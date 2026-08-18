-- =====================================================================
-- Verificação somente-leitura das correções P0.
-- Pode ser executada no SQL Editor depois das migrações de segurança.
-- Se algo estiver ausente ou amplo demais, a consulta falha com uma
-- mensagem explícita. Nenhum dado ou objeto do banco é alterado.
-- =====================================================================

DO $$
DECLARE
  trigger_pacientes_ok BOOLEAN;
  trigger_perfis_ok BOOLEAN;
  trigger_consultas_ok BOOLEAN;
  funcao_pacientes TEXT;
  funcao_consultas TEXT;
  funcao_usuario TEXT;
BEGIN
  IF to_regclass('public.pacientes_view') IS NULL
     OR to_regclass('public.perfis_view') IS NULL THEN
    RAISE EXCEPTION 'P0 incompleto: views seguras ausentes';
  END IF;

  IF has_column_privilege('authenticated', 'public.pacientes', 'alergias', 'SELECT') THEN
    RAISE EXCEPTION 'P0 inseguro: authenticated ainda lê pacientes.alergias diretamente';
  END IF;

  IF has_column_privilege('authenticated', 'public.perfis', 'cpf', 'SELECT') THEN
    RAISE EXCEPTION 'P0 inseguro: authenticated ainda lê perfis.cpf diretamente';
  END IF;

  IF NOT has_table_privilege('authenticated', 'public.pacientes_view', 'SELECT')
     OR NOT has_table_privilege('authenticated', 'public.perfis_view', 'SELECT') THEN
    RAISE EXCEPTION 'P0 incompleto: authenticated não consegue ler uma das views seguras';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgrelid = 'public.pacientes'::regclass
      AND tgname = 'trg_proteger_dados_clinicos_paciente'
      AND tgenabled <> 'D' AND NOT tgisinternal
  ) INTO trigger_pacientes_ok;

  SELECT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgrelid = 'public.perfis'::regclass
      AND tgname = 'trg_proteger_campos_seguranca_perfil'
      AND tgenabled <> 'D' AND NOT tgisinternal
  ) INTO trigger_perfis_ok;

  SELECT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgrelid = 'public.consultas'::regclass
      AND tgname = 'trg_validar_consulta_clinica'
      AND tgenabled <> 'D' AND NOT tgisinternal
  ) INTO trigger_consultas_ok;

  IF NOT trigger_pacientes_ok OR NOT trigger_perfis_ok OR NOT trigger_consultas_ok THEN
    RAISE EXCEPTION 'P0 incompleto: um ou mais triggers de segurança estão ausentes/desativados';
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'perfis'
      AND policyname = 'inserir perfis'
  ) THEN
    RAISE EXCEPTION 'P0 inseguro: policy antiga de inserção direta de perfis ainda existe';
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'pacientes'
      AND cmd = 'DELETE'
  ) THEN
    RAISE EXCEPTION 'P0 inseguro: exclusão física de pacientes ainda está exposta por RLS';
  END IF;

  SELECT pg_get_functiondef('public.proteger_dados_clinicos_paciente()'::regprocedure)
    INTO funcao_pacientes;
  SELECT pg_get_functiondef('public.validar_consulta_clinica()'::regprocedure)
    INTO funcao_consultas;
  SELECT pg_get_functiondef('public.criar_perfil_usuario()'::regprocedure)
    INTO funcao_usuario;

  IF position('NEW.alergias := OLD.alergias' IN funcao_pacientes) = 0 THEN
    RAISE EXCEPTION 'Hotfix da Recepção ausente: dados clínicos não são preservados';
  END IF;

  IF position('NEW.created_by := auth.uid()' IN funcao_consultas) = 0
     OR position('NEW.assinado_por_nome := profissional_nome' IN funcao_consultas) = 0 THEN
    RAISE EXCEPTION 'P0 incompleto: autoria/assinatura ainda não estão controladas pelo banco';
  END IF;

  IF position('''Pendente''' IN funcao_usuario) = 0
     OR position('false' IN lower(funcao_usuario)) = 0 THEN
    RAISE EXCEPTION 'P0 incompleto: novos perfis não nascem pendentes e inativos';
  END IF;
END;
$$;

DO $$
DECLARE
  definicao TEXT;
BEGIN
  SELECT pg_get_functiondef('public.proteger_campos_seguranca_perfil()'::regprocedure)
    INTO definicao;
  IF definicao ILIKE '%service_role%' THEN
    RAISE EXCEPTION 'Trigger de perfis ainda contém bypass de service_role';
  END IF;
END;
$$;

SELECT
  'OK' AS resultado,
  'Views, privilégios, policies, triggers, autoria, assinatura e hotfix da Recepção validados.' AS verificacao;
