-- Psicólogo(a) e Fisioterapeuta como funções clínicas, e RQE no perfil.
--
-- Acesso clínico dos dois: igual Enfermeiro(a) (veem e registram no
-- prontuário), mas podendo emitir Atestado — CRP e COFFITO permitem
-- atestado dentro da área de cada profissão. Receituário e Prescrição
-- continuam só de Médico.
--
-- A regra "qual papel registra qual tipo" estava repetida em três
-- lugares (duas policies de consultas e a RPC salvar_registro_clinico)
-- comparando só 'Enfermeiro(a)'. Agora fica numa função única,
-- papel_clinico_pode_registrar, e os três a chamam. Espelhada no
-- front-end em src/constants/roles.js (PODE_EMITIR) — mantenha as duas
-- em sincronia.

BEGIN;

-- ---------------------------------------------------------------------
-- 1. RQE (Registro de Qualificação de Especialista, CRM) — só médico.
-- ---------------------------------------------------------------------
ALTER TABLE public.perfis ADD COLUMN IF NOT EXISTS rqe TEXT;
COMMENT ON COLUMN public.perfis.rqe IS 'Número do RQE (Registro de Qualificação de Especialista) do médico; vazio para as demais funções.';

-- ---------------------------------------------------------------------
-- 2. Papel clínico efetivo inclui as duas funções novas.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.current_user_papel_clinico()
RETURNS TEXT
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT CASE
    WHEN funcao IN ('Médico', 'Enfermeiro(a)', 'Psicólogo(a)', 'Fisioterapeuta') THEN funcao
    WHEN funcao = 'Administrador' THEN papel_clinico_administrador
    ELSE NULL
  END
  FROM public.perfis WHERE id = auth.uid() AND ativo;
$$;

-- ---------------------------------------------------------------------
-- 3. Regra única de tipo de registro por papel clínico.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.papel_clinico_pode_registrar(p_papel TEXT, p_tipo TEXT)
RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE
    WHEN p_papel = 'Médico' THEN true
    WHEN p_papel = 'Enfermeiro(a)'
      THEN COALESCE(p_tipo NOT IN ('Receituário', 'Prescrição', 'Atestado'), true)
    WHEN p_papel IN ('Psicólogo(a)', 'Fisioterapeuta')
      THEN COALESCE(p_tipo NOT IN ('Receituário', 'Prescrição'), true)
    ELSE false
  END;
