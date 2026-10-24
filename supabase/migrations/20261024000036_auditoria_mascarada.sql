-- Auditoria sem vazamento clínico.
--
-- Problema (segunda opinião, 24/10/2026, reproduzido localmente): a
-- trigger registrar_auditoria grava a linha INTEIRA (to_jsonb) e a
-- policy "ver auditoria" (migração 09) libera a leitura a qualquer
-- Administrador. Depois que a migração 30 separou Administrador de papel
-- clínico, isso virou um desvio: um Administrador SEM papel clínico lia
-- pela auditoria o conteúdo das consultas, receitas e antecedentes dos
-- pacientes — e, qualquer Administrador, a imagem de assinatura de
-- outros profissionais (que nem a perfis_view lhe mostra).
--
-- Correção, no banco e só na LEITURA (as linhas gravadas não são
-- alteradas — a auditoria continua íntegra, inclusive o histórico já
-- existente, que passa a sair mascarado também):
--   * authenticated perde o SELECT direto em public.auditoria;
--   * leitura passa a ser por public.auditoria_view, só Administrador
--     ativo, com auditoria_mascarar() aplicada a dados_antigos/novos:
--       - assinatura_imagem: nunca sai, para ninguém;
--       - sem papel clínico: consultas e medicamentos_receita só com
--         metadados (lista branca); pacientes sem os antecedentes.
--     Campo restrito sai como "[restrito]", ou "[restrito — alterado]"
--     quando o valor mudou naquela operação — dá pra ver O QUE mudou sem
--     ver o conteúdo.

BEGIN;

CREATE OR REPLACE FUNCTION public.auditoria_mascarar(p_tabela TEXT, p_dados JSONB, p_outro JSONB)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  clinico BOOLEAN := public.current_user_papel_clinico() IS NOT NULL;
  resultado JSONB := '{}'::JSONB;
  chave TEXT;
  valor JSONB;
  restrito BOOLEAN;
BEGIN
  IF p_dados IS NULL THEN RETURN NULL; END IF;

  FOR chave, valor IN SELECT * FROM jsonb_each(p_dados) LOOP
    restrito := chave = 'assinatura_imagem'
      OR (NOT clinico AND (
        (p_tabela = 'consultas' AND chave <> ALL (ARRAY[
          'id', 'paciente_id', 'tipo', 'data', 'hora', 'status', 'medico', 'crm', 'medico_id',
          'created_by', 'created_at', 'assinado_em', 'assinado_por_nome', 'assinado_por_registro',
          'retificacao_de', 'versao']))
        OR (p_tabela = 'medicamentos_receita' AND chave <> ALL (ARRAY['id', 'consulta_id', 'ordem']))
        OR (p_tabela = 'pacientes' AND chave = ANY (ARRAY[
          'alergias', 'has', 'dm', 'dac', 'dislipidemia', 'tabagismo', 'etilismo',
          'cirurgias', 'medicamentos_uso', 'outras_comorbidades']))
      ));

    IF restrito AND valor IS NOT NULL AND valor <> 'null'::JSONB THEN
      valor := to_jsonb(CASE
        WHEN p_outro IS NOT NULL AND (p_outro -> chave) IS DISTINCT FROM valor THEN '[restrito — alterado]'
        ELSE '[restrito]'
      END);
    END IF;
    resultado := resultado || jsonb_build_object(chave, valor);
  END LOOP;

  RETURN resultado;
END;
$$;

REVOKE ALL ON FUNCTION public.auditoria_mascarar(TEXT, JSONB, JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.auditoria_mascarar(TEXT, JSONB, JSONB) TO authenticated;

CREATE OR REPLACE VIEW public.auditoria_view
WITH (security_barrier = true, security_invoker = false) AS
SELECT
  a.id,
  a.tabela,
  a.registro_id,
  a.operacao,
  public.auditoria_mascarar(a.tabela, a.dados_antigos, a.dados_novos) AS dados_antigos,
  public.auditoria_mascarar(a.tabela, a.dados_novos, a.dados_antigos) AS dados_novos,
  a.alterado_por,
  a.alterado_em
FROM public.auditoria a
WHERE public.current_user_ativo() AND public.current_user_funcao() = 'Administrador';

REVOKE ALL ON public.auditoria_view FROM PUBLIC, anon;
GRANT SELECT ON public.auditoria_view TO authenticated;

-- Tabela base: ninguém lê direto (a trigger SECURITY DEFINER continua
-- gravando; a policy fica como segunda barreira se alguém reconceder).
REVOKE SELECT ON public.auditoria FROM authenticated;

COMMIT;
