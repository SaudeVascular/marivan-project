-- Somente banco descartável: fixtures e verificações são revertidas no final.
-- Migração 49: procedimento no agendamento, assinatura conclui, Realizado gera cobrança.
BEGIN;
SELECT set_config('pep.leitura_clinica', 'sim', true);
INSERT INTO auth.users (id, email) VALUES
 ('ee000000-0000-4000-8000-000000000001', 'medico-ac@example.invalid'),
 ('ee000000-0000-4000-8000-000000000002', 'recepcao-ac@example.invalid'),
 ('ee000000-0000-4000-8000-000000000003', 'outro-medico-ac@example.invalid');
SET LOCAL session_replication_role = replica;
UPDATE public.perfis SET ativo = true, funcao = 'Médico', nome = 'Médica AC', crm = '1', uf = 'BA' WHERE id = 'ee000000-0000-4000-8000-000000000001';
UPDATE public.perfis SET ativo = true, funcao = 'Recepcionista', nome = 'Recepção AC' WHERE id = 'ee000000-0000-4000-8000-000000000002';
UPDATE public.perfis SET ativo = true, funcao = 'Médico', nome = 'Outro médico AC', crm = '2', uf = 'BA' WHERE id = 'ee000000-0000-4000-8000-000000000003';
SET LOCAL session_replication_role = origin;
INSERT INTO public.convenios (id, nome) VALUES ('ee000000-0000-4000-8000-000000000030', 'Convênio AC');
INSERT INTO public.procedimentos (id, nome, valor_particular, tipo)
 VALUES ('ee000000-0000-4000-8000-000000000040', 'Consulta AC', 300, 'Consulta');
-- Repasse é do profissional (migração 50): 60% em consultas.
INSERT INTO public.repasse_profissional (profissional_id, percentual_consulta, percentual_exame)
 VALUES ('ee000000-0000-4000-8000-000000000001', 60, 10);
INSERT INTO public.convenio_valores (convenio_id, procedimento_id, valor)
 VALUES ('ee000000-0000-4000-8000-000000000030', 'ee000000-0000-4000-8000-000000000040', 180);
INSERT INTO public.pacientes (id, nome) VALUES ('ee000000-0000-4000-8000-000000000010', 'Paciente AC');

CREATE FUNCTION pg_temp.assert_ok(ok BOOLEAN, mensagem TEXT) RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN IF ok IS DISTINCT FROM true THEN RAISE EXCEPTION 'FALHOU: %', mensagem; END IF; END;
$$;
CREATE FUNCTION pg_temp.como(usuario UUID) RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claim.sub', usuario::TEXT, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', usuario, 'role', 'authenticated')::TEXT, true);
END;
$$;
CREATE FUNCTION pg_temp.cobranca(ag UUID) RETURNS public.cobrancas LANGUAGE sql SECURITY DEFINER AS
  $$ SELECT * FROM public.cobrancas WHERE agendamento_id = ag $$;
GRANT EXECUTE ON FUNCTION pg_temp.cobranca(UUID) TO authenticated;

SET LOCAL ROLE authenticated;
DO $$
DECLARE
  pac UUID := 'ee000000-0000-4000-8000-000000000010';
  medica UUID := 'ee000000-0000-4000-8000-000000000001';
  conv UUID := 'ee000000-0000-4000-8000-000000000030';
  proc UUID := 'ee000000-0000-4000-8000-000000000040';
  hoje DATE := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
  ag UUID; ag_outro UUID; ag_sem_proc UUID; c public.cobrancas;
