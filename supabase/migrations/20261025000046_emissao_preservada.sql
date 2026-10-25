-- Versão fiel do documento emitido (quarta avaliação, 25/10/2026).
--
-- O conteúdo assinado já era imutável, mas a 2ª via montava o resto com
-- dados ATUAIS: cadastro e idade do paciente, antecedentes (nos
-- atendimentos) e dados da clínica. Uma mudança posterior no endereço, nas
-- alergias ou no nome da clínica mudava a impressão de um registro antigo.
--
-- Agora, no momento da assinatura, o banco guarda em consultas.emissao um
-- retrato do que entra no documento (modelo 1):
--   paciente     nome, CPF, nascimento, idade na data, nome da mãe, CNS,
--                convênio e endereço;
--   antecedentes só nos atendimentos (Consulta, Evolução de Enfermagem,
--                Sinais Vitais), como estavam no momento;
--   clinica      nome, nome fantasia, CNPJ, endereço, cidade, CEP, telefone
--                e o endereço (URL) da logo — a imagem em si não é copiada;
--   profissional nome, especialidade, área, RQE e função — a imagem da
--                assinatura NÃO é copiada (só o dono a lê; migração 31);
--   datas        atendimento (data/hora do registro), assinado_em e
--                emitido_em (a 1ª emissão é a assinatura).
-- e em emissao_hash um SHA-256 disso tudo junto com tipo, título, texto e
-- identidade de quem assinou, impresso na 2ª via como código de
-- verificação. Como todo registro assinado, é imutável.
--
-- Registros assinados antes desta migração ficam com emissao NULL: a 2ª
-- via deles diz explicitamente que usa dados atuais do cadastro.
--
-- Leitura: mesma RLS de consultas (quem lê o registro lê o retrato). A
-- auditoria mascarada (migração 36) já esconde estas colunas de quem não
-- tem papel clínico — para consultas ela usa lista branca.
BEGIN;

ALTER TABLE public.consultas
  ADD COLUMN IF NOT EXISTS emissao JSONB,
  ADD COLUMN IF NOT EXISTS emissao_hash TEXT;

CREATE OR REPLACE FUNCTION public.montar_emissao(p_paciente_id UUID, p_tipo TEXT, p_assinado_em TIMESTAMPTZ)
RETURNS JSONB
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'modelo', 1,
    'emitido_em', to_char(p_assinado_em AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
    'paciente', (
      SELECT jsonb_build_object(
        'nome', pa.nome, 'cpf', pa.cpf, 'nascimento', pa.nascimento,
        'idade', CASE WHEN pa.nascimento IS NULL THEN NULL
                      ELSE date_part('year', age((p_assinado_em AT TIME ZONE 'America/Sao_Paulo')::date, pa.nascimento))::INT END,
        'nome_mae', pa.nome_mae, 'cns', pa.cns,
        'convenio', COALESCE(cv.nome, pa.convenio),
        'cep', pa.cep, 'endereco', pa.endereco, 'numero', pa.numero, 'complemento', pa.complemento)
      FROM public.pacientes pa LEFT JOIN public.convenios cv ON cv.id = pa.convenio_id
      WHERE pa.id = p_paciente_id),
    'antecedentes', CASE WHEN p_tipo IN ('Consulta', 'Evolução de Enfermagem', 'Sinais Vitais') THEN (
      SELECT jsonb_build_object(
        'has', pa.has, 'dm', pa.dm, 'dac', pa.dac, 'dislipidemia', pa.dislipidemia,
        'tabagismo', pa.tabagismo, 'etilismo', pa.etilismo,
        'outras_comorbidades', pa.outras_comorbidades, 'cirurgias', pa.cirurgias,
        'medicamentos_uso', pa.medicamentos_uso, 'alergias', pa.alergias)
      FROM public.pacientes pa WHERE pa.id = p_paciente_id) END,
    'clinica', (
      SELECT jsonb_build_object(
        'nome', c.nome, 'nome_fantasia', c.nome_fantasia, 'cnpj', c.cnpj, 'cep', c.cep,
        'endereco', c.endereco, 'numero', c.numero, 'complemento', c.complemento,
        'cidade', c.cidade, 'telefone', c.telefone, 'logo_url', c.logo_url)
      FROM public.configuracoes_clinica c ORDER BY c.updated_at DESC NULLS LAST LIMIT 1),
    'profissional', (
      SELECT jsonb_build_object(
        'nome', pf.nome, 'especialidade', pf.especialidade, 'area_atuacao', pf.area_atuacao, 'rqe', pf.rqe,
        'funcao', COALESCE(NULLIF(pf.papel_clinico_administrador, ''), pf.funcao))
      FROM public.perfis pf WHERE pf.id = auth.uid())
  );
