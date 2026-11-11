-- Importações de planilha em lote (25/10/2026).
--
-- As migrações 50 e 51 gravavam linha por linha, e cada linha procurava o
-- procedimento pelo nome sem índice. Uma tabela do tamanho da TUSS (~6 mil
-- linhas) passava do limite de 8 s por comando que a Supabase impõe às
-- chamadas do app ("canceling statement due to statement timeout"), e
-- nada era gravado.
--
-- Agora cada importação faz poucos comandos sobre o arquivo inteiro, com
-- índice no nome do procedimento e no código TUSS do catálogo de exames.
-- As regras não mudam (ver 50 e 51): casa pelo código; sem código igual,
-- pelo nome de um procedimento ainda sem código (que ganha o código);
-- senão cria. Linha repetida no arquivo: vale a última. Tudo ou nada.
BEGIN;

-- A TUSS tem termos com mais de 300 caracteres (o maior, 302): o limite
-- da migração 50 sobe para 1000.
ALTER TABLE public.procedimentos DROP CONSTRAINT IF EXISTS procedimentos_codigo_tipo_validos;
ALTER TABLE public.procedimentos ADD CONSTRAINT procedimentos_codigo_tipo_validos CHECK (
      tipo IN ('Consulta', 'Exame', 'Procedimento')
  AND (codigo IS NULL OR codigo ~ '^[0-9A-Z]{1,20}$')
  AND (valor_particular IS NULL OR valor_particular >= 0)
  AND length(nome) BETWEEN 1 AND 1000
);

CREATE INDEX IF NOT EXISTS procedimentos_nome_lower_idx ON public.procedimentos (lower(nome));
CREATE INDEX IF NOT EXISTS exames_tuss_idx ON public.exames (tuss);

-- Linhas do arquivo, já normalizadas, e o motivo de recusa de cada uma.
CREATE OR REPLACE FUNCTION privado.itens_importacao(p_itens JSONB, p_exige_valor BOOLEAN)
RETURNS TABLE (ordem BIGINT, cod TEXT, descr TEXT, valor NUMERIC, tipo TEXT, chave TEXT, problema TEXT)
LANGUAGE sql
STABLE
AS $$
  SELECT x.ordem, x.cod, x.descr,
         CASE WHEN x.valor_txt ~ '^[0-9]{1,8}(\.[0-9]{1,2})?$' THEN x.valor_txt::NUMERIC END,
         x.tipo,
         COALESCE(x.cod, 'nome:' || lower(x.descr)),
         CASE
           WHEN x.cod IS NULL AND x.descr IS NULL THEN 'sem código nem descrição'
           WHEN length(x.cod) > 20 OR length(x.descr) > 1000 THEN 'código com mais de 20 caracteres ou descrição com mais de 1000'
           WHEN x.valor_txt IS NULL AND p_exige_valor THEN 'valor inválido (vazio)'
           WHEN x.valor_txt IS NOT NULL AND x.valor_txt !~ '^[0-9]{1,8}(\.[0-9]{1,2})?$' THEN 'valor inválido (' || x.valor_txt || ')'
           WHEN x.tipo IS NOT NULL AND x.tipo NOT IN ('Consulta', 'Exame', 'Procedimento') THEN 'tipo deve ser Consulta, Exame ou Procedimento'
         END
    FROM (
      SELECT e.ordem,
             privado.normalizar_codigo(e.l->>'codigo') AS cod,
             NULLIF(btrim(regexp_replace(COALESCE(e.l->>'descricao', ''), '\s+', ' ', 'g')), '') AS descr,
             e.l->>'valor' AS valor_txt,
             e.l->>'tipo' AS tipo
        FROM jsonb_array_elements(p_itens) WITH ORDINALITY AS e(l, ordem)
    ) x;
$$;
GRANT EXECUTE ON FUNCTION privado.itens_importacao(JSONB, BOOLEAN) TO authenticated;

-- Valida o arquivo e garante que todo item tenha procedimento no catálogo
-- (dá o código a quem casou pelo nome; cria o que falta). Devolve quantos
-- foram criados. Comum às duas importações.
CREATE OR REPLACE FUNCTION privado.preparar_importacao(p_itens JSONB, p_exige_valor BOOLEAN, p_valor_particular BOOLEAN)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
  ruim RECORD;
  novos INTEGER;
