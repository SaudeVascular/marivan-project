-- =====================================================================
-- RLS por função (RBAC) — substitui as policies "auth.role() = 'authenticated'"
-- =====================================================================
--
-- Hoje qualquer usuário autenticado (médico, enfermeiro, recepção, admin)
-- pode ver e editar todos os pacientes, todas as evoluções/registros
-- clínicos, e qualquer um pode alterar a função (funcao) de qualquer
-- outro usuário — inclusive promover a si mesmo a Administrador.
--
-- Este script:
--   1. cria duas funções SECURITY DEFINER para ler a função/status do
--      usuário logado sem risco de recursão de RLS (mesmo padrão já
--      usado por criar_perfil_usuario() neste projeto);
--   2. reescreve as policies de pacientes, consultas, medicamentos_receita
--      e perfis;
--   3. adiciona um trigger em perfis para impedir que alguém que não seja
--      Administrador altere a própria função ou a de outra pessoa.
--
-- É seguro rodar mais de uma vez (todo DROP usa IF EXISTS).
-- Rode no SQL Editor do projeto Supabase. Depois, teste com um usuário
-- de cada função (Médico, Enfermeiro(a), Recepcionista, Administrador).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Funções auxiliares (SECURITY DEFINER: leem perfis ignorando RLS,
--    evitando o problema clássico de uma policy de perfis referenciar
--    a própria tabela perfis recursivamente)
-- ---------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.current_user_funcao()
RETURNS TEXT
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT funcao FROM perfis WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.current_user_ativo()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT COALESCE(ativo, false) FROM perfis WHERE id = auth.uid();
$$;

-- ---------------------------------------------------------------------
-- 2. perfis
--    - qualquer autenticado pode ler seu próprio perfil (necessário para
--      o app funcionar); Administrador pode ler todos, para a tela de
--      gestão de usuários
--    - inserir só o próprio perfil (id = auth.uid()) — a criação de
--      perfil de terceiros continua acontecendo via trigger
--      SECURITY DEFINER no signup, que não passa por RLS
--    - atualizar: o próprio usuário pode editar seu perfil, e
--      Administrador pode editar qualquer um; o trigger abaixo bloqueia
--      a troca do campo funcao por quem não é Administrador
-- ---------------------------------------------------------------------

DROP POLICY IF EXISTS "ver perfis" ON perfis;
DROP POLICY IF EXISTS "inserir perfis" ON perfis;
DROP POLICY IF EXISTS "atualizar perfis" ON perfis;

CREATE POLICY "ver perfis" ON perfis
  FOR SELECT
  USING (auth.uid() = id OR current_user_funcao() = 'Administrador');

CREATE POLICY "inserir perfis" ON perfis
  FOR INSERT
  WITH CHECK (auth.uid() = id);

CREATE POLICY "atualizar perfis" ON perfis
  FOR UPDATE
  USING (auth.uid() = id OR current_user_funcao() = 'Administrador')
  WITH CHECK (auth.uid() = id OR current_user_funcao() = 'Administrador');

CREATE OR REPLACE FUNCTION public.impedir_auto_promocao()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.funcao IS DISTINCT FROM OLD.funcao AND current_user_funcao() <> 'Administrador' THEN
    RAISE EXCEPTION 'Apenas administradores podem alterar a função de um usuário';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_impedir_auto_promocao ON perfis;
CREATE TRIGGER trg_impedir_auto_promocao
  BEFORE UPDATE ON perfis
  FOR EACH ROW
  EXECUTE FUNCTION public.impedir_auto_promocao();

-- ---------------------------------------------------------------------
-- 3. pacientes
--    Cadastro administrativo — todo profissional ativo precisa (médico,
--    enfermagem e recepção usam o cadastro do paciente no dia a dia).
--    Só passa a exigir que a conta esteja ativa.
-- ---------------------------------------------------------------------

