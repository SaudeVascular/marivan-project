-- Controle de concorrência no cadastro e nos antecedentes do paciente.
--
-- Antes, duas pessoas editando o mesmo paciente ao mesmo tempo: a última
-- gravação vencia em silêncio, apagando a outra. Os registros clínicos já
-- tinham versão (migração 28); o cadastro e os antecedentes, não.
--
-- Duas versões, porque são telas diferentes que gravam campos disjuntos
-- (pacientes.service: cadastroToDb × clinicosToDb) — a Recepção mudar o
-- endereço não pode dar "conflito" com o médico editando alergias:
--   versao_cadastro → dados cadastrais e ativo
--   versao_clinica  → antecedentes/comorbidades
--
-- A tabela base não é legível pelo app (só pacientes_view), então a
-- checagem fica no gatilho: o cliente envia no UPDATE a versão que tinha
-- (versao_cadastro / versao_clinica = esperada); diferente da atual →
-- erro P4090, o mesmo código da gravação clínica. Sem a coluna no
-- UPDATE, não há checagem (clientes antigos em cache continuam
-- funcionando). A versão sobe sozinha quando algum campo do grupo muda.

BEGIN;

ALTER TABLE public.pacientes
  ADD COLUMN IF NOT EXISTS versao_cadastro INTEGER NOT NULL DEFAULT 1 CHECK (versao_cadastro > 0),
  ADD COLUMN IF NOT EXISTS versao_clinica  INTEGER NOT NULL DEFAULT 1 CHECK (versao_clinica > 0);

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

-- Nome depois de trg_proteger_dados_clinicos_paciente: gatilhos BEFORE
-- rodam em ordem alfabética, e a proteção (que desfaz alteração clínica
-- de quem não tem papel clínico) precisa vir antes da detecção de mudança.
DROP TRIGGER IF EXISTS trg_versionar_paciente ON public.pacientes;
CREATE TRIGGER trg_versionar_paciente
  BEFORE INSERT OR UPDATE ON public.pacientes
  FOR EACH ROW EXECUTE FUNCTION public.versionar_paciente();

-- Mesma view da migração 34, com as versões no fim.
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
  c.registro_ans AS convenio_registro_ans,
  p.versao_cadastro,
  p.versao_clinica
FROM public.pacientes p
LEFT JOIN public.convenios c ON c.id = p.convenio_id
WHERE public.current_user_ativo();

REVOKE ALL ON public.pacientes_view FROM anon;
GRANT SELECT ON public.pacientes_view TO authenticated;

COMMIT;
