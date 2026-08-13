-- Tabela de modelos de prescrição em texto livre
-- Executar no SQL Editor do Supabase

CREATE TABLE IF NOT EXISTS modelos_receita (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nome       TEXT        NOT NULL,
  conteudo   TEXT        NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE modelos_receita ENABLE ROW LEVEL SECURITY;

-- Cada médico vê e gerencia apenas seus próprios modelos
CREATE POLICY "ver modelos"    ON modelos_receita FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "criar modelos"  ON modelos_receita FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "deletar modelos" ON modelos_receita FOR DELETE USING (auth.uid() = user_id);
