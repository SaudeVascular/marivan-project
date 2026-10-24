-- ============================================================
-- TABELA DE PERFIS DE USUÁRIOS
-- Executar no SQL Editor do Supabase
-- ============================================================

CREATE TABLE IF NOT EXISTS perfis (
  id         UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nome       TEXT        NOT NULL DEFAULT '',
  email      TEXT,
  funcao     TEXT        DEFAULT 'Médico',
  ativo      BOOLEAN     DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índice para busca por e-mail
CREATE INDEX IF NOT EXISTS idx_perfis_email ON perfis(email);

-- Row Level Security
ALTER TABLE perfis ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ver perfis"       ON perfis FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "inserir perfis"   ON perfis FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "atualizar perfis" ON perfis FOR UPDATE USING (auth.role() = 'authenticated');

-- ============================================================
-- TRIGGER: cria perfil automaticamente ao cadastrar novo usuário
-- ============================================================
CREATE OR REPLACE FUNCTION criar_perfil_usuario()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO perfis (id, email, nome, funcao)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'nome', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'funcao', 'Médico')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_criar_perfil ON auth.users;
CREATE TRIGGER trg_criar_perfil
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION criar_perfil_usuario();

-- ============================================================
-- Criar perfil para usuários já existentes (execução única)
-- ============================================================
INSERT INTO perfis (id, email, nome, funcao)
SELECT
  id,
  email,
  COALESCE(raw_user_meta_data->>'nome', split_part(email, '@', 1)),
  COALESCE(raw_user_meta_data->>'funcao', 'Médico')
FROM auth.users
ON CONFLICT (id) DO NOTHING;
