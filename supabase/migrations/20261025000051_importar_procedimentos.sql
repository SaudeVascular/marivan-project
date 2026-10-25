-- Importação do catálogo de procedimentos a partir de planilha (pedido do
-- responsável clínico, 25/10/2026): antes, cada procedimento era cadastrado
-- um a um na aba Procedimentos.
--
-- importar_procedimentos(itens) grava de uma vez (tudo ou nada) a lista
-- lida da planilha — código, descrição, tipo (opcional) e valor particular
-- (opcional):
--   * procedimento com o mesmo código: atualiza nome, tipo (se veio) e
--     valor particular (se veio);
--   * sem código igual, mesmo nome e ainda sem código: é o mesmo; ganha o
--     código;
--   * senão, cria — tipo pelo código TUSS quando a planilha não diz.
-- Nada é apagado nem desativado: o catálogo só cresce ou é atualizado.
BEGIN;

CREATE OR REPLACE FUNCTION public.importar_procedimentos(p_itens JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  item RECORD;
  cod TEXT;
  descr TEXT;
  valor NUMERIC;
  proc_id UUID;
  novos INTEGER := 0;
  atualizados INTEGER := 0;
BEGIN
  IF NOT (COALESCE(public.current_user_ativo(), false)
          AND COALESCE(public.current_user_funcao() IN ('Financeiro', 'Administrador'), false)) THEN
    RAISE EXCEPTION 'Somente Financeiro ou Administrador importa procedimentos.' USING ERRCODE = '42501';
  END IF;
  IF jsonb_typeof(p_itens) IS DISTINCT FROM 'array' OR jsonb_array_length(p_itens) = 0 THEN
    RAISE EXCEPTION 'A tabela está vazia.' USING ERRCODE = '22023';
  END IF;
  IF jsonb_array_length(p_itens) > 20000 THEN
    RAISE EXCEPTION 'Tabela com mais de 20.000 linhas: divida o arquivo.' USING ERRCODE = '22023';
  END IF;

  FOR item IN
    SELECT x.ordem, x.linha->>'codigo' AS codigo, x.linha->>'descricao' AS descricao,
           x.linha->>'valor' AS valor, x.linha->>'tipo' AS tipo
      FROM jsonb_array_elements(p_itens) WITH ORDINALITY AS x(linha, ordem)
  LOOP
    cod := privado.normalizar_codigo(item.codigo);
    descr := NULLIF(btrim(regexp_replace(COALESCE(item.descricao, ''), '\s+', ' ', 'g')), '');
    IF cod IS NULL AND descr IS NULL THEN
      RAISE EXCEPTION 'Linha %: sem código nem descrição.', item.ordem USING ERRCODE = '22023';
    END IF;
    IF length(cod) > 20 OR length(descr) > 300 THEN
      RAISE EXCEPTION 'Linha %: código com mais de 20 caracteres ou descrição com mais de 300.', item.ordem USING ERRCODE = '22023';
    END IF;
    IF item.valor IS NOT NULL AND item.valor !~ '^[0-9]{1,8}(\.[0-9]{1,2})?$' THEN
      RAISE EXCEPTION 'Linha %: valor inválido (%).', item.ordem, item.valor USING ERRCODE = '22023';
    END IF;
    IF item.tipo IS NOT NULL AND item.tipo NOT IN ('Consulta', 'Exame', 'Procedimento') THEN
      RAISE EXCEPTION 'Linha %: tipo deve ser Consulta, Exame ou Procedimento.', item.ordem USING ERRCODE = '22023';
    END IF;
    valor := item.valor::NUMERIC;

    proc_id := NULL;
    IF cod IS NOT NULL THEN
      SELECT p.id INTO proc_id FROM public.procedimentos p WHERE p.codigo = cod;
    END IF;
    IF proc_id IS NULL AND descr IS NOT NULL THEN
      SELECT p.id INTO proc_id FROM public.procedimentos p
       WHERE lower(p.nome) = lower(descr) AND (p.codigo IS NULL OR cod IS NULL)
       ORDER BY p.ativo DESC, p.created_at LIMIT 1;
    END IF;

    IF proc_id IS NULL THEN
      INSERT INTO public.procedimentos (nome, codigo, tipo, valor_particular)
      VALUES (COALESCE(descr, cod), cod, COALESCE(item.tipo, privado.tipo_por_codigo(cod)), valor);
      novos := novos + 1;
    ELSE
      UPDATE public.procedimentos
         SET nome = COALESCE(descr, nome),
             codigo = COALESCE(codigo, cod),
             tipo = COALESCE(item.tipo, tipo),
             valor_particular = COALESCE(valor, valor_particular)
       WHERE id = proc_id;
      atualizados := atualizados + 1;
    END IF;
  END LOOP;

  RETURN jsonb_build_object('novos', novos, 'atualizados', atualizados);
END;
$$;
REVOKE ALL ON FUNCTION public.importar_procedimentos(JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.importar_procedimentos(JSONB) TO authenticated;

COMMIT;
