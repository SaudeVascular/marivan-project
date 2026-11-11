-- Assinar o atendimento sempre gera a cobrança (homologação, 25/10/2026).
--
-- Na migração 49, assinar só concluía o agendamento do dia que já tinha
-- passado pelo check-in (Aguardando ou Em atendimento). Atendimento cujo
-- agendamento ficou em Agendado/Confirmado, ou feito sem agendamento, não
-- gerava cobrança — contra a decisão de que "a cobrança pendente nasce
-- sozinha quando o atendimento é concluído".
--
--   1. Assinar conclui também o agendamento do dia em Agendado ou
--      Confirmado (passando pelas transições: → Aguardando → Em
--      atendimento → Realizado). Preferência: o já em atendimento, depois
--      o aguardando, depois o mais cedo.
--   2. Sem agendamento do dia para concluir, a assinatura da Consulta
--      gera a cobrança direto: Pendente, procedimento a definir, convênio
--      do cadastro do paciente, data de hoje. No máximo uma por paciente,
--      profissional e dia (outra consulta assinada no mesmo dia não cobra
--      de novo); o Financeiro completa o procedimento e o valor.
BEGIN;

CREATE OR REPLACE FUNCTION privado.concluir_agendamento_do_atendimento()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ag public.agendamentos%ROWTYPE;
  hoje DATE := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
BEGIN
  IF NEW.status <> 'Assinado' OR NEW.retificacao_de IS NOT NULL
     OR NEW.tipo NOT IN ('Consulta', 'Evolução de Enfermagem')
     OR (TG_OP = 'UPDATE' AND OLD.status = 'Assinado') THEN
    RETURN NEW;
  END IF;
  SELECT * INTO ag FROM public.agendamentos a
   WHERE a.paciente_id = NEW.paciente_id
     AND a.data = hoje
     AND a.status IN ('Agendado', 'Confirmado', 'Aguardando', 'Em atendimento')
     AND (a.medico_id = NEW.created_by OR a.medico_id IS NULL)
   ORDER BY CASE a.status WHEN 'Em atendimento' THEN 0 WHEN 'Aguardando' THEN 1 ELSE 2 END,
            (a.medico_id IS NULL), a.hora, a.created_at
   LIMIT 1
   FOR UPDATE;

  IF FOUND THEN
    -- Mesmas transições da agenda (validar_agendamento, migração 47).
    IF ag.status IN ('Agendado', 'Confirmado') THEN
      UPDATE public.agendamentos SET status = 'Aguardando' WHERE id = ag.id;
    END IF;
    IF ag.status <> 'Em atendimento' THEN
      UPDATE public.agendamentos SET status = 'Em atendimento' WHERE id = ag.id;
    END IF;
    UPDATE public.agendamentos SET status = 'Realizado' WHERE id = ag.id;
    RETURN NEW;
  END IF;

  -- Sem agendamento: a Consulta assinada gera a cobrança, uma por dia.
  IF NEW.tipo = 'Consulta' AND NOT EXISTS (
       SELECT 1 FROM public.cobrancas c
        WHERE c.paciente_id = NEW.paciente_id
          AND c.medico_id IS NOT DISTINCT FROM NEW.created_by
          AND c.data_cobranca = hoje
          AND c.status <> 'Cancelado') THEN
    INSERT INTO public.cobrancas (paciente_id, medico_id, convenio_id, descricao, valor, data_cobranca, created_by)
    SELECT NEW.paciente_id, NEW.created_by, p.convenio_id,
           'Consulta sem agendamento — procedimento a definir', 0, hoje, NEW.created_by
      FROM public.pacientes p WHERE p.id = NEW.paciente_id;
  END IF;
  RETURN NEW;
END;
$$;

COMMIT;
