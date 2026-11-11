-- Gravação segura em cadastro, agenda e financeiro (quarta avaliação,
-- 25/10/2026).
--
-- Os registros clínicos já tinham idempotência e versão (migração 28); o
-- resto gravava direto. Com resposta perdida (timeout, rede caindo depois
-- do commit), repetir criava outro paciente sem CPF, outro agendamento ou
-- outra cobrança; e duas pessoas mudando o mesmo agendamento ou cobrança
-- sobrescreviam uma à outra em silêncio.
--
--   1. operacao_id (UUID, único) em pacientes, agendamentos e cobrancas: o
--      app gera um por formulário e o reenvia nas repetições. A segunda
--      inserção com o mesmo id falha com 23505, e o app recupera o que foi
--      criado na primeira (localizar_paciente_por_operacao, para pacientes,
--      que só expõem o id ao app; nas outras duas, pela própria RLS).
--   2. versao em agendamentos e cobrancas, +1 a cada alteração: o app só
--      altera "onde versao = a que estava na tela"; se mudou, o app avisa.
--   3. Transições de status no banco, iguais às do app (PROXIMOS_STATUS):
--        agendamento Agendado → Confirmado | Aguardando | Cancelado
--                    Confirmado → Aguardando | Cancelado | Faltou
--                    Aguardando → Em atendimento | Cancelado | Faltou
--                    Em atendimento → Realizado | Cancelado
--                    Realizado, Cancelado, Faltou: finais
--        cobrança    Pendente → Pago | Cancelado | Glosado
--                    Pago → Pendente (desfazer o pagamento)
--                    Glosado → Pendente
--                    Cancelado: final
--      Criação só como Agendado / Pendente.
--   4. data_pagamento é do banco: entra a data de hoje (fuso de São Paulo)
--      ao virar Pago e é apagada ao sair de Pago — antes, desfazer um
--      pagamento deixava a data antiga.
BEGIN;

-- 1. Identificador da operação de criação -------------------------------
ALTER TABLE public.pacientes    ADD COLUMN IF NOT EXISTS operacao_id UUID;
ALTER TABLE public.agendamentos ADD COLUMN IF NOT EXISTS operacao_id UUID;
ALTER TABLE public.cobrancas    ADD COLUMN IF NOT EXISTS operacao_id UUID;
CREATE UNIQUE INDEX IF NOT EXISTS pacientes_operacao_id_key    ON public.pacientes (operacao_id)    WHERE operacao_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS agendamentos_operacao_id_key ON public.agendamentos (operacao_id) WHERE operacao_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS cobrancas_operacao_id_key    ON public.cobrancas (operacao_id)    WHERE operacao_id IS NOT NULL;

-- pacientes tem privilégio de coluna: o app precisa poder enviar o id.
GRANT INSERT (operacao_id) ON public.pacientes TO authenticated;

-- Id do paciente criado por esta operação — só para quem o criou.
CREATE OR REPLACE FUNCTION public.localizar_paciente_por_operacao(p_operacao_id UUID)
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT id FROM public.pacientes
   WHERE operacao_id = p_operacao_id AND created_by = auth.uid() AND public.current_user_ativo();
