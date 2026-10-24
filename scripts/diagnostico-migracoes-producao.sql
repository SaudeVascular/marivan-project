-- Diagnóstico SOMENTE-LEITURA: quais migrações já estão de fato no banco,
-- para quem não tem supabase_migrations.schema_migrations (produção sem
-- histórico). Cada linha procura um objeto que só aquela migração cria.
-- Não lê dados de pacientes — apenas metadados do schema e contagens.
WITH f AS (
  SELECT
    (SELECT pg_get_functiondef(p.oid) FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.proname = 'proteger_dados_clinicos_paciente' LIMIT 1) AS pacientes_fn,
    (SELECT pg_get_functiondef(p.oid) FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.proname = 'proteger_campos_seguranca_perfil' LIMIT 1) AS perfil_fn
),
col AS (
  SELECT table_name || '.' || column_name AS c FROM information_schema.columns WHERE table_schema = 'public'
)
SELECT marcador, presente FROM (VALUES
  ('01 tabela pacientes',                 to_regclass('public.pacientes') IS NOT NULL),
  ('12 tabela convenios',                 to_regclass('public.convenios') IS NOT NULL),
  ('14 pacientes_view',                   to_regclass('public.pacientes_view') IS NOT NULL),
  ('15 perfis_view',                      to_regclass('public.perfis_view') IS NOT NULL),
  ('17 configuracoes_clinica',            to_regclass('public.configuracoes_clinica') IS NOT NULL),
  ('20 filiais',                          to_regclass('public.filiais') IS NOT NULL),
  ('22 P0: alergias fora do authenticated', NOT has_column_privilege('authenticated', 'public.pacientes', 'alergias', 'SELECT')),
  ('23 hotfix recepção',                  coalesce(position('NEW.alergias := OLD.alergias' IN (SELECT pacientes_fn FROM f)) > 0, false)),
  ('24/25 função proteger_campos_seguranca_perfil', (SELECT perfil_fn FROM f) IS NOT NULL),
  ('24 (exceção service_role ainda presente => 25 faltando)', coalesce(position('service_role' IN (SELECT perfil_fn FROM f)) > 0, false)),
  ('26 pacientes.outras_comorbidades',    EXISTS (SELECT 1 FROM col WHERE c = 'pacientes.outras_comorbidades')),
  ('27 pacientes.numero',                 EXISTS (SELECT 1 FROM col WHERE c = 'pacientes.numero')),
  ('28 operacoes_registro',               to_regclass('public.operacoes_registro') IS NOT NULL),
  ('30 perfis.papel_clinico_administrador', EXISTS (SELECT 1 FROM col WHERE c = 'perfis.papel_clinico_administrador')),
  ('31 perfis.assinatura_imagem',         EXISTS (SELECT 1 FROM col WHERE c = 'perfis.assinatura_imagem')),
  ('32 tabela exames',                    to_regclass('public.exames') IS NOT NULL),
  ('34 pacientes.cns',                    EXISTS (SELECT 1 FROM col WHERE c = 'pacientes.cns')),
  ('35 perfis.rqe',                       EXISTS (SELECT 1 FROM col WHERE c = 'perfis.rqe'))
) AS t(marcador, presente);

-- Volume (só contagens), para saber se há dados reais em jogo.
SELECT
  (SELECT count(*) FROM public.pacientes) AS pacientes,
  (SELECT count(*) FROM public.consultas) AS consultas,
  (SELECT count(*) FROM public.perfis)    AS perfis;
