-- Somente banco descartável: fixtures e verificações são revertidas no final.
-- Migração 47: criação idempotente, versão e transições em agenda e cobranças.
BEGIN;
INSERT INTO auth.users (id, email) VALUES
 ('ec000000-0000-4000-8000-000000000001', 'recepcao-gs@example.invalid'),
 ('ec000000-0000-4000-8000-000000000002', 'financeiro-gs@example.invalid');
SET LOCAL session_replication_role = replica;
UPDATE public.perfis SET ativo = true, funcao = 'Recepcionista', nome = 'Recepção fictícia' WHERE id = 'ec000000-0000-4000-8000-000000000001';
UPDATE public.perfis SET ativo = true, funcao = 'Financeiro', nome = 'Financeiro fictício' WHERE id = 'ec000000-0000-4000-8000-000000000002';
SET LOCAL session_replication_role = origin;
INSERT INTO public.pacientes (id, nome) VALUES ('ec000000-0000-4000-8000-000000000010', 'Paciente gravação segura');

CREATE FUNCTION pg_temp.assert_ok(ok BOOLEAN, mensagem TEXT) RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN IF ok IS DISTINCT FROM true THEN RAISE EXCEPTION 'FALHOU: %', mensagem; END IF; END;
$$;
CREATE FUNCTION pg_temp.erro(comando TEXT) RETURNS TEXT LANGUAGE plpgsql AS $$
BEGIN EXECUTE comando; RETURN 'ok';
EXCEPTION WHEN OTHERS THEN RETURN SQLSTATE;
END;
$$;
CREATE FUNCTION pg_temp.como(usuario UUID) RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claim.sub', usuario::TEXT, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', usuario, 'role', 'authenticated')::TEXT, true);
END;
$$;

SET LOCAL ROLE authenticated;
DO $$
DECLARE
  pac UUID := 'ec000000-0000-4000-8000-000000000010';
  op UUID := gen_random_uuid();
  op_pac UUID := gen_random_uuid();
  ag UUID; cb UUID; novo_pac UUID;