$$;

CREATE OR REPLACE FUNCTION public.hash_emissao(
  p_tipo TEXT, p_titulo TEXT, p_conteudo TEXT, p_data DATE, p_hora TEXT, p_assinado_em TIMESTAMPTZ,
  p_nome TEXT, p_registro TEXT, p_emissao JSONB
) RETURNS TEXT
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT encode(sha256(convert_to(jsonb_build_object(
    'tipo', p_tipo, 'titulo', p_titulo, 'conteudo', p_conteudo, 'data', p_data, 'hora', p_hora,
    -- Data em UTC com texto fixo: o hash não pode depender do fuso da sessão.
    'assinado_em', to_char(p_assinado_em AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'), 'assinado_por_nome', p_nome, 'assinado_por_registro', p_registro,
    'emissao', p_emissao)::TEXT, 'UTF8')), 'hex');
$$;

REVOKE ALL ON FUNCTION public.montar_emissao(UUID, TEXT, TIMESTAMPTZ) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.hash_emissao(TEXT, TEXT, TEXT, DATE, TEXT, TIMESTAMPTZ, TEXT, TEXT, JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.hash_emissao(TEXT, TEXT, TEXT, DATE, TEXT, TIMESTAMPTZ, TEXT, TEXT, JSONB) TO authenticated;

CREATE OR REPLACE FUNCTION public.validar_consulta_clinica()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
      FROM public.identidade_profissional_validada();
      NEW.assinado_em := clock_timestamp();
      NEW.assinado_por_nome := profissional_nome;
      NEW.assinado_por_registro := profissional_registro;
      NEW.emissao := public.montar_emissao(NEW.paciente_id, NEW.tipo, NEW.assinado_em);
      NEW.emissao_hash := public.hash_emissao(NEW.tipo, NEW.titulo, NEW.conteudo, NEW.data, NEW.hora, NEW.assinado_em,
                                              NEW.assinado_por_nome, NEW.assinado_por_registro, NEW.emissao);
    ELSE
      NEW.assinado_em := NULL;
      NEW.assinado_por_nome := NULL;
      NEW.assinado_por_registro := NULL;
      NEW.emissao := NULL;
      NEW.emissao_hash := NULL;
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
    FROM public.identidade_profissional_validada();
    NEW.assinado_em := clock_timestamp();
    NEW.assinado_por_nome := profissional_nome;
    NEW.assinado_por_registro := profissional_registro;
    NEW.emissao := public.montar_emissao(NEW.paciente_id, NEW.tipo, NEW.assinado_em);
    NEW.emissao_hash := public.hash_emissao(NEW.tipo, NEW.titulo, NEW.conteudo, NEW.data, NEW.hora, NEW.assinado_em,
                                            NEW.assinado_por_nome, NEW.assinado_por_registro, NEW.emissao);
  ELSE
    NEW.assinado_em := NULL;
    NEW.assinado_por_nome := NULL;
    NEW.assinado_por_registro := NULL;
    NEW.emissao := NULL;
    NEW.emissao_hash := NULL;
  END IF;
  RETURN NEW;
END;
$function$;

COMMIT;
