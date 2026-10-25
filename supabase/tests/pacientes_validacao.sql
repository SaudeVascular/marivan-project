-- Somente banco descartável: fixtures e verificações são revertidas no final.
-- Migração 45: CPF normalizado e único pelos dígitos, CNS, nascimento, tamanhos.
BEGIN;
-- Simula a passagem pelas funções de leitura auditada (migração 48); o
-- bloqueio da leitura direta é testado em leitura_auditada.sql.
SELECT set_config('pep.leitura_clinica', 'sim', true);
CREATE FUNCTION pg_temp.assert_ok(ok BOOLEAN, mensagem TEXT) RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN IF ok IS DISTINCT FROM true THEN RAISE EXCEPTION 'FALHOU: %', mensagem; END IF; END;
$$;
CREATE FUNCTION pg_temp.erro(comando TEXT) RETURNS TEXT LANGUAGE plpgsql AS $$
BEGIN EXECUTE comando; RETURN 'ok';
EXCEPTION WHEN OTHERS THEN RETURN SQLSTATE;
END;
$$;

DO $$
DECLARE id1 UUID; id2 UUID;
BEGIN
  -- Dígitos verificadores
  PERFORM pg_temp.assert_ok(public.cpf_valido('529.982.247-25'), 'CPF válido com máscara');
  PERFORM pg_temp.assert_ok(public.cpf_valido('52998224725'), 'CPF válido só dígitos');
  PERFORM pg_temp.assert_ok(NOT public.cpf_valido('529.982.247-24'), 'dígito verificador errado');
  PERFORM pg_temp.assert_ok(NOT public.cpf_valido('111.111.111-11'), 'todos iguais');
  PERFORM pg_temp.assert_ok(NOT public.cpf_valido('5299822472'), '10 dígitos');
  PERFORM pg_temp.assert_ok(public.cns_valido('898001160660001') AND public.cns_valido('700000000000005'), 'CNS válidos (provisórios)');
  PERFORM pg_temp.assert_ok(public.cns_valido('100000000060018'), 'CNS válido (definitivo)');
  PERFORM pg_temp.assert_ok(NOT public.cns_valido('123456789012345'), 'CNS inválido');

  -- Normalização e unicidade
  INSERT INTO public.pacientes (nome, cpf) VALUES ('Paciente com máscara', '529.982.247-25') RETURNING id INTO id1;
  PERFORM pg_temp.assert_ok((SELECT cpf FROM public.pacientes WHERE id = id1) = '529.982.247-25', 'CPF gravado formatado');
  PERFORM pg_temp.assert_ok(pg_temp.erro($q$INSERT INTO public.pacientes (nome, cpf) VALUES ('Mesmo CPF sem máscara', '52998224725')$q$) = '23505',
    'o mesmo CPF sem pontuação é recusado como duplicado (o caso reproduzido)');
  PERFORM pg_temp.assert_ok(pg_temp.erro($q$INSERT INTO public.pacientes (nome, cpf) VALUES ('CPF inválido', '529.982.247-24')$q$) = '22023',
    'CPF com dígito errado recusado');
  INSERT INTO public.pacientes (nome, cpf) VALUES ('Sem CPF 1', NULL), ('Sem CPF 2', ''), ('Sem CPF 3', '   ');
  PERFORM pg_temp.assert_ok((SELECT count(*) FROM public.pacientes WHERE nome LIKE 'Sem CPF %' AND cpf IS NULL) = 3,
    'CPF continua opcional; em branco vira NULL e não conflita');
  INSERT INTO public.pacientes (nome, cpf) VALUES ('Só dígitos', '39053344705') RETURNING id INTO id2;
  PERFORM pg_temp.assert_ok((SELECT cpf FROM public.pacientes WHERE id = id2) = '390.533.447-05', 'CPF digitado sem máscara é formatado');

  -- CNS, nascimento, tamanhos
  PERFORM pg_temp.assert_ok(pg_temp.erro($q$INSERT INTO public.pacientes (nome, cns) VALUES ('CNS ruim', '123456789012345')$q$) = '22023', 'CNS inválido recusado');
  INSERT INTO public.pacientes (nome, cns) VALUES ('CNS bom', '898 0011 6066 0001');
  PERFORM pg_temp.assert_ok((SELECT cns FROM public.pacientes WHERE nome = 'CNS bom') = '898001160660001', 'CNS gravado só com dígitos');
  PERFORM pg_temp.assert_ok(pg_temp.erro(format('INSERT INTO public.pacientes (nome, nascimento) VALUES (%L, %L)', 'Futuro', CURRENT_DATE + 1)) = '22023', 'nascimento no futuro recusado');
  PERFORM pg_temp.assert_ok(pg_temp.erro($q$INSERT INTO public.pacientes (nome, nascimento) VALUES ('Antigo', '1899-12-31')$q$) = '22023', 'nascimento antes de 1900 recusado');
  PERFORM pg_temp.assert_ok(pg_temp.erro(format('INSERT INTO public.pacientes (nome) VALUES (%L)', repeat('a', 201))) = '22023', 'nome longo demais');
  PERFORM pg_temp.assert_ok(pg_temp.erro(format('INSERT INTO public.pacientes (nome, alergias) VALUES (%L, %L)', 'Alergias', repeat('a', 5001))) = '22023', 'antecedente longo demais');

  -- Legado: CPF antigo inválido não trava a edição dos outros campos.
  SET LOCAL session_replication_role = replica;
  INSERT INTO public.pacientes (id, nome, cpf) VALUES ('ea000000-0000-4000-8000-000000000001', 'Legado', '123.456.789-00');
  SET LOCAL session_replication_role = origin;
  UPDATE public.pacientes SET telefone = '(71) 90000-0000' WHERE id = 'ea000000-0000-4000-8000-000000000001';
  PERFORM pg_temp.assert_ok((SELECT telefone FROM public.pacientes WHERE id = 'ea000000-0000-4000-8000-000000000001') = '(71) 90000-0000',
    'paciente antigo com CPF inválido continua editável nos outros campos');
  PERFORM pg_temp.assert_ok(pg_temp.erro($q$UPDATE public.pacientes SET cpf = '000.000.000-01' WHERE id = 'ea000000-0000-4000-8000-000000000001'$q$) = '22023',
    'mas o CPF, se alterado, precisa ser válido');
END;
$$;
ROLLBACK;
