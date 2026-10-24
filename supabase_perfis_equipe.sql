-- =====================================================================
-- Deixa a equipe ativa visível uns para os outros (roster), mascarando
-- dado pessoal sensível — corrige a Recepcionista não conseguir listar
-- Médico/Enfermeiro(a) ao agendar (e o mesmo problema silencioso no
-- Financeiro, que não consegue listar médicos pra lançar cobrança nem
-- mostrar o nome do médico no recibo).
-- =====================================================================
--
-- Causa: `supabase_rls_rbac.sql` deixou "ver perfis" só para o próprio
-- usuário ou Administrador. Isso trava qualquer tela que precise saber
-- quem mais trabalha na clínica (Agenda, Recepção, Financeiro), porque
-- RLS filtra a LINHA inteira — não dá pra "ver só o nome" de outro
-- perfil com a policy como está.
--
-- Solução, no mesmo espírito de supabase_pacientes_mascara_clinica.sql:
--   1. amplia a policy de linha: qualquer usuário ativo pode ver linhas
--      de outros usuários ativos (além de si mesmo e Administrador,
--      que já podiam);
--   2. cria `perfis_view`, que mascara os campos pessoais sensíveis
--      (cpf, nascimento, sexo) quando quem consulta não é o dono do
--      perfil nem Administrador — nome, função, CRM/UF e especialidade
--      continuam visíveis pra qualquer colega (são exatamente os dados
--      que Agenda/Recepção/Financeiro precisam pra identificar um
--      profissional).
--
-- Pressupõe supabase_rls_rbac.sql, supabase_perfis_extra.sql,
-- supabase_crm.sql e supabase_perfis_uf.sql já rodados. Seguro rodar
-- mais de uma vez.
-- =====================================================================

DROP POLICY IF EXISTS "ver perfis" ON perfis;
CREATE POLICY "ver perfis" ON perfis
  FOR SELECT
  USING (
    auth.uid() = id
    OR current_user_funcao() = 'Administrador'
    OR (current_user_ativo() AND ativo)
  );

CREATE OR REPLACE VIEW perfis_view
WITH (security_invoker = true) AS
SELECT
  p.id,
  p.nome,
  p.email,
  p.funcao,
  p.crm,
  p.uf,
  p.especialidade,
  p.area_atuacao,
  p.ativo,
  p.created_at,
  CASE WHEN p.id = auth.uid() OR current_user_funcao() = 'Administrador'
       THEN p.cpf END AS cpf,
  CASE WHEN p.id = auth.uid() OR current_user_funcao() = 'Administrador'
       THEN p.nascimento END AS nascimento,
  CASE WHEN p.id = auth.uid() OR current_user_funcao() = 'Administrador'
       THEN p.sexo END AS sexo
FROM perfis p;

GRANT SELECT ON perfis_view TO authenticated;
