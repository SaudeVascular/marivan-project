-- Agenda → atendimento → cobrança (decisão do responsável clínico,
-- 25/10/2026).
--
-- Antes, agenda, prontuário e financeiro não se falavam: assinar a consulta
-- não concluía o agendamento, e a cobrança era sempre lançada à mão.
--
--   1. O agendamento guarda procedimento e convênio, escolhidos ao agendar
--      (o convênio vem do cadastro do paciente) e confirmados/ajustados pela
--      Recepção na chegada. catalogo_procedimentos(convênio) devolve os
--      procedimentos ativos com o valor da tabela do convênio (ou o valor
--      particular) para quem agenda — sem abrir a tabela de preços inteira,
--      que continua só do Financeiro/Administrador.
--   2. Assinar o atendimento (Consulta ou Evolução de Enfermagem, não
--      retificação) conclui o agendamento do mesmo paciente, no mesmo dia,
--      que esteja Aguardando ou Em atendimento com o mesmo profissional (ou
--      sem profissional definido) — o mais cedo, se houver mais de um.
--   3. Agendamento que vira Realizado (por isso ou pelos botões da agenda)
--      gera uma cobrança Pendente, ligada ao agendamento, com procedimento,
--      convênio, profissional, valor da tabela e percentual de repasse do
--      procedimento. No máximo uma por agendamento (índice único). Sem
--      procedimento, nasce com valor 0 e "procedimento a definir" para o
--      Financeiro completar.
BEGIN;

-- 1. Procedimento e convênio no agendamento --------------------------------
ALTER TABLE public.agendamentos
  ADD COLUMN IF NOT EXISTS procedimento_id UUID REFERENCES public.procedimentos(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS convenio_id UUID REFERENCES public.convenios(id) ON DELETE SET NULL;

-- Valor de um procedimento num convênio; sem convênio, o particular.
CREATE OR REPLACE FUNCTION privado.valor_procedimento(p_convenio_id UUID, p_procedimento_id UUID)
RETURNS NUMERIC
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT cv.valor FROM public.convenio_valores cv
      WHERE cv.convenio_id = p_convenio_id AND cv.procedimento_id = p_procedimento_id),
    (SELECT p.valor_particular FROM public.procedimentos p WHERE p.id = p_procedimento_id AND p_convenio_id IS NULL)
  );
$$;
REVOKE ALL ON FUNCTION privado.valor_procedimento(UUID, UUID) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.catalogo_procedimentos(p_convenio_id UUID DEFAULT NULL)
RETURNS TABLE (id UUID, nome TEXT, valor NUMERIC)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, p.nome, privado.valor_procedimento(p_convenio_id, p.id)
    FROM public.procedimentos p
   WHERE p.ativo AND public.current_user_ativo()
   ORDER BY p.nome;
$$;
REVOKE ALL ON FUNCTION public.catalogo_procedimentos(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.catalogo_procedimentos(UUID) TO authenticated;

-- 3. Realizado gera a cobrança ------------------------------------------------
CREATE UNIQUE INDEX IF NOT EXISTS cobrancas_agendamento_id_key
  ON public.cobrancas (agendamento_id) WHERE agendamento_id IS NOT NULL;

CREATE OR REPLACE FUNCTION privado.gerar_cobranca_do_agendamento()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  proc public.procedimentos%ROWTYPE;
  valor NUMERIC;
BEGIN
  IF NEW.status <> 'Realizado' OR OLD.status = 'Realizado' THEN
    RETURN NEW;
  END IF;
  IF NEW.procedimento_id IS NOT NULL THEN
    SELECT * INTO proc FROM public.procedimentos WHERE id = NEW.procedimento_id;
    valor := privado.valor_procedimento(NEW.convenio_id, NEW.procedimento_id);
  END IF;
  INSERT INTO public.cobrancas (paciente_id, agendamento_id, procedimento_id, medico_id, convenio_id,
                                descricao, valor, percentual_repasse, data_cobranca, created_by)
  VALUES (NEW.paciente_id, NEW.id, NEW.procedimento_id, NEW.medico_id, NEW.convenio_id,
          COALESCE(proc.nome, 'Atendimento — procedimento a definir'),
          COALESCE(valor, 0), COALESCE(proc.percentual_repasse, 0), NEW.data, auth.uid())
  ON CONFLICT (agendamento_id) WHERE agendamento_id IS NOT NULL DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_gerar_cobranca_do_agendamento ON public.agendamentos;
CREATE TRIGGER trg_gerar_cobranca_do_agendamento
  AFTER UPDATE OF status ON public.agendamentos
  FOR EACH ROW EXECUTE FUNCTION privado.gerar_cobranca_do_agendamento();

-- 2. Assinar o atendimento conclui o agendamento ----------------------------
CREATE OR REPLACE FUNCTION privado.concluir_agendamento_do_atendimento()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ag public.agendamentos%ROWTYPE;
BEGIN
  IF NEW.status <> 'Assinado' OR NEW.retificacao_de IS NOT NULL
     OR NEW.tipo NOT IN ('Consulta', 'Evolução de Enfermagem')
     OR (TG_OP = 'UPDATE' AND OLD.status = 'Assinado') THEN
    RETURN NEW;
  END IF;
  SELECT * INTO ag FROM public.agendamentos a
   WHERE a.paciente_id = NEW.paciente_id
     AND a.data = (now() AT TIME ZONE 'America/Sao_Paulo')::date
     AND a.status IN ('Aguardando', 'Em atendimento')
     AND (a.medico_id = NEW.created_by OR a.medico_id IS NULL)
   ORDER BY a.hora, a.created_at
   LIMIT 1
   FOR UPDATE;
  IF NOT FOUND THEN
    RETURN NEW;
  END IF;
  -- Mesmas transições da agenda (validar_agendamento): Aguardando passa por
  -- Em atendimento.
  IF ag.status = 'Aguardando' THEN
    UPDATE public.agendamentos SET status = 'Em atendimento' WHERE id = ag.id;
  END IF;
  UPDATE public.agendamentos SET status = 'Realizado' WHERE id = ag.id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_concluir_agendamento_do_atendimento ON public.consultas;
CREATE TRIGGER trg_concluir_agendamento_do_atendimento
  AFTER INSERT OR UPDATE OF status ON public.consultas
  FOR EACH ROW EXECUTE FUNCTION privado.concluir_agendamento_do_atendimento();

COMMIT;
