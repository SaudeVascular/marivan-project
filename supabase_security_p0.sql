-- =====================================================================
-- Correções P0 de segurança e integridade clínica
-- Execute depois de todas as migrações anteriores do README.
-- =====================================================================

BEGIN;

-- Uma conta inativa não conserva poderes de sua função antiga em policies
-- que consultam apenas current_user_funcao().
CREATE OR REPLACE FUNCTION public.current_user_funcao()
RETURNS TEXT
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT funcao FROM public.perfis WHERE id = auth.uid() AND ativo;
$$;

-- 1. Perfis: cadastro público nunca escolhe função nem nasce ativo.
CREATE OR REPLACE FUNCTION public.criar_perfil_usuario()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.perfis (id, email, nome, funcao, ativo)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NULLIF(BTRIM(NEW.raw_user_meta_data->>'nome'), ''), split_part(NEW.email, '@', 1)),
    'Pendente',
    false
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP POLICY IF EXISTS "inserir perfis" ON public.perfis;

DROP POLICY IF EXISTS "atualizar perfis" ON public.perfis;
CREATE POLICY "atualizar perfis" ON public.perfis
  FOR UPDATE
  USING (
    public.current_user_funcao() = 'Administrador'
    OR (auth.uid() = id AND public.current_user_ativo())
  )
  WITH CHECK (
    public.current_user_funcao() = 'Administrador'
    OR (auth.uid() = id AND public.current_user_ativo())
  );

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
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_impedir_auto_promocao ON public.perfis;
DROP FUNCTION IF EXISTS public.impedir_auto_promocao();
DROP TRIGGER IF EXISTS trg_proteger_campos_seguranca_perfil ON public.perfis;
CREATE TRIGGER trg_proteger_campos_seguranca_perfil
  BEFORE UPDATE ON public.perfis
  FOR EACH ROW EXECUTE FUNCTION public.proteger_campos_seguranca_perfil();

-- A view roda com o dono e aplica a máscara explicitamente. Isso permite
-- retirar a leitura direta da tabela, que tornava a view contornável.
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
       THEN p.sexo END AS sexo
FROM public.perfis p
WHERE
  p.id = auth.uid()
  OR public.current_user_funcao() = 'Administrador'
  OR (public.current_user_ativo() AND p.ativo);

REVOKE SELECT ON public.perfis FROM anon, authenticated;
REVOKE ALL ON public.perfis_view FROM anon;
GRANT SELECT (id) ON public.perfis TO authenticated;
GRANT SELECT ON public.perfis_view TO authenticated;

-- 2. Pacientes: leitura somente pela view e escrita clínica protegida.
CREATE OR REPLACE VIEW public.pacientes_view
WITH (security_barrier = true, security_invoker = false) AS
SELECT
  p.id, p.nome, p.cpf, p.nascimento, p.nome_mae, p.telefone,
  p.convenio_id, c.nome AS convenio_nome, p.cep, p.endereco,
  p.ativo, p.created_by, p.created_at, p.updated_at,
  CASE WHEN public.current_user_funcao() IN ('Médico', 'Enfermeiro(a)', 'Administrador')
       THEN p.alergias END AS alergias,
  CASE WHEN public.current_user_funcao() IN ('Médico', 'Enfermeiro(a)', 'Administrador')
       THEN p.has END AS has,
  CASE WHEN public.current_user_funcao() IN ('Médico', 'Enfermeiro(a)', 'Administrador')
       THEN p.dm END AS dm,
  CASE WHEN public.current_user_funcao() IN ('Médico', 'Enfermeiro(a)', 'Administrador')
       THEN p.dac END AS dac,
  CASE WHEN public.current_user_funcao() IN ('Médico', 'Enfermeiro(a)', 'Administrador')
       THEN p.dislipidemia END AS dislipidemia,
  CASE WHEN public.current_user_funcao() IN ('Médico', 'Enfermeiro(a)', 'Administrador')
       THEN p.tabagismo END AS tabagismo,
  CASE WHEN public.current_user_funcao() IN ('Médico', 'Enfermeiro(a)', 'Administrador')
       THEN p.etilismo END AS etilismo,
  CASE WHEN public.current_user_funcao() IN ('Médico', 'Enfermeiro(a)', 'Administrador')
       THEN p.cirurgias END AS cirurgias,
  CASE WHEN public.current_user_funcao() IN ('Médico', 'Enfermeiro(a)', 'Administrador')
       THEN p.medicamentos_uso END AS medicamentos_uso
FROM public.pacientes p
LEFT JOIN public.convenios c ON c.id = p.convenio_id
WHERE public.current_user_ativo();

REVOKE SELECT ON public.pacientes FROM anon, authenticated;
REVOKE ALL ON public.pacientes_view FROM anon;
GRANT SELECT (id) ON public.pacientes TO authenticated;
GRANT SELECT ON public.pacientes_view TO authenticated;

