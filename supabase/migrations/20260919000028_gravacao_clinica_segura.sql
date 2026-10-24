-- Toda gravação clínica do frontend passa por uma transação idempotente.
-- Publicar o frontend compatível após aplicar esta migração: clientes antigos
-- deixam de poder escrever diretamente, evitando contornar a versão esperada.
BEGIN;

ALTER TABLE public.consultas ADD COLUMN versao INTEGER NOT NULL DEFAULT 1 CHECK (versao > 0);

CREATE TABLE public.operacoes_registro (
  autor_id UUID NOT NULL REFERENCES auth.users(id),
  operacao_id UUID NOT NULL,
  requisicao_hash TEXT NOT NULL,
  resultado JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (autor_id, operacao_id)
);
ALTER TABLE public.operacoes_registro ENABLE ROW LEVEL SECURITY;
-- Somente a função abaixo pode acessar o recibo, inclusive os dados clínicos.
REVOKE ALL ON public.operacoes_registro FROM PUBLIC, anon, authenticated;

CREATE FUNCTION public.versionar_consulta()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
  IF OLD.status <> 'Rascunho' THEN
    IF NEW IS DISTINCT FROM OLD THEN
      RAISE EXCEPTION 'Registro consolidado é imutável; crie uma retificação';
    END IF;
    RETURN NEW;
  END IF;
  NEW.versao := OLD.versao + 1;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_versao_consulta BEFORE UPDATE ON public.consultas
FOR EACH ROW EXECUTE FUNCTION public.versionar_consulta();
REVOKE ALL ON FUNCTION public.versionar_consulta() FROM PUBLIC, anon, authenticated;

