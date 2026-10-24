-- =====================================================================
-- Configurações da Clínica — número e complemento do endereço, e
-- auditoria de alterações.
-- =====================================================================
--
-- Número/complemento separados do logradouro (que a busca por CEP já
-- preenche em "endereço") — mistura tudo num campo só dificultava
-- editar depois.
--
-- Auditoria: até aqui só pacientes/consultas/medicamentos_receita/
-- perfis tinham o trigger de supabase_auditoria.sql. Configurações da
-- clínica também precisa — é dado usado em todo documento impresso, e
-- o Administrador pediu rastro de quem mexeu.
--
-- Pressupõe supabase_configuracoes_clinica.sql e supabase_auditoria.sql
-- (usa registrar_auditoria()) já rodados. Seguro rodar mais de uma vez.
-- =====================================================================

ALTER TABLE configuracoes_clinica ADD COLUMN IF NOT EXISTS numero TEXT NOT NULL DEFAULT '';
ALTER TABLE configuracoes_clinica ADD COLUMN IF NOT EXISTS complemento TEXT NOT NULL DEFAULT '';

DROP TRIGGER IF EXISTS trg_auditoria_configuracoes_clinica ON configuracoes_clinica;
CREATE TRIGGER trg_auditoria_configuracoes_clinica
  AFTER INSERT OR UPDATE OR DELETE ON configuracoes_clinica
  FOR EACH ROW EXECUTE FUNCTION public.registrar_auditoria();
