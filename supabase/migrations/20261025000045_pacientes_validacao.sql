-- Validação e normalização do cadastro de pacientes (quarta avaliação,
-- 25/10/2026).
--
-- Problema reproduzido: dois pacientes com o mesmo CPF, um "123.456.789-09"
-- e outro "12345678909" — a unicidade comparava os textos.
--
--   * CPF: continua opcional. Quando informado, precisa ter 11 dígitos e
--     dígitos verificadores certos; é gravado sempre como 000.000.000-00
--     (o formato que a tela já mostra e busca). Unicidade passa a ser
--     sobre os dígitos.
--   * CNS: 15 dígitos (já era) e dígito verificador do Ministério da Saúde.
--   * Nascimento: entre 1900-01-01 e hoje.
--   * Tamanho máximo dos campos de texto.
--
-- As regras valem para o que for GRAVADO de agora em diante, campo a campo:
-- um paciente antigo com CPF inválido continua editável nos outros campos;
-- só o CPF precisa ser corrigido quando for alterado. CPFs antigos válidos
-- são reescritos no formato padrão. Se já houver CPFs repetidos (comparando
-- só os dígitos), a migração para e lista quantos — revise antes de aplicar.
BEGIN;

CREATE OR REPLACE FUNCTION public.so_digitos(p TEXT) RETURNS TEXT
LANGUAGE sql IMMUTABLE AS $$ SELECT NULLIF(regexp_replace(COALESCE(p, ''), '\D', '', 'g'), '') $$;

CREATE OR REPLACE FUNCTION public.cpf_valido(p TEXT) RETURNS BOOLEAN
LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE
  d TEXT := public.so_digitos(p);
  soma INT; dv INT;
BEGIN
  IF d IS NULL OR length(d) <> 11 OR d ~ '^(\d)\1{10}$' THEN RETURN false; END IF;
  soma := 0;
  FOR i IN 1..9 LOOP soma := soma + substr(d, i, 1)::INT * (11 - i); END LOOP;
  dv := (soma * 10) % 11; IF dv = 10 THEN dv := 0; END IF;
  IF dv <> substr(d, 10, 1)::INT THEN RETURN false; END IF;
  soma := 0;
  FOR i IN 1..10 LOOP soma := soma + substr(d, i, 1)::INT * (12 - i); END LOOP;
  dv := (soma * 10) % 11; IF dv = 10 THEN dv := 0; END IF;
  RETURN dv = substr(d, 11, 1)::INT;
END;
$$;

-- Algoritmo do Cartão Nacional de Saúde (definitivos 1/2, provisórios 7/8/9).
CREATE OR REPLACE FUNCTION public.cns_valido(p TEXT) RETURNS BOOLEAN
LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE
  d TEXT := public.so_digitos(p);
  soma INT := 0; resto INT; dv INT; esperado TEXT;
BEGIN
  IF d IS NULL OR length(d) <> 15 THEN RETURN false; END IF;
  IF substr(d, 1, 1) IN ('1', '2') THEN
    FOR i IN 1..11 LOOP soma := soma + substr(d, i, 1)::INT * (16 - i); END LOOP;
    resto := soma % 11; dv := 11 - resto; IF dv = 11 THEN dv := 0; END IF;
    IF dv = 10 THEN
      soma := soma + 2; resto := soma % 11; dv := 11 - resto;
      esperado := substr(d, 1, 11) || '001' || dv::TEXT;
    ELSE
      esperado := substr(d, 1, 11) || '000' || dv::TEXT;
    END IF;
    RETURN d = esperado;
  ELSIF substr(d, 1, 1) IN ('7', '8', '9') THEN
    FOR i IN 1..15 LOOP soma := soma + substr(d, i, 1)::INT * (16 - i); END LOOP;
    RETURN soma % 11 = 0;
  END IF;
  RETURN false;
END;
$$;

CREATE OR REPLACE FUNCTION public.formatar_cpf(p TEXT) RETURNS TEXT
LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE WHEN length(public.so_digitos(p)) = 11 THEN
    regexp_replace(public.so_digitos(p), '^(\d{3})(\d{3})(\d{3})(\d{2})$', '\1.\2.\3-\4') END
$$;

GRANT EXECUTE ON FUNCTION public.so_digitos(TEXT), public.cpf_valido(TEXT), public.cns_valido(TEXT), public.formatar_cpf(TEXT)
  TO authenticated;
REVOKE ALL ON FUNCTION public.so_digitos(TEXT), public.cpf_valido(TEXT), public.cns_valido(TEXT), public.formatar_cpf(TEXT)
  FROM anon;

-- 1. Antes de qualquer mudança: CPFs repetidos pelos dígitos?
DO $$
DECLARE repetidos INT;
BEGIN
  SELECT count(*) INTO repetidos FROM (
    SELECT public.so_digitos(cpf) FROM public.pacientes
    WHERE public.so_digitos(cpf) IS NOT NULL
    GROUP BY 1 HAVING count(*) > 1
  ) x;
  IF repetidos > 0 THEN
    RAISE EXCEPTION 'Há % CPF(s) cadastrados em mais de um paciente (mesmos dígitos, formatos diferentes). Revise e una ou corrija esses cadastros antes de aplicar a migração 45.', repetidos;
  END IF;
