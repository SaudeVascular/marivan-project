-- Somente banco descartável: fixtures e verificações são revertidas no final.
BEGIN;
INSERT INTO auth.users (id, email) VALUES
 ('e2000000-0000-4000-8000-000000000001', 'medico-estabilidade@example.invalid'),
 ('e2000000-0000-4000-8000-000000000002', 'outro-estabilidade@example.invalid'),
 ('e2000000-0000-4000-8000-000000000003', 'enfermagem-estabilidade@example.invalid'),
 ('e2000000-0000-4000-8000-000000000004', 'recepcao-estabilidade@example.invalid'),
 ('e2000000-0000-4000-8000-000000000005', 'inativo-estabilidade@example.invalid');
-- Preparação privilegiada das fixtures, sem alterar as proteções em teste.
SET LOCAL session_replication_role = replica;
UPDATE public.perfis SET ativo = true, funcao = CASE id
 WHEN 'e2000000-0000-4000-8000-000000000003' THEN 'Enfermeiro(a)'
 WHEN 'e2000000-0000-4000-8000-000000000004' THEN 'Recepcionista'
 ELSE 'Médico' END, nome = 'Profissional fictício', crm = '123', uf = 'BA'
 WHERE id::TEXT LIKE 'e2000000-%';
UPDATE public.perfis SET ativo = false WHERE id = 'e2000000-0000-4000-8000-000000000005';
SET LOCAL session_replication_role = origin;
INSERT INTO public.pacientes (id, nome) VALUES ('e2000000-0000-4000-8000-000000000010', 'Paciente fictício');

CREATE FUNCTION pg_temp.assert_ok(ok BOOLEAN, mensagem TEXT) RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN IF ok IS DISTINCT FROM true THEN RAISE EXCEPTION 'FALHOU: %', mensagem; END IF; END;
$$;

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', 'e2000000-0000-4000-8000-000000000001', true);
SELECT set_config('request.jwt.claim.role', 'authenticated', true);
SELECT set_config('request.jwt.claims', '{"sub":"e2000000-0000-4000-8000-000000000001","role":"authenticated"}', true);

DO $$
DECLARE
  paciente UUID := 'e2000000-0000-4000-8000-000000000010';
  op UUID := gen_random_uuid();
  op_edicao UUID := gen_random_uuid();
  op_assinatura UUID := gen_random_uuid();
  op_retificar UUID := gen_random_uuid();
  dados JSONB := '{"tipo":"Consulta","titulo":"Teste","conteudo":"Texto inicial","status":"Rascunho"}';
  r JSONB;
  assinado JSONB;
  retificado JSONB;
  registro_id UUID;
  bloqueou BOOLEAN;
  usuario UUID;
