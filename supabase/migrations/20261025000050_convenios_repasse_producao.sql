-- Convênios com dados da operadora e tabela própria; repasse por
-- profissional; relatório de produção (decisão do responsável clínico,
-- 25/10/2026).
--
--   1. Convênio guarda os dados da operadora (razão social, CNPJ, registro
--      ANS, código do prestador, contato, endereço, prazo de pagamento,
--      tabela de referência). O convênio marcado como `particular` é a
--      tabela da própria clínica: o valor dele é procedimentos.valor_particular.
--   2. Procedimento ganha código (TUSS/CBHPM, guardado sem pontos nem
--      traços) e tipo (Consulta, Exame ou Procedimento — é o tipo que
--      decide o percentual de repasse). Valor particular pode ficar vazio:
--      procedimento que só existe na tabela de um convênio não vira
--      "particular a R$ 0,00".
--   3. importar_tabela_convenio(convênio, itens, substituir) grava de uma
--      vez a tabela lida da planilha: casa cada linha com o procedimento
--      pelo código (ou, sem código, pelo nome), cria o que não existe e
--      grava o valor acordado. Com `substituir`, o que não veio no arquivo
--      sai da tabela do convênio. Tudo ou nada.
--   4. Repasse sai do procedimento e vai para o profissional
--      (repasse_profissional): cada um tem seu percentual de consulta, de
--      exame e de procedimento. Só o Administrador define. A cobrança
--      guarda o percentual do momento em que nasce (o banco calcula; muda
--      só enquanto Pendente e se mudar o profissional ou o procedimento) —
--      mudar a regra depois não reescreve o passado.
--   5. Todo profissional (não só Médico) lê as próprias cobranças.
--   6. relatorio_producao(de, até, profissional): atendimentos não
--      cancelados do período com procedimento, convênio, valor, repasse e
--      o que fica para a clínica. Financeiro e Administrador veem todos;
--      os demais, só a própria produção — pedir a de outro é recusado.
BEGIN;

