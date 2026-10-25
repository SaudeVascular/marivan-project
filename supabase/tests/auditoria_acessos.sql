-- Somente banco descartável: fixtures e verificações são revertidas no final.
-- Migração 38: registro de leitura (abrir prontuário, imprimir documento).
BEGIN;
-- Simula a passagem pelas funções de leitura auditada (migração 48); o
-- bloqueio da leitura direta é testado em leitura_auditada.sql.
SELECT set_config('pep.leitura_clinica', 'sim', true);
CREATE FUNCTION pg_temp.assert_ok(ok BOOLEAN, mensagem TEXT) RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN IF ok IS DISTINCT FROM true THEN RAISE EXCEPTION 'FALHOU: %', mensagem; END IF; END;
$$;
CREATE FUNCTION pg_temp.falha(comando TEXT) RETURNS BOOLEAN LANGUAGE plpgsql AS $$
BEGIN EXECUTE comando; RETURN false;
EXCEPTION WHEN OTHERS THEN RETURN true;
END;
$$;
CREATE FUNCTION pg_temp.como(usuario UUID) RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claim.sub', usuario::TEXT, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', usuario, 'role', 'authenticated')::TEXT, true);
END;
$$;

INSERT INTO auth.users (id, email) VALUES
 ('e8000000-0000-4000-8000-000000000001', 'medico-acesso@example.invalid'),
 ('e8000000-0000-4000-8000-000000000002', 'admin-acesso@example.invalid'),
 ('e8000000-0000-4000-8000-000000000003', 'inativo-acesso@example.invalid');
SET LOCAL session_replication_role = replica;
UPDATE public.perfis SET ativo = true, funcao = 'Médico', nome = 'Médico fictício' WHERE id = 'e8000000-0000-4000-8000-000000000001';
UPDATE public.perfis SET ativo = true, funcao = 'Administrador', nome = 'Admin fictício' WHERE id = 'e8000000-0000-4000-8000-000000000002';
UPDATE public.perfis SET ativo = false, funcao = 'Médico', nome = 'Inativo fictício' WHERE id = 'e8000000-0000-4000-8000-000000000003';
SET LOCAL session_replication_role = origin;
INSERT INTO public.pacientes (id, nome) VALUES ('e8000000-0000-4000-8000-000000000010', 'Paciente acesso'),
 ('e8000000-0000-4000-8000-000000000011', 'Outro paciente');
SET LOCAL session_replication_role = replica;
INSERT INTO public.consultas (id, paciente_id, tipo, titulo, conteudo, status, created_by) VALUES
 ('e8000000-0000-4000-8000-000000000020', 'e8000000-0000-4000-8000-000000000010', 'Atestado', 'Atestado', 'Texto fictício', 'Assinado', 'e8000000-0000-4000-8000-000000000001'),
 ('e8000000-0000-4000-8000-000000000021', 'e8000000-0000-4000-8000-000000000011', 'Atestado', 'Atestado', 'Texto de outro', 'Assinado', 'e8000000-0000-4000-8000-000000000001');
SET LOCAL session_replication_role = origin;

SET LOCAL ROLE authenticated;
DO $$
DECLARE p UUID := 'e8000000-0000-4000-8000-000000000010'; medico UUID := 'e8000000-0000-4000-8000-000000000001';
BEGIN
  PERFORM pg_temp.como(medico);
  PERFORM count(*) FROM public.ler_registros_paciente(p); -- registra abrir_prontuario no banco (migração 48)
  PERFORM pg_temp.assert_ok(pg_temp.falha(format('SELECT public.registrar_acesso(%L, %L)', p, 'abrir_prontuario')),
    'o app não registra abrir_prontuario por conta própria: só a função de leitura');
  PERFORM public.registrar_acesso(p, 'imprimir_documento', 'Receituário');
  PERFORM public.registrar_acesso(p, 'imprimir_documento', 'Reimpressão: Atestado', 'e8000000-0000-4000-8000-000000000020');
  PERFORM pg_temp.assert_ok(pg_temp.falha(format('SELECT public.registrar_acesso(%L, %L, %L, %L)', p, 'imprimir_documento', 'Reimpressão',
    'e8000000-0000-4000-8000-000000000021')), 'registro de OUTRO paciente recusado (migração 43)');
  PERFORM pg_temp.assert_ok(pg_temp.falha(format('SELECT public.registrar_acesso(%L, %L, %L, %L)', p, 'imprimir_documento', 'Reimpressão',
    gen_random_uuid())), 'registro inexistente recusado');

  PERFORM pg_temp.assert_ok(pg_temp.falha(format('SELECT public.registrar_acesso(%L, %L)', p, 'apagar_tudo')), 'ação fora da lista recusada');
  PERFORM pg_temp.assert_ok(pg_temp.falha(format('SELECT public.registrar_acesso(%L, %L)', gen_random_uuid(), 'imprimir_documento')), 'paciente inexistente recusado');
  PERFORM pg_temp.assert_ok(pg_temp.falha('SELECT * FROM public.acessos'), 'tabela base fechada para leitura');
  PERFORM pg_temp.assert_ok(pg_temp.falha(format(
    'INSERT INTO public.acessos (usuario_id, paciente_id, acao) VALUES (%L, %L, %L)', 'e8000000-0000-4000-8000-000000000002', p, 'abrir_prontuario')),
    'ninguém grava direto (nem em nome de outro)');
  PERFORM pg_temp.assert_ok(NOT EXISTS (SELECT 1 FROM public.acessos_view), 'Médico não lê a auditoria de acessos');

  PERFORM pg_temp.como('e8000000-0000-4000-8000-000000000003');
  PERFORM pg_temp.assert_ok(pg_temp.falha(format('SELECT public.registrar_acesso(%L, %L)', p, 'imprimir_documento')), 'conta inativa não registra');

  PERFORM pg_temp.como('e8000000-0000-4000-8000-000000000002');
  PERFORM pg_temp.assert_ok((SELECT count(*) FROM public.acessos_view WHERE paciente_id = p) = 3, 'Administrador lê os três acessos');
  PERFORM pg_temp.assert_ok(EXISTS (SELECT 1 FROM public.acessos_view WHERE paciente_id = p AND usuario_id = medico
    AND usuario_nome = 'Médico fictício' AND paciente_nome = 'Paciente acesso' AND acao = 'imprimir_documento' AND detalhe = 'Receituário'),
    'autor é sempre quem chamou, com nomes legíveis');
  PERFORM pg_temp.assert_ok(pg_temp.falha(format('DELETE FROM public.acessos WHERE paciente_id = %L', p)), 'Administrador não apaga acessos');
END;
$$;
RESET ROLE;
ROLLBACK;