END;
$$;

-- 2. Validação ao gravar, só nos campos que mudaram.
CREATE OR REPLACE FUNCTION public.validar_paciente()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  mudou BOOLEAN;
BEGIN
  -- CPF: em branco vira NULL; informado precisa ser válido e sai formatado.
  IF NEW.cpf IS NOT NULL AND btrim(NEW.cpf) = '' THEN NEW.cpf := NULL; END IF;
  mudou := TG_OP = 'INSERT' OR NEW.cpf IS DISTINCT FROM OLD.cpf;
  IF mudou AND NEW.cpf IS NOT NULL THEN
    IF NOT public.cpf_valido(NEW.cpf) THEN
      RAISE EXCEPTION 'CPF inválido: confira os 11 dígitos (o CPF é opcional — deixe em branco se não tiver).'
        USING ERRCODE = '22023';
    END IF;
    NEW.cpf := public.formatar_cpf(NEW.cpf);
  END IF;

  IF NEW.cns IS NOT NULL AND btrim(NEW.cns) = '' THEN NEW.cns := NULL; END IF;
  IF (TG_OP = 'INSERT' OR NEW.cns IS DISTINCT FROM OLD.cns) AND NEW.cns IS NOT NULL THEN
    NEW.cns := public.so_digitos(NEW.cns);
    IF NOT public.cns_valido(NEW.cns) THEN
      RAISE EXCEPTION 'Cartão Nacional de Saúde inválido: confira os 15 dígitos.' USING ERRCODE = '22023';
    END IF;
  END IF;

  IF (TG_OP = 'INSERT' OR NEW.nascimento IS DISTINCT FROM OLD.nascimento) AND NEW.nascimento IS NOT NULL
     AND (NEW.nascimento < DATE '1900-01-01' OR NEW.nascimento > CURRENT_DATE) THEN
    RAISE EXCEPTION 'Data de nascimento fora do intervalo aceito (01/01/1900 até hoje).' USING ERRCODE = '22023';
  END IF;

  IF (TG_OP = 'INSERT' OR NEW.nome IS DISTINCT FROM OLD.nome)
     AND char_length(btrim(COALESCE(NEW.nome, ''))) NOT BETWEEN 2 AND 200 THEN
    RAISE EXCEPTION 'Nome do paciente deve ter de 2 a 200 caracteres.' USING ERRCODE = '22023';
  END IF;

  IF (TG_OP = 'INSERT' OR ROW(NEW.nome_mae, NEW.telefone, NEW.cep, NEW.endereco, NEW.numero, NEW.complemento)
        IS DISTINCT FROM ROW(OLD.nome_mae, OLD.telefone, OLD.cep, OLD.endereco, OLD.numero, OLD.complemento))
     AND (char_length(COALESCE(NEW.nome_mae, '')) > 200 OR char_length(COALESCE(NEW.telefone, '')) > 30
          OR char_length(COALESCE(NEW.cep, '')) > 10 OR char_length(COALESCE(NEW.endereco, '')) > 300
          OR char_length(COALESCE(NEW.numero, '')) > 20 OR char_length(COALESCE(NEW.complemento, '')) > 100) THEN
    RAISE EXCEPTION 'Algum campo do cadastro passou do tamanho máximo.' USING ERRCODE = '22023';
  END IF;

  IF (TG_OP = 'INSERT' OR ROW(NEW.alergias, NEW.cirurgias, NEW.medicamentos_uso, NEW.outras_comorbidades)
        IS DISTINCT FROM ROW(OLD.alergias, OLD.cirurgias, OLD.medicamentos_uso, OLD.outras_comorbidades))
     AND (char_length(COALESCE(NEW.alergias, '')) > 5000 OR char_length(COALESCE(NEW.cirurgias, '')) > 5000
          OR char_length(COALESCE(NEW.medicamentos_uso, '')) > 5000 OR char_length(COALESCE(NEW.outras_comorbidades, '')) > 5000) THEN
    RAISE EXCEPTION 'Antecedentes: cada campo aceita até 5000 caracteres.' USING ERRCODE = '22023';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validar_paciente ON public.pacientes;
CREATE TRIGGER trg_validar_paciente
  BEFORE INSERT OR UPDATE ON public.pacientes
  FOR EACH ROW EXECUTE FUNCTION public.validar_paciente();

-- 3. CPFs antigos válidos no formato padrão (manutenção: o trigger de
--    versão só exige a função atualizar_paciente para o papel do app).
UPDATE public.pacientes SET cpf = public.formatar_cpf(cpf)
 WHERE cpf IS NOT NULL AND public.cpf_valido(cpf) AND cpf IS DISTINCT FROM public.formatar_cpf(cpf);

-- 4. Unicidade pelos dígitos (cobre também CPFs antigos fora do padrão).
CREATE UNIQUE INDEX IF NOT EXISTS pacientes_cpf_digitos_key
  ON public.pacientes (public.so_digitos(cpf)) WHERE cpf IS NOT NULL;

COMMIT;
