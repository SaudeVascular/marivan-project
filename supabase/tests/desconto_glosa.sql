-- Somente banco descartável: fixtures e verificações são revertidas no final.
-- Migração 54: desconto no particular (Recepção), glosa no convênio,
-- repasse sobre o que de fato entrou, totais e relatório.
BEGIN;
SELECT set_config('pep.leitura_clinica', 'sim', true);
INSERT INTO auth.users (id, email) VALUES
 ('ed000000-0000-4000-8000-000000000001', 'medica-dg@example.invalid'),
 ('ed000000-0000-4000-8000-000000000002', 'recepcao-dg@example.invalid'),
 ('ed000000-0000-4000-8000-000000000003', 'financeiro-dg@example.invalid'),
 ('ed000000-0000-4000-8000-000000000004', 'enfermeira-dg@example.invalid');
SET LOCAL session_replication_role = replica;
UPDATE public.perfis SET ativo = true, funcao = 'Médico', nome = 'Médica DG', especialidade = 'Cardiologia' WHERE id = 'ed000000-0000-4000-8000-000000000001';
UPDATE public.perfis SET ativo = true, funcao = 'Recepcionista', nome = 'Recepção DG' WHERE id = 'ed000000-0000-4000-8000-000000000002';
UPDATE public.perfis SET ativo = true, funcao = 'Financeiro', nome = 'Financeiro DG' WHERE id = 'ed000000-0000-4000-8000-000000000003';
UPDATE public.perfis SET ativo = true, funcao = 'Enfermeiro(a)', nome = 'Enfermeira DG' WHERE id = 'ed000000-0000-4000-8000-000000000004';
SET LOCAL session_replication_role = origin;
INSERT INTO public.convenios (id, nome) VALUES ('ed000000-0000-4000-8000-000000000030', 'Convênio DG');
INSERT INTO public.procedimentos (id, nome, tipo, valor_particular) VALUES
 ('ed000000-0000-4000-8000-000000000040', 'Consulta DG', 'Consulta', 300),
 ('ed000000-0000-4000-8000-000000000041', 'Sem preço DG', 'Procedimento', NULL);
INSERT INTO public.convenio_valores (convenio_id, procedimento_id, valor)
 VALUES ('ed000000-0000-4000-8000-000000000030', 'ed000000-0000-4000-8000-000000000040', 180);
INSERT INTO public.repasse_profissional (profissional_id, percentual_consulta) VALUES ('ed000000-0000-4000-8000-000000000001', 60);
INSERT INTO public.pacientes (id, nome) VALUES ('ed000000-0000-4000-8000-000000000010', 'Paciente DG');

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
CREATE FUNCTION pg_temp.erro(comando TEXT) RETURNS TEXT LANGUAGE plpgsql AS $$
BEGIN
  EXECUTE comando;
  RETURN 'ok';
EXCEPTION WHEN OTHERS THEN
  RETURN SQLSTATE;
END;
$$;
CREATE FUNCTION pg_temp.cob(ag UUID) RETURNS public.cobrancas LANGUAGE sql SECURITY DEFINER AS
  $$ SELECT * FROM public.cobrancas WHERE agendamento_id = ag $$;
GRANT EXECUTE ON FUNCTION pg_temp.cob(UUID) TO authenticated;

SET LOCAL ROLE authenticated;
DO $$
DECLARE
  pac UUID := 'ed000000-0000-4000-8000-000000000010';
  medica UUID := 'ed000000-0000-4000-8000-000000000001';
  recepcao UUID := 'ed000000-0000-4000-8000-000000000002';
  conv UUID := 'ed000000-0000-4000-8000-000000000030';
  consulta UUID := 'ed000000-0000-4000-8000-000000000040';
  hoje DATE := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
  ag_part UUID; ag_conv UUID; ag_sem UUID; r JSONB; c public.cobrancas; t RECORD;
