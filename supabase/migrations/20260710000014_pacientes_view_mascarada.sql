-- =====================================================================
-- Mascara os campos clínicos de `pacientes` (alergias e antecedentes)
-- para quem não é Médico/Enfermeiro(a)/Administrador.
-- =====================================================================
--
-- Problema: `supabase_rls_rbac.sql` já impede Recepcionista de ler a
-- tabela `consultas` (evoluções/prontuário), mas RLS trabalha por
-- LINHA, não por coluna. A tabela `pacientes` precisa continuar
-- inteira legível pela Recepcionista (cadastro administrativo), e ela
-- guarda também alergias e antecedentes clínicos (has, dm, dac,
-- dislipidemia, tabagismo, etilismo, cirurgias, medicamentos_uso) —
-- hoje esses campos chegam no JSON de qualquer usuário autenticado,
-- mesmo a tela de Cadastro de Pacientes só exibindo Alergias para
-- perfil clínico (ver App.js, PacientesPage).
--
-- Solução: como todo usuário autenticado do Supabase cai no mesmo role
-- de Postgres (`authenticated`) — a distinção Médico/Recepcionista é
-- só a coluna `perfis.funcao` — não dá para usar GRANT/REVOKE de
-- coluna direto na tabela. Em vez disso, o app passa a ler pacientes
-- por uma VIEW que mascara os campos clínicos com base em
-- current_user_funcao(), a mesma função SECURITY DEFINER já criada em
-- supabase_rls_rbac.sql. Escritas continuam indo direto pra tabela
-- `pacientes` (a view não é atualizável, por causa do CASE).
--
-- Mesmo conjunto de funções liberado para campos clínicos em App.js
-- (FUNCOES_CLINICAS) — mantenha os dois em sincronia.
--
-- Pressupõe supabase_schema.sql, supabase_rls_rbac.sql e
-- supabase_pacientes_convenio.sql já rodados. Seguro rodar mais de uma
-- vez.
-- =====================================================================

CREATE OR REPLACE VIEW pacientes_view
WITH (security_invoker = true) AS
SELECT
  p.id,
  p.nome,
  p.cpf,
  p.nascimento,
  p.nome_mae,
  p.telefone,
  p.convenio_id,
  c.nome AS convenio_nome,
  p.cep,
  p.endereco,
  p.ativo,
  p.created_by,
  p.created_at,
  p.updated_at,
  CASE WHEN current_user_funcao() IN ('Médico', 'Enfermeiro(a)', 'Administrador')
       THEN p.alergias END AS alergias,
  CASE WHEN current_user_funcao() IN ('Médico', 'Enfermeiro(a)', 'Administrador')
       THEN p.has END AS has,
  CASE WHEN current_user_funcao() IN ('Médico', 'Enfermeiro(a)', 'Administrador')
       THEN p.dm END AS dm,
  CASE WHEN current_user_funcao() IN ('Médico', 'Enfermeiro(a)', 'Administrador')
       THEN p.dac END AS dac,
  CASE WHEN current_user_funcao() IN ('Médico', 'Enfermeiro(a)', 'Administrador')
       THEN p.dislipidemia END AS dislipidemia,
  CASE WHEN current_user_funcao() IN ('Médico', 'Enfermeiro(a)', 'Administrador')
       THEN p.tabagismo END AS tabagismo,
  CASE WHEN current_user_funcao() IN ('Médico', 'Enfermeiro(a)', 'Administrador')
       THEN p.etilismo END AS etilismo,
  CASE WHEN current_user_funcao() IN ('Médico', 'Enfermeiro(a)', 'Administrador')
       THEN p.cirurgias END AS cirurgias,
  CASE WHEN current_user_funcao() IN ('Médico', 'Enfermeiro(a)', 'Administrador')
       THEN p.medicamentos_uso END AS medicamentos_uso
FROM pacientes p
LEFT JOIN convenios c ON c.id = p.convenio_id;

-- `security_invoker = true` faz a view rodar com o role de quem
-- consulta, então a policy "ver pacientes" (current_user_ativo()) de
-- supabase_rls_rbac.sql continua valendo por trás da view — sem isso,
-- a view rodaria com o role do dono (postgres) e ignoraria a RLS.

GRANT SELECT ON pacientes_view TO authenticated;