$$;
REVOKE ALL ON FUNCTION public.papel_clinico_pode_registrar(TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.papel_clinico_pode_registrar(TEXT, TEXT) TO authenticated;

DROP POLICY IF EXISTS "criar consultas" ON public.consultas;
CREATE POLICY "criar consultas" ON public.consultas
  FOR INSERT
  WITH CHECK (
    public.current_user_ativo()
    AND created_by = auth.uid()
    AND public.papel_clinico_pode_registrar(public.current_user_papel_clinico(), tipo)
  );

DROP POLICY IF EXISTS "editar consultas" ON public.consultas;
CREATE POLICY "editar consultas" ON public.consultas
  FOR UPDATE
  USING (
    public.current_user_ativo()
    AND status = 'Rascunho'
    AND created_by = auth.uid()
  )
  WITH CHECK (
    public.current_user_ativo()
    AND created_by = auth.uid()
    AND public.papel_clinico_pode_registrar(public.current_user_papel_clinico(), tipo)
  );

-- Mesma RPC da migração 30, trocando as três checagens fixas de
-- 'Enfermeiro(a)' pela função acima.
CREATE OR REPLACE FUNCTION public.salvar_registro_clinico(
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
  papel_clinico TEXT := public.current_user_papel_clinico();
  hash_requisicao TEXT;
  recibo public.operacoes_registro%ROWTYPE;
  registro public.consultas%ROWTYPE;
  tipo_registro TEXT;
  resposta JSONB;
BEGIN
  IF autor IS NULL OR NOT COALESCE(public.current_user_ativo(), false) OR papel_clinico IS NULL THEN
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

  PERFORM pg_advisory_xact_lock(hashtextextended(autor::TEXT || ':' || p_operacao_id::TEXT, 0));
  SELECT * INTO recibo FROM public.operacoes_registro
    WHERE autor_id = autor AND operacao_id = p_operacao_id;
  IF FOUND THEN
    IF recibo.requisicao_hash <> hash_requisicao THEN
      RAISE EXCEPTION USING ERRCODE = 'P4091', MESSAGE = 'Identificador de operação reutilizado com dados diferentes';
    END IF;
    IF NOT public.papel_clinico_pode_registrar(papel_clinico, recibo.resultado->>'tipo') THEN
      RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Função atual não permite este documento';
    END IF;
    RETURN recibo.resultado;
  END IF;

  IF p_acao = 'criar' THEN
    IF p_registro_id IS NOT NULL OR p_versao_esperada IS NOT NULL THEN
      RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Criação não aceita registro ou versão anterior';
    END IF;
    tipo_registro := p_dados->>'tipo';
    IF tipo_registro IS NULL OR NOT public.papel_clinico_pode_registrar(papel_clinico, tipo_registro) THEN
      RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Função atual não permite este documento';
    END IF;
    IF COALESCE(p_dados->>'status', 'Assinado') NOT IN ('Rascunho', 'Assinado')
       OR NULLIF(btrim(p_dados->>'conteudo'), '') IS NULL THEN
      RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Conteúdo ou status inválido';
    END IF;
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
    SELECT * INTO registro FROM public.consultas WHERE id = p_registro_id FOR UPDATE;
    IF NOT FOUND OR registro.created_by IS DISTINCT FROM autor OR registro.paciente_id <> p_paciente_id THEN
      RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Registro indisponível para este usuário';
    END IF;
    IF NOT public.papel_clinico_pode_registrar(papel_clinico, registro.tipo) THEN
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



-- ---------------------------------------------------------------------
-- 4. Cadastro de pacientes: as funções novas atendem e podem atualizar
--    o cadastro, como Médico e Enfermeiro(a).
-- ---------------------------------------------------------------------
DROP POLICY IF EXISTS "criar pacientes" ON public.pacientes;
CREATE POLICY "criar pacientes" ON public.pacientes
  FOR INSERT
  WITH CHECK (
    public.current_user_ativo()
    AND public.current_user_funcao() IN ('Médico', 'Enfermeiro(a)', 'Psicólogo(a)', 'Fisioterapeuta', 'Recepcionista', 'Administrador')
    AND created_by = auth.uid()
  );

DROP POLICY IF EXISTS "editar pacientes" ON public.pacientes;
CREATE POLICY "editar pacientes" ON public.pacientes
  FOR UPDATE
  USING (
    public.current_user_ativo()
    AND public.current_user_funcao() IN ('Médico', 'Enfermeiro(a)', 'Psicólogo(a)', 'Fisioterapeuta', 'Recepcionista', 'Administrador')
  )
  WITH CHECK (
    public.current_user_ativo()
    AND public.current_user_funcao() IN ('Médico', 'Enfermeiro(a)', 'Psicólogo(a)', 'Fisioterapeuta', 'Recepcionista', 'Administrador')
  );

-- ---------------------------------------------------------------------
-- 5. Sigla do conselho na assinatura dos registros.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.identidade_profissional_atual(
  OUT nome TEXT,
  OUT registro TEXT
)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT
    p.nome,
    CASE
      WHEN NULLIF(BTRIM(COALESCE(p.crm, '')), '') IS NULL THEN NULL
      ELSE (CASE COALESCE(NULLIF(p.papel_clinico_administrador, ''), p.funcao)
              WHEN 'Enfermeiro(a)' THEN 'COREN '
              WHEN 'Psicólogo(a)' THEN 'CRP '
              WHEN 'Fisioterapeuta' THEN 'CREFITO '
              ELSE 'CRM '
            END)
           || BTRIM(p.crm)
           || CASE WHEN NULLIF(BTRIM(COALESCE(p.uf, '')), '') IS NULL
                   THEN '' ELSE '/' || BTRIM(p.uf) END
    END
  FROM public.perfis p
  WHERE p.id = auth.uid() AND p.ativo;
$$;

-- ---------------------------------------------------------------------
-- 6. perfis_view: mesma da migração 34, com o RQE no fim (público como
--    o CRM — sai impresso nos documentos).
-- ---------------------------------------------------------------------
CREATE OR REPLACE VIEW public.perfis_view
WITH (security_barrier = true, security_invoker = false) AS
SELECT
  p.id,
  p.nome,
  CASE WHEN p.id = auth.uid() OR public.current_user_funcao() = 'Administrador'
       THEN p.email END AS email,
  p.funcao,
  p.crm,
  p.uf,
  p.especialidade,
  p.area_atuacao,
  p.ativo,
  p.created_at,
  CASE WHEN p.id = auth.uid() OR public.current_user_funcao() = 'Administrador'
       THEN p.cpf END AS cpf,
  CASE WHEN p.id = auth.uid() OR public.current_user_funcao() = 'Administrador'
       THEN p.nascimento END AS nascimento,
  CASE WHEN p.id = auth.uid() OR public.current_user_funcao() = 'Administrador'
       THEN p.sexo END AS sexo,
  p.papel_clinico_administrador,
  CASE WHEN p.id = auth.uid() THEN p.assinatura_imagem END AS assinatura_imagem,
  p.cbo,
  p.rqe
FROM public.perfis p
WHERE
  p.id = auth.uid()
  OR public.current_user_funcao() = 'Administrador'
  OR (public.current_user_ativo() AND p.ativo);

REVOKE ALL ON public.perfis_view FROM anon;
GRANT SELECT ON public.perfis_view TO authenticated;

COMMIT;
