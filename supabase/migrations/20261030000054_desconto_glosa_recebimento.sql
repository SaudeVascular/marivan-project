-- Desconto, glosa e o que de fato foi recebido (decisão do responsável
-- clínico, 30/10/2026).
--
--   Valor do procedimento (tabela) − Desconto = Valor pago
--   Valor pago − Glosa                       = Valor recebido (só se Pago)
--   Valor recebido × percentual do profissional = recebido pelo profissional;
--   o resto, pela clínica.
--
--   1. cobrancas ganha desconto (R$) e valor_glosa (R$). Desconto só em
--      cobrança particular (sem convênio, ou o convênio "Particular");
--      glosa é coisa de convênio (a tela só a oferece lá). Glosado = glosa total; voltar a Pendente zera
--      a glosa. valor_repasse passa a ser calculado sobre o valor pago
--      menos a glosa (antes, sobre o valor cheio).
--   2. receber_atendimento(agendamento, desconto, forma): a Recepção (e o
--      Financeiro/Administrador) recebe o particular do dia, antes ou
--      depois da consulta — com o valor da tabela particular e o desconto
--      que der. Cria a cobrança se ainda não existir (a que nasceria ao
--      concluir o atendimento é a mesma: uma por agendamento).
--   3. pagamentos_do_dia(data): o que já foi recebido em cada agendamento
--      do dia, para a tela da Recepção (que não lê a tabela de cobranças).
--   4. resumo_financeiro(de, até, profissional): totais de todas as
--      colunas, no banco e sob a RLS.
--   5. relatorio_producao devolve as colunas novas e a especialidade do
--      profissional.
BEGIN;