BEGIN
  IF jsonb_typeof(p_itens) IS DISTINCT FROM 'array' OR jsonb_array_length(p_itens) = 0 THEN
    RAISE EXCEPTION 'A tabela está vazia.' USING ERRCODE = '22023';
  END IF;
  IF jsonb_array_length(p_itens) > 20000 THEN
    RAISE EXCEPTION 'Tabela com mais de 20.000 linhas: divida o arquivo.' USING ERRCODE = '22023';
  END IF;
  SELECT i.ordem, i.problema INTO ruim FROM privado.itens_importacao(p_itens, p_exige_valor) i
   WHERE i.problema IS NOT NULL ORDER BY i.ordem LIMIT 1;
  IF FOUND THEN
    RAISE EXCEPTION 'Linha %: %.', ruim.ordem, ruim.problema USING ERRCODE = '22023';
  END IF;

  -- Mesmo nome, procedimento ainda sem código: ganha o código do arquivo.
  WITH u AS (
    SELECT DISTINCT ON (i.chave) i.* FROM privado.itens_importacao(p_itens, p_exige_valor) i ORDER BY i.chave, i.ordem DESC
  ), alvo AS (
    SELECT DISTINCT ON (p.id) p.id, u.cod
      FROM u JOIN public.procedimentos p ON lower(p.nome) = lower(u.descr) AND p.codigo IS NULL
     WHERE u.cod IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM public.procedimentos q WHERE q.codigo = u.cod)
     ORDER BY p.id, u.ordem DESC
  ), unico AS (
    SELECT DISTINCT ON (alvo.cod) alvo.* FROM alvo ORDER BY alvo.cod, alvo.id
  )
  UPDATE public.procedimentos p SET codigo = unico.cod FROM unico WHERE p.id = unico.id;

  WITH u AS (
    SELECT DISTINCT ON (i.chave) i.* FROM privado.itens_importacao(p_itens, p_exige_valor) i ORDER BY i.chave, i.ordem DESC
  )
  INSERT INTO public.procedimentos (nome, codigo, tipo, valor_particular)
  SELECT COALESCE(u.descr, u.cod), u.cod, COALESCE(u.tipo, privado.tipo_por_codigo(u.cod)),
         CASE WHEN p_valor_particular THEN u.valor END
    FROM u
   WHERE NOT EXISTS (
     SELECT 1 FROM public.procedimentos p
      WHERE (u.cod IS NOT NULL AND p.codigo = u.cod)
         OR (u.cod IS NULL AND lower(p.nome) = lower(u.descr)));
  GET DIAGNOSTICS novos = ROW_COUNT;
  RETURN novos;
END;
$$;
GRANT EXECUTE ON FUNCTION privado.preparar_importacao(JSONB, BOOLEAN, BOOLEAN) TO authenticated;

-- Cada item do arquivo (sem repetição) com o procedimento correspondente.
CREATE OR REPLACE FUNCTION privado.itens_com_procedimento(p_itens JSONB, p_exige_valor BOOLEAN)
RETURNS TABLE (procedimento_id UUID, cod TEXT, descr TEXT, valor NUMERIC, tipo TEXT, ordem BIGINT)
LANGUAGE sql
STABLE
AS $$
  WITH u AS (
    SELECT DISTINCT ON (i.chave) i.* FROM privado.itens_importacao(p_itens, p_exige_valor) i ORDER BY i.chave, i.ordem DESC
  ), m AS (
    SELECT p.id, u.cod, u.descr, u.valor, u.tipo, u.ordem, 0 AS prioridade, p.created_at
      FROM u JOIN public.procedimentos p ON p.codigo = u.cod
     WHERE u.cod IS NOT NULL
    UNION ALL
    SELECT p.id, u.cod, u.descr, u.valor, u.tipo, u.ordem, CASE WHEN p.ativo THEN 1 ELSE 2 END, p.created_at
      FROM u JOIN public.procedimentos p ON lower(p.nome) = lower(u.descr)
     WHERE u.cod IS NULL
  ), por_item AS (
    SELECT DISTINCT ON (m.ordem) m.* FROM m ORDER BY m.ordem, m.prioridade, m.created_at
  )
  SELECT DISTINCT ON (por_item.id) por_item.id, por_item.cod, por_item.descr, por_item.valor, por_item.tipo, por_item.ordem
    FROM por_item ORDER BY por_item.id, por_item.ordem DESC;
