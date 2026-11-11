-- Somente banco descartável: fixtures e verificações são revertidas no final.
-- Migração 57: antecedentes só dentro da leitura registrada.
BEGIN;
INSERT INTO auth.users (id, email) VALUES
 ('eb000000-0000-4000-8000-000000000001', 'medica-ant@example.invalid'),
 ('eb000000-0000-4000-8000-000000000002', 'recepcao-ant@example.invalid');
SET LOCAL session_replication_role = replica;
UPDATE public.perfis SET ativo = true, funcao = 'Médico', nome = 'Médica ANT' WHERE id = 'eb000000-0000-4000-8000-000000000001';
UPDATE public.perfis SET ativo = true, funcao = 'Recepcionista', nome = 'Recepção ANT' WHERE id = 'eb000000-0000-4000-8000-000000000002';
SET LOCAL session_replication_role = origin;
INSERT INTO public.pacientes (id, nome, alergias, medicamentos_uso)
 VALUES ('eb000000-0000-4000-8000-000000000010', 'Paciente ANT', 'Dipirona', 'Losartana');

CREATE FUNCTION pg_temp.assert_ok(ok BOOLEAN, mensagem TEXT) RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN IF ok IS DISTINCT FROM true THEN RAISE EXCEPTION 'FALHOU: %', mensagem; END IF; END;
$$;
CREATE FUNCTION pg_temp.como(usuario UUID) RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claim.sub', usuario::TEXT, true);
  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', usuario, 'role', 'authenticated')::TEXT, true);
END;
$$;
CREATE FUNCTION pg_temp.acessos(pac UUID) RETURNS BIGINT LANGUAGE sql SECURITY DEFINER AS
  $$ SELECT count(*) FROM public.acessos WHERE paciente_id = pac AND acao = 'ver_antecedentes' $$;
GRANT EXECUTE ON FUNCTION pg_temp.acessos(UUID) TO authenticated;

SET LOCAL ROLE authenticated;
DO $$
DECLARE
  pac UUID := 'eb000000-0000-4000-8000-000000000010';
  erro TEXT;
BEGIN
  PERFORM pg_temp.como('eb000000-0000-4000-8000-000000000001');
  PERFORM pg_temp.assert_ok((SELECT alergias IS NULL AND medicamentos_uso IS NULL AND nome = 'Paciente ANT' FROM public.pacientes_view WHERE id = pac),
    'busca/lista: médica vê o cadastro, sem os antecedentes');
  PERFORM pg_temp.assert_ok(pg_temp.acessos(pac) = 0, 'nada registrado ainda');
  PERFORM pg_temp.assert_ok((SELECT alergias = 'Dipirona' AND medicamentos_uso = 'Losartana' FROM public.ler_paciente_clinico(pac)),
    'prontuário: antecedentes pela função');
  PERFORM pg_temp.assert_ok(pg_temp.acessos(pac) = 1, 'e o acesso fica registrado');
  PERFORM pg_temp.assert_ok((SELECT alergias IS NULL FROM public.pacientes_view WHERE id = pac), 'depois da função, a leitura direta volta a vir vazia');
  PERFORM pg_temp.assert_ok(NOT EXISTS (SELECT 1 FROM public.ler_paciente_clinico('eb000000-0000-4000-8000-0000000000ff')), 'paciente inexistente: nada');

  PERFORM pg_temp.como('eb000000-0000-4000-8000-000000000002');
  BEGIN
    PERFORM public.ler_paciente_clinico(pac);
    erro := 'ok';
  EXCEPTION WHEN OTHERS THEN erro := SQLSTATE;
  END;
  PERFORM pg_temp.assert_ok(erro = '42501', 'Recepção não lê antecedentes');
  PERFORM set_config('pep.leitura_clinica', 'sim', true);
  PERFORM pg_temp.assert_ok((SELECT alergias IS NULL FROM public.pacientes_view WHERE id = pac), 'nem ligando a marca à mão, sem papel clínico');
  PERFORM set_config('pep.leitura_clinica', '', true);
END;
$$;
RESET ROLE;
DO $$ BEGIN
  PERFORM pg_temp.assert_ok(NOT has_function_privilege('anon', 'public.ler_paciente_clinico(uuid)', 'EXECUTE'), 'anon não executa');
END $$;
ROLLBACK;
