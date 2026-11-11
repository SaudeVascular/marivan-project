-- Somente banco descartável: fixtures e verificações são revertidas no final.
-- Migração 36: a auditoria não pode ser um atalho para dados clínicos nem
-- para a assinatura de outro profissional. Reproduz o desvio original
-- (Administrador sem papel clínico lendo conteúdo de consulta e imagem
-- de assinatura pela auditoria) e garante que ele não volte.
BEGIN;
-- Simula a passagem pelas funções de leitura auditada (migração 48); o
-- bloqueio da leitura direta é testado em leitura_auditada.sql.
SELECT set_config('pep.leitura_clinica', 'sim', true);
CREATE FUNCTION pg_temp.assert_ok(ok BOOLEAN, mensagem TEXT) RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN IF ok IS DISTINCT FROM true THEN RAISE EXCEPTION 'FALHOU: %', mensagem; END IF; END;
$$;

CREATE TEMP TABLE atores(id UUID, funcao TEXT, papel_clinico TEXT, ve_auditoria BOOLEAN, clinico BOOLEAN);
INSERT INTO atores VALUES
 ('e4000000-0000-4000-8000-000000000001', 'Médico',        NULL,     false, true),
 ('e4000000-0000-4000-8000-000000000002', 'Administrador', NULL,     true,  false),
 ('e4000000-0000-4000-8000-000000000003', 'Administrador', 'Médico', true,  true),
 ('e4000000-0000-4000-8000-000000000004', 'Recepcionista', NULL,     false, false),
 ('e4000000-0000-4000-8000-000000000005', 'Psicólogo(a)',  NULL,     false, true);
GRANT SELECT ON atores TO authenticated;

INSERT INTO auth.users (id, email) SELECT id, id::TEXT || '@example.invalid' FROM atores;
SET LOCAL session_replication_role = replica;
UPDATE public.perfis p SET ativo = true, funcao = a.funcao, nome = 'Fictício auditoria', crm = '1', uf = 'BA',
  papel_clinico_administrador = a.papel_clinico
  FROM atores a WHERE p.id = a.id;
SET LOCAL session_replication_role = origin;

-- Gravações reais pelas triggers de auditoria.
UPDATE public.perfis SET assinatura_imagem = 'data:image/png;base64,ASSINATURA_SECRETA'
  WHERE id = 'e4000000-0000-4000-8000-000000000001';
INSERT INTO public.pacientes (id, nome, alergias) VALUES
 ('e4000000-0000-4000-8000-000000000010', 'Paciente fictício auditoria', 'ALERGIA_SECRETA');
INSERT INTO public.consultas (id, paciente_id, tipo, conteudo, status, created_by) VALUES
 ('e4000000-0000-4000-8000-000000000010', 'e4000000-0000-4000-8000-000000000010', 'Consulta', 'CONTEUDO_SECRETO_1', 'Rascunho',
  'e4000000-0000-4000-8000-000000000001');
UPDATE public.consultas SET conteudo = 'CONTEUDO_SECRETO_2' WHERE id = 'e4000000-0000-4000-8000-000000000010';
INSERT INTO public.medicamentos_receita (id, consulta_id, nome, dose) VALUES
 ('e4000000-0000-4000-8000-000000000010', 'e4000000-0000-4000-8000-000000000010', 'REMEDIO_SECRETO', '1 cp');

SET LOCAL ROLE authenticated;
DO $$
DECLARE
  a RECORD; vazou BOOLEAN; texto TEXT; base_ok BOOLEAN;
  consulta UUID := 'e4000000-0000-4000-8000-000000000010';
BEGIN
  FOR a IN SELECT * FROM atores LOOP
    PERFORM set_config('request.jwt.claim.sub', a.id::TEXT, true);
    PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
    PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', a.id, 'role', 'authenticated')::TEXT, true);

    -- Tabela base fechada para todos.
    BEGIN
      PERFORM 1 FROM public.auditoria LIMIT 1;
      base_ok := true;
    EXCEPTION WHEN insufficient_privilege THEN base_ok := false;
    END;
    PERFORM pg_temp.assert_ok(NOT base_ok, 'auditoria base sem SELECT: ' || a.funcao);

    PERFORM pg_temp.assert_ok(
      EXISTS (SELECT 1 FROM public.auditoria_view WHERE tabela = 'consultas' AND registro_id = consulta) = a.ve_auditoria,
      'auditoria_view só para Administrador: ' || a.funcao || '/' || COALESCE(a.papel_clinico, '-'));

    IF a.ve_auditoria THEN
      SELECT string_agg(COALESCE(dados_antigos::TEXT, '') || COALESCE(dados_novos::TEXT, ''), ' ') INTO texto
        FROM public.auditoria_view WHERE alterado_em >= now() - interval '1 hour';

      -- Assinatura de outro profissional: nunca, nem com papel clínico.
      PERFORM pg_temp.assert_ok(position('ASSINATURA_SECRETA' IN texto) = 0, 'assinatura nunca exposta: ' || COALESCE(a.papel_clinico, 'sem papel'));

      vazou := position('CONTEUDO_SECRETO' IN texto) > 0 OR position('ALERGIA_SECRETA' IN texto) > 0
        OR position('REMEDIO_SECRETO' IN texto) > 0;
      PERFORM pg_temp.assert_ok(vazou = a.clinico, 'conteúdo clínico só com papel clínico: ' || COALESCE(a.papel_clinico, 'sem papel'));

      -- Metadados continuam visíveis; mudança aparece sem o conteúdo.
      PERFORM pg_temp.assert_ok(EXISTS (
        SELECT 1 FROM public.auditoria_view WHERE tabela = 'consultas' AND registro_id = consulta
          AND operacao = 'UPDATE' AND dados_novos->>'tipo' = 'Consulta'
          AND dados_novos->>'conteudo' = CASE WHEN a.clinico THEN 'CONTEUDO_SECRETO_2' ELSE '[restrito — alterado]' END
      ), 'UPDATE mostra o que mudou: ' || COALESCE(a.papel_clinico, 'sem papel'));
      PERFORM pg_temp.assert_ok(EXISTS (
        SELECT 1 FROM public.auditoria_view WHERE tabela = 'perfis' AND registro_id = 'e4000000-0000-4000-8000-000000000001'
          AND dados_novos->>'assinatura_imagem' = '[restrito — alterado]'
      ), 'troca de assinatura registrada sem a imagem');
      PERFORM pg_temp.assert_ok(EXISTS (
        SELECT 1 FROM public.auditoria_view WHERE tabela = 'pacientes' AND registro_id = consulta
          AND dados_novos->>'nome' = 'Paciente fictício auditoria'
      ), 'dados cadastrais do paciente seguem visíveis');
    END IF;
  END LOOP;
END;
$$;
RESET ROLE;

-- A gravação continua íntegra: a máscara é só na leitura.
SELECT pg_temp.assert_ok(
  (SELECT dados_novos->>'conteudo' FROM public.auditoria
    WHERE tabela = 'consultas' AND registro_id = 'e4000000-0000-4000-8000-000000000010' AND operacao = 'UPDATE') = 'CONTEUDO_SECRETO_2',
  'linha original da auditoria preservada');
ROLLBACK;
