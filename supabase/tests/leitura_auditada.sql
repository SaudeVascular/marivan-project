-- Somente banco descartável: fixtures e verificações são revertidas no final.
-- Migração 48: leitura clínica só com registro de acesso no banco; exportação.
BEGIN;
INSERT INTO auth.users (id, email) VALUES
 ('ed000000-0000-4000-8000-000000000001', 'medico-leitura@example.invalid'),
 ('ed000000-0000-4000-8000-000000000002', 'recepcao-leitura@example.invalid'),
 ('ed000000-0000-4000-8000-000000000003', 'admin-tecnico@example.invalid'),
 ('ed000000-0000-4000-8000-000000000004', 'admin-clinico@example.invalid');
SET LOCAL session_replication_role = replica;
UPDATE public.perfis SET ativo = true, funcao = 'Médico', nome = 'Médica leitura', crm = '1', uf = 'BA' WHERE id = 'ed000000-0000-4000-8000-000000000001';
UPDATE public.perfis SET ativo = true, funcao = 'Recepcionista', nome = 'Recepção leitura' WHERE id = 'ed000000-0000-4000-8000-000000000002';
UPDATE public.perfis SET ativo = true, funcao = 'Administrador', nome = 'Admin técnico' WHERE id = 'ed000000-0000-4000-8000-000000000003';
UPDATE public.perfis SET ativo = true, funcao = 'Administrador', nome = 'Admin clínico', papel_clinico_administrador = 'Médico'
 WHERE id = 'ed000000-0000-4000-8000-000000000004';
INSERT INTO public.pacientes (id, nome) VALUES ('ed000000-0000-4000-8000-000000000010', 'Paciente A'), ('ed000000-0000-4000-8000-000000000011', 'Paciente B');
INSERT INTO public.consultas (id, paciente_id, tipo, titulo, conteudo, status, created_by) VALUES
 ('ed000000-0000-4000-8000-000000000020', 'ed000000-0000-4000-8000-000000000010', 'Consulta', 'Consulta', 'Conteúdo de A', 'Assinado', 'ed000000-0000-4000-8000-000000000001'),
 ('ed000000-0000-4000-8000-000000000021', 'ed000000-0000-4000-8000-000000000011', 'Consulta', 'Consulta', 'Conteúdo de B', 'Assinado', 'ed000000-0000-4000-8000-000000000001');
SET LOCAL session_replication_role = origin;

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
-- Contagem de acessos sem depender da policy (dono do banco).
CREATE FUNCTION pg_temp.acessos(p_acao TEXT) RETURNS BIGINT LANGUAGE sql SECURITY DEFINER AS
  $$ SELECT count(*) FROM public.acessos WHERE acao = p_acao AND usuario_id::text LIKE 'ed000000-%' $$;
GRANT EXECUTE ON FUNCTION pg_temp.acessos(TEXT) TO authenticated;

SET LOCAL ROLE authenticated;
DO $$
DECLARE
  a UUID := 'ed000000-0000-4000-8000-000000000010';
  b UUID := 'ed000000-0000-4000-8000-000000000011';
  reg_a UUID := 'ed000000-0000-4000-8000-000000000020';
  ex JSONB;
