-- =====================================================================
-- Financeiro — Fase 3 do Documento Mestre ("módulos profissionais").
-- =====================================================================
--
-- Cobre a seção 2.4 do Documento Mestre (perfil Financeiro: pagamentos,
-- contas a receber, repasses, recibos, relatórios financeiros — sem
-- acesso a conteúdo clínico).
--
-- Decisões de negócio (confirmadas com o usuário antes de desenhar):
--   - valor fixo por procedimento (tabela de preços), não valor livre;
--   - atende particular e convênios, com valor podendo variar por convênio;
--   - função "Financeiro" separada de Recepcionista/Administrador;
--   - repasse (% por procedimento) já entra nesta versão.
--
-- Seguro rodar mais de uma vez. Pressupõe supabase_rls_rbac.sql (usa
-- current_user_funcao()) e supabase_auditoria.sql (usa
-- registrar_auditoria()) já terem sido rodados.
-- =====================================================================

CREATE TABLE IF NOT EXISTS convenios (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome       TEXT NOT NULL,
  ativo      BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS procedimentos (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome                TEXT NOT NULL,
  valor_particular    NUMERIC(10,2) NOT NULL DEFAULT 0,
  percentual_repasse  NUMERIC(5,2) NOT NULL DEFAULT 0,
  ativo               BOOLEAN NOT NULL DEFAULT true,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Só tem linha aqui quando o convênio paga diferente do valor_particular.
CREATE TABLE IF NOT EXISTS convenio_valores (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  convenio_id     UUID NOT NULL REFERENCES convenios(id) ON DELETE CASCADE,
  procedimento_id UUID NOT NULL REFERENCES procedimentos(id) ON DELETE CASCADE,
  valor           NUMERIC(10,2) NOT NULL,
  UNIQUE (convenio_id, procedimento_id)
);

CREATE TABLE IF NOT EXISTS cobrancas (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  paciente_id         UUID NOT NULL REFERENCES pacientes(id) ON DELETE CASCADE,
  agendamento_id      UUID REFERENCES agendamentos(id) ON DELETE SET NULL,
  procedimento_id     UUID REFERENCES procedimentos(id) ON DELETE SET NULL,
  medico_id           UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  convenio_id         UUID REFERENCES convenios(id) ON DELETE SET NULL,
  descricao           TEXT,
  valor               NUMERIC(10,2) NOT NULL,
  percentual_repasse  NUMERIC(5,2) NOT NULL DEFAULT 0,
  valor_repasse       NUMERIC(10,2) GENERATED ALWAYS AS (round(valor * percentual_repasse / 100, 2)) STORED,
  forma_pagamento     TEXT CHECK (forma_pagamento IN ('Dinheiro', 'Cartão de Débito', 'Cartão de Crédito', 'PIX', 'Boleto', 'Convênio')),
  status              TEXT NOT NULL DEFAULT 'Pendente' CHECK (status IN ('Pendente', 'Pago', 'Cancelado', 'Glosado')),
  data_cobranca       DATE NOT NULL DEFAULT CURRENT_DATE,
  data_pagamento      DATE,
  observacoes         TEXT,
  created_by          UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cobrancas_paciente ON cobrancas (paciente_id);
CREATE INDEX IF NOT EXISTS idx_cobrancas_medico ON cobrancas (medico_id);
CREATE INDEX IF NOT EXISTS idx_cobrancas_data ON cobrancas (data_cobranca DESC);

DROP TRIGGER IF EXISTS trg_cobrancas_updated_at ON cobrancas;
CREATE TRIGGER trg_cobrancas_updated_at
  BEFORE UPDATE ON cobrancas
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------

ALTER TABLE convenios ENABLE ROW LEVEL SECURITY;
ALTER TABLE procedimentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE convenio_valores ENABLE ROW LEVEL SECURITY;
ALTER TABLE cobrancas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ver convenios" ON convenios;
DROP POLICY IF EXISTS "gerenciar convenios" ON convenios;
DROP POLICY IF EXISTS "excluir convenios" ON convenios;

CREATE POLICY "ver convenios" ON convenios
  FOR SELECT
  USING (current_user_funcao() IN ('Financeiro', 'Administrador'));

CREATE POLICY "gerenciar convenios" ON convenios
  FOR INSERT
  WITH CHECK (current_user_funcao() IN ('Financeiro', 'Administrador'));

CREATE POLICY "editar convenios" ON convenios
  FOR UPDATE
  USING (current_user_funcao() IN ('Financeiro', 'Administrador'))
  WITH CHECK (current_user_funcao() IN ('Financeiro', 'Administrador'));

CREATE POLICY "excluir convenios" ON convenios
  FOR DELETE
  USING (current_user_funcao() = 'Administrador');

DROP POLICY IF EXISTS "ver procedimentos" ON procedimentos;
DROP POLICY IF EXISTS "criar procedimentos" ON procedimentos;
DROP POLICY IF EXISTS "editar procedimentos" ON procedimentos;
DROP POLICY IF EXISTS "excluir procedimentos" ON procedimentos;

CREATE POLICY "ver procedimentos" ON procedimentos
  FOR SELECT
  USING (current_user_funcao() IN ('Financeiro', 'Administrador'));

CREATE POLICY "criar procedimentos" ON procedimentos
  FOR INSERT
  WITH CHECK (current_user_funcao() IN ('Financeiro', 'Administrador'));

CREATE POLICY "editar procedimentos" ON procedimentos
  FOR UPDATE
  USING (current_user_funcao() IN ('Financeiro', 'Administrador'))
  WITH CHECK (current_user_funcao() IN ('Financeiro', 'Administrador'));

CREATE POLICY "excluir procedimentos" ON procedimentos
  FOR DELETE
  USING (current_user_funcao() = 'Administrador');

DROP POLICY IF EXISTS "ver convenio_valores" ON convenio_valores;
DROP POLICY IF EXISTS "criar convenio_valores" ON convenio_valores;
DROP POLICY IF EXISTS "editar convenio_valores" ON convenio_valores;
DROP POLICY IF EXISTS "excluir convenio_valores" ON convenio_valores;

CREATE POLICY "ver convenio_valores" ON convenio_valores
  FOR SELECT
  USING (current_user_funcao() IN ('Financeiro', 'Administrador'));

CREATE POLICY "criar convenio_valores" ON convenio_valores
  FOR INSERT
  WITH CHECK (current_user_funcao() IN ('Financeiro', 'Administrador'));

CREATE POLICY "editar convenio_valores" ON convenio_valores
  FOR UPDATE
  USING (current_user_funcao() IN ('Financeiro', 'Administrador'))
  WITH CHECK (current_user_funcao() IN ('Financeiro', 'Administrador'));

CREATE POLICY "excluir convenio_valores" ON convenio_valores
  FOR DELETE
  USING (current_user_funcao() IN ('Financeiro', 'Administrador'));

-- cobrancas: Financeiro/Administrador veem e gerenciam tudo; Médico só
-- enxerga (leitura) as próprias, para acompanhar o repasse dele.
DROP POLICY IF EXISTS "ver cobrancas" ON cobrancas;
DROP POLICY IF EXISTS "criar cobrancas" ON cobrancas;
DROP POLICY IF EXISTS "editar cobrancas" ON cobrancas;
DROP POLICY IF EXISTS "excluir cobrancas" ON cobrancas;

CREATE POLICY "ver cobrancas" ON cobrancas
  FOR SELECT
  USING (
    current_user_funcao() IN ('Financeiro', 'Administrador')
    OR (current_user_funcao() = 'Médico' AND medico_id = auth.uid())
  );

CREATE POLICY "criar cobrancas" ON cobrancas
  FOR INSERT
  WITH CHECK (current_user_funcao() IN ('Financeiro', 'Administrador'));

CREATE POLICY "editar cobrancas" ON cobrancas
  FOR UPDATE
  USING (current_user_funcao() IN ('Financeiro', 'Administrador'))
  WITH CHECK (current_user_funcao() IN ('Financeiro', 'Administrador'));

CREATE POLICY "excluir cobrancas" ON cobrancas
  FOR DELETE
  USING (current_user_funcao() = 'Administrador');

-- ---------------------------------------------------------------------
-- Estende a auditoria já existente para cobranças (não faz sentido
-- auditar o catálogo de preços/convênios, só o dinheiro em movimento).
-- ---------------------------------------------------------------------

DROP TRIGGER IF EXISTS trg_auditoria_cobrancas ON cobrancas;
CREATE TRIGGER trg_auditoria_cobrancas
  AFTER INSERT OR UPDATE OR DELETE ON cobrancas
  FOR EACH ROW EXECUTE FUNCTION public.registrar_auditoria();