DROP POLICY IF EXISTS "criar pacientes" ON public.pacientes;
CREATE POLICY "criar pacientes" ON public.pacientes
  FOR INSERT
  WITH CHECK (
    public.current_user_ativo()
    AND public.current_user_funcao() IN ('Médico', 'Enfermeiro(a)', 'Recepcionista', 'Administrador')
    AND created_by = auth.uid()
  );

DROP POLICY IF EXISTS "editar pacientes" ON public.pacientes;
CREATE POLICY "editar pacientes" ON public.pacientes
  FOR UPDATE
  USING (
    public.current_user_ativo()
    AND public.current_user_funcao() IN ('Médico', 'Enfermeiro(a)', 'Recepcionista', 'Administrador')
  )
  WITH CHECK (
    public.current_user_ativo()
    AND public.current_user_funcao() IN ('Médico', 'Enfermeiro(a)', 'Recepcionista', 'Administrador')
  );

-- A aplicação desativa pacientes por UPDATE; exclusão física em cascata
-- apagaria o prontuário e não fica disponível pela API.
DROP POLICY IF EXISTS "excluir pacientes" ON public.pacientes;

CREATE OR REPLACE FUNCTION public.proteger_dados_clinicos_paciente()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  perfil_clinico BOOLEAN := public.current_user_funcao() IN ('Médico', 'Enfermeiro(a)', 'Administrador');
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
      NULLIF(BTRIM(COALESCE(NEW.medicamentos_uso, '')), '') IS NOT NULL
    ) THEN
      RAISE EXCEPTION 'Perfil sem permissão para registrar dados clínicos';
    END IF;
  ELSIF NOT perfil_clinico THEN
    -- Clientes antigos reenviavam os campos mascarados como vazios ao editar
    -- apenas telefone/endereço. Em vez de rejeitar todo o cadastro (ou, pior,
    -- apagar os dados), o banco ignora qualquer valor clínico enviado por um
    -- perfil não clínico e conserva exatamente o que já estava armazenado.
    NEW.alergias := OLD.alergias;
    NEW.has := OLD.has;
    NEW.dm := OLD.dm;
    NEW.dac := OLD.dac;
    NEW.dislipidemia := OLD.dislipidemia;
    NEW.tabagismo := OLD.tabagismo;
    NEW.etilismo := OLD.etilismo;
    NEW.cirurgias := OLD.cirurgias;
    NEW.medicamentos_uso := OLD.medicamentos_uso;
  END IF;
  IF TG_OP = 'UPDATE' AND NEW.created_by IS DISTINCT FROM OLD.created_by THEN
    RAISE EXCEPTION 'A autoria do cadastro do paciente não pode ser alterada';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_proteger_dados_clinicos_paciente ON public.pacientes;
CREATE TRIGGER trg_proteger_dados_clinicos_paciente
  BEFORE INSERT OR UPDATE ON public.pacientes
  FOR EACH ROW EXECUTE FUNCTION public.proteger_dados_clinicos_paciente();

-- 3. Prontuário: autoria e assinatura são fatos produzidos pelo banco.
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
      ELSE (CASE WHEN p.funcao = 'Enfermeiro(a)' THEN 'COREN ' ELSE 'CRM ' END)
           || BTRIM(p.crm)
           || CASE WHEN NULLIF(BTRIM(COALESCE(p.uf, '')), '') IS NULL
                   THEN '' ELSE '/' || BTRIM(p.uf) END
    END
  FROM public.perfis p
  WHERE p.id = auth.uid() AND p.ativo;
$$;

