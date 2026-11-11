-- Somente banco descartável: fixtures e verificações são revertidas no final.
-- Migração 56: convites pendentes, só para Administrador ativo.
BEGIN;
INSERT INTO auth.users (id, email, email_confirmed_at, last_sign_in_at) VALUES
 ('ec000000-0000-4000-8000-000000000001', 'admin-cv@example.invalid', now(), now()),
 ('ec000000-0000-4000-8000-000000000002', 'convidado-cv@example.invalid', NULL, NULL),
 ('ec000000-0000-4000-8000-000000000003', 'ativo-cv@example.invalid', now(), now()),
 ('ec000000-0000-4000-8000-000000000004', 'recepcao-cv@example.invalid', now(), now());
SET LOCAL session_replication_role = replica;
UPDATE public.perfis SET ativo = true, funcao = 'Administrador', nome = 'Admin CV' WHERE id = 'ec000000-0000-4000-8000-000000000001';
UPDATE public.perfis SET ativo = true, funcao = 'Médico', nome = 'Convidado CV' WHERE id = 'ec000000-0000-4000-8000-000000000002';
UPDATE public.perfis SET ativo = true, funcao = 'Recepcionista', nome = 'Recepção CV' WHERE id = 'ec000000-0000-4000-8000-000000000004';
SET LOCAL session_replication_role = origin;

CREATE FUNCTION pg_temp.assert_ok(ok BOOLEAN, mensagem TEXT) RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN IF ok IS DISTINCT FROM true THEN RAISE EXCEPTION 'FALHOU: %', mensagem; END IF; END;
$$;
CREATE FUNCTION pg_temp.como(usuario UUID) RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claim.sub', usuario::TEXT, true);
  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', usuario, 'role', 'authenticated')::TEXT, true);
END;
$$;

SET LOCAL ROLE authenticated;
DO $$
BEGIN
  PERFORM pg_temp.como('ec000000-0000-4000-8000-000000000001');
  PERFORM pg_temp.assert_ok('ec000000-0000-4000-8000-000000000002'::UUID IN (SELECT public.convites_pendentes()), 'Administrador vê o convite pendente');
  PERFORM pg_temp.assert_ok('ec000000-0000-4000-8000-000000000003'::UUID NOT IN (SELECT public.convites_pendentes()), 'quem já entrou não aparece');
  PERFORM pg_temp.como('ec000000-0000-4000-8000-000000000004');
  PERFORM pg_temp.assert_ok(NOT EXISTS (SELECT public.convites_pendentes()), 'Recepção não vê nada');
END;
$$;
RESET ROLE;
DO $$ BEGIN
  PERFORM pg_temp.assert_ok(NOT has_function_privilege('anon', 'public.convites_pendentes()', 'EXECUTE'), 'anon não executa');
END $$;
ROLLBACK;
