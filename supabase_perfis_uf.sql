-- Estado (UF) do conselho que emitiu o CRM — CRM só é único dentro do
-- mesmo estado, então "12345" sozinho não identifica o médico.
ALTER TABLE perfis ADD COLUMN IF NOT EXISTS uf TEXT DEFAULT '';
