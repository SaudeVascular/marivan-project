-- =====================================================================
-- Tabela de auditoria — item da Fase 1 do Documento Mestre, ligado às
-- regras de negócio 8.1 ("alterações importantes devem gerar registro
-- de auditoria") e 8.2 ("correções devem preservar o conteúdo anterior").
-- =====================================================================
--
-- Registra automaticamente, no nível do banco (não depende do app fazer
-- a chamada certa), toda inserção/alteração/exclusão em pacientes,
-- consultas, medicamentos_receita e perfis — guardando o registro
-- inteiro antes e depois da mudança, quem fez e quando.
--
-- Por rodar como trigger SECURITY DEFINER, funciona mesmo se o dado for
-- alterado direto no SQL Editor, não só pelo app.
--
-- Seguro rodar mais de uma vez. Pressupõe que supabase_rls_rbac.sql já
-- foi rodado (usa current_user_funcao()); se não tiver sido, a função é
-- recriada aqui também, então funciona rodando sozinho.
-- =====================================================================

CREATE OR REPLACE FUNCTION public.current_user_funcao()
RETURNS TEXT
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT funcao FROM perfis WHERE id = auth.uid();
$$;

-- ---------------------------------------------------------------------
-- 1. Tabela
-- ---------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS auditoria (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tabela         TEXT NOT NULL,
  registro_id    UUID,
  operacao       TEXT NOT NULL CHECK (operacao IN ('INSERT', 'UPDATE', 'DELETE')),
  dados_antigos  JSONB,
  dados_novos    JSONB,
  alterado_por   UUID REFERENCES auth.users(id),
  alterado_em    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_auditoria_registro ON auditoria (tabela, registro_id);
CREATE INDEX IF NOT EXISTS idx_auditoria_data ON auditoria (alterado_em DESC);

-- ---------------------------------------------------------------------
-- 2. RLS — só Administrador lê; ninguém insere/edita/apaga direto
--    (a única forma de gravar é o trigger abaixo, que roda como
--    SECURITY DEFINER e ignora RLS — o registro de auditoria fica
--    protegido mesmo de um usuário com acesso de escrita nas outras
--    tabelas)
-- ---------------------------------------------------------------------

ALTER TABLE auditoria ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ver auditoria" ON auditoria;
CREATE POLICY "ver auditoria" ON auditoria
  FOR SELECT
  USING (current_user_funcao() = 'Administrador');

-- ---------------------------------------------------------------------
-- 3. Trigger genérico
-- ---------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.registrar_auditoria()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO auditoria (tabela, registro_id, operacao, dados_antigos, dados_novos, alterado_por)
  VALUES (
    TG_TABLE_NAME,
    COALESCE(NEW.id, OLD.id),
    TG_OP,
    CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN to_jsonb(OLD) ELSE NULL END,
    CASE WHEN TG_OP IN ('UPDATE', 'INSERT') THEN to_jsonb(NEW) ELSE NULL END,
    auth.uid()
  );
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_auditoria_pacientes ON pacientes;
CREATE TRIGGER trg_auditoria_pacientes
  AFTER INSERT OR UPDATE OR DELETE ON pacientes
  FOR EACH ROW EXECUTE FUNCTION public.registrar_auditoria();

DROP TRIGGER IF EXISTS trg_auditoria_consultas ON consultas;
CREATE TRIGGER trg_auditoria_consultas
  AFTER INSERT OR UPDATE OR DELETE ON consultas
  FOR EACH ROW EXECUTE FUNCTION public.registrar_auditoria();

DROP TRIGGER IF EXISTS trg_auditoria_medicamentos ON medicamentos_receita;
CREATE TRIGGER trg_auditoria_medicamentos
  AFTER INSERT OR UPDATE OR DELETE ON medicamentos_receita
  FOR EACH ROW EXECUTE FUNCTION public.registrar_auditoria();

DROP TRIGGER IF EXISTS trg_auditoria_perfis ON perfis;
CREATE TRIGGER trg_auditoria_perfis
  AFTER INSERT OR UPDATE OR DELETE ON perfis
  FOR EACH ROW EXECUTE FUNCTION public.registrar_auditoria();
