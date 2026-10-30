-- Assinatura só com identidade profissional completa (quarta avaliação,
-- 25/10/2026).
--
-- A tela já bloqueava salvar/imprimir sem nome e registro (useMedicoPerfil),
-- mas uma chamada direta à API assinava um atestado com o número do
-- conselho vazio: o trigger copiava para o registro o que houvesse no
-- perfil, inclusive nada.
--
-- Agora, ao ASSINAR (status 'Assinado', inclusive retificação), o banco
-- exige no perfil ativo de quem assina:
--   * nome com ao menos 3 caracteres;
--   * número do conselho (perfis.crm) de 1 a 20 caracteres, letras,
--     números, ponto, barra ou hífen;
--   * UF válida — CRM, COREN, CRP e CREFITO são todos conselhos regionais.
-- Rascunho continua livre: dá para começar o texto antes de completar o
-- cadastro, mas não para finalizá-lo. Recusa: 23514 com mensagem legível.
--
-- A identidade gravada no registro (assinado_por_nome/registro) continua
-- sendo a validada no momento da assinatura. Isto confere preenchimento,
-- não a regularidade do profissional no conselho.
BEGIN;

CREATE OR REPLACE FUNCTION public.identidade_profissional_validada(
  OUT nome TEXT,
  OUT registro TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  p public.perfis%ROWTYPE;
BEGIN
  -- Sem JWT (manutenção pelo dono do banco, fixtures de teste): mesma
  -- regra de antes, identidade da sessão — que aqui é nenhuma. O app e a
  -- API sempre chegam com JWT; anon não grava em consultas.
  IF auth.uid() IS NULL THEN
    SELECT i.nome, i.registro INTO nome, registro FROM public.identidade_profissional_atual() i;
    RETURN;
  END IF;
  SELECT * INTO p FROM public.perfis WHERE id = auth.uid() AND ativo;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Assinatura exige uma conta ativa.' USING ERRCODE = '42501';
  END IF;
  IF char_length(BTRIM(COALESCE(p.nome, ''))) < 3
     OR BTRIM(COALESCE(p.crm, '')) !~ '^[0-9A-Za-z./-]{1,20}$'
     OR UPPER(BTRIM(COALESCE(p.uf, ''))) NOT IN ('AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO') THEN
    RAISE EXCEPTION 'Para assinar, seu cadastro precisa ter nome, número do registro no conselho e UF. Peça ao Administrador que complete em Usuários; o rascunho pode ser salvo.'
      USING ERRCODE = '23514';
  END IF;
  SELECT i.nome, i.registro INTO nome, registro FROM public.identidade_profissional_atual() i;
END;
$$;

REVOKE ALL ON FUNCTION public.identidade_profissional_validada() FROM PUBLIC, anon, authenticated;

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
    FROM public.identidade_profissional_validada();
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
$function$;

COMMIT;