BEGIN
  r := public.salvar_registro_clinico(op, 'criar', paciente, NULL, NULL, dados);
  registro_id := (r->>'id')::UUID;
  PERFORM pg_temp.assert_ok(r->>'versao' = '1' AND r->>'created_by' = auth.uid()::TEXT, 'criação com autoria e versão');
  PERFORM pg_temp.assert_ok(public.salvar_registro_clinico(op, 'criar', paciente, NULL, NULL, dados) = r, 'resposta perdida retorna recibo idêntico');
  PERFORM pg_temp.assert_ok((SELECT count(*) = 1 FROM public.consultas WHERE paciente_id = paciente), 'repetição não duplica');

  bloqueou := false;
  BEGIN
    PERFORM public.salvar_registro_clinico(op, 'criar', paciente, NULL, NULL, dados || '{"conteudo":"outro"}');
  EXCEPTION WHEN SQLSTATE 'P4091' THEN bloqueou := true; END;
  PERFORM pg_temp.assert_ok(bloqueou, 'ID não pode ser reutilizado com outro conteúdo');

  r := public.salvar_registro_clinico(op_edicao, 'atualizar', paciente, registro_id, 1, '{"conteudo":"Edição 1"}');
  PERFORM pg_temp.assert_ok(r->>'versao' = '2', 'edição incrementa versão');
  bloqueou := false;
  BEGIN
    PERFORM public.salvar_registro_clinico(gen_random_uuid(), 'assinar', paciente, registro_id, 1, '{"conteudo":"Texto obsoleto"}');
  EXCEPTION WHEN SQLSTATE 'P4090' THEN bloqueou := true; END;
  PERFORM pg_temp.assert_ok(bloqueou, 'assinatura com versão antiga é rejeitada');
  PERFORM pg_temp.assert_ok((SELECT conteudo = 'Edição 1' AND status = 'Rascunho' AND versao = 2 FROM public.consultas WHERE consultas.id = registro_id), 'conflito não altera texto nem assina');

  assinado := public.salvar_registro_clinico(op_assinatura, 'assinar', paciente, registro_id, 2, '{"conteudo":"Texto definitivo"}');
  PERFORM pg_temp.assert_ok(assinado->>'conteudo' = 'Texto definitivo' AND assinado->>'status' = 'Assinado' AND assinado->>'versao' = '3' AND assinado->>'assinado_em' IS NOT NULL AND assinado->>'assinado_por_registro' = 'CRM 123/BA', 'texto e assinatura atômicos');
  PERFORM pg_temp.assert_ok(public.salvar_registro_clinico(op_assinatura, 'assinar', paciente, registro_id, 2, '{"conteudo":"Texto definitivo"}') = assinado, 'assinatura repetida não muda timestamp/versão');
  PERFORM pg_temp.assert_ok(public.salvar_registro_clinico(op_edicao, 'atualizar', paciente, registro_id, 1, '{"conteudo":"Edição 1"}') = r, 'recibo antigo não altera registro atual');

  bloqueou := false;
  BEGIN
    PERFORM public.salvar_registro_clinico(gen_random_uuid(), 'atualizar', paciente, registro_id, 3, '{"conteudo":"Alteração indevida"}');
  EXCEPTION WHEN SQLSTATE 'P4090' THEN bloqueou := true; END;
  PERFORM pg_temp.assert_ok(bloqueou, 'registro assinado continua imutável');

  dados := jsonb_build_object('tipo','Consulta','titulo','Retificação','conteudo','Correção','retificacao_de',registro_id,'motivo_retificacao','Correção de teste');
  retificado := public.salvar_registro_clinico(op_retificar, 'criar', paciente, NULL, NULL, dados);
  PERFORM pg_temp.assert_ok(retificado->>'retificacao_de' = registro_id::TEXT AND retificado->>'status' = 'Assinado', 'retificação vinculada ao original');
  PERFORM pg_temp.assert_ok(public.salvar_registro_clinico(op_retificar, 'criar', paciente, NULL, NULL, dados) = retificado, 'retificação idempotente');

  -- Dados clínicos e identidade não podem ser injetados fora da lista permitida.
  bloqueou := false;
  BEGIN
    PERFORM public.salvar_registro_clinico(gen_random_uuid(), 'criar', paciente, NULL, NULL, dados || '{"created_by":"e2000000-0000-4000-8000-000000000002"}');
  EXCEPTION WHEN invalid_parameter_value THEN bloqueou := true; END;
  PERFORM pg_temp.assert_ok(bloqueou, 'autoria fornecida pelo cliente é recusada');

  bloqueou := false;
  BEGIN INSERT INTO public.consultas (paciente_id, tipo) VALUES (paciente, 'Consulta');
  EXCEPTION WHEN insufficient_privilege THEN bloqueou := true; END;
  PERFORM pg_temp.assert_ok(bloqueou, 'cliente antigo não insere diretamente');
  bloqueou := false;
  BEGIN UPDATE public.consultas SET conteudo = 'bypass' WHERE consultas.id = registro_id;
  EXCEPTION WHEN insufficient_privilege THEN bloqueou := true; END;
  PERFORM pg_temp.assert_ok(bloqueou, 'cliente antigo não atualiza diretamente');
  bloqueou := false;
  BEGIN DELETE FROM public.consultas WHERE consultas.id = registro_id;
  EXCEPTION WHEN insufficient_privilege THEN bloqueou := true; END;
  PERFORM pg_temp.assert_ok(bloqueou, 'cliente não remove original ou recibo');
  bloqueou := false;
  BEGIN PERFORM * FROM public.operacoes_registro;
  EXCEPTION WHEN insufficient_privilege THEN bloqueou := true; END;
  PERFORM pg_temp.assert_ok(bloqueou, 'recibos clínicos não são expostos diretamente');

  -- Médico diferente não edita registro de colega, nem por SECURITY DEFINER.
  PERFORM set_config('request.jwt.claim.sub', 'e2000000-0000-4000-8000-000000000002', true);
  PERFORM set_config('request.jwt.claims', '{"sub":"e2000000-0000-4000-8000-000000000002","role":"authenticated"}', true);
  bloqueou := false;
  BEGIN PERFORM public.salvar_registro_clinico(gen_random_uuid(), 'atualizar', paciente, registro_id, 3, '{}');
  EXCEPTION WHEN insufficient_privilege THEN bloqueou := true; END;
  PERFORM pg_temp.assert_ok(bloqueou, 'colega não pode editar/assinar');

  PERFORM set_config('request.jwt.claim.sub', 'e2000000-0000-4000-8000-000000000003', true);
  PERFORM set_config('request.jwt.claims', '{"sub":"e2000000-0000-4000-8000-000000000003","role":"authenticated"}', true);
  bloqueou := false;
  BEGIN PERFORM public.salvar_registro_clinico(gen_random_uuid(), 'criar', paciente, NULL, NULL, '{"tipo":"Atestado","conteudo":"Vedado"}');
  EXCEPTION WHEN insufficient_privilege THEN bloqueou := true; END;
  PERFORM pg_temp.assert_ok(bloqueou, 'enfermagem não emite atestado');
  r := public.salvar_registro_clinico(gen_random_uuid(), 'criar', paciente, NULL, NULL, '{"tipo":"Evolução de Enfermagem","conteudo":"Cuidados"}');
  PERFORM pg_temp.assert_ok(r->>'assinado_por_registro' = 'COREN 123/BA', 'enfermagem mantém seus atos autorizados');

  FOREACH usuario IN ARRAY ARRAY['e2000000-0000-4000-8000-000000000004'::UUID, 'e2000000-0000-4000-8000-000000000005'::UUID] LOOP
    PERFORM set_config('request.jwt.claim.sub', usuario::TEXT, true);
    PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', usuario, 'role', 'authenticated')::TEXT, true);
    bloqueou := false;
    BEGIN PERFORM public.salvar_registro_clinico(gen_random_uuid(), 'criar', paciente, NULL, NULL, '{"tipo":"Consulta","conteudo":"Vedado"}');
    EXCEPTION WHEN insufficient_privilege THEN bloqueou := true; END;
    PERFORM pg_temp.assert_ok(bloqueou, 'recepção e inativo não gravam conteúdo clínico');
  END LOOP;
END;
$$;
RESET ROLE;
DO $$ BEGIN
  PERFORM pg_temp.assert_ok((SELECT count(*) = 5 FROM public.operacoes_registro WHERE autor_id::TEXT LIKE 'e2000000-%'), 'somente operações confirmadas produzem recibo');
  PERFORM pg_temp.assert_ok((SELECT count(*) = 5 FROM public.auditoria WHERE tabela = 'consultas' AND alterado_por::TEXT LIKE 'e2000000-%'), 'repetições e falhas não duplicam auditoria');
END; $$;
ROLLBACK;
SELECT 'OK: idempotência, versões, assinatura atômica, retificação, auditoria e permissões';
