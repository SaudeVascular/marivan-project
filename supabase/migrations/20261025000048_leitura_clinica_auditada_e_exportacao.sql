-- Leitura clínica auditada no banco e exportação (quarta avaliação,
-- 25/10/2026).
--
-- Antes, "quem abriu o prontuário" era registrado pelo app (migração 38):
-- uma leitura feita direto na API não deixava rastro, e uma falha no
-- registro ficava só no console.
--
--   1. A leitura de consultas (registros clínicos) passa a exigir que a
--      transação tenha passado por uma função que registra o acesso
--      ANTES de ler: a policy "ver consultas" ganha a condição
--      pep.leitura_clinica = 'sim', que só estas funções ligam (no mesmo
--      padrão de pep.atualizar_paciente, migração 42 — o cliente da API não
--      tem como ligar esse parâmetro). Sem registro, não há leitura: se o
--      registro falhar, a leitura falha junto.
--        ler_registros_paciente(paciente, limite, offset) → histórico;
--                               registra 'abrir_prontuario' na 1ª página
--        ler_registro(registro, paciente) → um registro, só se for daquele
--                               paciente; registra 'abrir_registro'
--   2. Exportação:
--        exportar_prontuario(paciente) → JSON com o cadastro, todos os
--          registros (autoria, datas, assinatura, retificações, retrato da
--          emissão) e os medicamentos das receitas; mesma permissão de quem
--          lê o prontuário; registra 'exportar_prontuario'.
--        exportar_clinica(limite, offset) → pacientes em lotes, cada um com
--          o prontuário, e na 1ª página agenda, cobranças, catálogos,
--          clínica, filiais e profissionais (sem e-mail nem imagem de
--          assinatura). Só Administrador ativo COM papel clínico concedido
--          (contém dados clínicos); registra 'exportar_clinica'.
--      O arquivo é montado no navegador de quem exporta: não existe cópia
--      temporária no servidor.
--
-- Limite conhecido: os antecedentes do cadastro (pacientes_view) continuam
-- legíveis por perfis clínicos na busca de pacientes; o registro de acesso
-- cobre a abertura do prontuário e dos documentos.
--
-- Produção: aplicar LOGO DEPOIS de publicar o site que lê por estas
-- funções — o site antigo lê consultas direto e passaria a ver o
-- histórico vazio.
BEGIN;

-- Funções internas ficam fora do esquema exposto pela API (public): o app
-- não as chama direto, só as funções públicas abaixo.
CREATE SCHEMA IF NOT EXISTS privado;
REVOKE ALL ON SCHEMA privado FROM PUBLIC, anon;
GRANT USAGE ON SCHEMA privado TO authenticated;

-- Ações novas; exportar_clinica não tem paciente.
ALTER TABLE public.acessos DROP CONSTRAINT IF EXISTS acessos_acao_check;
ALTER TABLE public.acessos ADD CONSTRAINT acessos_acao_check CHECK (acao = ANY (ARRAY[
  'abrir_prontuario', 'abrir_registro', 'imprimir_documento', 'exportar_prontuario', 'exportar_clinica']));
ALTER TABLE public.acessos ALTER COLUMN paciente_id DROP NOT NULL;
ALTER TABLE public.acessos ADD CONSTRAINT acessos_paciente_obrigatorio
  CHECK (paciente_id IS NOT NULL OR acao = 'exportar_clinica');

CREATE OR REPLACE FUNCTION public.registrar_acesso(
  p_paciente_id UUID, p_acao TEXT, p_detalhe TEXT DEFAULT NULL, p_registro_id UUID DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.current_user_ativo() THEN
    RAISE EXCEPTION 'Usuário inativo ou não autenticado' USING ERRCODE = '42501';
  END IF;
  -- O app só registra impressões; as outras ações vêm das funções de
  -- leitura e exportação abaixo (que chamam registrar_acesso_interno).
  IF p_acao <> 'imprimir_documento' THEN
    RAISE EXCEPTION 'Ação de acesso desconhecida: %', p_acao USING ERRCODE = '22023';
  END IF;
  PERFORM privado.registrar_acesso_interno(p_paciente_id, p_acao, p_detalhe, p_registro_id);
END;
$$;

CREATE OR REPLACE FUNCTION privado.registrar_acesso_interno(
  p_paciente_id UUID, p_acao TEXT, p_detalhe TEXT DEFAULT NULL, p_registro_id UUID DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.current_user_ativo() THEN
    RAISE EXCEPTION 'Usuário inativo ou não autenticado' USING ERRCODE = '42501';
  END IF;
  IF p_paciente_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.pacientes WHERE id = p_paciente_id) THEN
    RAISE EXCEPTION 'Paciente inexistente' USING ERRCODE = '22023';
  END IF;
  IF p_registro_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.consultas c WHERE c.id = p_registro_id AND c.paciente_id = p_paciente_id
  ) THEN
    RAISE EXCEPTION 'Registro não pertence ao paciente informado' USING ERRCODE = '22023';
  END IF;
  INSERT INTO public.acessos (usuario_id, paciente_id, acao, detalhe, registro_id)
  VALUES (auth.uid(), p_paciente_id, p_acao, left(NULLIF(btrim(p_detalhe), ''), 120), p_registro_id);
