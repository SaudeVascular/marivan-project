-- Somente banco descartável: fixtures e verificações são revertidas no final.
-- Migração 50: dados da operadora, importação de tabela, repasse por
-- profissional e relatório de produção.
BEGIN;
SELECT set_config('pep.leitura_clinica', 'sim', true);
INSERT INTO auth.users (id, email) VALUES
 ('ef000000-0000-4000-8000-000000000001', 'medica-crp@example.invalid'),
 ('ef000000-0000-4000-8000-000000000002', 'enfermeira-crp@example.invalid'),
 ('ef000000-0000-4000-8000-000000000003', 'financeiro-crp@example.invalid'),
 ('ef000000-0000-4000-8000-000000000004', 'admin-crp@example.invalid'),
 ('ef000000-0000-4000-8000-000000000005', 'recepcao-crp@example.invalid');
SET LOCAL session_replication_role = replica;
UPDATE public.perfis SET ativo = true, funcao = 'Médico', nome = 'Médica CRP' WHERE id = 'ef000000-0000-4000-8000-000000000001';
UPDATE public.perfis SET ativo = true, funcao = 'Enfermeiro(a)', nome = 'Enfermeira CRP' WHERE id = 'ef000000-0000-4000-8000-000000000002';
UPDATE public.perfis SET ativo = true, funcao = 'Financeiro', nome = 'Financeiro CRP' WHERE id = 'ef000000-0000-4000-8000-000000000003';
UPDATE public.perfis SET ativo = true, funcao = 'Administrador', nome = 'Admin CRP' WHERE id = 'ef000000-0000-4000-8000-000000000004';
UPDATE public.perfis SET ativo = true, funcao = 'Recepcionista', nome = 'Recepção CRP' WHERE id = 'ef000000-0000-4000-8000-000000000005';
SET LOCAL session_replication_role = origin;
INSERT INTO public.pacientes (id, nome) VALUES ('ef000000-0000-4000-8000-000000000010', 'Paciente CRP');
INSERT INTO public.convenios (id, nome) VALUES ('ef000000-0000-4000-8000-000000000030', 'Operadora CRP');
INSERT INTO public.procedimentos (id, nome, codigo, tipo, valor_particular)
 VALUES ('ef000000-0000-4000-8000-000000000040', 'Consulta CRP', '1.01.01.01-2', 'Consulta', 300);

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
-- Erro esperado (SQLSTATE) de um comando; os efeitos são desfeitos.
CREATE FUNCTION pg_temp.erro(comando TEXT) RETURNS TEXT LANGUAGE plpgsql AS $$
BEGIN
  EXECUTE comando;
  RETURN 'ok';
EXCEPTION WHEN OTHERS THEN
  RETURN SQLSTATE;
END;
$$;
CREATE FUNCTION pg_temp.proc(p_codigo TEXT) RETURNS public.procedimentos LANGUAGE sql SECURITY DEFINER AS
  $$ SELECT * FROM public.procedimentos WHERE codigo = p_codigo $$;
GRANT EXECUTE ON FUNCTION pg_temp.proc(TEXT) TO authenticated;

-- CNPJ numérico e alfanumérico (exemplo oficial da Receita) -------------
DO $$
BEGIN
  PERFORM pg_temp.assert_ok(public.cnpj_valido('11.222.333/0001-81'), 'CNPJ numérico válido');
  PERFORM pg_temp.assert_ok(public.cnpj_valido('12.ABC.345/01DE-35'), 'CNPJ alfanumérico válido');
  PERFORM pg_temp.assert_ok(NOT public.cnpj_valido('11222333000182'), 'dígito verificador errado');
  PERFORM pg_temp.assert_ok(NOT public.cnpj_valido('00000000000000'), 'repetido');
  PERFORM pg_temp.assert_ok(pg_temp.erro($q$UPDATE public.convenios SET cnpj = '11222333000182' WHERE nome = 'Operadora CRP'$q$) = '23514',
    'convênio recusa CNPJ inválido');
  PERFORM pg_temp.assert_ok((SELECT count(*) FROM public.convenios WHERE particular) = 1, 'um único Particular');
  PERFORM pg_temp.assert_ok((SELECT codigo FROM public.procedimentos WHERE id = 'ef000000-0000-4000-8000-000000000040') = '10101012',
    'código guardado sem pontos nem traço');
