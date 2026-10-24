-- =====================================================================
-- Agenda — Fase 3 do Documento Mestre ("módulos profissionais").
-- =====================================================================
--
-- Tabela nova, não reaproveita `consultas`: consultas hoje é "registros
-- de prontuário" (coisas que já aconteceram), agendamento é "coisas que
-- vão acontecer" — são conceitos diferentes.
--
-- Acesso amplo (não só clínico): é o que dá à Recepcionista uso real do
-- sistema (Documento Mestre 2.3 — agenda, confirmação de atendimento,
-- status de chegada).
--
-- Seguro rodar mais de uma vez. Pressupõe supabase_schema.sql (usa
-- set_updated_at()), supabase_rls_rbac.sql (usa current_user_ativo()) e
-- supabase_auditoria.sql (usa registrar_auditoria()) já terem sido
-- rodados — todos já devem estar aplicados nesse ponto do projeto.
-- =====================================================================

CREATE TABLE IF NOT EXISTS agendamentos (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  paciente_id  UUID NOT NULL REFERENCES pacientes(id) ON DELETE CASCADE,
  medico_id    UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  data         DATE NOT NULL,
  hora         TEXT NOT NULL,
  duracao_min  INTEGER NOT NULL DEFAULT 30,
  status       TEXT NOT NULL DEFAULT 'Agendado'
               CHECK (status IN ('Agendado', 'Confirmado', 'Aguardando', 'Em atendimento', 'Realizado', 'Cancelado', 'Faltou')),
  observacoes  TEXT,
  created_by   UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agendamentos_data ON agendamentos (data);
CREATE INDEX IF NOT EXISTS idx_agendamentos_paciente ON agendamentos (paciente_id);

DROP TRIGGER IF EXISTS trg_agendamentos_updated_at ON agendamentos;
CREATE TRIGGER trg_agendamentos_updated_at
  BEFORE UPDATE ON agendamentos
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------
-- RLS — mesmo padrão de `pacientes`: qualquer staff ativo (médico,
-- enfermagem, recepção, admin) lê e escreve; exclusão só Administrador
-- (cancelar é uma troca de status, não uma exclusão).
-- ---------------------------------------------------------------------

ALTER TABLE agendamentos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ver agendamentos" ON agendamentos;
DROP POLICY IF EXISTS "criar agendamentos" ON agendamentos;
DROP POLICY IF EXISTS "editar agendamentos" ON agendamentos;
DROP POLICY IF EXISTS "excluir agendamentos" ON agendamentos;

CREATE POLICY "ver agendamentos" ON agendamentos
  FOR SELECT
  USING (current_user_ativo());

CREATE POLICY "criar agendamentos" ON agendamentos
  FOR INSERT
  WITH CHECK (current_user_ativo());

CREATE POLICY "editar agendamentos" ON agendamentos
  FOR UPDATE
  USING (current_user_ativo())
  WITH CHECK (current_user_ativo());

CREATE POLICY "excluir agendamentos" ON agendamentos
  FOR DELETE
  USING (current_user_funcao() = 'Administrador');

-- ---------------------------------------------------------------------
-- Estende a auditoria já existente (supabase_auditoria.sql) para cobrir
-- agendamentos também.
-- ---------------------------------------------------------------------

DROP TRIGGER IF EXISTS trg_auditoria_agendamentos ON agendamentos;
CREATE TRIGGER trg_auditoria_agendamentos
  AFTER INSERT OR UPDATE OR DELETE ON agendamentos
  FOR EACH ROW EXECUTE FUNCTION public.registrar_auditoria();