BEGIN
  PERFORM pg_temp.como('ec000000-0000-4000-8000-000000000001');

  -- Paciente: repetir a criação não duplica; só o autor recupera o id.
  INSERT INTO public.pacientes (nome, operacao_id, created_by) VALUES ('Sem CPF repetido', op_pac, 'ec000000-0000-4000-8000-000000000001');
  PERFORM pg_temp.assert_ok(pg_temp.erro(format('INSERT INTO public.pacientes (nome, operacao_id) VALUES (%L, %L)', 'Sem CPF repetido', op_pac)) = '23505',
    'repetir a criação do paciente com a mesma operação é recusado (nada duplicado)');
  novo_pac := public.localizar_paciente_por_operacao(op_pac);
  PERFORM pg_temp.assert_ok(novo_pac IS NOT NULL, 'autor recupera o paciente criado pela operação');

  -- Agendamento
  INSERT INTO public.agendamentos (paciente_id, data, hora, operacao_id, created_by)
    VALUES (pac, DATE '2030-02-01', '09:00', op, 'ec000000-0000-4000-8000-000000000001') RETURNING id INTO ag;
  PERFORM pg_temp.assert_ok(pg_temp.erro(format('INSERT INTO public.agendamentos (paciente_id, data, hora, operacao_id) VALUES (%L, %L, %L, %L)',
    pac, '2030-02-01', '09:00', op)) = '23505', 'repetir a criação do agendamento não duplica');
  PERFORM pg_temp.assert_ok((SELECT id FROM public.agendamentos WHERE operacao_id = op) = ag, 'agendamento recuperado pela operação');
  PERFORM pg_temp.assert_ok(pg_temp.erro(format('INSERT INTO public.agendamentos (paciente_id, data, hora, status) VALUES (%L, %L, %L, %L)',
    pac, '2030-02-01', '10:00', 'Realizado')) = '22023', 'agendamento novo só como Agendado');

  PERFORM pg_temp.assert_ok((SELECT versao FROM public.agendamentos WHERE id = ag) = 1, 'versão inicial 1');
  UPDATE public.agendamentos SET status = 'Confirmado' WHERE id = ag AND versao = 1;
  PERFORM pg_temp.assert_ok((SELECT versao FROM public.agendamentos WHERE id = ag) = 2, 'alteração sobe a versão');
  UPDATE public.agendamentos SET observacoes = 'versão velha' WHERE id = ag AND versao = 1;
  PERFORM pg_temp.assert_ok((SELECT observacoes IS NULL FROM public.agendamentos WHERE id = ag), 'alteração com versão antiga não sobrescreve');
  PERFORM pg_temp.assert_ok(pg_temp.erro(format('UPDATE public.agendamentos SET status = %L WHERE id = %L', 'Realizado', ag)) = '22023',
    'Confirmado → Realizado não é permitido');
  UPDATE public.agendamentos SET status = 'Aguardando' WHERE id = ag;
  UPDATE public.agendamentos SET status = 'Em atendimento' WHERE id = ag;
  UPDATE public.agendamentos SET status = 'Realizado' WHERE id = ag;
  PERFORM pg_temp.assert_ok(pg_temp.erro(format('UPDATE public.agendamentos SET observacoes = %L WHERE id = %L', 'depois', ag)) = '22023',
    'agendamento realizado não muda mais');

  -- Cobrança
  PERFORM pg_temp.como('ec000000-0000-4000-8000-000000000002');
  op := gen_random_uuid();
  INSERT INTO public.cobrancas (paciente_id, valor, operacao_id, data_pagamento, created_by)
    VALUES (pac, 100, op, DATE '2000-01-01', 'ec000000-0000-4000-8000-000000000002') RETURNING id INTO cb;
  PERFORM pg_temp.assert_ok((SELECT data_pagamento IS NULL FROM public.cobrancas WHERE id = cb), 'cobrança nova não nasce com data de pagamento');
  PERFORM pg_temp.assert_ok(pg_temp.erro(format('INSERT INTO public.cobrancas (paciente_id, valor, operacao_id) VALUES (%L, 100, %L)', pac, op)) = '23505',
    'repetir a criação da cobrança não duplica');
  PERFORM pg_temp.assert_ok(pg_temp.erro(format('INSERT INTO public.cobrancas (paciente_id, valor, status) VALUES (%L, 100, %L)', pac, 'Pago')) = '22023',
    'cobrança nova só como Pendente');

  UPDATE public.cobrancas SET status = 'Pago', data_pagamento = DATE '1999-01-01' WHERE id = cb;
  PERFORM pg_temp.assert_ok((SELECT data_pagamento = (now() AT TIME ZONE 'America/Sao_Paulo')::date FROM public.cobrancas WHERE id = cb),
    'data de pagamento é a do banco, não a enviada');
  UPDATE public.cobrancas SET status = 'Pendente' WHERE id = cb;
  PERFORM pg_temp.assert_ok((SELECT data_pagamento IS NULL FROM public.cobrancas WHERE id = cb), 'desfazer o pagamento apaga a data');
  PERFORM pg_temp.assert_ok((SELECT versao FROM public.cobrancas WHERE id = cb) = 3, 'versão da cobrança sobe a cada alteração');
  UPDATE public.cobrancas SET status = 'Cancelado' WHERE id = cb;
  PERFORM pg_temp.assert_ok(pg_temp.erro(format('UPDATE public.cobrancas SET status = %L WHERE id = %L', 'Pendente', cb)) = '22023',
    'cobrança cancelada é final');

  -- Outro usuário não recupera o paciente criado pela recepção.
  PERFORM pg_temp.assert_ok(public.localizar_paciente_por_operacao(op_pac) IS NULL, 'operação de outra pessoa não é localizada');
END;
$$;
RESET ROLE;
ROLLBACK;
