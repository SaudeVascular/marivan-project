-- Somente banco descartável: fixtures e verificações são revertidas no final.
-- Psicólogo(a) e Fisioterapeuta (migração 35): acesso clínico como
-- Enfermeiro(a), mas emitem Atestado; Receituário/Prescrição só Médico.
-- Migração 39: cada profissão não médica só registra a própria lista.
BEGIN;
-- Simula a passagem pelas funções de leitura auditada (migração 48); o
-- bloqueio da leitura direta é testado em leitura_auditada.sql.
SELECT set_config('pep.leitura_clinica', 'sim', true);
CREATE FUNCTION pg_temp.assert_ok(ok BOOLEAN, mensagem TEXT) RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN IF ok IS DISTINCT FROM true THEN RAISE EXCEPTION 'FALHOU: %', mensagem; END IF; END;
$$;

CREATE TEMP TABLE atores(id UUID, funcao TEXT, sigla TEXT);
INSERT INTO atores VALUES
 ('e3000000-0000-4000-8000-000000000001', 'Médico', 'CRM'),
 ('e3000000-0000-4000-8000-000000000002', 'Enfermeiro(a)', 'COREN'),
 ('e3000000-0000-4000-8000-000000000003', 'Psicólogo(a)', 'CRP'),
 ('e3000000-0000-4000-8000-000000000004', 'Fisioterapeuta', 'CREFITO');
CREATE TEMP TABLE esperado(funcao TEXT, tipo TEXT, permitido BOOLEAN);
INSERT INTO esperado VALUES
 ('Médico', 'Consulta', true), ('Médico', 'Atestado', true), ('Médico', 'Receituário', true), ('Médico', 'Prescrição', true),
 ('Médico', 'Relatório', true), ('Médico', 'Pedido de Exames', true), ('Médico', 'Laudo', true), ('Médico', 'Sinais Vitais', true),
 -- Migração 39: listas do que cada profissão não médica PODE registrar.
 ('Enfermeiro(a)', 'Consulta', true), ('Enfermeiro(a)', 'Evolução de Enfermagem', true), ('Enfermeiro(a)', 'Sinais Vitais', true),
 ('Enfermeiro(a)', 'Atestado', false), ('Enfermeiro(a)', 'Receituário', false), ('Enfermeiro(a)', 'Prescrição', false),
 ('Enfermeiro(a)', 'Relatório', false), ('Enfermeiro(a)', 'Pedido de Exames', false), ('Enfermeiro(a)', 'Laudo', false),
 ('Psicólogo(a)', 'Consulta', true), ('Psicólogo(a)', 'Atestado', true), ('Psicólogo(a)', 'Relatório', true),
 ('Psicólogo(a)', 'Receituário', false), ('Psicólogo(a)', 'Prescrição', false), ('Psicólogo(a)', 'Pedido de Exames', false),
 ('Psicólogo(a)', 'Laudo', false), ('Psicólogo(a)', 'Sinais Vitais', false), ('Psicólogo(a)', 'Evolução de Enfermagem', false),
 ('Fisioterapeuta', 'Consulta', true), ('Fisioterapeuta', 'Atestado', true), ('Fisioterapeuta', 'Relatório', true),
 ('Fisioterapeuta', 'Receituário', false), ('Fisioterapeuta', 'Prescrição', false), ('Fisioterapeuta', 'Pedido de Exames', false),
 ('Fisioterapeuta', 'Laudo', false), ('Fisioterapeuta', 'Sinais Vitais', false), ('Fisioterapeuta', 'Evolução de Enfermagem', false);
GRANT SELECT ON atores, esperado TO authenticated;

INSERT INTO auth.users (id, email) SELECT id, id::TEXT || '@example.invalid' FROM atores;
SET LOCAL session_replication_role = replica;
UPDATE public.perfis p SET ativo = true, funcao = a.funcao, nome = 'Profissional fictício', crm = '789', uf = 'BA'
  FROM atores a WHERE p.id = a.id;
SET LOCAL session_replication_role = origin;
INSERT INTO public.pacientes (id, nome, alergias) VALUES ('e3000000-0000-4000-8000-000000000010', 'Paciente fictício', 'Dipirona');

SET LOCAL ROLE authenticated;
DO $$
DECLARE
  a RECORD; e RECORD; r JSONB; aceito BOOLEAN;
  paciente UUID := 'e3000000-0000-4000-8000-000000000010';
BEGIN
  FOR a IN SELECT * FROM atores LOOP
    PERFORM set_config('request.jwt.claim.sub', a.id::TEXT, true);
    PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
    PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', a.id, 'role', 'authenticated')::TEXT, true);

    PERFORM pg_temp.assert_ok(public.current_user_papel_clinico() = a.funcao, 'papel clínico efetivo: ' || a.funcao);
    PERFORM pg_temp.assert_ok((SELECT alergias FROM public.pacientes_view WHERE id = paciente) = 'Dipirona', 'vê dados clínicos: ' || a.funcao);

    FOR e IN SELECT * FROM esperado WHERE funcao = a.funcao LOOP
      BEGIN
        r := public.salvar_registro_clinico(gen_random_uuid(), 'criar', paciente, NULL, NULL,
          jsonb_build_object('tipo', e.tipo, 'conteudo', 'Fictício', 'status', 'Assinado'));
        aceito := true;
        PERFORM pg_temp.assert_ok(r->>'assinado_por_registro' = a.sigla || ' 789/BA', 'sigla do conselho na assinatura: ' || a.funcao);
      EXCEPTION WHEN OTHERS THEN
        IF SQLERRM LIKE 'FALHOU:%' THEN RAISE; END IF;
        aceito := false;
      END;
      PERFORM pg_temp.assert_ok(aceito = e.permitido, format('%s registrar %s', a.funcao, e.tipo));
    END LOOP;
  END LOOP;
END;
$$;
RESET ROLE;
ROLLBACK;
SELECT 'OK: psicólogo e fisioterapeuta — acesso clínico, tipos de registro e sigla do conselho';
