-- Repasse das cobranças pendentes segue a regra atual; totais previstos
-- (homologação, 30/10/2026).
--
-- Antes (migração 50), o percentual era gravado quando a cobrança nascia:
-- cobrança lançada antes de o Administrador preencher o repasse do
-- profissional ficava com 0% para sempre.
--
--   1. Enquanto Pendente, a cobrança acompanha a regra atual do
--      profissional e o tipo atual do procedimento; ao virar Pago (ou
--      Glosado/Cancelado), o percentual daquele momento fica gravado e não
--      muda mais. Mudar a regra ou o tipo recalcula as pendentes na hora.
--      As pendentes de hoje são recalculadas por esta migração.
--   2. resumo_financeiro passa a devolver também a divisão prevista das
--      pendentes (o que a clínica e o profissional vão receber se forem
--      pagas pelo valor atual).
BEGIN;

CREATE OR REPLACE FUNCTION privado.repasse_da_cobranca()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'INSERT' OR OLD.status = 'Pendente' THEN
    NEW.percentual_repasse := privado.percentual_repasse(NEW.medico_id, NEW.procedimento_id);
  ELSE
    NEW.percentual_repasse := OLD.percentual_repasse;
  END IF;
  RETURN NEW;
END;
$$;

-- Regra ou tipo mudou: as pendentes afetadas passam pelo trigger acima.
CREATE OR REPLACE FUNCTION privado.recalcular_pendentes_do_profissional()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.cobrancas c
     SET percentual_repasse = privado.percentual_repasse(c.medico_id, c.procedimento_id)
   WHERE c.status = 'Pendente'
     AND c.medico_id = COALESCE(NEW.profissional_id, OLD.profissional_id)
     AND c.percentual_repasse IS DISTINCT FROM privado.percentual_repasse(c.medico_id, c.procedimento_id);
  RETURN NULL;
END;
$$;
DROP TRIGGER IF EXISTS trg_recalcular_pendentes ON public.repasse_profissional;
CREATE TRIGGER trg_recalcular_pendentes
  AFTER INSERT OR UPDATE OR DELETE ON public.repasse_profissional
  FOR EACH ROW EXECUTE FUNCTION privado.recalcular_pendentes_do_profissional();

CREATE OR REPLACE FUNCTION privado.recalcular_pendentes_do_procedimento()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.cobrancas c
     SET percentual_repasse = privado.percentual_repasse(c.medico_id, c.procedimento_id)
   WHERE c.status = 'Pendente'
     AND c.procedimento_id = NEW.id
     AND c.percentual_repasse IS DISTINCT FROM privado.percentual_repasse(c.medico_id, c.procedimento_id);
  RETURN NULL;
END;
$$;
DROP TRIGGER IF EXISTS trg_recalcular_pendentes ON public.procedimentos;
CREATE TRIGGER trg_recalcular_pendentes
  AFTER UPDATE OF tipo ON public.procedimentos
  FOR EACH ROW WHEN (OLD.tipo IS DISTINCT FROM NEW.tipo)
  EXECUTE FUNCTION privado.recalcular_pendentes_do_procedimento();

-- As pendentes de hoje, pela regra atual.
UPDATE public.cobrancas c
   SET percentual_repasse = privado.percentual_repasse(c.medico_id, c.procedimento_id)
 WHERE c.status = 'Pendente'
   AND c.percentual_repasse IS DISTINCT FROM privado.percentual_repasse(c.medico_id, c.procedimento_id);

-- 2. Totais com a divisão prevista das pendentes ----------------------------
DROP FUNCTION IF EXISTS public.resumo_financeiro(DATE, DATE, UUID);
CREATE FUNCTION public.resumo_financeiro(
  p_de DATE DEFAULT NULL, p_ate DATE DEFAULT NULL, p_medico_id UUID DEFAULT NULL
)
RETURNS TABLE (quantidade BIGINT, valor NUMERIC, desconto NUMERIC, valor_pago NUMERIC, glosa NUMERIC,
               recebido NUMERIC, recebido_clinica NUMERIC, recebido_profissional NUMERIC,
               previsto_clinica NUMERIC, previsto_profissional NUMERIC)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT count(*),
         COALESCE(sum(c.valor), 0),
         COALESCE(sum(c.desconto), 0),
         COALESCE(sum(c.valor - c.desconto), 0),
         COALESCE(sum(c.valor_glosa), 0),
         COALESCE(sum(c.valor - c.desconto - c.valor_glosa) FILTER (WHERE c.status = 'Pago'), 0),
         COALESCE(sum(c.valor - c.desconto - c.valor_glosa - c.valor_repasse) FILTER (WHERE c.status = 'Pago'), 0),
         COALESCE(sum(c.valor_repasse) FILTER (WHERE c.status = 'Pago'), 0),
         COALESCE(sum(c.valor - c.desconto - c.valor_glosa - c.valor_repasse) FILTER (WHERE c.status = 'Pendente'), 0),
         COALESCE(sum(c.valor_repasse) FILTER (WHERE c.status = 'Pendente'), 0)
    FROM public.cobrancas c
   WHERE c.status <> 'Cancelado'
     AND (p_de IS NULL OR c.data_cobranca >= p_de)
     AND (p_ate IS NULL OR c.data_cobranca <= p_ate)
     AND (p_medico_id IS NULL OR c.medico_id = p_medico_id);
$$;
REVOKE ALL ON FUNCTION public.resumo_financeiro(DATE, DATE, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.resumo_financeiro(DATE, DATE, UUID) TO authenticated;

COMMIT;
