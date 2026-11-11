-- Somente banco descartável: fixtures e verificações são revertidas no final.
-- Migração 46: retrato da emissão guardado na assinatura, imutável e com hash.
BEGIN;
-- Simula a passagem pelas funções de leitura auditada (migração 48); o
-- bloqueio da leitura direta é testado em leitura_auditada.sql.
SELECT set_config('pep.leitura_clinica', 'sim', true);
INSERT INTO auth.users (id, email) VALUES ('eb000000-0000-4000-8000-000000000001', 'medico-emissao@example.invalid');
SET LOCAL session_replication_role = replica;
UPDATE public.perfis SET ativo = true, funcao = 'Médico', nome = 'Médica fictícia', crm = '321', uf = 'BA',
  especialidade = 'Cardiologia', rqe = '999', assinatura_imagem = 'data:image/png;base64,QUFB'
 WHERE id = 'eb000000-0000-4000-8000-000000000001';
SET LOCAL session_replication_role = origin;
INSERT INTO public.pacientes (id, nome, cpf, nascimento, alergias, has)
 VALUES ('eb000000-0000-4000-8000-000000000010', 'Paciente Original', '529.982.247-25', '1980-05-20', 'Dipirona', 'Sim');
UPDATE public.configuracoes_clinica SET nome = 'Clínica Original', endereco = 'Rua Antiga, 1';

CREATE FUNCTION pg_temp.assert_ok(ok BOOLEAN, mensagem TEXT) RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN IF ok IS DISTINCT FROM true THEN RAISE EXCEPTION 'FALHOU: %', mensagem; END IF; END;
$$;

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', 'eb000000-0000-4000-8000-000000000001', true);
SELECT set_config('request.jwt.claim.role', 'authenticated', true);
SELECT set_config('request.jwt.claims', '{"sub":"eb000000-0000-4000-8000-000000000001","role":"authenticated"}', true);

DO $$
DECLARE
  pac UUID := 'eb000000-0000-4000-8000-000000000010';
  consulta JSONB; atestado JSONB; rascunho JSONB;
  c public.consultas%ROWTYPE;
BEGIN
  consulta := public.salvar_registro_clinico(gen_random_uuid(), 'criar', pac, NULL, NULL,
    '{"tipo":"Consulta","titulo":"Consulta","conteudo":"Anamnese fictícia","status":"Assinado"}');
  atestado := public.salvar_registro_clinico(gen_random_uuid(), 'criar', pac, NULL, NULL,
    '{"tipo":"Atestado","titulo":"Atestado","conteudo":"Atesto fictício","status":"Assinado"}');
  rascunho := public.salvar_registro_clinico(gen_random_uuid(), 'criar', pac, NULL, NULL,
    '{"tipo":"Consulta","titulo":"Consulta","conteudo":"Ainda escrevendo","status":"Rascunho"}');

  SELECT * INTO c FROM public.consultas WHERE id = (consulta->>'id')::UUID;
  PERFORM pg_temp.assert_ok(c.emissao->>'modelo' = '1', 'modelo versionado');
  PERFORM pg_temp.assert_ok(c.emissao->'paciente'->>'nome' = 'Paciente Original' AND c.emissao->'paciente'->>'cpf' = '529.982.247-25', 'paciente da emissão');
  PERFORM pg_temp.assert_ok((c.emissao->'paciente'->>'idade')::INT >= 46, 'idade na data da emissão');
  PERFORM pg_temp.assert_ok(c.emissao->'antecedentes'->>'alergias' = 'Dipirona' AND c.emissao->'antecedentes'->>'has' = 'Sim', 'antecedentes do atendimento');
  PERFORM pg_temp.assert_ok(c.emissao->'clinica'->>'nome' = 'Clínica Original', 'clínica da emissão');
  PERFORM pg_temp.assert_ok(c.emissao->'profissional'->>'especialidade' = 'Cardiologia' AND c.emissao->'profissional'->>'rqe' = '999', 'profissional da emissão');
  PERFORM pg_temp.assert_ok(position('QUFB' IN c.emissao::TEXT) = 0, 'a imagem da assinatura não é copiada');
  PERFORM pg_temp.assert_ok(c.emissao->>'emitido_em' ~ '^\d{4}-\d{2}-\d{2}T.*Z$', 'emitido_em em UTC');
  PERFORM pg_temp.assert_ok(c.emissao_hash = public.hash_emissao(c.tipo, c.titulo, c.conteudo, c.data, c.hora, c.assinado_em,
    c.assinado_por_nome, c.assinado_por_registro, c.emissao), 'hash confere com os dados guardados');
  PERFORM set_config('TimeZone', 'Asia/Tokyo', true);
  PERFORM pg_temp.assert_ok(c.emissao_hash = public.hash_emissao(c.tipo, c.titulo, c.conteudo, c.data, c.hora, c.assinado_em,
    c.assinado_por_nome, c.assinado_por_registro, c.emissao), 'hash não depende do fuso da sessão');
  PERFORM pg_temp.assert_ok(c.emissao_hash <> public.hash_emissao(c.tipo, c.titulo, c.conteudo || ' alterado', c.data, c.hora, c.assinado_em,
    c.assinado_por_nome, c.assinado_por_registro, c.emissao), 'texto alterado muda o hash');

  PERFORM pg_temp.assert_ok((SELECT emissao->'antecedentes' = 'null'::jsonb OR emissao->'antecedentes' IS NULL
    FROM public.consultas WHERE id = (atestado->>'id')::UUID), 'atestado não leva antecedentes');
  PERFORM pg_temp.assert_ok((SELECT emissao IS NULL AND emissao_hash IS NULL FROM public.consultas WHERE id = (rascunho->>'id')::UUID),
    'rascunho não tem emissão');
END;
$$;

-- Cadastro e clínica mudam depois: o retrato não muda.
RESET ROLE;
UPDATE public.pacientes SET nome = 'Paciente Renomeado', alergias = 'Nenhuma' WHERE id = 'eb000000-0000-4000-8000-000000000010';
UPDATE public.configuracoes_clinica SET nome = 'Clínica Nova';
DO $$
BEGIN
  PERFORM pg_temp.assert_ok((SELECT bool_and(emissao->'paciente'->>'nome' = 'Paciente Original' AND emissao->'clinica'->>'nome' = 'Clínica Original')
    FROM public.consultas WHERE paciente_id = 'eb000000-0000-4000-8000-000000000010' AND status = 'Assinado'),
    'mudanças posteriores no cadastro e na clínica não alteram o documento emitido');
  PERFORM pg_temp.assert_ok((SELECT emissao->'antecedentes'->>'alergias' FROM public.consultas
    WHERE paciente_id = 'eb000000-0000-4000-8000-000000000010' AND tipo = 'Consulta' AND status = 'Assinado') = 'Dipirona',
    'antecedentes da emissão preservados');
END;
$$;
SET LOCAL ROLE authenticated;
DO $$
DECLARE bloqueou BOOLEAN := false;
BEGIN
  BEGIN
    UPDATE public.consultas SET emissao = '{}'::jsonb WHERE paciente_id = 'eb000000-0000-4000-8000-000000000010' AND status = 'Assinado';
  EXCEPTION WHEN OTHERS THEN bloqueou := true;
  END;
  PERFORM pg_temp.assert_ok(bloqueou, 'retrato de registro assinado é imutável');
END;
$$;
RESET ROLE;
ROLLBACK;