DROP POLICY IF EXISTS "ver pacientes" ON pacientes;
DROP POLICY IF EXISTS "criar pacientes" ON pacientes;
DROP POLICY IF EXISTS "editar pacientes" ON pacientes;
DROP POLICY IF EXISTS "excluir pacientes" ON pacientes;

CREATE POLICY "ver pacientes" ON pacientes
  FOR SELECT
  USING (current_user_ativo());

CREATE POLICY "criar pacientes" ON pacientes
  FOR INSERT
  WITH CHECK (current_user_ativo());

CREATE POLICY "editar pacientes" ON pacientes
  FOR UPDATE
  USING (current_user_ativo())
  WITH CHECK (current_user_ativo());

CREATE POLICY "excluir pacientes" ON pacientes
  FOR DELETE
  USING (current_user_funcao() = 'Administrador');

-- ---------------------------------------------------------------------
-- 4. consultas (registros clínicos: evoluções, atestados, receituários,
--    relatórios, laudos, pedidos de exame)
--    Só perfis clínicos. Recepcionista deixa de ver evoluções médicas,
--    conforme a seção 2.3 do Documento Mestre do projeto.
-- ---------------------------------------------------------------------

DROP POLICY IF EXISTS "ver consultas" ON consultas;
DROP POLICY IF EXISTS "criar consultas" ON consultas;
DROP POLICY IF EXISTS "editar consultas" ON consultas;
DROP POLICY IF EXISTS "excluir consultas" ON consultas;

CREATE POLICY "ver consultas" ON consultas
  FOR SELECT
  USING (current_user_ativo() AND current_user_funcao() IN ('Médico', 'Enfermeiro(a)', 'Administrador'));

CREATE POLICY "criar consultas" ON consultas
  FOR INSERT
  WITH CHECK (current_user_ativo() AND current_user_funcao() IN ('Médico', 'Enfermeiro(a)', 'Administrador'));

CREATE POLICY "editar consultas" ON consultas
  FOR UPDATE
  USING (current_user_ativo() AND current_user_funcao() IN ('Médico', 'Enfermeiro(a)', 'Administrador'))
  WITH CHECK (current_user_ativo() AND current_user_funcao() IN ('Médico', 'Enfermeiro(a)', 'Administrador'));

CREATE POLICY "excluir consultas" ON consultas
  FOR DELETE
  USING (current_user_funcao() = 'Administrador');

-- ---------------------------------------------------------------------
-- 5. medicamentos_receita (itens de receituário, sempre vinculados a
--    uma consulta) — mesma regra de acesso clínico de "consultas"
-- ---------------------------------------------------------------------

DROP POLICY IF EXISTS "ver medicamentos" ON medicamentos_receita;
DROP POLICY IF EXISTS "criar medicamentos" ON medicamentos_receita;
DROP POLICY IF EXISTS "editar medicamentos" ON medicamentos_receita;
DROP POLICY IF EXISTS "excluir medicamentos" ON medicamentos_receita;

CREATE POLICY "ver medicamentos" ON medicamentos_receita
  FOR SELECT
  USING (current_user_ativo() AND current_user_funcao() IN ('Médico', 'Enfermeiro(a)', 'Administrador'));

CREATE POLICY "criar medicamentos" ON medicamentos_receita
  FOR INSERT
  WITH CHECK (current_user_ativo() AND current_user_funcao() IN ('Médico', 'Enfermeiro(a)', 'Administrador'));

CREATE POLICY "editar medicamentos" ON medicamentos_receita
  FOR UPDATE
  USING (current_user_ativo() AND current_user_funcao() IN ('Médico', 'Enfermeiro(a)', 'Administrador'))
  WITH CHECK (current_user_ativo() AND current_user_funcao() IN ('Médico', 'Enfermeiro(a)', 'Administrador'));

CREATE POLICY "excluir medicamentos" ON medicamentos_receita
  FOR DELETE
  USING (current_user_funcao() = 'Administrador');
