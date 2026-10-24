-- Somente banco descartável: fixtures e verificações são revertidas no final.
-- Migrações 37, 41 e 42: edição concorrente de cadastro/antecedentes não
-- sobrescreve em silêncio; a versão é obrigatória (só pela função
-- atualizar_paciente); grupos de campos independentes não geram falso conflito.
BEGIN;
CREATE FUNCTION pg_temp.assert_ok(ok BOOLEAN, mensagem TEXT) RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN IF ok IS DISTINCT FROM true THEN RAISE EXCEPTION 'FALHOU: %', mensagem; END IF; END;
$$;
-- Código do erro do comando ('' se passou).
CREATE FUNCTION pg_temp.erro(comando TEXT) RETURNS TEXT LANGUAGE plpgsql AS $$
BEGIN
  EXECUTE comando;
  RETURN '';
EXCEPTION WHEN OTHERS THEN RETURN SQLSTATE;
END;
$$;
CREATE FUNCTION pg_temp.cadastro(telefone TEXT) RETURNS JSONB LANGUAGE sql AS $$
  SELECT jsonb_build_object('nome', 'Paciente versão', 'cpf', NULL, 'nascimento', '1980-02-01', 'nome_mae', NULL,
    'telefone', telefone, 'convenio_id', NULL, 'cep', NULL, 'endereco', NULL, 'numero', NULL, 'complemento', NULL, 'cns', NULL);
$$;
CREATE FUNCTION pg_temp.clinicos(alergias TEXT) RETURNS JSONB LANGUAGE sql AS $$
  SELECT jsonb_build_object('alergias', alergias, 'has', 'Sim', 'dm', '', 'dac', '', 'dislipidemia', '',
    'tabagismo', '', 'etilismo', '', 'cirurgias', '', 'medicamentos_uso', '', 'outras_comorbidades', '');
$$;
CREATE FUNCTION pg_temp.chamar(p UUID, grupo TEXT, versao INTEGER, dados JSONB) RETURNS TEXT LANGUAGE sql AS $$
  SELECT pg_temp.erro(format('SELECT public.atualizar_paciente(%L, %L, %s, %L)', p, grupo, COALESCE(versao::TEXT, 'NULL'), dados));
$$;

INSERT INTO auth.users (id, email) VALUES
 ('e7000000-0000-4000-8000-000000000001', 'medico-versao@example.invalid'),
 ('e7000000-0000-4000-8000-000000000002', 'recepcao-versao@example.invalid'),
 ('e7000000-0000-4000-8000-000000000003', 'financeiro-versao@example.invalid');
SET LOCAL session_replication_role = replica;
UPDATE public.perfis SET ativo = true, funcao = 'Médico', nome = 'Médico fictício' WHERE id = 'e7000000-0000-4000-8000-000000000001';
UPDATE public.perfis SET ativo = true, funcao = 'Recepcionista', nome = 'Recepção fictícia' WHERE id = 'e7000000-0000-4000-8000-000000000002';
UPDATE public.perfis SET ativo = true, funcao = 'Financeiro', nome = 'Financeiro fictício' WHERE id = 'e7000000-0000-4000-8000-000000000003';
SET LOCAL session_replication_role = origin;
INSERT INTO public.pacientes (id, nome, telefone, alergias, versao_cadastro, versao_clinica)
  VALUES ('e7000000-0000-4000-8000-000000000010', 'Paciente versão', '1', 'Nenhuma', 50, 50);

SELECT pg_temp.assert_ok((SELECT versao_cadastro = 1 AND versao_clinica = 1 FROM public.pacientes
  WHERE id = 'e7000000-0000-4000-8000-000000000010'), 'INSERT sempre começa na versão 1');

