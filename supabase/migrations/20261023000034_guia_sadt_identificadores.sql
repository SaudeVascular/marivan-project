-- Identificadores que a guia SP/SADT (padrão TISS/ANS) pede e que não
-- tinham onde ficar — antes eram digitados a cada guia (e o CBO/ANS
-- lembrados só no navegador de quem digitou):
--   * pacientes.cns         → campo 11 (Cartão Nacional de Saúde)
--   * convenios.registro_ans → campo 1 (Registro ANS da operadora)
--   * perfis.cbo            → campo 19 (Código CBO do solicitante)
--
-- Só dígitos, no tamanho oficial de cada um; NULL quando não informado.

BEGIN;

ALTER TABLE public.pacientes ADD COLUMN IF NOT EXISTS cns TEXT;
ALTER TABLE public.convenios ADD COLUMN IF NOT EXISTS registro_ans TEXT;
ALTER TABLE public.perfis ADD COLUMN IF NOT EXISTS cbo TEXT;

ALTER TABLE public.pacientes DROP CONSTRAINT IF EXISTS pacientes_cns_formato;
ALTER TABLE public.pacientes ADD CONSTRAINT pacientes_cns_formato
  CHECK (cns IS NULL OR cns ~ '^[0-9]{15}$');
ALTER TABLE public.convenios DROP CONSTRAINT IF EXISTS convenios_registro_ans_formato;
ALTER TABLE public.convenios ADD CONSTRAINT convenios_registro_ans_formato
  CHECK (registro_ans IS NULL OR registro_ans ~ '^[0-9]{6}$');
ALTER TABLE public.perfis DROP CONSTRAINT IF EXISTS perfis_cbo_formato;
ALTER TABLE public.perfis ADD CONSTRAINT perfis_cbo_formato
  CHECK (cbo IS NULL OR cbo ~ '^[0-9]{6}$');

COMMENT ON COLUMN public.pacientes.cns IS 'Cartão Nacional de Saúde (15 dígitos), campo 11 da guia SP/SADT.';
COMMENT ON COLUMN public.convenios.registro_ans IS 'Registro da operadora na ANS (6 dígitos), campo 1 da guia SP/SADT.';
COMMENT ON COLUMN public.perfis.cbo IS 'Código CBO do profissional (6 dígitos), campo 19 da guia SP/SADT.';

-- Mesma view da migração 30 (máscara clínica por papel clínico, não
-- por função — Administrador sem papel clínico não vê antecedentes),
-- acrescentando no fim (CREATE OR REPLACE VIEW só aceita colunas novas
-- depois das existentes) o CNS e o Registro ANS do convênio — dado
-- administrativo, sem máscara.
CREATE OR REPLACE VIEW public.pacientes_view
WITH (security_barrier = true, security_invoker = false) AS
SELECT
  p.id, p.nome, p.cpf, p.nascimento, p.nome_mae, p.telefone,
  p.convenio_id, c.nome AS convenio_nome, p.cep, p.endereco,
  p.ativo, p.created_by, p.created_at, p.updated_at,
  CASE WHEN public.current_user_papel_clinico() IS NOT NULL THEN p.alergias END AS alergias,
  CASE WHEN public.current_user_papel_clinico() IS NOT NULL THEN p.has END AS has,
  CASE WHEN public.current_user_papel_clinico() IS NOT NULL THEN p.dm END AS dm,
  CASE WHEN public.current_user_papel_clinico() IS NOT NULL THEN p.dac END AS dac,
  CASE WHEN public.current_user_papel_clinico() IS NOT NULL THEN p.dislipidemia END AS dislipidemia,
  CASE WHEN public.current_user_papel_clinico() IS NOT NULL THEN p.tabagismo END AS tabagismo,
  CASE WHEN public.current_user_papel_clinico() IS NOT NULL THEN p.etilismo END AS etilismo,
  CASE WHEN public.current_user_papel_clinico() IS NOT NULL THEN p.cirurgias END AS cirurgias,
  CASE WHEN public.current_user_papel_clinico() IS NOT NULL THEN p.medicamentos_uso END AS medicamentos_uso,
  CASE WHEN public.current_user_papel_clinico() IS NOT NULL THEN p.outras_comorbidades END AS outras_comorbidades,
  p.numero,
  p.complemento,
  p.cns,
  c.registro_ans AS convenio_registro_ans
FROM public.pacientes p
LEFT JOIN public.convenios c ON c.id = p.convenio_id
WHERE public.current_user_ativo();

REVOKE ALL ON public.pacientes_view FROM anon;
GRANT SELECT ON public.pacientes_view TO authenticated;

-- Mesma view da migração 31, acrescentando o CBO no fim — visível como
-- CRM/UF (é público no conselho, sai impresso na guia).
CREATE OR REPLACE VIEW public.perfis_view
WITH (security_barrier = true, security_invoker = false) AS
SELECT
  p.id,
  p.nome,
  CASE WHEN p.id = auth.uid() OR public.current_user_funcao() = 'Administrador'
       THEN p.email END AS email,
  p.funcao,
  p.crm,
  p.uf,
  p.especialidade,
  p.area_atuacao,
  p.ativo,
  p.created_at,
  CASE WHEN p.id = auth.uid() OR public.current_user_funcao() = 'Administrador'
       THEN p.cpf END AS cpf,
  CASE WHEN p.id = auth.uid() OR public.current_user_funcao() = 'Administrador'
       THEN p.nascimento END AS nascimento,
  CASE WHEN p.id = auth.uid() OR public.current_user_funcao() = 'Administrador'
       THEN p.sexo END AS sexo,
  p.papel_clinico_administrador,
  CASE WHEN p.id = auth.uid() THEN p.assinatura_imagem END AS assinatura_imagem,
  p.cbo
FROM public.perfis p
WHERE
  p.id = auth.uid()
  OR public.current_user_funcao() = 'Administrador'
  OR (public.current_user_ativo() AND p.ativo);

REVOKE ALL ON public.perfis_view FROM anon;
GRANT SELECT ON public.perfis_view TO authenticated;

COMMIT;
