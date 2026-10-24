-- Decisão registrada em docs/AUTORIZACAO.md ("Decisões ainda necessárias"):
-- Administrador deixa de ter acesso clínico automático — só passa a ter
-- leitura/escrita de dados clínicos, histórico e prescrição se um OUTRO
-- administrador conceder explicitamente um papel clínico (Médico ou
-- Enfermeiro(a)) à conta. Financeiro passa a só ler a agenda, sem
-- criar/editar. Nenhuma das duas mudanças altera Recepção, Configurações,
-- Filiais, Auditoria ou Usuários — que continuam de acesso administrativo,
-- não clínico.
BEGIN;

-- ---------------------------------------------------------------------
-- 1. Papel clínico adicional do Administrador
-- ---------------------------------------------------------------------
-- Só existe para dar a um Administrador que também é Médico/Enfermeiro(a)
-- de verdade (tem CRM/COREN próprio) a mesma capacidade clínica dessas
-- funções — não é um atalho para "Administrador continua vendo tudo".

ALTER TABLE public.perfis
  ADD COLUMN IF NOT EXISTS papel_clinico_administrador TEXT
  CHECK (papel_clinico_administrador IN ('Médico', 'Enfermeiro(a)'));

-- Só faz sentido em conta Administrador; em qualquer outra função o
-- próprio funcao já determina o papel clínico.
ALTER TABLE public.perfis
  ADD CONSTRAINT papel_clinico_administrador_exige_funcao_admin
  CHECK (papel_clinico_administrador IS NULL OR funcao = 'Administrador');

COMMENT ON COLUMN public.perfis.papel_clinico_administrador IS
  'Concessão explícita e não autoatribuível: só um Administrador diferente do titular pode ligar/desligar. Define se essa conta de Administrador também pratica como Médico ou Enfermeiro(a).';

-- Efetivo: funcao clínica direta (Médico/Enfermeiro(a)), ou, se
-- Administrador, o papel concedido (pode ser NULL = nenhum).
CREATE OR REPLACE FUNCTION public.current_user_papel_clinico()
RETURNS TEXT
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT CASE
    WHEN funcao IN ('Médico', 'Enfermeiro(a)') THEN funcao
    WHEN funcao = 'Administrador' THEN papel_clinico_administrador
    ELSE NULL
  END
  FROM public.perfis WHERE id = auth.uid() AND ativo;
$$;

-- Amplia a proteção de campos sensíveis do próprio perfil: ninguém
-- concede papel clínico a si mesmo, nem administrador — precisa ser
-- outro Administrador ativo a fazer a concessão, igual já vale para
-- função/status/e-mail.
CREATE OR REPLACE FUNCTION public.proteger_campos_seguranca_perfil()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.current_user_funcao() IS DISTINCT FROM 'Administrador' AND (
    NEW.funcao IS DISTINCT FROM OLD.funcao OR
    NEW.ativo IS DISTINCT FROM OLD.ativo OR
    NEW.email IS DISTINCT FROM OLD.email
  ) THEN
    RAISE EXCEPTION 'Somente administradores podem alterar função, status ou e-mail';
  END IF;

  IF NEW.papel_clinico_administrador IS DISTINCT FROM OLD.papel_clinico_administrador THEN
    IF auth.uid() = NEW.id THEN
      RAISE EXCEPTION USING ERRCODE = '42501',
        MESSAGE = 'Um administrador não pode conceder papel clínico à própria conta';
    END IF;
    IF public.current_user_funcao() IS DISTINCT FROM 'Administrador' THEN
      RAISE EXCEPTION USING ERRCODE = '42501',
        MESSAGE = 'Somente administradores concedem papel clínico adicional';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------
-- 2. Identidade de assinatura: prefixo CRM/COREN também considera o
--    papel clínico concedido a um Administrador.
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
      ELSE (CASE
              WHEN p.funcao = 'Enfermeiro(a)'
                   OR (p.funcao = 'Administrador' AND p.papel_clinico_administrador = 'Enfermeiro(a)')
              THEN 'COREN ' ELSE 'CRM '
            END)
           || BTRIM(p.crm)
           || CASE WHEN NULLIF(BTRIM(COALESCE(p.uf, '')), '') IS NULL
                   THEN '' ELSE '/' || BTRIM(p.uf) END
    END
  FROM public.perfis p
  WHERE p.id = auth.uid() AND p.ativo;
$$;

-- ---------------------------------------------------------------------
-- 3. Dados clínicos do paciente: mascaramento e proteção de escrita
--    passam a depender do papel clínico efetivo, não mais de "funcao =
--    Administrador" isoladamente. Mesma lista de colunas da migração 027
--    (numero/complemento não são clínicos e continuam sempre visíveis).
-- ---------------------------------------------------------------------

