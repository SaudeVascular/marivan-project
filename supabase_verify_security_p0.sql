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

  IF has_column_privilege('authenticated', 'public.pacientes', 'outras_comorbidades', 'SELECT') THEN
    RAISE EXCEPTION 'P0 inseguro: authenticated ainda lê pacientes.outras_comorbidades diretamente';
  END IF;

  -- Migração 36: auditoria guarda linhas inteiras (conteúdo clínico,
  -- assinaturas) — só pode ser lida pela auditoria_view mascarada.
  IF has_table_privilege('authenticated', 'public.auditoria', 'SELECT')
     OR to_regclass('public.auditoria_view') IS NULL THEN
    RAISE EXCEPTION 'P0 inseguro: auditoria legível diretamente (aplique a migração 36)';
  END IF;

  -- Migrações 41/42: paciente só é editado pela função, que precisa
  -- obedecer à RLS de quem chama (SECURITY DEFINER a contornaria).
  IF to_regprocedure('public.atualizar_paciente(uuid,text,integer,jsonb)') IS NULL
     OR (SELECT prosecdef FROM pg_proc WHERE oid = to_regprocedure('public.atualizar_paciente(uuid,text,integer,jsonb)'))
     OR has_function_privilege('anon', 'public.atualizar_paciente(uuid,text,integer,jsonb)', 'EXECUTE') THEN
    RAISE EXCEPTION 'P0 inseguro: atualizar_paciente ausente, SECURITY DEFINER ou aberta a anon (aplique a migração 41)';
  END IF;
  IF position('pep.atualizar_paciente' IN pg_get_functiondef('public.versionar_paciente()'::regprocedure)) = 0 THEN
    RAISE EXCEPTION 'P0 inseguro: UPDATE direto em pacientes sem conferência de versão (aplique a migração 42)';
  END IF;
  IF position('identidade_profissional_validada' IN pg_get_functiondef('public.validar_consulta_clinica()'::regprocedure)) = 0 THEN
    RAISE EXCEPTION 'P0 inseguro: assinatura sem validar a identidade profissional (aplique a migração 44)';
  END IF;
  IF position('p_registro_id' IN pg_get_functiondef('public.registrar_acesso(uuid,text,text,uuid)'::regprocedure)) = 0
     OR position('paciente_id = p_paciente_id' IN pg_get_functiondef('public.registrar_acesso(uuid,text,text,uuid)'::regprocedure)) = 0 THEN
    RAISE EXCEPTION 'P0 inseguro: acesso aceita registro de outro paciente (aplique a migração 43)';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_validar_agendamento' AND tgrelid = 'public.agendamentos'::regclass)
     OR NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_validar_cobranca' AND tgrelid = 'public.cobrancas'::regclass)
     OR NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'pacientes_operacao_id_key') THEN
    RAISE EXCEPTION 'P0 inseguro: agenda/cobranças sem versão e transições, ou criação sem idempotência (aplique a migração 47)';
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

  IF position('NEW.outras_comorbidades := OLD.outras_comorbidades' IN funcao_pacientes) = 0 THEN
    RAISE EXCEPTION 'Proteção de outras comorbidades ausente para perfis administrativos';
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