SET LOCAL ROLE authenticated;
DO $$
DECLARE p UUID := 'e7000000-0000-4000-8000-000000000010';
BEGIN
  PERFORM set_config('request.jwt.claim.sub', 'e7000000-0000-4000-8000-000000000002', true);

  -- Gravação direta (sem passar pela função) é recusada, com ou sem versão.
  PERFORM pg_temp.assert_ok(pg_temp.erro(format('UPDATE public.pacientes SET telefone = %L WHERE id = %L', '9', p)) = '42501',
    'UPDATE direto sem versão é recusado');
  PERFORM pg_temp.assert_ok(pg_temp.erro(format('UPDATE public.pacientes SET telefone = %L, versao_cadastro = 1 WHERE id = %L', '9', p)) = '42501',
    'UPDATE direto mesmo com versão é recusado');
  PERFORM pg_temp.assert_ok(pg_temp.erro(format('UPDATE public.pacientes SET ativo = false WHERE id = %L', p)) = '42501',
    'desativar direto é recusado');
  -- (Numa sessão SQL própria daria para ligar pep.atualizar_paciente à mão;
  -- pela API não: cada requisição é uma transação e set_config não é RPC.)

  -- Versão obrigatória e grupo fechado.
  PERFORM pg_temp.assert_ok(pg_temp.chamar(p, 'cadastro', NULL, pg_temp.cadastro('2')) = '22023', 'sem versão é recusado');
  PERFORM pg_temp.assert_ok(pg_temp.chamar(p, 'cadastro', 1, pg_temp.cadastro('2') - 'telefone') = '22023', 'campo faltando é recusado');
  PERFORM pg_temp.assert_ok(pg_temp.chamar(p, 'cadastro', 1, pg_temp.cadastro('2') || '{"alergias": "x"}') = '22023', 'campo de outro grupo é recusado');
  PERFORM pg_temp.assert_ok(pg_temp.chamar(p, 'tudo', 1, '{}') = '22023', 'grupo desconhecido é recusado');

  -- Recepção edita o cadastro com a versão que tinha (1): passa e sobe para 2.
  PERFORM pg_temp.assert_ok(pg_temp.chamar(p, 'cadastro', 1, pg_temp.cadastro('2')) = '', 'edição com versão atual passa');
  PERFORM pg_temp.assert_ok((SELECT versao_cadastro = 2 AND telefone = '2' AND nascimento = DATE '1980-02-01'
    FROM public.pacientes_view WHERE id = p), 'versão do cadastro sobe e os tipos são convertidos');
  PERFORM pg_temp.assert_ok(current_setting('pep.atualizar_paciente', true) = '', 'liberação desligada ao sair da função');
  PERFORM pg_temp.assert_ok(pg_temp.erro(format('UPDATE public.pacientes SET telefone = %L WHERE id = %L', '9', p)) = '42501',
    'depois da função, UPDATE direto continua recusado na mesma transação');

  -- Outra pessoa, ainda com a versão 1 na tela: recusada, telefone preservado.
  PERFORM pg_temp.assert_ok(pg_temp.chamar(p, 'cadastro', 1, pg_temp.cadastro('3')) = 'P4090', 'edição obsoleta do cadastro é recusada');
  PERFORM pg_temp.assert_ok((SELECT telefone FROM public.pacientes_view WHERE id = p) = '2', 'gravação anterior preservada');

  -- Recepção não altera antecedentes: erro explícito, não sucesso vazio.
  PERFORM pg_temp.assert_ok(pg_temp.chamar(p, 'clinico', 1, pg_temp.clinicos('Tentativa')) = '42501', 'Recepção não grava antecedentes');

  -- Médico edita antecedentes com versao_clinica 1: o cadastro ter mudado não conflita.
  PERFORM set_config('request.jwt.claim.sub', 'e7000000-0000-4000-8000-000000000001', true);
  PERFORM pg_temp.assert_ok(pg_temp.chamar(p, 'clinico', 1, pg_temp.clinicos('Dipirona')) = '', 'grupos independentes não conflitam');
  PERFORM pg_temp.assert_ok((SELECT versao_clinica = 2 AND versao_cadastro = 2 AND alergias = 'Dipirona' FROM public.pacientes_view WHERE id = p),
    'só a versão clínica sobe ao editar antecedentes');
  PERFORM pg_temp.assert_ok(pg_temp.chamar(p, 'clinico', 1, pg_temp.clinicos('Outra')) = 'P4090', 'edição obsoleta dos antecedentes é recusada');
  PERFORM pg_temp.assert_ok((SELECT alergias FROM public.pacientes_view WHERE id = p) = 'Dipirona', 'antecedentes preservados');

  -- Desativar também exige a versão do cadastro.
  PERFORM pg_temp.assert_ok(pg_temp.chamar(p, 'ativo', 1, '{"ativo": false}') = 'P4090', 'desativar com versão obsoleta é recusado');
  PERFORM pg_temp.assert_ok(pg_temp.chamar(p, 'ativo', 2, '{"ativo": false}') = '', 'desativar com a versão atual passa');
  PERFORM pg_temp.assert_ok((SELECT NOT ativo AND versao_cadastro = 3 FROM public.pacientes_view WHERE id = p), 'desativar sobe a versão do cadastro');

  -- Sem permissão de edição (Financeiro) ou paciente inexistente: erro, não sucesso vazio.
  PERFORM pg_temp.assert_ok(pg_temp.chamar(gen_random_uuid(), 'ativo', 1, '{"ativo": true}') = '42501', 'paciente inexistente dá erro');
  PERFORM set_config('request.jwt.claim.sub', 'e7000000-0000-4000-8000-000000000003', true);
  PERFORM pg_temp.assert_ok(pg_temp.chamar(p, 'ativo', 3, '{"ativo": true}') = '42501', 'perfil sem permissão de edição dá erro');
END;
$$;
RESET ROLE;

-- Manutenção pelo SQL Editor (postgres) continua possível.
UPDATE public.pacientes SET ativo = true WHERE id = 'e7000000-0000-4000-8000-000000000010';
SELECT pg_temp.assert_ok((SELECT ativo AND versao_cadastro = 4 FROM public.pacientes WHERE id = 'e7000000-0000-4000-8000-000000000010'),
  'manutenção direta passa e versiona');
ROLLBACK;