-- Código de procedimento: só letras e dígitos, maiúsculas.
-- "1.01.01.01-2" (CBHPM) e "10101012" (TUSS) são o mesmo código.
CREATE OR REPLACE FUNCTION privado.normalizar_codigo(p TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$ SELECT NULLIF(upper(regexp_replace(COALESCE(p, ''), '[^0-9A-Za-z]', '', 'g')), '') $$;
GRANT EXECUTE ON FUNCTION privado.normalizar_codigo(TEXT) TO authenticated;

-- CNPJ, numérico ou alfanumérico (IN RFB 2.229/2024, em vigor desde
-- julho de 2026): 12 caracteres [0-9A-Z] e 2 dígitos verificadores
-- (módulo 11, cada caractere vale seu código ASCII − 48).
CREATE OR REPLACE FUNCTION public.cnpj_valido(p TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  c TEXT := upper(regexp_replace(COALESCE(p, ''), '[./-]', '', 'g'));
  pesos INTEGER[] := ARRAY[6,5,4,3,2,9,8,7,6,5,4,3,2];
  soma INTEGER;
  dv INTEGER;
BEGIN
  IF c !~ '^[0-9A-Z]{12}[0-9]{2}$' OR c ~ '^(.)\1{13}$' THEN
    RETURN false;
  END IF;
  FOR n IN 12..13 LOOP
    soma := 0;
    FOR k IN 1..n LOOP
      soma := soma + (ascii(substr(c, k, 1)) - 48) * pesos[k + 13 - n];
    END LOOP;
    dv := CASE WHEN soma % 11 < 2 THEN 0 ELSE 11 - soma % 11 END;
    IF dv <> substr(c, n + 1, 1)::INTEGER THEN
      RETURN false;
    END IF;
  END LOOP;
  RETURN true;
END;
$$;

-- 1. Dados da operadora -------------------------------------------------
ALTER TABLE public.convenios
  ADD COLUMN IF NOT EXISTS razao_social TEXT,
  ADD COLUMN IF NOT EXISTS cnpj TEXT,
  ADD COLUMN IF NOT EXISTS codigo_prestador TEXT,
  ADD COLUMN IF NOT EXISTS telefone TEXT,
  ADD COLUMN IF NOT EXISTS email TEXT,
  ADD COLUMN IF NOT EXISTS site TEXT,
  ADD COLUMN IF NOT EXISTS cep TEXT,
  ADD COLUMN IF NOT EXISTS endereco TEXT,
  ADD COLUMN IF NOT EXISTS cidade TEXT,
  ADD COLUMN IF NOT EXISTS uf TEXT,
  ADD COLUMN IF NOT EXISTS contato TEXT,
  ADD COLUMN IF NOT EXISTS prazo_pagamento_dias INTEGER,
  ADD COLUMN IF NOT EXISTS tabela_referencia TEXT,
  ADD COLUMN IF NOT EXISTS observacoes TEXT,
  ADD COLUMN IF NOT EXISTS particular BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.convenios DROP CONSTRAINT IF EXISTS convenios_operadora_valida;
ALTER TABLE public.convenios ADD CONSTRAINT convenios_operadora_valida CHECK (
      (cnpj IS NULL OR (cnpj ~ '^[0-9A-Z]{12}[0-9]{2}$' AND public.cnpj_valido(cnpj)))
  AND (cep IS NULL OR cep ~ '^[0-9]{8}$')
  AND (uf IS NULL OR uf IN ('AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'))
  AND (email IS NULL OR email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$')
  AND (prazo_pagamento_dias IS NULL OR prazo_pagamento_dias BETWEEN 0 AND 365)
  AND length(nome) BETWEEN 1 AND 120
  AND COALESCE(length(razao_social), 0) <= 200
  AND COALESCE(length(codigo_prestador), 0) <= 30
  AND COALESCE(length(telefone), 0) <= 40
  AND COALESCE(length(email), 0) <= 200
  AND COALESCE(length(site), 0) <= 200
  AND COALESCE(length(endereco), 0) <= 300
  AND COALESCE(length(cidade), 0) <= 100
  AND COALESCE(length(contato), 0) <= 200
  AND COALESCE(length(tabela_referencia), 0) <= 60
  AND COALESCE(length(observacoes), 0) <= 2000
);

-- Um único "Particular" (migração 13 já o cria pelo nome).
INSERT INTO public.convenios (nome)
SELECT 'Particular' WHERE NOT EXISTS (SELECT 1 FROM public.convenios WHERE nome = 'Particular');
UPDATE public.convenios SET particular = true
 WHERE id = (SELECT id FROM public.convenios WHERE nome = 'Particular' ORDER BY created_at, id LIMIT 1);
CREATE UNIQUE INDEX IF NOT EXISTS convenios_um_particular ON public.convenios ((true)) WHERE particular;

COMMENT ON COLUMN public.convenios.codigo_prestador IS 'Código da clínica na operadora (contratado).';
COMMENT ON COLUMN public.convenios.tabela_referencia IS 'Tabela que o contrato usa como base (TUSS, CBHPM 5ª ed., AMB 92, própria...).';
COMMENT ON COLUMN public.convenios.particular IS 'Tabela da própria clínica: os valores são procedimentos.valor_particular.';

-- 2. Código e tipo do procedimento ----------------------------------------
ALTER TABLE public.procedimentos
  ADD COLUMN IF NOT EXISTS codigo TEXT,
  ADD COLUMN IF NOT EXISTS tipo TEXT NOT NULL DEFAULT 'Procedimento';
ALTER TABLE public.procedimentos ALTER COLUMN valor_particular DROP NOT NULL;
ALTER TABLE public.procedimentos ALTER COLUMN valor_particular DROP DEFAULT;
ALTER TABLE public.procedimentos DROP CONSTRAINT IF EXISTS procedimentos_codigo_tipo_validos;
ALTER TABLE public.procedimentos ADD CONSTRAINT procedimentos_codigo_tipo_validos CHECK (
      tipo IN ('Consulta', 'Exame', 'Procedimento')
  AND (codigo IS NULL OR codigo ~ '^[0-9A-Z]{1,20}$')
  AND (valor_particular IS NULL OR valor_particular >= 0)
  AND length(nome) BETWEEN 1 AND 300
);
UPDATE public.procedimentos SET tipo = 'Consulta' WHERE nome ILIKE 'consulta%';
CREATE UNIQUE INDEX IF NOT EXISTS procedimentos_codigo_key ON public.procedimentos (codigo) WHERE codigo IS NOT NULL;
COMMENT ON COLUMN public.procedimentos.percentual_repasse IS
  'Obsoleto desde a migração 50: o repasse é por profissional (repasse_profissional).';

ALTER TABLE public.convenio_valores ADD COLUMN IF NOT EXISTS codigo TEXT;
ALTER TABLE public.convenio_valores DROP CONSTRAINT IF EXISTS convenio_valores_validos;
ALTER TABLE public.convenio_valores ADD CONSTRAINT convenio_valores_validos CHECK (
  valor >= 0 AND (codigo IS NULL OR codigo ~ '^[0-9A-Z]{1,20}$')
);
COMMENT ON COLUMN public.convenio_valores.codigo IS 'Código do procedimento na tabela deste convênio, quando difere do código do procedimento.';

CREATE OR REPLACE FUNCTION privado.normalizar_codigo_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.codigo := privado.normalizar_codigo(NEW.codigo);
  RETURN NEW;
END;
$$;
GRANT EXECUTE ON FUNCTION privado.normalizar_codigo_trigger() TO authenticated;
DROP TRIGGER IF EXISTS trg_normalizar_codigo ON public.procedimentos;
CREATE TRIGGER trg_normalizar_codigo BEFORE INSERT OR UPDATE OF codigo ON public.procedimentos
  FOR EACH ROW EXECUTE FUNCTION privado.normalizar_codigo_trigger();
DROP TRIGGER IF EXISTS trg_normalizar_codigo ON public.convenio_valores;
CREATE TRIGGER trg_normalizar_codigo BEFORE INSERT OR UPDATE OF codigo ON public.convenio_valores
  FOR EACH ROW EXECUTE FUNCTION privado.normalizar_codigo_trigger();

-- Tipo pelo código: primeiro o catálogo TUSS da clínica (migração 33),
-- depois o capítulo da TUSS (10 = consultas; 40/41 = diagnóstico).
CREATE OR REPLACE FUNCTION privado.tipo_por_codigo(p_codigo TEXT)
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT CASE e.tipo WHEN 'Consulta' THEN 'Consulta'
                        WHEN 'Laboratorial' THEN 'Exame' WHEN 'Imagem' THEN 'Exame' WHEN 'Diagnóstico' THEN 'Exame'
                        ELSE 'Procedimento' END
       FROM public.exames e WHERE e.tuss = privado.normalizar_codigo(p_codigo) LIMIT 1),
    CASE WHEN privado.normalizar_codigo(p_codigo) ~ '^10[0-9]{6}$' THEN 'Consulta'
         WHEN privado.normalizar_codigo(p_codigo) ~ '^4[01][0-9]{6}$' THEN 'Exame'
         ELSE 'Procedimento' END
  );
$$;
REVOKE ALL ON FUNCTION privado.tipo_por_codigo(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION privado.tipo_por_codigo(TEXT) TO authenticated;

-- Valor de um procedimento num convênio. Sem convênio ou no Particular:
-- o valor particular. Convênio sem o procedimento na tabela: nenhum.
CREATE OR REPLACE FUNCTION privado.valor_procedimento(p_convenio_id UUID, p_procedimento_id UUID)
RETURNS NUMERIC
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN p_convenio_id IS NULL OR EXISTS (SELECT 1 FROM public.convenios c WHERE c.id = p_convenio_id AND c.particular)
      THEN (SELECT p.valor_particular FROM public.procedimentos p WHERE p.id = p_procedimento_id)
    ELSE (SELECT cv.valor FROM public.convenio_valores cv
           WHERE cv.convenio_id = p_convenio_id AND cv.procedimento_id = p_procedimento_id)
  END;
$$;
REVOKE ALL ON FUNCTION privado.valor_procedimento(UUID, UUID) FROM PUBLIC, anon, authenticated;

DROP FUNCTION IF EXISTS public.catalogo_procedimentos(UUID);
CREATE FUNCTION public.catalogo_procedimentos(p_convenio_id UUID DEFAULT NULL)
RETURNS TABLE (id UUID, nome TEXT, codigo TEXT, tipo TEXT, valor NUMERIC)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, p.nome, p.codigo, p.tipo, privado.valor_procedimento(p_convenio_id, p.id)
    FROM public.procedimentos p
   WHERE p.ativo AND public.current_user_ativo()
   ORDER BY p.nome;
$$;
REVOKE ALL ON FUNCTION public.catalogo_procedimentos(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.catalogo_procedimentos(UUID) TO authenticated;

-- 3. Importação da tabela -------------------------------------------------
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
  item RECORD;
  cod TEXT;
  descr TEXT;
  proc_id UUID;
  ids UUID[] := ARRAY[]::UUID[];
  novos INTEGER := 0;
  gravados INTEGER := 0;
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
  IF jsonb_typeof(p_itens) IS DISTINCT FROM 'array' OR jsonb_array_length(p_itens) = 0 THEN
    RAISE EXCEPTION 'A tabela está vazia.' USING ERRCODE = '22023';
  END IF;
  IF jsonb_array_length(p_itens) > 20000 THEN
    RAISE EXCEPTION 'Tabela com mais de 20.000 linhas: divida o arquivo.' USING ERRCODE = '22023';
  END IF;

  FOR item IN
    SELECT x.ordem, x.valor->>'codigo' AS codigo, x.valor->>'descricao' AS descricao,
           x.valor->>'valor' AS valor, x.valor->>'tipo' AS tipo
      FROM jsonb_array_elements(p_itens) WITH ORDINALITY AS x(valor, ordem)
  LOOP
    cod := privado.normalizar_codigo(item.codigo);
    descr := NULLIF(btrim(regexp_replace(COALESCE(item.descricao, ''), '\s+', ' ', 'g')), '');
    IF cod IS NULL AND descr IS NULL THEN
      RAISE EXCEPTION 'Linha %: sem código nem descrição.', item.ordem USING ERRCODE = '22023';
    END IF;
    IF length(cod) > 20 OR length(descr) > 300 THEN
      RAISE EXCEPTION 'Linha %: código com mais de 20 caracteres ou descrição com mais de 300.', item.ordem USING ERRCODE = '22023';
    END IF;
    IF item.valor IS NULL OR item.valor !~ '^[0-9]{1,8}(\.[0-9]{1,2})?$' THEN
      RAISE EXCEPTION 'Linha %: valor inválido (%).', item.ordem, COALESCE(item.valor, 'vazio') USING ERRCODE = '22023';
    END IF;
    IF item.tipo IS NOT NULL AND item.tipo NOT IN ('Consulta', 'Exame', 'Procedimento') THEN
      RAISE EXCEPTION 'Linha %: tipo deve ser Consulta, Exame ou Procedimento.', item.ordem USING ERRCODE = '22023';
    END IF;

    proc_id := NULL;
    IF cod IS NOT NULL THEN
      SELECT p.id INTO proc_id FROM public.procedimentos p WHERE p.codigo = cod;
    END IF;
    IF proc_id IS NULL AND descr IS NOT NULL THEN
      -- Mesmo nome e ainda sem código: é o mesmo procedimento; ganha o código.
      SELECT p.id INTO proc_id FROM public.procedimentos p
       WHERE lower(p.nome) = lower(descr) AND (p.codigo IS NULL OR cod IS NULL)
       ORDER BY p.ativo DESC, p.created_at LIMIT 1;
      IF proc_id IS NOT NULL AND cod IS NOT NULL THEN
        UPDATE public.procedimentos SET codigo = cod WHERE id = proc_id;
      END IF;
    END IF;
    IF proc_id IS NULL THEN
      INSERT INTO public.procedimentos (nome, codigo, tipo, valor_particular)
      VALUES (COALESCE(descr, cod), cod, COALESCE(item.tipo, privado.tipo_por_codigo(cod)), NULL)
      RETURNING id INTO proc_id;
      novos := novos + 1;
    ELSIF item.tipo IS NOT NULL THEN
      UPDATE public.procedimentos SET tipo = item.tipo WHERE id = proc_id AND tipo IS DISTINCT FROM item.tipo;
    END IF;

    IF eh_particular THEN
      UPDATE public.procedimentos SET valor_particular = item.valor::NUMERIC WHERE id = proc_id;
    ELSE
      INSERT INTO public.convenio_valores (convenio_id, procedimento_id, valor, codigo)
      VALUES (p_convenio_id, proc_id, item.valor::NUMERIC, cod)
      ON CONFLICT (convenio_id, procedimento_id) DO UPDATE SET valor = EXCLUDED.valor, codigo = EXCLUDED.codigo;
    END IF;
    ids := ids || proc_id;
    gravados := gravados + 1;
  END LOOP;

  IF p_substituir THEN
    IF eh_particular THEN
      UPDATE public.procedimentos SET valor_particular = NULL
       WHERE valor_particular IS NOT NULL AND NOT (id = ANY (ids));
    ELSE
      DELETE FROM public.convenio_valores WHERE convenio_id = p_convenio_id AND NOT (procedimento_id = ANY (ids));
    END IF;
    GET DIAGNOSTICS removidos = ROW_COUNT;
  END IF;

  RETURN jsonb_build_object('gravados', gravados, 'procedimentos_novos', novos, 'removidos', removidos);
END;
$$;
REVOKE ALL ON FUNCTION public.importar_tabela_convenio(UUID, JSONB, BOOLEAN) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.importar_tabela_convenio(UUID, JSONB, BOOLEAN) TO authenticated;

-- 4. Repasse por profissional ---------------------------------------------
CREATE TABLE IF NOT EXISTS public.repasse_profissional (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profissional_id         UUID NOT NULL UNIQUE REFERENCES public.perfis(id) ON DELETE CASCADE,
  percentual_consulta     NUMERIC(5,2) NOT NULL DEFAULT 0 CHECK (percentual_consulta BETWEEN 0 AND 100),
  percentual_exame        NUMERIC(5,2) NOT NULL DEFAULT 0 CHECK (percentual_exame BETWEEN 0 AND 100),
  percentual_procedimento NUMERIC(5,2) NOT NULL DEFAULT 0 CHECK (percentual_procedimento BETWEEN 0 AND 100),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by              UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

ALTER TABLE public.repasse_profissional ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.repasse_profissional FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.repasse_profissional TO authenticated;

DROP POLICY IF EXISTS "ver repasse" ON public.repasse_profissional;
CREATE POLICY "ver repasse" ON public.repasse_profissional FOR SELECT
  USING (public.current_user_ativo() AND (
    public.current_user_funcao() IN ('Financeiro', 'Administrador') OR profissional_id = auth.uid()));
DROP POLICY IF EXISTS "definir repasse" ON public.repasse_profissional;
CREATE POLICY "definir repasse" ON public.repasse_profissional FOR ALL
  USING (public.current_user_ativo() AND public.current_user_funcao() = 'Administrador')
  WITH CHECK (public.current_user_ativo() AND public.current_user_funcao() = 'Administrador');

CREATE OR REPLACE FUNCTION privado.carimbar_repasse()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  NEW.updated_by := auth.uid();
  RETURN NEW;
END;
$$;
GRANT EXECUTE ON FUNCTION privado.carimbar_repasse() TO authenticated;
DROP TRIGGER IF EXISTS trg_carimbar_repasse ON public.repasse_profissional;
CREATE TRIGGER trg_carimbar_repasse BEFORE INSERT OR UPDATE ON public.repasse_profissional
  FOR EACH ROW EXECUTE FUNCTION privado.carimbar_repasse();
DROP TRIGGER IF EXISTS trg_auditoria_repasse_profissional ON public.repasse_profissional;
CREATE TRIGGER trg_auditoria_repasse_profissional
  AFTER INSERT OR UPDATE OR DELETE ON public.repasse_profissional
  FOR EACH ROW EXECUTE FUNCTION public.registrar_auditoria();

-- Percentual do profissional para o tipo do procedimento; sem regra ou
-- sem procedimento, 0.
CREATE OR REPLACE FUNCTION privado.percentual_repasse(p_profissional_id UUID, p_procedimento_id UUID)
RETURNS NUMERIC
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE((
    SELECT CASE p.tipo WHEN 'Consulta' THEN r.percentual_consulta
                       WHEN 'Exame' THEN r.percentual_exame
                       ELSE r.percentual_procedimento END
      FROM public.repasse_profissional r, public.procedimentos p
     WHERE r.profissional_id = p_profissional_id AND p.id = p_procedimento_id
  ), 0);
$$;
REVOKE ALL ON FUNCTION privado.percentual_repasse(UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION privado.percentual_repasse(UUID, UUID) TO authenticated;

-- O percentual da cobrança é do banco, como a data de pagamento.
CREATE OR REPLACE FUNCTION privado.repasse_da_cobranca()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'INSERT'
     OR (OLD.status = 'Pendente' AND (NEW.medico_id IS DISTINCT FROM OLD.medico_id
                                      OR NEW.procedimento_id IS DISTINCT FROM OLD.procedimento_id)) THEN
    NEW.percentual_repasse := privado.percentual_repasse(NEW.medico_id, NEW.procedimento_id);
  ELSE
    NEW.percentual_repasse := OLD.percentual_repasse;
  END IF;
  RETURN NEW;
END;
$$;
GRANT EXECUTE ON FUNCTION privado.repasse_da_cobranca() TO authenticated;
DROP TRIGGER IF EXISTS trg_repasse_da_cobranca ON public.cobrancas;
CREATE TRIGGER trg_repasse_da_cobranca BEFORE INSERT OR UPDATE ON public.cobrancas
  FOR EACH ROW EXECUTE FUNCTION privado.repasse_da_cobranca();

-- 5. Todo profissional vê as próprias cobranças ---------------------------
DROP POLICY IF EXISTS "ver cobrancas" ON public.cobrancas;
CREATE POLICY "ver cobrancas" ON public.cobrancas FOR SELECT
  USING (
    public.current_user_funcao() IN ('Financeiro', 'Administrador')
    OR (medico_id = auth.uid() AND public.current_user_ativo())
  );

-- 6. Relatório de produção -------------------------------------------------
CREATE OR REPLACE FUNCTION public.relatorio_producao(
  p_de DATE, p_ate DATE, p_profissional_id UUID DEFAULT NULL
)
RETURNS TABLE (
  cobranca_id UUID, data DATE, status TEXT, da_agenda BOOLEAN,
  paciente_id UUID, paciente_nome TEXT,
  profissional_id UUID, profissional_nome TEXT,
  procedimento_id UUID, codigo TEXT, procedimento TEXT, tipo TEXT,
  convenio_id UUID, convenio TEXT, forma_pagamento TEXT,
  valor NUMERIC, percentual_repasse NUMERIC, valor_repasse NUMERIC, valor_clinica NUMERIC
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  gestor BOOLEAN := COALESCE(public.current_user_funcao() IN ('Financeiro', 'Administrador'), false);
  alvo UUID := p_profissional_id;
BEGIN
  IF NOT COALESCE(public.current_user_ativo(), false) THEN
    RAISE EXCEPTION 'Usuário inativo.' USING ERRCODE = '42501';
  END IF;
  IF p_de IS NULL OR p_ate IS NULL OR p_ate < p_de THEN
    RAISE EXCEPTION 'Informe o período (data inicial até a final).' USING ERRCODE = '22023';
  END IF;
  IF NOT gestor THEN
    IF alvo IS NOT NULL AND alvo <> auth.uid() THEN
      RAISE EXCEPTION 'Você só pode ver a sua própria produção.' USING ERRCODE = '42501';
    END IF;
    alvo := auth.uid();
  END IF;
  RETURN QUERY
    SELECT c.id, c.data_cobranca, c.status, c.agendamento_id IS NOT NULL,
           c.paciente_id, pa.nome,
           c.medico_id, pf.nome,
           c.procedimento_id, COALESCE(cv.codigo, p.codigo), COALESCE(p.nome, c.descricao), p.tipo,
           c.convenio_id, co.nome, c.forma_pagamento,
           c.valor, c.percentual_repasse, c.valor_repasse, c.valor - c.valor_repasse
      FROM public.cobrancas c
      JOIN public.pacientes pa ON pa.id = c.paciente_id
      LEFT JOIN public.perfis pf ON pf.id = c.medico_id
      LEFT JOIN public.procedimentos p ON p.id = c.procedimento_id
      LEFT JOIN public.convenios co ON co.id = c.convenio_id
      LEFT JOIN public.convenio_valores cv ON cv.convenio_id = c.convenio_id AND cv.procedimento_id = c.procedimento_id
     WHERE c.status <> 'Cancelado'
       AND c.data_cobranca BETWEEN p_de AND p_ate
       AND (alvo IS NULL OR c.medico_id = alvo)
     ORDER BY c.data_cobranca, pf.nome NULLS LAST, c.created_at, c.id;
END;
$$;
REVOKE ALL ON FUNCTION public.relatorio_producao(DATE, DATE, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.relatorio_producao(DATE, DATE, UUID) TO authenticated;

-- Exportação da clínica leva também as tabelas dos convênios e as regras
-- de repasse (mesma função da migração 48, com as duas chaves a mais).
CREATE OR REPLACE FUNCTION public.exportar_clinica(p_limite INTEGER DEFAULT 50, p_offset INTEGER DEFAULT 0)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  resultado JSONB;
  lim INTEGER := LEAST(GREATEST(COALESCE(p_limite, 50), 1), 200);
BEGIN
  IF public.current_user_funcao() IS DISTINCT FROM 'Administrador' OR public.current_user_papel_clinico() IS NULL THEN
    RAISE EXCEPTION 'Exportar a clínica exige Administrador com papel clínico concedido' USING ERRCODE = '42501';
  END IF;
  IF COALESCE(p_offset, 0) = 0 THEN
    PERFORM privado.registrar_acesso_interno(NULL, 'exportar_clinica', 'Exportação completa da clínica');
  END IF;
  PERFORM set_config('pep.leitura_clinica', 'sim', true);
  resultado := jsonb_build_object(
    'total_pacientes', (SELECT count(*) FROM public.pacientes_view),
    'pacientes', COALESCE((
      SELECT jsonb_agg(privado.prontuario_json(p.id) ORDER BY p.nome, p.id)
      FROM (SELECT id, nome FROM public.pacientes_view ORDER BY nome, id LIMIT lim OFFSET GREATEST(COALESCE(p_offset, 0), 0)) p
    ), '[]'::jsonb)
  );
  IF COALESCE(p_offset, 0) = 0 THEN
    resultado := resultado || jsonb_build_object(
      'formato', 'pep-clinica', 'versao_formato', 1,
      'exportado_em', to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
      'clinica', (SELECT to_jsonb(c) FROM public.configuracoes_clinica c ORDER BY updated_at DESC NULLS LAST LIMIT 1),
      'filiais', (SELECT COALESCE(jsonb_agg(to_jsonb(f)), '[]'::jsonb) FROM public.filiais f),
      'profissionais', (SELECT COALESCE(jsonb_agg(jsonb_build_object('id', id, 'nome', nome, 'funcao', funcao, 'conselho', crm,
                          'uf', uf, 'especialidade', especialidade, 'rqe', rqe, 'ativo', ativo) ORDER BY nome), '[]'::jsonb)
                        FROM public.perfis_view),
      'agendamentos', (SELECT COALESCE(jsonb_agg(to_jsonb(a) - 'operacao_id' ORDER BY a.data, a.hora), '[]'::jsonb) FROM public.agendamentos a),
      'cobrancas', (SELECT COALESCE(jsonb_agg(to_jsonb(b) - 'operacao_id' ORDER BY b.data_cobranca), '[]'::jsonb) FROM public.cobrancas b),
      'convenios', (SELECT COALESCE(jsonb_agg(to_jsonb(x)), '[]'::jsonb) FROM public.convenios x),
      'procedimentos', (SELECT COALESCE(jsonb_agg(to_jsonb(x)), '[]'::jsonb) FROM public.procedimentos x),
      'convenio_valores', (SELECT COALESCE(jsonb_agg(to_jsonb(x)), '[]'::jsonb) FROM public.convenio_valores x),
      'repasse_profissional', (SELECT COALESCE(jsonb_agg(to_jsonb(x) - 'updated_by'), '[]'::jsonb) FROM public.repasse_profissional x)
    );
  END IF;
  PERFORM set_config('pep.leitura_clinica', '', true);
  RETURN resultado;
END;
$$;
REVOKE ALL ON FUNCTION public.exportar_clinica(INTEGER, INTEGER) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.exportar_clinica(INTEGER, INTEGER) TO authenticated;

COMMIT;
