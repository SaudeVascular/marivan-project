-- Somente banco descartável: fixtures e verificações são revertidas no final.
-- Migração 44: assinar exige nome, número do conselho e UF; rascunho não.
-- Chama a RPC direto, como faria qualquer cliente da API.
BEGIN;
-- Simula a passagem pelas funções de leitura auditada (migração 48); o
-- bloqueio da leitura direta é testado em leitura_auditada.sql.
SELECT set_config('pep.leitura_clinica', 'sim', true);
INSERT INTO auth.users (id, email) VALUES ('e9000000-0000-4000-8000-000000000001', 'medico-identidade@example.invalid');
SET LOCAL session_replication_role = replica;
UPDATE public.perfis SET ativo = true, funcao = 'Médico', nome = 'Médica fictícia', crm = '', uf = ''
 WHERE id = 'e9000000-0000-4000-8000-000000000001';
SET LOCAL session_replication_role = origin;
INSERT INTO public.pacientes (id, nome) VALUES ('e9000000-0000-4000-8000-000000000010', 'Paciente identidade');

CREATE FUNCTION pg_temp.assert_ok(ok BOOLEAN, mensagem TEXT) RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN IF ok IS DISTINCT FROM true THEN RAISE EXCEPTION 'FALHOU: %', mensagem; END IF; END;
$$;
CREATE FUNCTION pg_temp.erro(comando TEXT) RETURNS TEXT LANGUAGE plpgsql AS $$
BEGIN EXECUTE comando; RETURN 'ok';
EXCEPTION WHEN OTHERS THEN RETURN SQLSTATE;
END;
$$;
-- Ajuste do perfil como dono do banco, sem sair do papel testado.
CREATE FUNCTION pg_temp.perfil(p_crm TEXT, p_uf TEXT, p_nome TEXT DEFAULT 'Médica fictícia') RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  SET LOCAL session_replication_role = replica;
  UPDATE public.perfis SET crm = p_crm, uf = p_uf, nome = p_nome WHERE id = 'e9000000-0000-4000-8000-000000000001';
  SET LOCAL session_replication_role = origin;
END;
$$;
GRANT EXECUTE ON FUNCTION pg_temp.perfil(TEXT, TEXT, TEXT) TO authenticated;

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', 'e9000000-0000-4000-8000-000000000001', true);
SELECT set_config('request.jwt.claim.role', 'authenticated', true);
SELECT set_config('request.jwt.claims', '{"sub":"e9000000-0000-4000-8000-000000000001","role":"authenticated"}', true);

DO $$
DECLARE
  pac UUID := 'e9000000-0000-4000-8000-000000000010';
  atestado JSONB := '{"tipo":"Atestado","titulo":"Atestado","conteudo":"Texto fictício","status":"Assinado"}';
  rascunho JSONB := '{"tipo":"Consulta","titulo":"Consulta","conteudo":"Rascunho","status":"Rascunho"}';
  r JSONB;
BEGIN
  PERFORM pg_temp.assert_ok(pg_temp.erro(format('SELECT public.salvar_registro_clinico(%L, %L, %L, NULL, NULL, %L)',
    gen_random_uuid(), 'criar', pac, atestado)) = '23514', 'sem número do conselho: atestado assinado recusado');

  r := public.salvar_registro_clinico(gen_random_uuid(), 'criar', pac, NULL, NULL, rascunho);
  PERFORM pg_temp.assert_ok(r->>'status' = 'Rascunho', 'rascunho incompleto pode ser salvo');
  PERFORM pg_temp.assert_ok(pg_temp.erro(format('SELECT public.salvar_registro_clinico(%L, %L, %L, %L, %s, %L)',
    gen_random_uuid(), 'assinar', pac, r->>'id', (r->>'versao')::INT, '{"conteudo":"Rascunho"}')) = '23514',
    'finalizar o rascunho sem identidade completa é recusado');

  PERFORM pg_temp.perfil('123', '');
  PERFORM pg_temp.assert_ok(pg_temp.erro(format('SELECT public.salvar_registro_clinico(%L, %L, %L, NULL, NULL, %L)',
    gen_random_uuid(), 'criar', pac, atestado)) = '23514', 'sem UF: recusado');
  PERFORM pg_temp.perfil('123', 'XX');
  PERFORM pg_temp.assert_ok(pg_temp.erro(format('SELECT public.salvar_registro_clinico(%L, %L, %L, NULL, NULL, %L)',
    gen_random_uuid(), 'criar', pac, atestado)) = '23514', 'UF inexistente: recusado');
  PERFORM pg_temp.perfil('123; DROP', 'BA');
  PERFORM pg_temp.assert_ok(pg_temp.erro(format('SELECT public.salvar_registro_clinico(%L, %L, %L, NULL, NULL, %L)',
    gen_random_uuid(), 'criar', pac, atestado)) = '23514', 'número com caracteres inválidos: recusado');
  PERFORM pg_temp.perfil('123', 'BA', 'Ab');
  PERFORM pg_temp.assert_ok(pg_temp.erro(format('SELECT public.salvar_registro_clinico(%L, %L, %L, NULL, NULL, %L)',
    gen_random_uuid(), 'criar', pac, atestado)) = '23514', 'nome curto demais: recusado');

  PERFORM pg_temp.perfil('123', 'ba');
  r := public.salvar_registro_clinico(gen_random_uuid(), 'criar', pac, NULL, NULL, atestado);
  PERFORM pg_temp.assert_ok(r->>'status' = 'Assinado', 'identidade completa assina');
  PERFORM pg_temp.assert_ok((SELECT assinado_por_nome = 'Médica fictícia' AND assinado_por_registro = 'CRM 123/ba'
    FROM public.consultas WHERE id = (r->>'id')::UUID), 'registro guarda a identidade validada no momento da assinatura');

  PERFORM pg_temp.perfil('', '');
  PERFORM pg_temp.assert_ok((SELECT assinado_por_registro = 'CRM 123/ba' FROM public.consultas WHERE id = (r->>'id')::UUID),
    'mudar o perfil depois não altera a identidade já gravada');
END;
$$;
RESET ROLE;
ROLLBACK;
