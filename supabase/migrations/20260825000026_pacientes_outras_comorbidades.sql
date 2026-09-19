-- Campo clínico livre para condições não cobertas pelas comorbidades
-- estruturadas. Recepção não pode ler nem alterar esse conteúdo.

BEGIN;

ALTER TABLE public.pacientes
  ADD COLUMN IF NOT EXISTS outras_comorbidades TEXT NOT NULL DEFAULT '';

CREATE OR REPLACE VIEW public.pacientes_view
WITH (security_barrier = true, security_invoker = false) AS
SELECT
  p.id, p.nome, p.cpf, p.nascimento, p.nome_mae, p.telefone,
  p.convenio_id, c.nome AS convenio_nome, p.cep, p.endereco,
  p.ativo, p.created_by, p.created_at, p.updated_at,
  CASE WHEN public.current_user_funcao() IN ('Médico', 'Enfermeiro(a)', 'Administrador')
       THEN p.alergias END AS alergias,
  CASE WHEN public.current_user_funcao() IN ('Médico', 'Enfermeiro(a)', 'Administrador')
       THEN p.has END AS has,
  CASE WHEN public.current_user_funcao() IN ('Médico', 'Enfermeiro(a)', 'Administrador')
       THEN p.dm END AS dm,
  CASE WHEN public.current_user_funcao() IN ('Médico', 'Enfermeiro(a)', 'Administrador')
       THEN p.dac END AS dac,
  CASE WHEN public.current_user_funcao() IN ('Médico', 'Enfermeiro(a)', 'Administrador')
       THEN p.dislipidemia END AS dislipidemia,
  CASE WHEN public.current_user_funcao() IN ('Médico', 'Enfermeiro(a)', 'Administrador')
       THEN p.tabagismo END AS tabagismo,
  CASE WHEN public.current_user_funcao() IN ('Médico', 'Enfermeiro(a)', 'Administrador')
       THEN p.etilismo END AS etilismo,
  CASE WHEN public.current_user_funcao() IN ('Médico', 'Enfermeiro(a)', 'Administrador')
       THEN p.cirurgias END AS cirurgias,
  CASE WHEN public.current_user_funcao() IN ('Médico', 'Enfermeiro(a)', 'Administrador')
       THEN p.medicamentos_uso END AS medicamentos_uso,
  CASE WHEN public.current_user_funcao() IN ('Médico', 'Enfermeiro(a)', 'Administrador')
       THEN p.outras_comorbidades END AS outras_comorbidades
FROM public.pacientes p
LEFT JOIN public.convenios c ON c.id = p.convenio_id
WHERE public.current_user_ativo();

REVOKE SELECT ON public.pacientes FROM anon, authenticated;
REVOKE ALL ON public.pacientes_view FROM anon;
GRANT SELECT (id) ON public.pacientes TO authenticated;
GRANT SELECT ON public.pacientes_view TO authenticated;

CREATE OR REPLACE FUNCTION public.proteger_dados_clinicos_paciente()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  perfil_clinico BOOLEAN := public.current_user_funcao() IN ('Médico', 'Enfermeiro(a)', 'Administrador');
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF auth.uid() IS NOT NULL THEN NEW.created_by := auth.uid(); END IF;
    IF NOT perfil_clinico AND (
      NULLIF(BTRIM(COALESCE(NEW.alergias, '')), '') IS NOT NULL OR
      NULLIF(BTRIM(COALESCE(NEW.has, '')), '') IS NOT NULL OR
      NULLIF(BTRIM(COALESCE(NEW.dm, '')), '') IS NOT NULL OR
      NULLIF(BTRIM(COALESCE(NEW.dac, '')), '') IS NOT NULL OR
      NULLIF(BTRIM(COALESCE(NEW.dislipidemia, '')), '') IS NOT NULL OR
      NULLIF(BTRIM(COALESCE(NEW.tabagismo, '')), '') IS NOT NULL OR
      NULLIF(BTRIM(COALESCE(NEW.etilismo, '')), '') IS NOT NULL OR
      NULLIF(BTRIM(COALESCE(NEW.cirurgias, '')), '') IS NOT NULL OR
      NULLIF(BTRIM(COALESCE(NEW.medicamentos_uso, '')), '') IS NOT NULL OR
      NULLIF(BTRIM(COALESCE(NEW.outras_comorbidades, '')), '') IS NOT NULL
    ) THEN
      RAISE EXCEPTION 'Perfil sem permissão para registrar dados clínicos';
    END IF;
  ELSIF NOT perfil_clinico THEN
    NEW.alergias := OLD.alergias;
    NEW.has := OLD.has;
    NEW.dm := OLD.dm;
    NEW.dac := OLD.dac;
    NEW.dislipidemia := OLD.dislipidemia;
    NEW.tabagismo := OLD.tabagismo;
    NEW.etilismo := OLD.etilismo;
    NEW.cirurgias := OLD.cirurgias;
    NEW.medicamentos_uso := OLD.medicamentos_uso;
    NEW.outras_comorbidades := OLD.outras_comorbidades;
  END IF;

  IF TG_OP = 'UPDATE' AND NEW.created_by IS DISTINCT FROM OLD.created_by THEN
    RAISE EXCEPTION 'A autoria do cadastro do paciente não pode ser alterada';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.proteger_dados_clinicos_paciente() FROM PUBLIC;

COMMENT ON COLUMN public.pacientes.outras_comorbidades IS
  'Outras condições clínicas relevantes não contempladas nos campos estruturados.';

COMMIT;