$$;
REVOKE ALL ON FUNCTION public.localizar_paciente_por_operacao(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.localizar_paciente_por_operacao(UUID) TO authenticated;

-- Pagamentos desfeitos antes desta migração ficaram com a data antiga.
UPDATE public.cobrancas SET data_pagamento = NULL WHERE status <> 'Pago' AND data_pagamento IS NOT NULL;

-- 2 e 3. Versão e transições ---------------------------------------------
ALTER TABLE public.agendamentos ADD COLUMN IF NOT EXISTS versao INTEGER NOT NULL DEFAULT 1 CHECK (versao > 0);
ALTER TABLE public.cobrancas    ADD COLUMN IF NOT EXISTS versao INTEGER NOT NULL DEFAULT 1 CHECK (versao > 0);

CREATE OR REPLACE FUNCTION public.validar_agendamento()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.status IS DISTINCT FROM 'Agendado' THEN
      RAISE EXCEPTION 'Agendamento novo começa como Agendado.' USING ERRCODE = '22023';
    END IF;
    NEW.versao := 1;
    RETURN NEW;
  END IF;
  IF NEW.operacao_id IS DISTINCT FROM OLD.operacao_id THEN
    RAISE EXCEPTION 'O identificador da operação não pode ser alterado.' USING ERRCODE = '22023';
  END IF;
  IF NEW.status IS DISTINCT FROM OLD.status AND NOT (
       (OLD.status = 'Agendado'       AND NEW.status IN ('Confirmado', 'Aguardando', 'Cancelado'))
    OR (OLD.status = 'Confirmado'     AND NEW.status IN ('Aguardando', 'Cancelado', 'Faltou'))
    OR (OLD.status = 'Aguardando'     AND NEW.status IN ('Em atendimento', 'Cancelado', 'Faltou'))
    OR (OLD.status = 'Em atendimento' AND NEW.status IN ('Realizado', 'Cancelado'))
  ) THEN
    RAISE EXCEPTION 'Mudança de status não permitida: % → %.', OLD.status, NEW.status USING ERRCODE = '22023';
  END IF;
  IF OLD.status IN ('Realizado', 'Cancelado', 'Faltou') AND NEW IS DISTINCT FROM OLD THEN
    RAISE EXCEPTION 'Agendamento % não pode mais ser alterado.', lower(OLD.status) USING ERRCODE = '22023';
  END IF;
  IF NEW IS DISTINCT FROM OLD THEN
    NEW.versao := OLD.versao + 1;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validar_agendamento ON public.agendamentos;
CREATE TRIGGER trg_validar_agendamento
  BEFORE INSERT OR UPDATE ON public.agendamentos
  FOR EACH ROW EXECUTE FUNCTION public.validar_agendamento();

CREATE OR REPLACE FUNCTION public.validar_cobranca()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.status IS DISTINCT FROM 'Pendente' THEN
      RAISE EXCEPTION 'Cobrança nova começa como Pendente.' USING ERRCODE = '22023';
    END IF;
    NEW.data_pagamento := NULL;
    NEW.versao := 1;
    RETURN NEW;
  END IF;
  IF NEW.operacao_id IS DISTINCT FROM OLD.operacao_id THEN
    RAISE EXCEPTION 'O identificador da operação não pode ser alterado.' USING ERRCODE = '22023';
  END IF;
  IF NEW.status IS DISTINCT FROM OLD.status AND NOT (
       (OLD.status = 'Pendente' AND NEW.status IN ('Pago', 'Cancelado', 'Glosado'))
    OR (OLD.status = 'Pago'     AND NEW.status = 'Pendente')
    OR (OLD.status = 'Glosado'  AND NEW.status = 'Pendente')
  ) THEN
    RAISE EXCEPTION 'Mudança de status não permitida: % → %.', OLD.status, NEW.status USING ERRCODE = '22023';
  END IF;
  IF OLD.status = 'Cancelado' AND NEW IS DISTINCT FROM OLD THEN
    RAISE EXCEPTION 'Cobrança cancelada não pode mais ser alterada.' USING ERRCODE = '22023';
  END IF;
  -- Data de pagamento é do banco, nunca do relógio de quem clicou.
  IF NEW.status = 'Pago' AND OLD.status IS DISTINCT FROM 'Pago' THEN
    NEW.data_pagamento := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
  ELSIF NEW.status <> 'Pago' THEN
    NEW.data_pagamento := NULL;
  ELSE
    NEW.data_pagamento := OLD.data_pagamento;
  END IF;
  IF NEW IS DISTINCT FROM OLD THEN
    NEW.versao := OLD.versao + 1;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validar_cobranca ON public.cobrancas;
CREATE TRIGGER trg_validar_cobranca
  BEFORE INSERT OR UPDATE ON public.cobrancas
  FOR EACH ROW EXECUTE FUNCTION public.validar_cobranca();

COMMIT;
