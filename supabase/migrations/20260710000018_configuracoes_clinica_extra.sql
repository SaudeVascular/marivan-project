-- =====================================================================
-- Configurações da Clínica — campos extras: Nome Fantasia (substitui
-- "subtitulo"), CNPJ, CEP separado do endereço, e logomarca.
-- =====================================================================
--
-- Complementa supabase_configuracoes_clinica.sql, já rodado. Nome
-- Fantasia ocupa o mesmo lugar que "subtitulo" tinha nos documentos
-- impressos (linha abaixo do nome da clínica no cabeçalho) — só muda o
-- significado do campo, por isso é um rename e não uma coluna nova.
--
-- CEP vira campo próprio (a tela de Configurações usa a mesma busca por
-- CEP do ViaCEP já usada no Cadastro de Pacientes) — antes o CEP vinha
-- misturado dentro do texto livre de "cidade".
--
-- A logomarca usa um bucket de Storage público próprio ("clinica"):
-- precisa aparecer em documento impresso sem exigir login, e só
-- Administrador pode trocar.
--
-- Pressupõe supabase_configuracoes_clinica.sql e supabase_rls_rbac.sql
-- (usa current_user_funcao()) já rodados. Seguro rodar mais de uma vez.
-- =====================================================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'configuracoes_clinica' AND column_name = 'subtitulo'
  ) THEN
    ALTER TABLE configuracoes_clinica RENAME COLUMN subtitulo TO nome_fantasia;
  END IF;
END $$;

ALTER TABLE configuracoes_clinica ADD COLUMN IF NOT EXISTS cnpj TEXT NOT NULL DEFAULT '';
ALTER TABLE configuracoes_clinica ADD COLUMN IF NOT EXISTS cep TEXT NOT NULL DEFAULT '';
ALTER TABLE configuracoes_clinica ADD COLUMN IF NOT EXISTS logo_url TEXT;

-- ---------------------------------------------------------------------
-- Bucket de Storage para a logomarca — público (leitura livre, pra
-- aparecer em documento impresso sem autenticação), upload/troca só
-- Administrador.
-- ---------------------------------------------------------------------

INSERT INTO storage.buckets (id, name, public)
VALUES ('clinica', 'clinica', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "logo da clinica - leitura publica" ON storage.objects;
CREATE POLICY "logo da clinica - leitura publica" ON storage.objects
  FOR SELECT
  USING (bucket_id = 'clinica');

DROP POLICY IF EXISTS "logo da clinica - upload admin" ON storage.objects;
CREATE POLICY "logo da clinica - upload admin" ON storage.objects
  FOR INSERT
  WITH CHECK (bucket_id = 'clinica' AND current_user_funcao() = 'Administrador');

DROP POLICY IF EXISTS "logo da clinica - atualizar admin" ON storage.objects;
CREATE POLICY "logo da clinica - atualizar admin" ON storage.objects
  FOR UPDATE
  USING (bucket_id = 'clinica' AND current_user_funcao() = 'Administrador');

DROP POLICY IF EXISTS "logo da clinica - excluir admin" ON storage.objects;
CREATE POLICY "logo da clinica - excluir admin" ON storage.objects
  FOR DELETE
  USING (bucket_id = 'clinica' AND current_user_funcao() = 'Administrador');
