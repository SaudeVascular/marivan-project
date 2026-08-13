-- =====================================================================
-- Configurações da Clínica — Fase 3 (painel administrativo, seção 2.5
-- do Documento Mestre).
-- =====================================================================
--
-- Hoje nome, endereço e telefone da clínica são uma constante fixa no
-- código (CLINICA, em App.js), usada em documentos impressos (receitas,
-- atestados, recibos, guia TISS). Isso trava o sistema numa única
-- clínica fictícia e exige mexer no código pra corrigir um dado
-- administrativo — o app passa a ler/gravar essa informação aqui.
--
-- Tabela de linha única: a UI sempre lê a primeira linha (não há tela
-- de "criar nova clínica"). O INSERT abaixo semeia com os mesmos dados
-- fixos que já estavam no código, pra não quebrar a impressão em
-- nenhum ambiente já rodando — o Administrador edita depois pela tela
-- de Configurações.
--
-- Pressupõe supabase_schema.sql (usa set_updated_at()) e
-- supabase_rls_rbac.sql (usa current_user_ativo()/current_user_funcao())
-- já rodados. Seguro rodar mais de uma vez.
-- =====================================================================

CREATE TABLE IF NOT EXISTS configuracoes_clinica (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome       TEXT NOT NULL DEFAULT '',
  subtitulo  TEXT NOT NULL DEFAULT '',
  endereco   TEXT NOT NULL DEFAULT '',
  cidade     TEXT NOT NULL DEFAULT '',
  telefone   TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS trg_configuracoes_clinica_updated_at ON configuracoes_clinica;
CREATE TRIGGER trg_configuracoes_clinica_updated_at
  BEFORE UPDATE ON configuracoes_clinica
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

INSERT INTO configuracoes_clinica (nome, subtitulo, endereco, cidade, telefone)
SELECT
  'Clínica CardioVida',
  'Cardiologia & Medicina Interna',
  'Av. das Palmeiras, 1234 — Sala 501 — Jardim América',
  'São Paulo — SP — CEP 01310-100',
  'Tel.: (11) 3456-7890 | cardiovida@clinica.com.br'
WHERE NOT EXISTS (SELECT 1 FROM configuracoes_clinica);

ALTER TABLE configuracoes_clinica ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ver configuracoes_clinica" ON configuracoes_clinica;
CREATE POLICY "ver configuracoes_clinica" ON configuracoes_clinica
  FOR SELECT
  USING (current_user_ativo());

DROP POLICY IF EXISTS "editar configuracoes_clinica" ON configuracoes_clinica;
CREATE POLICY "editar configuracoes_clinica" ON configuracoes_clinica
  FOR UPDATE
  USING (current_user_funcao() = 'Administrador')
  WITH CHECK (current_user_funcao() = 'Administrador');