CREATE OR REPLACE VIEW public.pacientes_view
WITH (security_barrier = true, security_invoker = false) AS
SELECT
  p.id, p.nome, p.cpf, p.nascimento, p.nome_mae, p.telefone,
  p.convenio_id, c.nome AS convenio_nome, p.cep, p.endereco,
  p.ativo, p.created_by, p.created_at, p.updated_at,
  CASE WHEN public.current_user_papel_clinico() IS NOT NULL THEN p.alergias END AS alergias,
  CASE WHEN public.current_user_papel_clinico() IS NOT NULL THEN p.has END AS has,
  CASE WHEN public.current_user_papel_clinico() IS NOT NULL THEN p.dm END AS dm,
  CASE WHEN public.current_user_papel_clinico() IS NOT NULL THEN p.dac END AS dac,
  CASE WHEN public.current_user_papel_clinico() IS NOT NULL THEN p.dislipidemia END AS dislipidemia,
  CASE WHEN public.current_user_papel_clinico() IS NOT NULL THEN p.tabagismo END AS tabagismo,
  CASE WHEN public.current_user_papel_clinico() IS NOT NULL THEN p.etilismo END AS etilismo,
  CASE WHEN public.current_user_papel_clinico() IS NOT NULL THEN p.cirurgias END AS cirurgias,
  CASE WHEN public.current_user_papel_clinico() IS NOT NULL THEN p.medicamentos_uso END AS medicamentos_uso,
  CASE WHEN public.current_user_papel_clinico() IS NOT NULL THEN p.outras_comorbidades END AS outras_comorbidades,
  p.numero,
  p.complemento
FROM public.pacientes p
LEFT JOIN public.convenios c ON c.id = p.convenio_id
WHERE public.current_user_ativo();

REVOKE ALL ON public.pacientes_view FROM anon;
GRANT SELECT ON public.pacientes_view TO authenticated;

CREATE OR REPLACE FUNCTION public.proteger_dados_clinicos_paciente()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  -- NULL (não FALSE) quando não há JWT algum (auth.uid() nulo — conexão
  -- privilegiada/direta, ex.: seed de fixture, SQL Editor, service_role):
  -- `IF NOT perfil_clinico AND (...)` com NULL não dispara a exceção, e a
  -- gravação segue sem checar campo clínico — igual já valia antes desta
  -- migração, quando `current_user_funcao() IN (...)` também propagava
  -- NULL nesse caso. Usar só `IS NOT NULL` aqui quebraria esse bypass,
  -- porque IS NOT NULL nunca é NULL — vira FALSE definitivo e passa a
  -- barrar até gravação sem nenhum campo clínico preenchido.
  perfil_clinico BOOLEAN := CASE
    WHEN auth.uid() IS NULL THEN NULL
    ELSE public.current_user_papel_clinico() IS NOT NULL
  END;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF auth.uid() IS NOT NULL THEN NEW.created_by := auth.uid(); END IF;
    IF NOT perfil_clinico AND (
      NULLIF(BTRIM(COALESCE(NEW.alergias, '')), '') IS NOT NULL OR
      NULLIF(BTRIM(COALESCE(NEW.has, '')), '') IS NOT NULL OR
      NULLIF(BTRIM(COALESCE(NEW.dm, '')), '') IS NOT NULL OR
      NULLIF(BTRIM(COALESCE(NEW.dac, '')), '') IS NOT NULL OR
      NULLIF(BTRIM(COALESCE(NEW.dislipidemia, '')), '') IS NOT NULL OR
      NULLIF(BTRIM(COALESCE(NEW.tabagismo, '')), '') IS NOT NULL OR
      NULLIF(BTRIM(COALESCE(NEW.etilismo, '')), '') IS NOT NULL OR
      NULLIF(BTRIM(COALESCE(NEW.cirurgias, '')), '') IS NOT NULL OR
      NULLIF(BTRIM(COALESCE(NEW.medicamentos_uso, '')), '') IS NOT NULL OR
      NULLIF(BTRIM(COALESCE(NEW.outras_comorbidades, '')), '') IS NOT NULL
    ) THEN
      RAISE EXCEPTION 'Perfil sem permissão para registrar dados clínicos';
    END IF;
  ELSIF NOT perfil_clinico THEN
    NEW.alergias := OLD.alergias;
    NEW.has := OLD.has;
    NEW.dm := OLD.dm;
    NEW.dac := OLD.dac;
    NEW.dislipidemia := OLD.dislipidemia;
    NEW.tabagismo := OLD.tabagismo;
    NEW.etilismo := OLD.etilismo;
    NEW.cirurgias := OLD.cirurgias;
    NEW.medicamentos_uso := OLD.medicamentos_uso;
    NEW.outras_comorbidades := OLD.outras_comorbidades;
  END IF;

  IF TG_OP = 'UPDATE' AND NEW.created_by IS DISTINCT FROM OLD.created_by THEN
    RAISE EXCEPTION 'A autoria do cadastro do paciente não pode ser alterada';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.proteger_dados_clinicos_paciente() FROM PUBLIC;

