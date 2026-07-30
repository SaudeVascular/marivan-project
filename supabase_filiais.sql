-- =====================================================================
-- Filiais — cadastro de outras unidades da clínica, mesmo formato de
-- dados de Configurações da Clínica (nome, nome fantasia, CNPJ,
-- endereço, contato, logomarca própria), só que em tabela de várias
-- linhas em vez de linha única.
-- =====================================================================
--
-- Reaproveita o bucket de Storage público "clinica" já criado em
-- supabase_configuracoes_clinica_extra.sql pra logomarca de cada
-- filial — não precisa de bucket novo, os arquivos só entram com nome
-- diferente (prefixo "filial-").
--
-- Exclusão é lógica (ativo = false), mesmo padrão de pacientes.
--
-- Pressupõe supabase_configuracoes_clinica_extra.sql (bucket "clinica"),
-- supabase_rls_rbac.sql (current_user_ativo()/current_user_funcao()) e
-- supabase_auditoria.sql (registrar_auditoria()) já rodados. Seguro
-- rodar mais de uma vez.
-- =====================================================================

CREATE TABLE IF NOT EXISTS filiais (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome          TEXT NOT NULL DEFAULT '',
  nome_fantasia TEXT NOT NULL DEFAULT '',
  cnpj          TEXT NOT NULL DEFAULT '',
  cep           TEXT NOT NULL DEFAULT '',
  endereco      TEXT NOT NULL DEFAULT '',
  numero        TEXT NOT NULL DEFAULT '',
  complemento   TEXT NOT NULL DEFAULT '',
  cidade        TEXT NOT NULL DEFAULT '',
  telefone      TEXT NOT NULL DEFAULT '',
  logo_url      TEXT,
  ativo         BOOLEAN NOT NULL DEFAULT true,
  created_by    UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS trg_filiais_updated_at ON filiais;
CREATE TRIGGER trg_filiais_updated_at
  BEFORE UPDATE ON filiais
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE filiais ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ver filiais" ON filiais;
CREATE POLICY "ver filiais" ON filiais
  FOR SELECT
  USING (current_user_ativo());

DROP POLICY IF EXISTS "criar filiais" ON filiais;
CREATE POLICY "criar filiais" ON filiais
  FOR INSERT
  WITH CHECK (current_user_funcao() = 'Administrador');

DROP POLICY IF EXISTS "editar filiais" ON filiais;
CREATE POLICY "editar filiais" ON filiais
  FOR UPDATE
  USING (current_user_funcao() = 'Administrador')
  WITH CHECK (current_user_funcao() = 'Administrador');

DROP POLICY IF EXISTS "excluir filiais" ON filiais;
CREATE POLICY "excluir filiais" ON filiais
  FOR DELETE
  USING (current_user_funcao() = 'Administrador');

DROP TRIGGER IF EXISTS trg_auditoria_filiais ON filiais;
CREATE TRIGGER trg_auditoria_filiais
  AFTER INSERT OR UPDATE OR DELETE ON filiais
  FOR EACH ROW EXECUTE FUNCTION public.registrar_auditoria();