-- 1. Desconto e glosa ------------------------------------------------------
ALTER TABLE public.cobrancas
  ADD COLUMN IF NOT EXISTS desconto NUMERIC(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS valor_glosa NUMERIC(10,2) NOT NULL DEFAULT 0;

-- Glosas antigas (status Glosado sem valor): glosa total.
UPDATE public.cobrancas SET valor_glosa = valor WHERE status = 'Glosado' AND valor_glosa = 0;

ALTER TABLE public.cobrancas DROP COLUMN IF EXISTS valor_repasse;
ALTER TABLE public.cobrancas ADD COLUMN valor_repasse NUMERIC(10,2)
  GENERATED ALWAYS AS (round((valor - desconto - valor_glosa) * percentual_repasse / 100, 2)) STORED;

ALTER TABLE public.cobrancas DROP CONSTRAINT IF EXISTS cobrancas_desconto_glosa_validos;
ALTER TABLE public.cobrancas ADD CONSTRAINT cobrancas_desconto_glosa_validos CHECK (
  desconto >= 0 AND valor_glosa >= 0 AND desconto + valor_glosa <= valor
);

CREATE OR REPLACE FUNCTION privado.cobranca_particular(p_convenio_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p_convenio_id IS NULL OR EXISTS (SELECT 1 FROM public.convenios c WHERE c.id = p_convenio_id AND c.particular);
$$;
REVOKE ALL ON FUNCTION privado.cobranca_particular(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION privado.cobranca_particular(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION privado.validar_desconto_glosa()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  particular BOOLEAN := privado.cobranca_particular(NEW.convenio_id);
BEGIN
  IF NEW.desconto > 0 AND NOT particular THEN
    RAISE EXCEPTION 'Desconto só em atendimento particular.' USING ERRCODE = '22023';
  END IF;
  IF NEW.status = 'Glosado' THEN
    NEW.valor_glosa := NEW.valor - NEW.desconto;
  ELSIF NEW.status = 'Pendente' THEN
    NEW.valor_glosa := 0;
  END IF;
  IF NEW.desconto + NEW.valor_glosa > NEW.valor THEN
    RAISE EXCEPTION 'Desconto e glosa não podem passar do valor do procedimento.' USING ERRCODE = '22023';
  END IF;
  RETURN NEW;
END;
$$;
GRANT EXECUTE ON FUNCTION privado.validar_desconto_glosa() TO authenticated;
DROP TRIGGER IF EXISTS trg_validar_desconto_glosa ON public.cobrancas;
CREATE TRIGGER trg_validar_desconto_glosa BEFORE INSERT OR UPDATE ON public.cobrancas
  FOR EACH ROW EXECUTE FUNCTION privado.validar_desconto_glosa();

-- 2. Recepção recebe o particular -----------------------------------------
CREATE OR REPLACE FUNCTION public.receber_atendimento(
  p_agendamento_id UUID, p_desconto NUMERIC, p_forma_pagamento TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ag public.agendamentos%ROWTYPE;
  proc public.procedimentos%ROWTYPE;
  cob public.cobrancas%ROWTYPE;
  v_valor NUMERIC;
  v_desconto NUMERIC := round(COALESCE(p_desconto, 0), 2);
BEGIN
  IF NOT (COALESCE(public.current_user_ativo(), false)
          AND COALESCE(public.current_user_funcao() IN ('Recepcionista', 'Financeiro', 'Administrador'), false)) THEN
    RAISE EXCEPTION 'Somente Recepção, Financeiro ou Administrador recebe pagamentos.' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO ag FROM public.agendamentos WHERE id = p_agendamento_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Agendamento não encontrado.' USING ERRCODE = '22023';
  END IF;
  IF ag.status IN ('Cancelado', 'Faltou') THEN
    RAISE EXCEPTION 'Agendamento % não pode ser cobrado.', lower(ag.status) USING ERRCODE = '22023';
  END IF;
  IF NOT privado.cobranca_particular(ag.convenio_id) THEN
    RAISE EXCEPTION 'Atendimento de convênio: quem paga é a operadora, não a Recepção.' USING ERRCODE = '22023';
  END IF;
  IF ag.procedimento_id IS NULL THEN
    RAISE EXCEPTION 'Defina o procedimento antes de receber.' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO proc FROM public.procedimentos WHERE id = ag.procedimento_id;
  v_valor := privado.valor_procedimento(ag.convenio_id, ag.procedimento_id);
  IF v_valor IS NULL OR v_valor <= 0 THEN
    RAISE EXCEPTION 'O procedimento não tem valor particular na tabela.' USING ERRCODE = '22023';
  END IF;
  IF v_desconto < 0 OR v_desconto > v_valor THEN
    RAISE EXCEPTION 'Desconto entre R$ 0,00 e o valor do procedimento.' USING ERRCODE = '22023';
  END IF;
  IF p_forma_pagamento IS NULL OR p_forma_pagamento NOT IN ('Dinheiro', 'Cartão de Débito', 'Cartão de Crédito', 'PIX', 'Boleto') THEN
    RAISE EXCEPTION 'Escolha a forma de pagamento.' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO cob FROM public.cobrancas WHERE agendamento_id = ag.id FOR UPDATE;
  IF FOUND THEN
    IF cob.status <> 'Pendente' THEN
      RAISE EXCEPTION 'Este atendimento já está %.', lower(cob.status) USING ERRCODE = '22023';
    END IF;
    UPDATE public.cobrancas
       SET procedimento_id = ag.procedimento_id, convenio_id = ag.convenio_id, medico_id = ag.medico_id,
           descricao = proc.nome, valor = v_valor, desconto = v_desconto
     WHERE id = cob.id;
  ELSE
    INSERT INTO public.cobrancas (paciente_id, agendamento_id, procedimento_id, medico_id, convenio_id,
                                  descricao, valor, desconto, data_cobranca, created_by)
    VALUES (ag.paciente_id, ag.id, ag.procedimento_id, ag.medico_id, ag.convenio_id,
            proc.nome, v_valor, v_desconto, ag.data, auth.uid())
    RETURNING * INTO cob;
  END IF;
  UPDATE public.cobrancas SET status = 'Pago', forma_pagamento = p_forma_pagamento
   WHERE id = cob.id RETURNING * INTO cob;

  RETURN jsonb_build_object('cobranca_id', cob.id, 'valor', cob.valor, 'desconto', cob.desconto,
                            'valor_pago', cob.valor - cob.desconto, 'forma_pagamento', cob.forma_pagamento);
END;
$$;
REVOKE ALL ON FUNCTION public.receber_atendimento(UUID, NUMERIC, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.receber_atendimento(UUID, NUMERIC, TEXT) TO authenticated;

-- 3. O que já foi recebido em cada agendamento do dia ------------------------
CREATE OR REPLACE FUNCTION public.pagamentos_do_dia(p_data DATE)
RETURNS TABLE (agendamento_id UUID, cobranca_id UUID, status TEXT, valor NUMERIC, desconto NUMERIC, forma_pagamento TEXT)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT c.agendamento_id, c.id, c.status, c.valor, c.desconto, c.forma_pagamento
    FROM public.cobrancas c
    JOIN public.agendamentos a ON a.id = c.agendamento_id
   WHERE a.data = p_data
     AND COALESCE(public.current_user_ativo(), false)
     AND public.current_user_funcao() IN ('Recepcionista', 'Financeiro', 'Administrador');
$$;
REVOKE ALL ON FUNCTION public.pagamentos_do_dia(DATE) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pagamentos_do_dia(DATE) TO authenticated;

-- 4. Totais do Financeiro com as colunas novas ------------------------------
CREATE OR REPLACE FUNCTION public.resumo_financeiro(
  p_de DATE DEFAULT NULL, p_ate DATE DEFAULT NULL, p_medico_id UUID DEFAULT NULL
)
RETURNS TABLE (quantidade BIGINT, valor NUMERIC, desconto NUMERIC, valor_pago NUMERIC, glosa NUMERIC,
               recebido NUMERIC, recebido_clinica NUMERIC, recebido_profissional NUMERIC)
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
         COALESCE(sum(c.valor_repasse) FILTER (WHERE c.status = 'Pago'), 0)
    FROM public.cobrancas c
   WHERE c.status <> 'Cancelado'
     AND (p_de IS NULL OR c.data_cobranca >= p_de)
     AND (p_ate IS NULL OR c.data_cobranca <= p_ate)
     AND (p_medico_id IS NULL OR c.medico_id = p_medico_id);
$$;
REVOKE ALL ON FUNCTION public.resumo_financeiro(DATE, DATE, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.resumo_financeiro(DATE, DATE, UUID) TO authenticated;

-- Totais antigos (migração 40) passam a usar o repasse sobre o líquido.
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

-- 5. Relatório de produção com as colunas novas -----------------------------
DROP FUNCTION IF EXISTS public.relatorio_producao(DATE, DATE, UUID);
CREATE FUNCTION public.relatorio_producao(
  p_de DATE, p_ate DATE, p_profissional_id UUID DEFAULT NULL
)
RETURNS TABLE (
  cobranca_id UUID, data DATE, status TEXT, da_agenda BOOLEAN,
  paciente_id UUID, paciente_nome TEXT,
  profissional_id UUID, profissional_nome TEXT, especialidade TEXT,
  procedimento_id UUID, codigo TEXT, procedimento TEXT, tipo TEXT,
  convenio_id UUID, convenio TEXT, particular BOOLEAN, forma_pagamento TEXT,
  valor NUMERIC, desconto NUMERIC, valor_pago NUMERIC, glosa NUMERIC, percentual_repasse NUMERIC,
  recebido NUMERIC, recebido_clinica NUMERIC, recebido_profissional NUMERIC
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  gestor BOOLEAN := COALESCE(public.current_user_funcao() IN ('Financeiro', 'Administrador'), false);
  alvo UUID := p_profissional_id;
BEGIN
  IF NOT COALESCE(public.current_user_ativo(), false) THEN
    RAISE EXCEPTION 'Usuário inativo.' USING ERRCODE = '42501';
  END IF;
  IF p_de IS NULL OR p_ate IS NULL OR p_ate < p_de THEN
    RAISE EXCEPTION 'Informe o período (data inicial até a final).' USING ERRCODE = '22023';
  END IF;
  IF NOT gestor THEN
    IF alvo IS NOT NULL AND alvo <> auth.uid() THEN
      RAISE EXCEPTION 'Você só pode ver a sua própria produção.' USING ERRCODE = '42501';
    END IF;
    alvo := auth.uid();
  END IF;
  RETURN QUERY
    SELECT c.id, c.data_cobranca, c.status, c.agendamento_id IS NOT NULL,
           c.paciente_id, pa.nome,
           c.medico_id, pf.nome, NULLIF(btrim(pf.especialidade), ''),
           c.procedimento_id, COALESCE(cv.codigo, p.codigo), COALESCE(p.nome, c.descricao), p.tipo,
           c.convenio_id, co.nome, privado.cobranca_particular(c.convenio_id), c.forma_pagamento,
           c.valor, c.desconto, c.valor - c.desconto, c.valor_glosa, c.percentual_repasse,
           CASE WHEN c.status = 'Pago' THEN c.valor - c.desconto - c.valor_glosa ELSE 0 END,
           CASE WHEN c.status = 'Pago' THEN c.valor - c.desconto - c.valor_glosa - c.valor_repasse ELSE 0 END,
           CASE WHEN c.status = 'Pago' THEN c.valor_repasse ELSE 0 END
      FROM public.cobrancas c
      JOIN public.pacientes pa ON pa.id = c.paciente_id
      LEFT JOIN public.perfis pf ON pf.id = c.medico_id
      LEFT JOIN public.procedimentos p ON p.id = c.procedimento_id
      LEFT JOIN public.convenios co ON co.id = c.convenio_id
      LEFT JOIN public.convenio_valores cv ON cv.convenio_id = c.convenio_id AND cv.procedimento_id = c.procedimento_id
     WHERE c.status <> 'Cancelado'
       AND c.data_cobranca BETWEEN p_de AND p_ate
       AND (alvo IS NULL OR c.medico_id = alvo)
     ORDER BY c.data_cobranca, pf.nome NULLS LAST, c.created_at, c.id;
END;
$$;
REVOKE ALL ON FUNCTION public.relatorio_producao(DATE, DATE, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.relatorio_producao(DATE, DATE, UUID) TO authenticated;

COMMIT;