-- ---------------------------------------------------------------------
-- 4. Prontuário: leitura, criação e edição usam o papel clínico efetivo.
--    Administrador sem concessão deixa de ver qualquer consulta, inclusive
--    assinadas; com concessão, tem exatamente a mesma regra de Médico ou
--    Enfermeiro(a). O suporte a rascunho de outro autor (conflito de
--    concorrência) continua existindo apenas para Administrador já
--    habilitado clinicamente — não é mais automático.
-- ---------------------------------------------------------------------

DROP POLICY IF EXISTS "ver consultas" ON public.consultas;
CREATE POLICY "ver consultas" ON public.consultas
  FOR SELECT
  USING (
    public.current_user_ativo()
    AND public.current_user_papel_clinico() IS NOT NULL
    AND (status <> 'Rascunho' OR created_by = auth.uid() OR public.current_user_funcao() = 'Administrador')
  );

DROP POLICY IF EXISTS "criar consultas" ON public.consultas;
CREATE POLICY "criar consultas" ON public.consultas
  FOR INSERT
  WITH CHECK (
    public.current_user_ativo()
    AND created_by = auth.uid()
    AND (
      public.current_user_papel_clinico() = 'Médico'
      OR (public.current_user_papel_clinico() = 'Enfermeiro(a)' AND tipo NOT IN ('Receituário', 'Prescrição', 'Atestado'))
    )
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
    AND (
      public.current_user_papel_clinico() = 'Médico'
      OR (public.current_user_papel_clinico() = 'Enfermeiro(a)' AND tipo NOT IN ('Receituário', 'Prescrição', 'Atestado'))
    )
  );

-- Modelos de receita: só quem efetivamente prescreve (Médico, ou
-- Administrador concedido como Médico) tem modelo próprio.
DROP POLICY IF EXISTS "ver modelos" ON public.modelos_receita;
DROP POLICY IF EXISTS "criar modelos" ON public.modelos_receita;
DROP POLICY IF EXISTS "deletar modelos" ON public.modelos_receita;
CREATE POLICY "ver modelos" ON public.modelos_receita FOR SELECT TO authenticated
  USING (auth.uid() = user_id AND public.current_user_papel_clinico() = 'Médico');
CREATE POLICY "criar modelos" ON public.modelos_receita FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND public.current_user_papel_clinico() = 'Médico');
CREATE POLICY "deletar modelos" ON public.modelos_receita FOR DELETE TO authenticated
  USING (auth.uid() = user_id AND public.current_user_papel_clinico() = 'Médico');

-- RPC única de gravação clínica (migração 28): mesma lógica, permissão
-- calculada pelo papel clínico efetivo em vez da função crua.
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
    IF papel_clinico = 'Enfermeiro(a)' AND recibo.resultado->>'tipo' IN ('Receituário', 'Prescrição', 'Atestado') THEN
      RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Função atual não permite este documento';
    END IF;
    RETURN recibo.resultado;
  END IF;

  IF p_acao = 'criar' THEN
    IF p_registro_id IS NOT NULL OR p_versao_esperada IS NOT NULL THEN
      RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Criação não aceita registro ou versão anterior';
    END IF;
    tipo_registro := p_dados->>'tipo';
    IF tipo_registro IS NULL OR (papel_clinico = 'Enfermeiro(a)' AND tipo_registro IN ('Receituário', 'Prescrição', 'Atestado')) THEN
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
    IF papel_clinico = 'Enfermeiro(a)' AND registro.tipo IN ('Receituário', 'Prescrição', 'Atestado') THEN
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
-- 5. Agenda: Financeiro passa a só ler — deixa de poder criar, confirmar
--    check-in ou cancelar. Recepção, clínicos e Administrador continuam
--    com o mesmo acesso amplo de antes (revisão dessa parte não foi
--    pedida agora).
-- ---------------------------------------------------------------------

DROP POLICY IF EXISTS "criar agendamentos" ON public.agendamentos;
CREATE POLICY "criar agendamentos" ON public.agendamentos
  FOR INSERT
  WITH CHECK (public.current_user_ativo() AND public.current_user_funcao() <> 'Financeiro');

DROP POLICY IF EXISTS "editar agendamentos" ON public.agendamentos;
CREATE POLICY "editar agendamentos" ON public.agendamentos
  FOR UPDATE
  USING (public.current_user_ativo() AND public.current_user_funcao() <> 'Financeiro')
  WITH CHECK (public.current_user_ativo() AND public.current_user_funcao() <> 'Financeiro');

-- ---------------------------------------------------------------------
-- 6. Roster: expõe o papel clínico concedido (não é dado sensível — é o
--    mesmo tipo de informação que função/CRM, já visíveis na equipe).
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
  p.papel_clinico_administrador
FROM public.perfis p
WHERE
  p.id = auth.uid()
  OR public.current_user_funcao() = 'Administrador'
  OR (public.current_user_ativo() AND p.ativo);

REVOKE ALL ON public.perfis_view FROM anon;
GRANT SELECT ON public.perfis_view TO authenticated;

COMMIT;
