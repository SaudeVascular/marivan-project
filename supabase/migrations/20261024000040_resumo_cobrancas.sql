-- Totais do Financeiro calculados no banco (segunda avaliação, 24/10/2026).
--
-- Antes, a tela somava as cobranças que tinha recebido. A API devolve no
-- máximo 1000 linhas por consulta: num período longo, o "Total no
-- período" saía menor que o real, sem aviso. Agora a tela pagina a lista
-- e pede os totais aqui.
--
-- SECURITY INVOKER: a soma passa pela mesma RLS de cobrancas — Financeiro
-- e Administrador somam tudo, Médico só as próprias. Ninguém obtém por
-- esta função um total que não poderia ler linha a linha.

BEGIN;

CREATE OR REPLACE FUNCTION public.resumo_cobrancas(
  p_de DATE DEFAULT NULL, p_ate DATE DEFAULT NULL, p_medico_id UUID DEFAULT NULL
)
RETURNS TABLE (quantidade BIGINT, total NUMERIC, total_repasse NUMERIC)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT
    count(*),
    COALESCE(sum(valor) FILTER (WHERE status <> 'Cancelado'), 0),
    COALESCE(sum(valor_repasse) FILTER (WHERE status <> 'Cancelado'), 0)
  FROM public.cobrancas
  WHERE (p_de IS NULL OR data_cobranca >= p_de)
    AND (p_ate IS NULL OR data_cobranca <= p_ate)
    AND (p_medico_id IS NULL OR medico_id = p_medico_id);
$$;

REVOKE ALL ON FUNCTION public.resumo_cobrancas(DATE, DATE, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.resumo_cobrancas(DATE, DATE, UUID) TO authenticated;

COMMIT;
