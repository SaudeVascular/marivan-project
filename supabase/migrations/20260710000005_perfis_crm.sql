-- Adiciona o campo CRM à tabela de perfis de usuários
-- Executar no SQL Editor do Supabase

ALTER TABLE perfis ADD COLUMN IF NOT EXISTS crm TEXT DEFAULT '';