$$;
GRANT EXECUTE ON FUNCTION privado.itens_com_procedimento(JSONB, BOOLEAN) TO authenticated;

CREATE OR REPLACE FUNCTION public.importar_procedimentos(p_itens JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  novos INTEGER;
  atualizados INTEGER;
BEGIN
  IF NOT (COALESCE(public.current_user_ativo(), false)
          AND COALESCE(public.current_user_funcao() IN ('Financeiro', 'Administrador'), false)) THEN
    RAISE EXCEPTION 'Somente Financeiro ou Administrador importa procedimentos.' USING ERRCODE = '42501';
  END IF;
  novos := privado.preparar_importacao(p_itens, false, true);

  -- Os que já existiam: nome, tipo e valor particular do arquivo (quando vieram).
  UPDATE public.procedimentos p
     SET nome = COALESCE(m.descr, p.nome),
         tipo = COALESCE(m.tipo, p.tipo),
         valor_particular = COALESCE(m.valor, p.valor_particular)
    FROM privado.itens_com_procedimento(p_itens, false) m
   WHERE p.id = m.procedimento_id;
  GET DIAGNOSTICS atualizados = ROW_COUNT;
  atualizados := atualizados - novos; -- os recém-criados também passam pelo UPDATE

  RETURN jsonb_build_object('novos', novos, 'atualizados', atualizados);
END;
$$;

CREATE OR REPLACE FUNCTION public.importar_tabela_convenio(
  p_convenio_id UUID, p_itens JSONB, p_substituir BOOLEAN DEFAULT false
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  eh_particular BOOLEAN;
  novos INTEGER;
  gravados INTEGER;
  removidos INTEGER := 0;
BEGIN
  IF NOT (COALESCE(public.current_user_ativo(), false)
          AND COALESCE(public.current_user_funcao() IN ('Financeiro', 'Administrador'), false)) THEN
    RAISE EXCEPTION 'Somente Financeiro ou Administrador importa tabelas.' USING ERRCODE = '42501';
  END IF;
  SELECT c.particular INTO eh_particular FROM public.convenios c WHERE c.id = p_convenio_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Convênio não encontrado.' USING ERRCODE = '22023';
  END IF;
  novos := privado.preparar_importacao(p_itens, true, false);

  -- Tipo informado no arquivo vale também para procedimento que já existia.
  UPDATE public.procedimentos p SET tipo = m.tipo
    FROM privado.itens_com_procedimento(p_itens, true) m
   WHERE p.id = m.procedimento_id AND m.tipo IS NOT NULL AND p.tipo IS DISTINCT FROM m.tipo;

  IF eh_particular THEN
    UPDATE public.procedimentos p SET valor_particular = m.valor
      FROM privado.itens_com_procedimento(p_itens, true) m
     WHERE p.id = m.procedimento_id;
  ELSE
    INSERT INTO public.convenio_valores (convenio_id, procedimento_id, valor, codigo)
    SELECT p_convenio_id, m.procedimento_id, m.valor, m.cod
      FROM privado.itens_com_procedimento(p_itens, true) m
    ON CONFLICT (convenio_id, procedimento_id) DO UPDATE SET valor = EXCLUDED.valor, codigo = EXCLUDED.codigo;
  END IF;
  GET DIAGNOSTICS gravados = ROW_COUNT;

  IF p_substituir THEN
    IF eh_particular THEN
      UPDATE public.procedimentos SET valor_particular = NULL
       WHERE valor_particular IS NOT NULL
         AND id NOT IN (SELECT m.procedimento_id FROM privado.itens_com_procedimento(p_itens, true) m);
    ELSE
      DELETE FROM public.convenio_valores
       WHERE convenio_id = p_convenio_id
         AND procedimento_id NOT IN (SELECT m.procedimento_id FROM privado.itens_com_procedimento(p_itens, true) m);
    END IF;
    GET DIAGNOSTICS removidos = ROW_COUNT;
  END IF;

  RETURN jsonb_build_object('gravados', gravados, 'procedimentos_novos', novos, 'removidos', removidos);
END;
$$;

COMMIT;