END;
$$;

SET LOCAL ROLE authenticated;
DO $$
DECLARE
  conv UUID := 'ef000000-0000-4000-8000-000000000030';
  particular UUID;
  consulta UUID := 'ef000000-0000-4000-8000-000000000040';
  pac UUID := 'ef000000-0000-4000-8000-000000000010';
  medica UUID := 'ef000000-0000-4000-8000-000000000001';
  enfermeira UUID := 'ef000000-0000-4000-8000-000000000002';
  r JSONB; hemo UUID; curativo UUID; c1 UUID; c2 UUID; c3 UUID; c4 UUID; n INTEGER;
BEGIN
  -- Importação ------------------------------------------------------------
  PERFORM pg_temp.como('ef000000-0000-4000-8000-000000000005');
  PERFORM pg_temp.assert_ok(pg_temp.erro(format($q$SELECT public.importar_tabela_convenio(%L, '[{"codigo":"1","valor":"1"}]')$q$, conv)) = '42501',
    'Recepção não importa tabela');

  PERFORM pg_temp.como('ef000000-0000-4000-8000-000000000003');
  SELECT id INTO particular FROM public.convenios WHERE convenios.particular;
  UPDATE public.convenios SET razao_social = 'Operadora CRP S.A.', cnpj = '11222333000181', registro_ans = '123456',
         codigo_prestador = 'PRE-77', prazo_pagamento_dias = 30, tabela_referencia = 'CBHPM 5ª ed.' WHERE id = conv;
  PERFORM pg_temp.assert_ok((SELECT razao_social FROM public.convenios WHERE id = conv) = 'Operadora CRP S.A.', 'Financeiro grava os dados da operadora');

  r := public.importar_tabela_convenio(conv, '[
    {"codigo":"10101012","descricao":"Consulta em consultório","valor":"150"},
    {"codigo":"40304361","descricao":"Hemograma CRP","valor":"12.5"},
    {"descricao":"Curativo CRP","valor":"40"}]');
  PERFORM pg_temp.assert_ok(r = '{"gravados":3,"procedimentos_novos":2,"removidos":0}', 'importa 3 linhas, cria 2 procedimentos: ' || r::TEXT);
  PERFORM pg_temp.assert_ok((SELECT nome FROM public.procedimentos WHERE id = consulta) = 'Consulta CRP', 'casar pelo código não renomeia o procedimento');
  hemo := (pg_temp.proc('40304361')).id;
  SELECT id INTO curativo FROM public.procedimentos WHERE nome = 'Curativo CRP';
  PERFORM pg_temp.assert_ok((pg_temp.proc('40304361')).tipo = 'Exame' AND (pg_temp.proc('40304361')).valor_particular IS NULL,
    'código 40…: exame, sem valor particular inventado');
  PERFORM pg_temp.assert_ok((SELECT tipo FROM public.procedimentos WHERE id = curativo) = 'Procedimento', 'sem código: procedimento');
  PERFORM pg_temp.assert_ok((SELECT valor FROM public.catalogo_procedimentos(conv) WHERE id = hemo) = 12.5, 'valor acordado no catálogo');
  PERFORM pg_temp.assert_ok((SELECT valor FROM public.catalogo_procedimentos(conv) WHERE id = consulta) = 150, 'consulta pelo convênio');
  PERFORM pg_temp.assert_ok((SELECT valor FROM public.catalogo_procedimentos(particular) WHERE id = consulta) = 300, 'Particular usa o valor particular');
  PERFORM pg_temp.assert_ok((SELECT valor FROM public.catalogo_procedimentos(NULL) WHERE id = consulta) = 300, 'sem convênio também');

  -- Linha inválida: nada é gravado.
  PERFORM pg_temp.assert_ok(pg_temp.erro(format($q$SELECT public.importar_tabela_convenio(%L,
    '[{"codigo":"10101012","valor":"999"},{"codigo":"20202020","descricao":"X","valor":"abc"}]')$q$, conv)) = '22023',
    'valor inválido recusa a importação');
  PERFORM pg_temp.assert_ok((SELECT valor FROM public.convenio_valores WHERE convenio_id = conv AND procedimento_id = consulta) = 150,
    'importação recusada não muda nada');

  -- Substituir: o que não veio sai da tabela do convênio.
  r := public.importar_tabela_convenio(conv, '[{"codigo":"40.30.436-1","descricao":"Hemograma","valor":"14"}]', true);
  PERFORM pg_temp.assert_ok(r = '{"gravados":1,"procedimentos_novos":0,"removidos":2}', 'substituir remove 2: ' || r::TEXT);
  PERFORM pg_temp.assert_ok((SELECT valor FROM public.catalogo_procedimentos(conv) WHERE id = consulta) IS NULL, 'fora da tabela: sem valor');

  -- No Particular, a importação grava o valor particular.
  r := public.importar_tabela_convenio(particular, '[{"descricao":"Curativo CRP","valor":"55"}]');
  PERFORM pg_temp.assert_ok((SELECT valor_particular FROM public.procedimentos WHERE id = curativo) = 55, 'Particular: valor particular');

  -- Repasse por profissional ---------------------------------------------
  PERFORM pg_temp.assert_ok(pg_temp.erro(format($q$INSERT INTO public.repasse_profissional (profissional_id, percentual_consulta) VALUES (%L, 50)$q$, medica)) = '42501',
    'Financeiro não define repasse');
  PERFORM pg_temp.como('ef000000-0000-4000-8000-000000000004');
  INSERT INTO public.repasse_profissional (profissional_id, percentual_consulta, percentual_exame, percentual_procedimento)
    VALUES (medica, 60, 10, 30), (enfermeira, 0, 0, 20);
  PERFORM pg_temp.assert_ok(pg_temp.erro(format($q$UPDATE public.repasse_profissional SET percentual_exame = 101 WHERE profissional_id = %L$q$, medica)) = '23514',
    'percentual acima de 100 recusado');

  PERFORM pg_temp.como('ef000000-0000-4000-8000-000000000001');
  PERFORM pg_temp.assert_ok((SELECT count(*) FROM public.repasse_profissional) = 1, 'médica lê só a própria regra');

  -- O percentual da cobrança é do banco.
  PERFORM pg_temp.como('ef000000-0000-4000-8000-000000000003');
  INSERT INTO public.cobrancas (paciente_id, medico_id, procedimento_id, convenio_id, valor, percentual_repasse, data_cobranca)
    VALUES (pac, medica, consulta, NULL, 300, 99, DATE '2031-03-05') RETURNING id INTO c1;
  INSERT INTO public.cobrancas (paciente_id, medico_id, procedimento_id, convenio_id, valor, data_cobranca)
    VALUES (pac, medica, hemo, conv, 14, DATE '2031-03-06') RETURNING id INTO c2;
  INSERT INTO public.cobrancas (paciente_id, medico_id, procedimento_id, valor, data_cobranca)
    VALUES (pac, enfermeira, curativo, 55, DATE '2031-03-06') RETURNING id INTO c3;
  INSERT INTO public.cobrancas (paciente_id, medico_id, procedimento_id, valor, data_cobranca)
    VALUES (pac, medica, consulta, 300, DATE '2031-03-07') RETURNING id INTO c4;
  PERFORM pg_temp.assert_ok((SELECT percentual_repasse FROM public.cobrancas WHERE id = c1) = 60, 'consulta: 60% da médica, não o enviado');
  PERFORM pg_temp.assert_ok((SELECT valor_repasse FROM public.cobrancas WHERE id = c2) = 1.4, 'exame: 10%');
  PERFORM pg_temp.assert_ok((SELECT percentual_repasse FROM public.cobrancas WHERE id = c3) = 20, 'procedimento da enfermeira: 20%');

  UPDATE public.cobrancas SET procedimento_id = curativo WHERE id = c4;
  PERFORM pg_temp.assert_ok((SELECT percentual_repasse FROM public.cobrancas WHERE id = c4) = 30, 'Pendente: trocar o procedimento recalcula');
  UPDATE public.cobrancas SET percentual_repasse = 99 WHERE id = c4;
  PERFORM pg_temp.assert_ok((SELECT percentual_repasse FROM public.cobrancas WHERE id = c4) = 30, 'percentual não é editado à mão');
  UPDATE public.cobrancas SET status = 'Cancelado' WHERE id = c4;

  UPDATE public.cobrancas SET status = 'Pago' WHERE id = c1;
  PERFORM pg_temp.como('ef000000-0000-4000-8000-000000000004');
  UPDATE public.repasse_profissional SET percentual_consulta = 70 WHERE profissional_id = medica;
  PERFORM pg_temp.assert_ok((SELECT percentual_repasse FROM public.cobrancas WHERE id = c1) = 60, 'mudar a regra não reescreve o passado');

  -- Enfermeira (não só Médico) vê as próprias cobranças.
  PERFORM pg_temp.como(enfermeira);
  PERFORM pg_temp.assert_ok((SELECT count(*) FROM public.cobrancas) = 1, 'enfermeira lê só a própria cobrança');

  -- Relatório de produção ------------------------------------------------
  PERFORM pg_temp.assert_ok((SELECT count(*) FROM public.relatorio_producao(DATE '2031-03-01', DATE '2031-03-31')) = 1,
    'profissional: só a própria produção');
  PERFORM pg_temp.assert_ok(pg_temp.erro(format($q$SELECT * FROM public.relatorio_producao('2031-03-01', '2031-03-31', %L)$q$, medica)) = '42501',
    'pedir a produção de outro é recusado');

  PERFORM pg_temp.como(medica);
  SELECT count(*) INTO n FROM public.relatorio_producao(DATE '2031-03-01', DATE '2031-03-31');
  PERFORM pg_temp.assert_ok(n = 2, 'médica: 2 atendimentos, sem o cancelado (' || n || ')');
  PERFORM pg_temp.assert_ok((SELECT codigo = '40304361' AND tipo = 'Exame' AND convenio = 'Operadora CRP' AND valor_clinica = 12.6
                               FROM public.relatorio_producao(DATE '2031-03-01', DATE '2031-03-31') WHERE cobranca_id = c2),
    'linha do exame: código, tipo, convênio e parte da clínica');

  PERFORM pg_temp.como('ef000000-0000-4000-8000-000000000004');
  PERFORM pg_temp.assert_ok((SELECT count(*) FROM public.relatorio_producao(DATE '2031-03-01', DATE '2031-03-31')) = 3, 'Administrador vê todos');
  PERFORM pg_temp.assert_ok((SELECT count(*) FROM public.relatorio_producao(DATE '2031-03-01', DATE '2031-03-31', enfermeira)) = 1, 'filtra por profissional');
  PERFORM pg_temp.assert_ok(pg_temp.erro($q$SELECT * FROM public.relatorio_producao('2031-03-31', '2031-03-01')$q$) = '22023', 'período invertido');

  PERFORM pg_temp.como('ef000000-0000-4000-8000-000000000005');
  PERFORM pg_temp.assert_ok((SELECT count(*) FROM public.relatorio_producao(DATE '2031-03-01', DATE '2031-03-31')) = 0, 'Recepção: nada');
END;
$$;
RESET ROLE;

DO $$
BEGIN
  PERFORM pg_temp.assert_ok((SELECT count(*) FROM public.auditoria WHERE tabela = 'repasse_profissional') >= 3, 'regras de repasse auditadas');
  PERFORM pg_temp.assert_ok(NOT has_function_privilege('anon', 'public.relatorio_producao(date,date,uuid)', 'EXECUTE'), 'anon não executa o relatório');
  PERFORM pg_temp.assert_ok(NOT has_function_privilege('anon', 'public.importar_tabela_convenio(uuid,jsonb,boolean)', 'EXECUTE'), 'anon não importa');
END;
$$;
ROLLBACK;