END;
$$;
REVOKE ALL ON FUNCTION public.registrar_acesso(UUID, TEXT, TEXT, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.registrar_acesso(UUID, TEXT, TEXT, UUID) TO authenticated;
REVOKE ALL ON FUNCTION privado.registrar_acesso_interno(UUID, TEXT, TEXT, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION privado.registrar_acesso_interno(UUID, TEXT, TEXT, UUID) TO authenticated;

-- 1. Policy de leitura condicionada ao registro ----------------------------
DROP POLICY IF EXISTS "ver consultas" ON public.consultas;
CREATE POLICY "ver consultas" ON public.consultas FOR SELECT TO authenticated USING (
  public.current_user_ativo()
  AND public.current_user_papel_clinico() IS NOT NULL
  AND (status <> 'Rascunho' OR created_by = auth.uid() OR public.current_user_funcao() = 'Administrador')
  AND COALESCE(current_setting('pep.leitura_clinica', true), '') = 'sim'
);

CREATE OR REPLACE FUNCTION public.ler_registros_paciente(p_paciente_id UUID, p_limite INTEGER DEFAULT 1000, p_offset INTEGER DEFAULT 0)
RETURNS SETOF public.consultas
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF public.current_user_papel_clinico() IS NULL THEN
    RAISE EXCEPTION 'Sem acesso clínico' USING ERRCODE = '42501';
  END IF;
  IF COALESCE(p_offset, 0) = 0 THEN
    PERFORM privado.registrar_acesso_interno(p_paciente_id, 'abrir_prontuario');
  END IF;
  PERFORM set_config('pep.leitura_clinica', 'sim', true);
  RETURN QUERY
    SELECT * FROM public.consultas c WHERE c.paciente_id = p_paciente_id
    ORDER BY c.created_at DESC, c.id DESC
    LIMIT LEAST(GREATEST(COALESCE(p_limite, 1000), 1), 1000) OFFSET GREATEST(COALESCE(p_offset, 0), 0);
  PERFORM set_config('pep.leitura_clinica', '', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.ler_registro(p_registro_id UUID, p_paciente_id UUID)
RETURNS SETOF public.consultas
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF public.current_user_papel_clinico() IS NULL THEN
    RAISE EXCEPTION 'Sem acesso clínico' USING ERRCODE = '42501';
  END IF;
  -- registrar_acesso_interno já recusa registro de outro paciente.
  PERFORM privado.registrar_acesso_interno(p_paciente_id, 'abrir_registro', NULL, p_registro_id);
  PERFORM set_config('pep.leitura_clinica', 'sim', true);
  RETURN QUERY SELECT * FROM public.consultas c WHERE c.id = p_registro_id AND c.paciente_id = p_paciente_id;
  PERFORM set_config('pep.leitura_clinica', '', true);
END;
$$;

-- 2. Exportação -------------------------------------------------------------
-- Prontuário de um paciente como JSON (sem log; quem chama registra).
CREATE OR REPLACE FUNCTION privado.prontuario_json(p_paciente_id UUID)
RETURNS JSONB
LANGUAGE sql
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'paciente', (SELECT to_jsonb(v) - 'operacao_id' FROM public.pacientes_view v WHERE v.id = p_paciente_id),
    'registros', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', c.id, 'tipo', c.tipo, 'titulo', c.titulo, 'conteudo', c.conteudo, 'status', c.status,
        'data_atendimento', c.data, 'hora_atendimento', c.hora, 'criado_em', c.created_at,
        'autor_id', c.created_by, 'autor_nome', au.nome,
        'assinado_em', c.assinado_em, 'assinado_por_nome', c.assinado_por_nome, 'assinado_por_registro', c.assinado_por_registro,
        'retificacao_de', c.retificacao_de, 'motivo_retificacao', c.motivo_retificacao, 'versao', c.versao,
        'emissao', c.emissao, 'emissao_hash', c.emissao_hash,
        'medicamentos', (SELECT COALESCE(jsonb_agg(to_jsonb(m) - 'consulta_id' ORDER BY m.ordem), '[]'::jsonb)
                           FROM public.medicamentos_receita m WHERE m.consulta_id = c.id)
      ) ORDER BY c.created_at, c.id)
      FROM public.consultas c LEFT JOIN public.perfis_view au ON au.id = c.created_by
      WHERE c.paciente_id = p_paciente_id), '[]'::jsonb)
  );
$$;
-- Chamada direta não lê registros (falta pep.leitura_clinica): só o cadastro,
-- que a pessoa já lê pela view.
REVOKE ALL ON FUNCTION privado.prontuario_json(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION privado.prontuario_json(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.exportar_prontuario(p_paciente_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  resultado JSONB;
BEGIN
  IF public.current_user_papel_clinico() IS NULL THEN
    RAISE EXCEPTION 'Exportar o prontuário exige acesso clínico' USING ERRCODE = '42501';
  END IF;
  PERFORM privado.registrar_acesso_interno(p_paciente_id, 'exportar_prontuario', 'Exportação do prontuário');
  PERFORM set_config('pep.leitura_clinica', 'sim', true);
  resultado := jsonb_build_object(
    'formato', 'pep-prontuario', 'versao_formato', 1,
    'exportado_em', to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
    'exportado_por', (SELECT nome FROM public.perfis_view WHERE id = auth.uid())
  ) || privado.prontuario_json(p_paciente_id);
  PERFORM set_config('pep.leitura_clinica', '', true);
  RETURN resultado;
END;
$$;

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
      'procedimentos', (SELECT COALESCE(jsonb_agg(to_jsonb(x)), '[]'::jsonb) FROM public.procedimentos x)
    );
  END IF;
  PERFORM set_config('pep.leitura_clinica', '', true);
  RETURN resultado;
END;
$$;

REVOKE ALL ON FUNCTION public.ler_registros_paciente(UUID, INTEGER, INTEGER), public.ler_registro(UUID, UUID),
  public.exportar_prontuario(UUID), public.exportar_clinica(INTEGER, INTEGER) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ler_registros_paciente(UUID, INTEGER, INTEGER), public.ler_registro(UUID, UUID),
  public.exportar_prontuario(UUID), public.exportar_clinica(INTEGER, INTEGER) TO authenticated;

COMMIT;
