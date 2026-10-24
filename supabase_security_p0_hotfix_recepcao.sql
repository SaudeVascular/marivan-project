-- =====================================================================
-- Hotfix P0: permitir edição cadastral pela Recepção sem apagar dados
-- clínicos, inclusive quando um bundle antigo reenviar campos mascarados.
-- Execute depois de supabase_security_p0.sql.
-- =====================================================================

BEGIN;

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
      NULLIF(BTRIM(COALESCE(NEW.medicamentos_uso, '')), '') IS NOT NULL
    ) THEN
      RAISE EXCEPTION 'Perfil sem permissão para registrar dados clínicos';
    END IF;
  ELSIF NOT perfil_clinico THEN
    -- Ignora valores clínicos enviados por perfis administrativos e
    -- preserva os dados existentes. Isso também protege contra chamadas
    -- diretas à API: a operação pode mudar telefone/endereço, mas nunca
    -- alergias ou antecedentes.
    NEW.alergias := OLD.alergias;
    NEW.has := OLD.has;
    NEW.dm := OLD.dm;
    NEW.dac := OLD.dac;
    NEW.dislipidemia := OLD.dislipidemia;
    NEW.tabagismo := OLD.tabagismo;
    NEW.etilismo := OLD.etilismo;
    NEW.cirurgias := OLD.cirurgias;
    NEW.medicamentos_uso := OLD.medicamentos_uso;
  END IF;

  IF TG_OP = 'UPDATE' AND NEW.created_by IS DISTINCT FROM OLD.created_by THEN
    RAISE EXCEPTION 'A autoria do cadastro do paciente não pode ser alterada';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.proteger_dados_clinicos_paciente() FROM PUBLIC;

COMMIT;