BEGIN
  PERFORM pg_temp.como(recepcao);
  INSERT INTO public.agendamentos (paciente_id, medico_id, data, hora, procedimento_id, convenio_id, created_by)
    VALUES (pac, medica, hoje, '08:00', consulta, NULL, recepcao) RETURNING id INTO ag_part;
  INSERT INTO public.agendamentos (paciente_id, medico_id, data, hora, procedimento_id, convenio_id, created_by)
    VALUES (pac, medica, hoje, '09:00', consulta, conv, recepcao) RETURNING id INTO ag_conv;
  INSERT INTO public.agendamentos (paciente_id, medico_id, data, hora, procedimento_id, convenio_id, created_by)
    VALUES (pac, medica, hoje, '10:00', 'ed000000-0000-4000-8000-000000000041', NULL, recepcao) RETURNING id INTO ag_sem;

  -- Recepção recebe o particular na chegada, com 10% de desconto.
  PERFORM pg_temp.assert_ok(pg_temp.erro(format($q$SELECT public.receber_atendimento(%L, 30, NULL)$q$, ag_part)) = '22023', 'forma de pagamento obrigatória');
  PERFORM pg_temp.assert_ok(pg_temp.erro(format($q$SELECT public.receber_atendimento(%L, 301, 'PIX')$q$, ag_part)) = '22023', 'desconto maior que o valor');
  r := public.receber_atendimento(ag_part, 30, 'PIX');
  PERFORM pg_temp.assert_ok((r->>'valor_pago')::NUMERIC = 270, 'valor pago = 300 − 30: ' || r::TEXT);
  c := pg_temp.cob(ag_part);
  PERFORM pg_temp.assert_ok(c.status = 'Pago' AND c.desconto = 30 AND c.forma_pagamento = 'PIX' AND c.data_pagamento IS NOT NULL
    AND c.percentual_repasse = 60 AND c.valor_repasse = 162, 'pago, com desconto, e repasse sobre o que entrou (60% de 270)');
  PERFORM pg_temp.assert_ok(pg_temp.erro(format($q$SELECT public.receber_atendimento(%L, 0, 'PIX')$q$, ag_part)) = '22023', 'não recebe duas vezes');
  PERFORM pg_temp.assert_ok(pg_temp.erro(format($q$SELECT public.receber_atendimento(%L, 0, 'PIX')$q$, ag_conv)) = '22023', 'convênio não é recebido pela Recepção');
  PERFORM pg_temp.assert_ok(pg_temp.erro(format($q$SELECT public.receber_atendimento(%L, 0, 'PIX')$q$, ag_sem)) = '22023', 'sem valor particular não recebe');
  PERFORM pg_temp.assert_ok((SELECT count(*) FROM public.pagamentos_do_dia(hoje) WHERE agendamento_id = ag_part AND status = 'Pago') = 1,
    'Recepção vê o que já recebeu no dia');
  PERFORM pg_temp.assert_ok(NOT EXISTS (SELECT 1 FROM public.cobrancas), 'mas continua sem ler a tabela de cobranças');

  -- Concluir o atendimento não cria outra cobrança.
  UPDATE public.agendamentos SET status = 'Aguardando' WHERE id IN (ag_part, ag_conv);
  UPDATE public.agendamentos SET status = 'Em atendimento' WHERE id IN (ag_part, ag_conv);
  UPDATE public.agendamentos SET status = 'Realizado' WHERE id IN (ag_part, ag_conv);
  PERFORM pg_temp.assert_ok((pg_temp.cob(ag_part)).status = 'Pago' AND (pg_temp.cob(ag_part)).desconto = 30, 'a cobrança recebida continua a mesma');

  -- Enfermeira não recebe.
  PERFORM pg_temp.como('ed000000-0000-4000-8000-000000000004');
  PERFORM pg_temp.assert_ok(pg_temp.erro(format($q$SELECT public.receber_atendimento(%L, 0, 'PIX')$q$, ag_sem)) = '42501', 'só Recepção/Financeiro/Administrador recebe');
  PERFORM pg_temp.assert_ok((SELECT count(*) FROM public.pagamentos_do_dia(hoje)) = 0, 'pagamentos do dia fechados para os demais');

  -- Financeiro: convênio paga com glosa parcial; desconto em convênio é recusado.
  PERFORM pg_temp.como('ed000000-0000-4000-8000-000000000003');
  c := pg_temp.cob(ag_conv);
  PERFORM pg_temp.assert_ok(pg_temp.erro(format($q$UPDATE public.cobrancas SET desconto = 10 WHERE id = %L$q$, c.id)) = '22023', 'desconto só no particular');
  UPDATE public.cobrancas SET status = 'Pago', valor_glosa = 50 WHERE id = c.id;
  c := pg_temp.cob(ag_conv);
  PERFORM pg_temp.assert_ok(c.valor = 180 AND c.valor_glosa = 50 AND c.valor_repasse = 78, 'glosa parcial: repasse 60% de 130');
  PERFORM pg_temp.assert_ok(pg_temp.erro(format($q$UPDATE public.cobrancas SET valor_glosa = 181 WHERE id = %L$q$, c.id)) IN ('22023', '23514'), 'glosa maior que o valor');

  SELECT * INTO t FROM public.resumo_financeiro(hoje, hoje, medica);
  PERFORM pg_temp.assert_ok(t.quantidade = 2 AND t.valor = 480 AND t.desconto = 30 AND t.valor_pago = 450 AND t.glosa = 50
    AND t.recebido = 400 AND t.recebido_profissional = 240 AND t.recebido_clinica = 160,
    format('totais: %s', to_jsonb(t)));

  SELECT * INTO t FROM public.relatorio_producao(hoje, hoje, medica) WHERE cobranca_id = c.id;
  PERFORM pg_temp.assert_ok(t.valor_pago = 180 AND t.glosa = 50 AND t.recebido = 130 AND t.recebido_clinica = 52 AND t.recebido_profissional = 78
    AND t.especialidade = 'Cardiologia' AND NOT t.particular, 'relatório: colunas novas e especialidade');

  -- Migração 55: pendente acompanha a regra atual; paga fica com a da época.
  PERFORM pg_temp.como('ed000000-0000-4000-8000-000000000003');
  SELECT * INTO t FROM public.resumo_financeiro(hoje, hoje, medica);
  PERFORM pg_temp.assert_ok(t.previsto_clinica = 0 AND t.previsto_profissional = 0, 'nenhuma pendente ainda');
  UPDATE public.cobrancas SET status = 'Pendente' WHERE id = c.id;  -- convênio volta a pendente (180, 60%)
  SELECT * INTO t FROM public.resumo_financeiro(hoje, hoje, medica);
  PERFORM pg_temp.assert_ok(t.previsto_profissional = 108 AND t.previsto_clinica = 72, format('previsto da pendente: %s', to_jsonb(t)));
  RESET ROLE;
  UPDATE public.repasse_profissional SET percentual_consulta = 50 WHERE profissional_id = medica;
  SET LOCAL ROLE authenticated;
  PERFORM pg_temp.como('ed000000-0000-4000-8000-000000000003');
  PERFORM pg_temp.assert_ok((pg_temp.cob(ag_conv)).percentual_repasse = 50 AND (pg_temp.cob(ag_conv)).valor_repasse = 90,
    'mudar a regra recalcula a pendente');
  PERFORM pg_temp.assert_ok((pg_temp.cob(ag_part)).percentual_repasse = 60 AND (pg_temp.cob(ag_part)).valor_repasse = 162,
    'a já paga fica com o percentual da época');
  RESET ROLE;
  UPDATE public.procedimentos SET tipo = 'Procedimento' WHERE id = consulta;
  SET LOCAL ROLE authenticated;
  PERFORM pg_temp.como('ed000000-0000-4000-8000-000000000003');
  PERFORM pg_temp.assert_ok((pg_temp.cob(ag_conv)).percentual_repasse = 0, 'mudar o tipo do procedimento recalcula a pendente (sem regra de procedimento: 0%)');
  RESET ROLE;
  UPDATE public.procedimentos SET tipo = 'Consulta' WHERE id = consulta;
  SET LOCAL ROLE authenticated;
  PERFORM pg_temp.como('ed000000-0000-4000-8000-000000000003');

  -- Glosa total: Glosado zera o recebido; voltar a Pendente (recurso) zera a glosa.
  UPDATE public.cobrancas SET status = 'Pendente' WHERE id = c.id;
  PERFORM pg_temp.assert_ok((pg_temp.cob(ag_conv)).valor_glosa = 0, 'desfazer o pagamento zera a glosa');
  UPDATE public.cobrancas SET status = 'Glosado' WHERE id = c.id;
  PERFORM pg_temp.assert_ok((pg_temp.cob(ag_conv)).valor_glosa = 180 AND (pg_temp.cob(ag_conv)).valor_repasse = 0, 'Glosado: glosa total, sem repasse');
END;
$$;
RESET ROLE;

DO $$
BEGIN
  PERFORM pg_temp.assert_ok(NOT has_function_privilege('anon', 'public.receber_atendimento(uuid,numeric,text)', 'EXECUTE'), 'anon não recebe');
  PERFORM pg_temp.assert_ok(NOT has_function_privilege('anon', 'public.pagamentos_do_dia(date)', 'EXECUTE'), 'anon não lê pagamentos');
  PERFORM pg_temp.assert_ok(NOT has_function_privilege('anon', 'public.resumo_financeiro(date,date,uuid)', 'EXECUTE'), 'anon não lê totais');
END;
$$;
ROLLBACK;
