-- Adiciona campos extras ao perfil do usuário
-- Executar no SQL Editor do Supabase

ALTER TABLE perfis ADD COLUMN IF NOT EXISTS nascimento DATE;
ALTER TABLE perfis ADD COLUMN IF NOT EXISTS sexo      TEXT DEFAULT '';
ALTER TABLE perfis ADD COLUMN IF NOT EXISTS cpf       TEXT DEFAULT '';