CREATE OR REPLACE FUNCTION public.validar_consulta_clinica()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  profissional_nome TEXT;
  profissional_registro TEXT;
  original public.consultas%ROWTYPE;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF auth.uid() IS NOT NULL THEN NEW.created_by := auth.uid(); END IF;

    IF NEW.retificacao_de IS NOT NULL THEN
      SELECT * INTO original FROM public.consultas WHERE id = NEW.retificacao_de;
      IF NOT FOUND OR original.status <> 'Assinado' THEN
        RAISE EXCEPTION 'Retificação exige um registro original assinado';
      END IF;
      IF original.created_by IS DISTINCT FROM auth.uid() THEN
        RAISE EXCEPTION 'Somente o autor do registro original pode retificá-lo';
      END IF;
      IF NULLIF(BTRIM(COALESCE(NEW.motivo_retificacao, '')), '') IS NULL THEN
        RAISE EXCEPTION 'O motivo da retificação é obrigatório';
      END IF;
      NEW.paciente_id := original.paciente_id;
      NEW.tipo := original.tipo;
      NEW.titulo := 'Retificação — ' || COALESCE(original.titulo, 'Registro clínico');
      NEW.status := 'Assinado';
    END IF;

    IF NEW.status = 'Assinado' THEN
      SELECT nome, registro INTO profissional_nome, profissional_registro
      FROM public.identidade_profissional_atual();
      NEW.assinado_em := clock_timestamp();
      NEW.assinado_por_nome := profissional_nome;
      NEW.assinado_por_registro := profissional_registro;
    ELSE
      NEW.assinado_em := NULL;
      NEW.assinado_por_nome := NULL;
      NEW.assinado_por_registro := NULL;
    END IF;
    RETURN NEW;
  END IF;

  IF OLD.status IN ('Assinado', 'Cancelado') THEN
    IF NEW IS DISTINCT FROM OLD THEN
      RAISE EXCEPTION 'Registro consolidado é imutável; crie uma retificação';
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.paciente_id IS DISTINCT FROM OLD.paciente_id
     OR NEW.created_by IS DISTINCT FROM OLD.created_by
     OR NEW.created_at IS DISTINCT FROM OLD.created_at
     OR NEW.retificacao_de IS DISTINCT FROM OLD.retificacao_de
     OR NEW.motivo_retificacao IS DISTINCT FROM OLD.motivo_retificacao THEN
    RAISE EXCEPTION 'Paciente, autoria e vínculo de retificação não podem ser alterados';
  END IF;

  IF NEW.status NOT IN ('Rascunho', 'Assinado') THEN
    RAISE EXCEPTION 'Transição de status inválida';
  END IF;

  IF NEW.status = 'Assinado' THEN
    SELECT nome, registro INTO profissional_nome, profissional_registro
    FROM public.identidade_profissional_atual();
    NEW.assinado_em := clock_timestamp();
    NEW.assinado_por_nome := profissional_nome;
    NEW.assinado_por_registro := profissional_registro;
  ELSE
    NEW.assinado_em := NULL;
    NEW.assinado_por_nome := NULL;
    NEW.assinado_por_registro := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_impedir_edicao_consulta_assinada ON public.consultas;
DROP TRIGGER IF EXISTS trg_validar_consulta_clinica ON public.consultas;
CREATE TRIGGER trg_validar_consulta_clinica
  BEFORE INSERT OR UPDATE ON public.consultas
  FOR EACH ROW EXECUTE FUNCTION public.validar_consulta_clinica();

DROP POLICY IF EXISTS "ver consultas" ON public.consultas;
CREATE POLICY "ver consultas" ON public.consultas
  FOR SELECT
  USING (
    public.current_user_ativo()
    AND public.current_user_funcao() IN ('Médico', 'Enfermeiro(a)', 'Administrador')
    AND (status <> 'Rascunho' OR created_by = auth.uid() OR public.current_user_funcao() = 'Administrador')
  );

DROP POLICY IF EXISTS "criar consultas" ON public.consultas;
CREATE POLICY "criar consultas" ON public.consultas
  FOR INSERT
  WITH CHECK (
    public.current_user_ativo()
    AND created_by = auth.uid()
    AND (
      public.current_user_funcao() IN ('Médico', 'Administrador')
      OR (public.current_user_funcao() = 'Enfermeiro(a)' AND tipo NOT IN ('Receituário', 'Prescrição', 'Atestado'))
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
      public.current_user_funcao() = 'Médico'
      OR (public.current_user_funcao() = 'Enfermeiro(a)' AND tipo NOT IN ('Receituário', 'Prescrição', 'Atestado'))
      OR public.current_user_funcao() = 'Administrador'
    )
  );

DROP POLICY IF EXISTS "excluir consultas" ON public.consultas;
CREATE POLICY "excluir consultas" ON public.consultas
  FOR DELETE
  USING (status = 'Rascunho' AND created_by = auth.uid());

-- Itens de receita só podem mudar enquanto o registro-pai é rascunho
-- do próprio autor. Isso evita alterar uma prescrição já assinada.
DROP POLICY IF EXISTS "ver medicamentos" ON public.medicamentos_receita;
CREATE POLICY "ver medicamentos" ON public.medicamentos_receita
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.consultas c
      WHERE c.id = consulta_id
    )
  );

DROP POLICY IF EXISTS "criar medicamentos" ON public.medicamentos_receita;
CREATE POLICY "criar medicamentos" ON public.medicamentos_receita
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.consultas c
      WHERE c.id = consulta_id AND c.status = 'Rascunho' AND c.created_by = auth.uid()
    )
  );

DROP POLICY IF EXISTS "editar medicamentos" ON public.medicamentos_receita;
CREATE POLICY "editar medicamentos" ON public.medicamentos_receita
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.consultas c
      WHERE c.id = consulta_id AND c.status = 'Rascunho' AND c.created_by = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.consultas c
      WHERE c.id = consulta_id AND c.status = 'Rascunho' AND c.created_by = auth.uid()
    )
  );

DROP POLICY IF EXISTS "excluir medicamentos" ON public.medicamentos_receita;
CREATE POLICY "excluir medicamentos" ON public.medicamentos_receita
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.consultas c
      WHERE c.id = consulta_id AND c.status = 'Rascunho' AND c.created_by = auth.uid()
    )
  );

REVOKE EXECUTE ON FUNCTION public.proteger_campos_seguranca_perfil() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.proteger_dados_clinicos_paciente() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.validar_consulta_clinica() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.criar_perfil_usuario() FROM PUBLIC;

COMMIT;
