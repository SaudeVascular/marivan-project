-- Gravação do paciente por função, com versão obrigatória (segunda
-- avaliação, 24/10/2026).
--
-- A migração 37 conferia a versão só quando o cliente a enviava: um
-- UPDATE sem a coluna passava e sobrescrevia em silêncio. Aqui entra a
-- via controlada; a migração 42 fecha o UPDATE direto.
--
-- Produção: aplicar (com a 42) LOGO DEPOIS de publicar o site que usa
-- esta função — o site antigo grava direto e, depois da 42, recebe erro
-- ao editar paciente; o site novo, antes da 41, também.
--
-- SECURITY INVOKER: RLS de pacientes, privilégios por coluna e os
-- gatilhos de proteção (recepção não altera antecedentes) continuam
-- valendo exatamente como no UPDATE direto. A função só acrescenta:
--   * grupo fechado de campos (cadastro, clinico ou ativo), todos
--     obrigatórios — nada de campo fora do grupo nem campo esquecido;
--   * versão esperada obrigatória, conferida pelo gatilho da migração 37;
--   * antecedentes só por quem tem papel clínico (antes, a proteção
--     desfazia a mudança e a tela achava que tinha gravado);
--   * erro explícito quando nenhuma linha foi alterada (paciente
--     inexistente ou sem permissão), em vez de sucesso vazio.

BEGIN;

CREATE OR REPLACE FUNCTION public.atualizar_paciente(
  p_id UUID, p_grupo TEXT, p_versao_esperada INTEGER, p_dados JSONB
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  campos TEXT[];
  faltando TEXT[];
  sobrando TEXT[];
  r public.pacientes;
BEGIN
  IF p_versao_esperada IS NULL OR p_versao_esperada < 1 THEN
    RAISE EXCEPTION 'Recarregue o paciente antes de editar: a versão que estava na tela não foi informada.'
      USING ERRCODE = '22023';
  END IF;
  IF p_dados IS NULL OR jsonb_typeof(p_dados) <> 'object' THEN
    RAISE EXCEPTION 'Dados do paciente inválidos.' USING ERRCODE = '22023';
  END IF;

  campos := CASE p_grupo
    WHEN 'cadastro' THEN ARRAY['nome','cpf','nascimento','nome_mae','telefone','convenio_id','cep','endereco','numero','complemento','cns']
    WHEN 'clinico'  THEN ARRAY['alergias','has','dm','dac','dislipidemia','tabagismo','etilismo','cirurgias','medicamentos_uso','outras_comorbidades']
    WHEN 'ativo'    THEN ARRAY['ativo']
  END;
  IF campos IS NULL THEN
    RAISE EXCEPTION 'Grupo de campos desconhecido: %', p_grupo USING ERRCODE = '22023';
  END IF;
  SELECT array_agg(c) INTO faltando FROM unnest(campos) c WHERE NOT p_dados ? c;
  SELECT array_agg(k) INTO sobrando FROM jsonb_object_keys(p_dados) k WHERE k <> ALL (campos);
  IF faltando IS NOT NULL OR sobrando IS NOT NULL THEN
    RAISE EXCEPTION 'Campos inválidos para %: faltando %, fora do grupo %', p_grupo,
      COALESCE(faltando, '{}'), COALESCE(sobrando, '{}') USING ERRCODE = '22023';
  END IF;
  IF p_grupo = 'clinico' AND public.current_user_papel_clinico() IS NULL THEN
    RAISE EXCEPTION 'Perfil sem permissão para alterar dados clínicos.' USING ERRCODE = '42501';
  END IF;

  -- Converte o JSON para os tipos das colunas sem ler a linha atual (o
  -- app não tem SELECT na tabela base, só no id).
  r := jsonb_populate_record(NULL::public.pacientes, p_dados);

  -- Liberação lida pelo gatilho da migração 42; vale só nesta transação.
  PERFORM set_config('pep.atualizar_paciente', 'sim', true);
  IF p_grupo = 'cadastro' THEN
    UPDATE public.pacientes SET
      nome = r.nome, cpf = r.cpf, nascimento = r.nascimento, nome_mae = r.nome_mae,
      telefone = r.telefone, convenio_id = r.convenio_id, cep = r.cep, endereco = r.endereco,
      numero = r.numero, complemento = r.complemento, cns = r.cns,
      versao_cadastro = p_versao_esperada
    WHERE id = p_id;
  ELSIF p_grupo = 'clinico' THEN
    UPDATE public.pacientes SET
      alergias = r.alergias, has = r.has, dm = r.dm, dac = r.dac, dislipidemia = r.dislipidemia,
      tabagismo = r.tabagismo, etilismo = r.etilismo, cirurgias = r.cirurgias,
      medicamentos_uso = r.medicamentos_uso, outras_comorbidades = r.outras_comorbidades,
      versao_clinica = p_versao_esperada
    WHERE id = p_id;
  ELSE
    IF r.ativo IS NULL THEN
      RAISE EXCEPTION 'Informe ativo = true ou false.' USING ERRCODE = '22023';
    END IF;
    UPDATE public.pacientes SET ativo = r.ativo, versao_cadastro = p_versao_esperada WHERE id = p_id;
  END IF;
  IF NOT FOUND THEN
    PERFORM set_config('pep.atualizar_paciente', '', true);
    RAISE EXCEPTION 'Paciente não encontrado ou sem permissão para editar.' USING ERRCODE = '42501';
  END IF;
  PERFORM set_config('pep.atualizar_paciente', '', true);
END;
$$;

REVOKE ALL ON FUNCTION public.atualizar_paciente(UUID, TEXT, INTEGER, JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.atualizar_paciente(UUID, TEXT, INTEGER, JSONB) TO authenticated;

COMMIT;