BEGIN
  PERFORM pg_temp.como('ed000000-0000-4000-8000-000000000001');
  PERFORM pg_temp.assert_ok((SELECT count(*) FROM public.consultas) = 0,
    'leitura direta da tabela (como pela API) não devolve nada: precisa passar pela função que registra');
  PERFORM pg_temp.assert_ok(pg_temp.erro($q$SELECT set_config('pep.leitura_clinica', 'sim', true)$q$) = 'ok', 'sanidade: set_config em SQL puro');
  PERFORM set_config('pep.leitura_clinica', '', true);

  PERFORM pg_temp.assert_ok((SELECT count(*) FROM public.ler_registros_paciente(a)) = 1, 'histórico de A pela função');
  PERFORM pg_temp.assert_ok(pg_temp.acessos('abrir_prontuario') = 1, 'abrir o prontuário ficou registrado no banco');
  PERFORM pg_temp.assert_ok((SELECT count(*) FROM public.consultas) = 0, 'depois da função, a leitura direta volta a ser bloqueada');
  PERFORM pg_temp.assert_ok((SELECT count(*) FROM public.ler_registros_paciente(a, 1000, 1000)) = 0
    AND pg_temp.acessos('abrir_prontuario') = 1, 'páginas seguintes não repetem o registro');

  PERFORM pg_temp.assert_ok((SELECT conteudo FROM public.ler_registro(reg_a, a)) = 'Conteúdo de A', 'um registro pela função');
  PERFORM pg_temp.assert_ok(pg_temp.acessos('abrir_registro') = 1, 'abrir um registro ficou registrado');
  PERFORM pg_temp.assert_ok(pg_temp.erro(format('SELECT * FROM public.ler_registro(%L, %L)', reg_a, b)) = '22023',
    'registro de A pedido com o paciente B é recusado');

  ex := public.exportar_prontuario(a);
  PERFORM pg_temp.assert_ok(ex->>'formato' = 'pep-prontuario' AND ex->'paciente'->>'nome' = 'Paciente A'
    AND jsonb_array_length(ex->'registros') = 1 AND ex->'registros'->0->>'conteudo' = 'Conteúdo de A'
    AND ex->'registros'->0->>'autor_nome' = 'Médica leitura', 'exportação do prontuário com registros e autoria');
  PERFORM pg_temp.assert_ok(position('Conteúdo de B' IN ex::text) = 0, 'exportação de A não leva nada de B');
  PERFORM pg_temp.assert_ok(pg_temp.acessos('exportar_prontuario') = 1, 'exportação registrada');
  PERFORM pg_temp.assert_ok(pg_temp.erro('SELECT public.exportar_clinica()') = '42501', 'Médico não exporta a clínica');
  PERFORM pg_temp.assert_ok(pg_temp.erro($q$SELECT public.registrar_acesso('ed000000-0000-4000-8000-000000000010', 'exportar_prontuario')$q$) = '22023',
    'o app não registra exportação falsa');

  PERFORM pg_temp.como('ed000000-0000-4000-8000-000000000002');
  PERFORM pg_temp.assert_ok(pg_temp.erro(format('SELECT count(*) FROM public.ler_registros_paciente(%L)', a)) = '42501', 'Recepção não lê o histórico');
  PERFORM pg_temp.assert_ok(pg_temp.erro(format('SELECT public.exportar_prontuario(%L)', a)) = '42501', 'Recepção não exporta');

  PERFORM pg_temp.como('ed000000-0000-4000-8000-000000000003');
  PERFORM pg_temp.assert_ok(pg_temp.erro('SELECT public.exportar_clinica()') = '42501', 'Administrador sem papel clínico não exporta a clínica');

  PERFORM pg_temp.como('ed000000-0000-4000-8000-000000000004');
  ex := public.exportar_clinica(1, 0);
  PERFORM pg_temp.assert_ok(ex->>'formato' = 'pep-clinica' AND (ex->>'total_pacientes')::INT >= 2
    AND jsonb_array_length(ex->'pacientes') = 1 AND ex ? 'agendamentos' AND ex ? 'profissionais', '1ª página da exportação da clínica');
  PERFORM pg_temp.assert_ok(position('assinatura_imagem' IN ex::text) = 0 AND position('@example.invalid' IN ex::text) = 0,
    'exportação da clínica sem imagem de assinatura nem e-mails');
  ex := public.exportar_clinica(1, 1);
  PERFORM pg_temp.assert_ok(NOT ex ? 'agendamentos' AND jsonb_array_length(ex->'pacientes') = 1, 'páginas seguintes só com pacientes');
  PERFORM pg_temp.assert_ok(pg_temp.acessos('exportar_clinica') = 1, 'exportação da clínica registrada uma vez');
END;
$$;
RESET ROLE;
ROLLBACK;
