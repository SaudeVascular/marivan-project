-- =====================================================================
-- Liga o cadastro de paciente ao catálogo de convênios do módulo
-- financeiro, em vez de texto livre. "Particular" passa a ser só mais
-- um convênio cadastrado (sem plano de saúde nenhum por trás).
--
-- Pressupõe supabase_financeiro.sql (tabela convenios) e
-- supabase_rls_rbac.sql (current_user_ativo()) já rodados. Seguro
-- rodar mais de uma vez.
-- =====================================================================

ALTER TABLE pacientes ADD COLUMN IF NOT EXISTS convenio_id UUID REFERENCES convenios(id) ON DELETE SET NULL;

-- Garante que "Particular" existe no catálogo (não duplica se já existir)
INSERT INTO convenios (nome)
SELECT 'Particular'
WHERE NOT EXISTS (SELECT 1 FROM convenios WHERE nome = 'Particular');

-- Cadastro de paciente é acessível a toda a equipe ativa (Recepcionista
-- inclusive), então a leitura da lista de convênios precisa acompanhar
-- — antes só Financeiro/Administrador liam. Gerenciar (criar/editar/
-- excluir) continua restrito, só amplia a leitura.
DROP POLICY IF EXISTS "ver convenios" ON convenios;
CREATE POLICY "ver convenios" ON convenios
  FOR SELECT
  USING (current_user_ativo());