CREATE FUNCTION public.salvar_registro_clinico(
  p_operacao_id UUID,
  p_acao TEXT,
  p_paciente_id UUID,
  p_registro_id UUID,
  p_versao_esperada INTEGER,
  p_dados JSONB
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  autor UUID := auth.uid();
  funcao TEXT := public.current_user_funcao();
  hash_requisicao TEXT;
  recibo public.operacoes_registro%ROWTYPE;
  registro public.consultas%ROWTYPE;
  tipo_registro TEXT;
  resposta JSONB;
BEGIN
  IF autor IS NULL OR NOT COALESCE(public.current_user_ativo(), false)
     OR funcao IS NULL OR funcao NOT IN ('Médico', 'Enfermeiro(a)', 'Administrador') THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Usuário sem permissão clínica';
  END IF;
  IF p_operacao_id IS NULL OR p_paciente_id IS NULL
     OR p_acao IS NULL OR p_acao NOT IN ('criar', 'atualizar', 'assinar')
     OR p_dados IS NULL OR jsonb_typeof(p_dados) <> 'object' THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Requisição clínica inválida';
  END IF;
  IF EXISTS (SELECT 1 FROM jsonb_object_keys(p_dados) AS k(chave)
             WHERE chave NOT IN ('tipo', 'titulo', 'conteudo', 'status', 'data', 'hora', 'retificacao_de', 'motivo_retificacao')) THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Campo não permitido na gravação clínica';
  END IF;

  hash_requisicao := encode(sha256(convert_to(jsonb_build_object(
    'acao', p_acao, 'paciente', p_paciente_id, 'registro', p_registro_id,
    'versao', p_versao_esperada, 'dados', p_dados
  )::TEXT, 'UTF8')), 'hex');

  -- A mesma tentativa, inclusive em conexões simultâneas, só executa uma vez.
  PERFORM pg_advisory_xact_lock(hashtextextended(autor::TEXT || ':' || p_operacao_id::TEXT, 0));
  SELECT * INTO recibo FROM public.operacoes_registro
    WHERE autor_id = autor AND operacao_id = p_operacao_id;
  IF FOUND THEN
    IF recibo.requisicao_hash <> hash_requisicao THEN
      RAISE EXCEPTION USING ERRCODE = 'P4091', MESSAGE = 'Identificador de operação reutilizado com dados diferentes';
    END IF;
    IF funcao = 'Enfermeiro(a)' AND recibo.resultado->>'tipo' IN ('Receituário', 'Prescrição', 'Atestado') THEN
      RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Função atual não permite este documento';
    END IF;
    RETURN recibo.resultado;
  END IF;

  IF p_acao = 'criar' THEN
    IF p_registro_id IS NOT NULL OR p_versao_esperada IS NOT NULL THEN
      RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Criação não aceita registro ou versão anterior';
    END IF;
    tipo_registro := p_dados->>'tipo';
    IF tipo_registro IS NULL OR (funcao = 'Enfermeiro(a)' AND tipo_registro IN ('Receituário', 'Prescrição', 'Atestado')) THEN
      RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Função atual não permite este documento';
    END IF;
    IF COALESCE(p_dados->>'status', 'Assinado') NOT IN ('Rascunho', 'Assinado')
       OR NULLIF(btrim(p_dados->>'conteudo'), '') IS NULL THEN
      RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Conteúdo ou status inválido';
    END IF;
    -- O trigger existente valida autor/original e produz a identidade da assinatura.
    INSERT INTO public.consultas (paciente_id, tipo, titulo, conteudo, data, hora,
      created_by, status, retificacao_de, motivo_retificacao)
    VALUES (p_paciente_id, tipo_registro, p_dados->>'titulo', p_dados->>'conteudo',
      COALESCE((p_dados->>'data')::DATE, CURRENT_DATE), p_dados->>'hora', autor,
      COALESCE(p_dados->>'status', 'Assinado'), (p_dados->>'retificacao_de')::UUID,
      p_dados->>'motivo_retificacao') RETURNING * INTO registro;
    IF registro.paciente_id <> p_paciente_id THEN
      RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Retificação pertence a outro paciente';
    END IF;
  ELSE
    IF p_registro_id IS NULL OR p_versao_esperada IS NULL OR p_versao_esperada < 1
       OR EXISTS (SELECT 1 FROM jsonb_object_keys(p_dados) AS k(chave) WHERE chave NOT IN ('titulo', 'conteudo')) THEN
      RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Edição exige registro, versão e campos permitidos';
    END IF;
    -- Serializa concorrentes antes de comparar a versão. Não há intervalo
    -- entre atualizar o texto e consolidar a assinatura.
    SELECT * INTO registro FROM public.consultas WHERE id = p_registro_id FOR UPDATE;
    IF NOT FOUND OR registro.created_by IS DISTINCT FROM autor OR registro.paciente_id <> p_paciente_id THEN
      RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Registro indisponível para este usuário';
    END IF;
    IF funcao = 'Enfermeiro(a)' AND registro.tipo IN ('Receituário', 'Prescrição', 'Atestado') THEN
      RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Função atual não permite este documento';
    END IF;
    IF registro.versao <> p_versao_esperada OR registro.status <> 'Rascunho' THEN
      RAISE EXCEPTION USING ERRCODE = 'P4090', MESSAGE = 'O registro foi alterado ou assinado em outra sessão. Revise a versão atual antes de salvar.';
    END IF;
    IF p_dados ? 'conteudo' AND NULLIF(btrim(p_dados->>'conteudo'), '') IS NULL THEN
      RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'O conteúdo não pode ficar vazio';
    END IF;
    UPDATE public.consultas SET
      titulo = CASE WHEN p_dados ? 'titulo' THEN p_dados->>'titulo' ELSE titulo END,
      conteudo = CASE WHEN p_dados ? 'conteudo' THEN p_dados->>'conteudo' ELSE conteudo END,
      status = CASE WHEN p_acao = 'assinar' THEN 'Assinado' ELSE 'Rascunho' END
    WHERE id = p_registro_id RETURNING * INTO registro;
  END IF;

  resposta := to_jsonb(registro);
  INSERT INTO public.operacoes_registro (autor_id, operacao_id, requisicao_hash, resultado)
    VALUES (autor, p_operacao_id, hash_requisicao, resposta);
  RETURN resposta;
END;
$$;

REVOKE ALL ON FUNCTION public.salvar_registro_clinico(UUID, TEXT, UUID, UUID, INTEGER, JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.salvar_registro_clinico(UUID, TEXT, UUID, UUID, INTEGER, JSONB) TO authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.consultas FROM PUBLIC, anon, authenticated;
-- Não depender dos privilégios padrão do projeto para carregar o histórico.
-- A política RLS existente continua filtrando usuários ativos e funções.
GRANT SELECT ON public.consultas TO authenticated;

COMMIT;
