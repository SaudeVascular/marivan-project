-- =====================================================================
-- Prontuário: rascunho, assinatura e retificação — item mais importante
-- apontado numa revisão externa da tela de prontuário.
-- =====================================================================
--
-- Problema: hoje "Salvar Atendimento" já cria o registro como
-- definitivo, e o autor pode editar título/conteúdo por 8 horas
-- (código lia "24h" no nome da variável, mas usava 8*60*60*1000) — uma
-- edição sobrescreve o conteúdo anterior sem deixar rastro claro na
-- tela (só na tabela de auditoria, que não é o lugar onde alguém vai
-- procurar isso no dia a dia).
--
-- Solução: registro clínico consolidado (status = 'Assinado') passa a
-- ser imutável de verdade — nem o autor, nem Administrador, conseguem
-- mudar título/conteúdo/tipo depois de assinado (o trigger abaixo
-- bloqueia isso no banco, não só na tela). Uma correção depois da
-- assinatura vira uma retificação: uma linha NOVA, vinculada à
-- original por `retificacao_de`, com `motivo_retificacao` — a original
-- nunca desaparece.
--
-- 'Rascunho' é um estado novo: enquanto o profissional ainda está
-- escrevendo, o registro pode ser salvo e editado livremente no banco
-- (antes só existia rascunho local, em localStorage). Registros já
-- existentes (antes desta migração) entram como 'Assinado' — já eram
-- tratados como definitivos.
--
-- Pressupõe supabase_schema.sql e supabase_rls_rbac.sql já rodados.
-- Seguro rodar mais de uma vez.
--
-- Atenção: `consultas.status` já existia desde supabase_schema.sql,
-- com DEFAULT 'Realizada' e sem NOT NULL — criado para uma ideia que
-- nunca chegou a ser usada por nenhuma tela. Por isso o ADD COLUMN
-- abaixo é um no-op em bancos já existentes (a coluna já está lá) e
-- não basta: é preciso normalizar os valores antigos ('Realizada' ou
-- NULL) para 'Assinado' antes de aplicar a constraint nova, senão o
-- ALTER TABLE ... ADD CONSTRAINT falha com "violated by some row".
-- =====================================================================

ALTER TABLE consultas ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'Assinado';

UPDATE consultas
   SET status = 'Assinado'
 WHERE status IS NULL
    OR status NOT IN ('Rascunho', 'Assinado', 'Cancelado');

ALTER TABLE consultas ALTER COLUMN status SET DEFAULT 'Assinado';
ALTER TABLE consultas ALTER COLUMN status SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'consultas_status_check'
  ) THEN
    ALTER TABLE consultas ADD CONSTRAINT consultas_status_check
      CHECK (status IN ('Rascunho', 'Assinado', 'Cancelado'));
  END IF;
END $$;

ALTER TABLE consultas ADD COLUMN IF NOT EXISTS assinado_em TIMESTAMPTZ;
ALTER TABLE consultas ADD COLUMN IF NOT EXISTS assinado_por_nome TEXT;
ALTER TABLE consultas ADD COLUMN IF NOT EXISTS assinado_por_registro TEXT;
ALTER TABLE consultas ADD COLUMN IF NOT EXISTS retificacao_de UUID REFERENCES consultas(id) ON DELETE SET NULL;
ALTER TABLE consultas ADD COLUMN IF NOT EXISTS motivo_retificacao TEXT;

CREATE INDEX IF NOT EXISTS idx_consultas_retificacao_de ON consultas (retificacao_de);

-- ---------------------------------------------------------------------
-- Trigger: uma vez assinado, título/conteúdo/tipo não mudam mais —
-- SECURITY DEFINER e roda pra qualquer UPDATE, inclusive feito direto
-- no SQL Editor, não só pelo app.
-- ---------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.impedir_edicao_consulta_assinada()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.status = 'Assinado' AND (
    NEW.titulo IS DISTINCT FROM OLD.titulo OR
    NEW.conteudo IS DISTINCT FROM OLD.conteudo OR
    NEW.tipo IS DISTINCT FROM OLD.tipo
  ) THEN
    RAISE EXCEPTION 'Registro assinado não pode ser alterado — crie uma retificação em vez de editar.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_impedir_edicao_consulta_assinada ON consultas;
CREATE TRIGGER trg_impedir_edicao_consulta_assinada
  BEFORE UPDATE ON consultas
  FOR EACH ROW EXECUTE FUNCTION public.impedir_edicao_consulta_assinada();

-- ---------------------------------------------------------------------
-- A policy de UPDATE em supabase_rls_rbac.sql não restringia a quem
-- criou a linha — qualquer Médico/Enfermeiro(a) podia, por API direta,
-- editar o registro de outro colega. Com rascunho passando a ser
-- editável de verdade (não só via app), isso precisa ficar restrito ao
-- autor (ou Administrador, para suporte).
-- ---------------------------------------------------------------------

DROP POLICY IF EXISTS "editar consultas" ON consultas;
CREATE POLICY "editar consultas" ON consultas
  FOR UPDATE
  USING (
    current_user_ativo()
    AND current_user_funcao() IN ('Médico', 'Enfermeiro(a)', 'Administrador')
    AND (created_by = auth.uid() OR current_user_funcao() = 'Administrador')
  )
  WITH CHECK (
    current_user_ativo() AND (
      current_user_funcao() IN ('Médico', 'Administrador')
      OR (current_user_funcao() = 'Enfermeiro(a)' AND tipo NOT IN ('Receituário', 'Prescrição', 'Atestado'))
    )
  );