BEGIN
  PERFORM pg_temp.como('ee000000-0000-4000-8000-000000000002');
  PERFORM pg_temp.assert_ok((SELECT valor FROM public.catalogo_procedimentos(conv) WHERE id = proc) = 180,
    'Recepção vê o valor do procedimento na tabela do convênio');
  PERFORM pg_temp.assert_ok((SELECT valor FROM public.catalogo_procedimentos(NULL) WHERE id = proc) = 300,
    'sem convênio: valor particular');
  PERFORM pg_temp.assert_ok(NOT EXISTS (SELECT 1 FROM public.convenio_valores), 'a tabela de preços continua fechada à Recepção');

  INSERT INTO public.agendamentos (paciente_id, medico_id, data, hora, procedimento_id, convenio_id, created_by)
    VALUES (pac, medica, hoje, '09:00', proc, conv, 'ee000000-0000-4000-8000-000000000002') RETURNING id INTO ag;
  INSERT INTO public.agendamentos (paciente_id, medico_id, data, hora, procedimento_id, convenio_id, created_by)
    VALUES (pac, 'ee000000-0000-4000-8000-000000000003', hoje, '10:00', proc, conv, 'ee000000-0000-4000-8000-000000000002') RETURNING id INTO ag_outro;
  UPDATE public.agendamentos SET status = 'Aguardando' WHERE id IN (ag, ag_outro);

  -- A médica assina um atestado: não conclui nada.
  PERFORM pg_temp.como(medica);
  PERFORM public.salvar_registro_clinico(gen_random_uuid(), 'criar', pac, NULL, NULL,
    '{"tipo":"Atestado","titulo":"Atestado","conteudo":"Atestado","status":"Assinado"}');
  PERFORM pg_temp.assert_ok((SELECT status FROM public.agendamentos WHERE id = ag) = 'Aguardando', 'atestado não conclui o agendamento');

  -- Rascunho também não; assinar a consulta, sim.
  PERFORM public.salvar_registro_clinico(gen_random_uuid(), 'criar', pac, NULL, NULL,
    '{"tipo":"Consulta","titulo":"Consulta","conteudo":"Anamnese","status":"Rascunho"}');
  PERFORM pg_temp.assert_ok((SELECT status FROM public.agendamentos WHERE id = ag) = 'Aguardando', 'rascunho não conclui');
  PERFORM public.salvar_registro_clinico(gen_random_uuid(), 'criar', pac, NULL, NULL,
    '{"tipo":"Consulta","titulo":"Consulta","conteudo":"Anamnese assinada","status":"Assinado"}');
  PERFORM pg_temp.assert_ok((SELECT status FROM public.agendamentos WHERE id = ag) = 'Realizado', 'assinar a consulta conclui o agendamento da médica');
  PERFORM pg_temp.assert_ok((SELECT status FROM public.agendamentos WHERE id = ag_outro) = 'Aguardando', 'o agendamento de outro profissional não é concluído');

  c := pg_temp.cobranca(ag);
  PERFORM pg_temp.assert_ok(c.status = 'Pendente' AND c.valor = 180 AND c.percentual_repasse = 60 AND c.valor_repasse = 108
    AND c.procedimento_id = proc AND c.convenio_id = conv AND c.medico_id = medica AND c.paciente_id = pac AND c.descricao = 'Consulta AC',
    'cobrança pendente com o valor da tabela do convênio e o repasse de consulta da médica');
  PERFORM pg_temp.assert_ok((SELECT count(*) FROM pg_temp.cobranca(ag)) = 1, 'uma cobrança por agendamento');

  -- Pela agenda, sem procedimento: cobrança com valor a definir.
  PERFORM pg_temp.como('ee000000-0000-4000-8000-000000000002');
  INSERT INTO public.agendamentos (paciente_id, data, hora, created_by)
    VALUES (pac, hoje, '11:00', 'ee000000-0000-4000-8000-000000000002') RETURNING id INTO ag_sem_proc;
  UPDATE public.agendamentos SET status = 'Aguardando' WHERE id = ag_sem_proc;
  UPDATE public.agendamentos SET status = 'Em atendimento' WHERE id = ag_sem_proc;
  UPDATE public.agendamentos SET status = 'Realizado' WHERE id = ag_sem_proc;
  c := pg_temp.cobranca(ag_sem_proc);
  PERFORM pg_temp.assert_ok(c.valor = 0 AND c.descricao = 'Atendimento — procedimento a definir', 'sem procedimento: valor a definir');

  -- Recepção ajusta o procedimento na chegada (antes de concluir).
  UPDATE public.agendamentos SET procedimento_id = NULL WHERE id = ag_outro;
  PERFORM pg_temp.assert_ok((SELECT procedimento_id IS NULL FROM public.agendamentos WHERE id = ag_outro), 'Recepção ajusta o procedimento');
END;
$$;
RESET ROLE;
ROLLBACK;
