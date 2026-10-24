-- Somente banco descartável: fixtures e verificações são revertidas no final.
-- Migração 37: edição concorrente de cadastro/antecedentes não sobrescreve
-- em silêncio; grupos de campos independentes não geram falso conflito.
BEGIN;
CREATE FUNCTION pg_temp.assert_ok(ok BOOLEAN, mensagem TEXT) RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN IF ok IS DISTINCT FROM true THEN RAISE EXCEPTION 'FALHOU: %', mensagem; END IF; END;
$$;
CREATE FUNCTION pg_temp.conflita(comando TEXT) RETURNS BOOLEAN LANGUAGE plpgsql AS $$
BEGIN
  EXECUTE comando;
  RETURN false;
EXCEPTION WHEN SQLSTATE 'P4090' THEN RETURN true;
END;
$$;

INSERT INTO auth.users (id, email) VALUES
 ('e7000000-0000-4000-8000-000000000001', 'medico-versao@example.invalid'),
 ('e7000000-0000-4000-8000-000000000002', 'recepcao-versao@example.invalid');
SET LOCAL session_replication_role = replica;
UPDATE public.perfis SET ativo = true, funcao = 'Médico', nome = 'Médico fictício' WHERE id = 'e7000000-0000-4000-8000-000000000001';
UPDATE public.perfis SET ativo = true, funcao = 'Recepcionista', nome = 'Recepção fictícia' WHERE id = 'e7000000-0000-4000-8000-000000000002';
SET LOCAL session_replication_role = origin;
INSERT INTO public.pacientes (id, nome, telefone, alergias, versao_cadastro, versao_clinica)
  VALUES ('e7000000-0000-4000-8000-000000000010', 'Paciente versão', '1', 'Nenhuma', 50, 50);

SELECT pg_temp.assert_ok((SELECT versao_cadastro = 1 AND versao_clinica = 1 FROM public.pacientes
  WHERE id = 'e7000000-0000-4000-8000-000000000010'), 'INSERT sempre começa na versão 1');

SET LOCAL ROLE authenticated;
DO $$
DECLARE p UUID := 'e7000000-0000-4000-8000-000000000010';
BEGIN
  -- Recepção edita o cadastro com a versão que tinha (1): passa e sobe para 2.
  PERFORM set_config('request.jwt.claim.sub', 'e7000000-0000-4000-8000-000000000002', true);
  PERFORM pg_temp.assert_ok(NOT pg_temp.conflita(format(
    'UPDATE public.pacientes SET telefone = %L, versao_cadastro = 1 WHERE id = %L', '2', p)), 'edição com versão atual passa');
  PERFORM pg_temp.assert_ok((SELECT versao_cadastro FROM public.pacientes_view WHERE id = p) = 2, 'versão do cadastro sobe');

  -- Outra pessoa, ainda com a versão 1 na tela: recusada, telefone preservado.
  PERFORM pg_temp.assert_ok(pg_temp.conflita(format(
    'UPDATE public.pacientes SET telefone = %L, versao_cadastro = 1 WHERE id = %L', '3', p)), 'edição obsoleta do cadastro é recusada');
  PERFORM pg_temp.assert_ok((SELECT telefone FROM public.pacientes_view WHERE id = p) = '2', 'gravação anterior preservada');

  -- Médico edita antecedentes com versao_clinica 1: o cadastro ter mudado não conflita.
  PERFORM set_config('request.jwt.claim.sub', 'e7000000-0000-4000-8000-000000000001', true);
  PERFORM pg_temp.assert_ok(NOT pg_temp.conflita(format(
    'UPDATE public.pacientes SET alergias = %L, versao_clinica = 1 WHERE id = %L', 'Dipirona', p)), 'grupos independentes não conflitam');
  PERFORM pg_temp.assert_ok((SELECT versao_clinica = 2 AND versao_cadastro = 2 FROM public.pacientes_view WHERE id = p),
    'só a versão clínica sobe ao editar antecedentes');
  PERFORM pg_temp.assert_ok(pg_temp.conflita(format(
    'UPDATE public.pacientes SET alergias = %L, versao_clinica = 1 WHERE id = %L', 'Outra', p)), 'edição obsoleta dos antecedentes é recusada');
  PERFORM pg_temp.assert_ok((SELECT alergias FROM public.pacientes_view WHERE id = p) = 'Dipirona', 'antecedentes preservados');

  -- Recepção sem papel clínico: a proteção desfaz a mudança clínica, e a versão clínica não sobe.
  PERFORM set_config('request.jwt.claim.sub', 'e7000000-0000-4000-8000-000000000002', true);
  BEGIN
    UPDATE public.pacientes SET alergias = 'Tentativa', versao_cadastro = 2 WHERE id = p;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
  PERFORM set_config('request.jwt.claim.sub', 'e7000000-0000-4000-8000-000000000001', true);
  PERFORM pg_temp.assert_ok((SELECT alergias = 'Dipirona' AND versao_clinica = 2 FROM public.pacientes_view WHERE id = p),
    'mudança clínica bloqueada não conta como nova versão');

  -- Cliente antigo (sem enviar versão) continua gravando; a versão sobe.
  PERFORM pg_temp.assert_ok(NOT pg_temp.conflita(format(
    'UPDATE public.pacientes SET ativo = false WHERE id = %L', p)), 'UPDATE sem versão não é bloqueado');
  PERFORM pg_temp.assert_ok((SELECT versao_cadastro FROM public.pacientes_view WHERE id = p) = 3, 'desativar sobe a versão do cadastro');
END;
$$;
RESET ROLE;
ROLLBACK;
