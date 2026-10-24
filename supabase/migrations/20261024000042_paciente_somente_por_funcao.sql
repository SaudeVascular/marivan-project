-- Fecha o UPDATE direto em pacientes para o app (segunda avaliação).
--
-- Produção: aplicar LOGO DEPOIS de publicar o site que grava pela função
-- atualizar_paciente (migração 41): o site antigo grava direto e passa a
-- receber erro ao editar cadastro, antecedentes ou desativar paciente.
-- Abas abertas antes da publicação precisam ser recarregadas.
--
-- Mesma função da migração 37, com uma checagem a mais no UPDATE: vindo
-- do app (papel authenticated), só passa dentro de atualizar_paciente,
-- que liga a liberação pep.atualizar_paciente na própria transação. O
-- cliente não consegue ligá-la: cada requisição da API é uma transação
-- própria, e set_config não é exposto como RPC. Manutenção pelo SQL
-- Editor (postgres) e funções SECURITY DEFINER não são afetadas.

BEGIN;

CREATE OR REPLACE FUNCTION public.versionar_paciente()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.versao_cadastro := 1;
    NEW.versao_clinica := 1;
    RETURN NEW;
  END IF;

  IF current_user = 'authenticated'
     AND COALESCE(current_setting('pep.atualizar_paciente', true), '') <> 'sim' THEN
    RAISE EXCEPTION 'Atualize o paciente pela função atualizar_paciente (com a versão que estava na tela).'
      USING ERRCODE = '42501';
  END IF;

  IF NEW.versao_cadastro IS DISTINCT FROM OLD.versao_cadastro THEN
    RAISE EXCEPTION 'O cadastro deste paciente foi alterado por outra pessoa enquanto você editava.'
      USING ERRCODE = 'P4090', DETAIL = format('versao_cadastro atual: %s', OLD.versao_cadastro);
  END IF;
  IF NEW.versao_clinica IS DISTINCT FROM OLD.versao_clinica THEN
    RAISE EXCEPTION 'Os dados clínicos deste paciente foram alterados por outra pessoa enquanto você editava.'
      USING ERRCODE = 'P4090', DETAIL = format('versao_clinica atual: %s', OLD.versao_clinica);
  END IF;

  IF (NEW.nome, NEW.cpf, NEW.nascimento, NEW.nome_mae, NEW.telefone, NEW.convenio, NEW.convenio_id,
      NEW.cep, NEW.endereco, NEW.numero, NEW.complemento, NEW.cns, NEW.ativo)
     IS DISTINCT FROM
     (OLD.nome, OLD.cpf, OLD.nascimento, OLD.nome_mae, OLD.telefone, OLD.convenio, OLD.convenio_id,
      OLD.cep, OLD.endereco, OLD.numero, OLD.complemento, OLD.cns, OLD.ativo) THEN
    NEW.versao_cadastro := OLD.versao_cadastro + 1;
  END IF;

  IF (NEW.alergias, NEW.has, NEW.dm, NEW.dac, NEW.dislipidemia, NEW.tabagismo, NEW.etilismo,
      NEW.cirurgias, NEW.medicamentos_uso, NEW.outras_comorbidades)
     IS DISTINCT FROM
     (OLD.alergias, OLD.has, OLD.dm, OLD.dac, OLD.dislipidemia, OLD.tabagismo, OLD.etilismo,
      OLD.cirurgias, OLD.medicamentos_uso, OLD.outras_comorbidades) THEN
    NEW.versao_clinica := OLD.versao_clinica + 1;
  END IF;

  RETURN NEW;
END;
$$;

COMMIT;
