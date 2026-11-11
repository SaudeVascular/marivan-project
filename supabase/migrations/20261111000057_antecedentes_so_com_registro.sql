-- Antecedentes do paciente só com registro de acesso (pendência do
-- Documento Mestre, 11/11/2026).
--
-- Desde a migração 48, registros clínicos só são entregues pelas funções
-- que registram o acesso antes. Os antecedentes do cadastro (alergias,
-- comorbidades, medicamentos em uso, cirurgias...) continuavam vindo em
-- qualquer leitura de pacientes_view por perfil clínico — inclusive na
-- busca de pacientes e nas listas da agenda, sem deixar rastro.
--
--   1. pacientes_view só mostra os antecedentes dentro de uma leitura
--      registrada (pep.leitura_clinica = 'sim', que só as funções ligam),
--      além de exigir papel clínico como antes. Fora disso vêm vazios.
--   2. ler_paciente_clinico(paciente) registra "ver_antecedentes" e devolve
--      o paciente com os antecedentes — é o que prontuário, documentos e
--      enfermagem usam.
BEGIN;

ALTER TABLE public.acessos DROP CONSTRAINT IF EXISTS acessos_acao_check;
ALTER TABLE public.acessos ADD CONSTRAINT acessos_acao_check CHECK (acao = ANY (ARRAY[
  'abrir_prontuario', 'abrir_registro', 'imprimir_documento', 'exportar_prontuario', 'exportar_clinica',
  'ver_antecedentes']));

CREATE OR REPLACE FUNCTION privado.leitura_clinica_liberada()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
AS $$
  SELECT public.current_user_papel_clinico() IS NOT NULL
     AND COALESCE(current_setting('pep.leitura_clinica', true), '') = 'sim';
$$;
GRANT EXECUTE ON FUNCTION privado.leitura_clinica_liberada() TO authenticated;

-- Mesma view da migração 37; só muda a condição dos antecedentes.
CREATE OR REPLACE VIEW public.pacientes_view
WITH (security_barrier = true, security_invoker = false) AS
SELECT
  p.id, p.nome, p.cpf, p.nascimento, p.nome_mae, p.telefone,
  p.convenio_id, c.nome AS convenio_nome, p.cep, p.endereco,
  p.ativo, p.created_by, p.created_at, p.updated_at,
  CASE WHEN privado.leitura_clinica_liberada() THEN p.alergias END AS alergias,
  CASE WHEN privado.leitura_clinica_liberada() THEN p.has END AS has,
  CASE WHEN privado.leitura_clinica_liberada() THEN p.dm END AS dm,
  CASE WHEN privado.leitura_clinica_liberada() THEN p.dac END AS dac,
  CASE WHEN privado.leitura_clinica_liberada() THEN p.dislipidemia END AS dislipidemia,
  CASE WHEN privado.leitura_clinica_liberada() THEN p.tabagismo END AS tabagismo,
  CASE WHEN privado.leitura_clinica_liberada() THEN p.etilismo END AS etilismo,
  CASE WHEN privado.leitura_clinica_liberada() THEN p.cirurgias END AS cirurgias,
  CASE WHEN privado.leitura_clinica_liberada() THEN p.medicamentos_uso END AS medicamentos_uso,
  CASE WHEN privado.leitura_clinica_liberada() THEN p.outras_comorbidades END AS outras_comorbidades,
  p.numero,
  p.complemento,
  p.cns,
  c.registro_ans AS convenio_registro_ans,
  p.versao_cadastro,
  p.versao_clinica
FROM public.pacientes p
LEFT JOIN public.convenios c ON c.id = p.convenio_id
WHERE public.current_user_ativo();

REVOKE ALL ON public.pacientes_view FROM anon;
GRANT SELECT ON public.pacientes_view TO authenticated;

CREATE OR REPLACE FUNCTION public.ler_paciente_clinico(p_paciente_id UUID)
RETURNS SETOF public.pacientes_view
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF public.current_user_papel_clinico() IS NULL THEN
    RAISE EXCEPTION 'Sem acesso clínico' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.pacientes_view v WHERE v.id = p_paciente_id) THEN
    RETURN; -- sem linha: o app trata como "não encontrado"
  END IF;
  PERFORM privado.registrar_acesso_interno(p_paciente_id, 'ver_antecedentes', NULL, NULL);
  PERFORM set_config('pep.leitura_clinica', 'sim', true);
  RETURN QUERY SELECT * FROM public.pacientes_view v WHERE v.id = p_paciente_id;
  PERFORM set_config('pep.leitura_clinica', '', true);
END;
$$;
REVOKE ALL ON FUNCTION public.ler_paciente_clinico(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ler_paciente_clinico(UUID) TO authenticated;

COMMIT;
