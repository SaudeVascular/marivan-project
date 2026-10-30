-- Somente banco descartável: fixtures e verificações são revertidas no final.
-- Migração 40: totais do Financeiro no banco, sob a RLS de cobrancas.
BEGIN;
-- Simula a passagem pelas funções de leitura auditada (migração 48); o
-- bloqueio da leitura direta é testado em leitura_auditada.sql.
SELECT set_config('pep.leitura_clinica', 'sim', true);
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

INSERT INTO auth.users (id, email) VALUES
 ('e9000000-0000-4000-8000-000000000001', 'medico1-resumo@example.invalid'),
 ('e9000000-0000-4000-8000-000000000002', 'medico2-resumo@example.invalid'),
 ('e9000000-0000-4000-8000-000000000003', 'financeiro-resumo@example.invalid'),
 ('e9000000-0000-4000-8000-000000000004', 'recepcao-resumo@example.invalid');
SET LOCAL session_replication_role = replica;
UPDATE public.perfis SET ativo = true, funcao = 'Médico' WHERE id IN ('e9000000-0000-4000-8000-000000000001', 'e9000000-0000-4000-8000-000000000002');
UPDATE public.perfis SET ativo = true, funcao = 'Financeiro' WHERE id = 'e9000000-0000-4000-8000-000000000003';
UPDATE public.perfis SET ativo = true, funcao = 'Recepcionista' WHERE id = 'e9000000-0000-4000-8000-000000000004';
SET LOCAL session_replication_role = origin;
INSERT INTO public.pacientes (id, nome) VALUES ('e9000000-0000-4000-8000-000000000010', 'Paciente resumo');

-- 1500 cobranças de 10,00 (repasse 50%, regra do médico 1 para consulta —
-- migração 50) — mais que o limite de 1000 linhas da API —, 1 cancelada
-- de 999,00 e 1 do médico 2 (sem regra de repasse) de 7,00.
INSERT INTO public.procedimentos (id, nome, tipo) VALUES ('e9000000-0000-4000-8000-000000000020', 'Consulta resumo', 'Consulta');
INSERT INTO public.repasse_profissional (profissional_id, percentual_consulta) VALUES ('e9000000-0000-4000-8000-000000000001', 50);
INSERT INTO public.cobrancas (paciente_id, medico_id, procedimento_id, valor, data_cobranca)
SELECT 'e9000000-0000-4000-8000-000000000010', 'e9000000-0000-4000-8000-000000000001', 'e9000000-0000-4000-8000-000000000020', 10, DATE '2030-01-15'
FROM generate_series(1, 1500);
INSERT INTO public.cobrancas (paciente_id, medico_id, procedimento_id, valor, status, data_cobranca) VALUES
 ('e9000000-0000-4000-8000-000000000010', 'e9000000-0000-4000-8000-000000000001', 'e9000000-0000-4000-8000-000000000020', 999, 'Pendente', DATE '2030-01-16'),
 ('e9000000-0000-4000-8000-000000000010', 'e9000000-0000-4000-8000-000000000002', 'e9000000-0000-4000-8000-000000000020', 7, 'Pendente', DATE '2030-01-17');
-- Nasce Pendente (migração 47) e é cancelada depois.
UPDATE public.cobrancas SET status = 'Cancelado' WHERE valor = 999 AND data_cobranca = DATE '2030-01-16';

SET LOCAL ROLE authenticated;
DO $$
DECLARE r RECORD;
BEGIN
  PERFORM pg_temp.como('e9000000-0000-4000-8000-000000000003');
  SELECT * INTO r FROM public.resumo_cobrancas(DATE '2030-01-01', DATE '2030-01-31');
  PERFORM pg_temp.assert_ok(r.quantidade = 1502 AND r.total = 15007 AND r.total_repasse = 7500,
    format('Financeiro soma tudo, sem canceladas e além de 1000 linhas (%s, %s, %s)', r.quantidade, r.total, r.total_repasse));
  SELECT * INTO r FROM public.resumo_cobrancas(DATE '2030-01-17', DATE '2030-01-31');
  PERFORM pg_temp.assert_ok(r.quantidade = 1 AND r.total = 7, 'respeita o período');

  PERFORM pg_temp.como('e9000000-0000-4000-8000-000000000001');
  SELECT * INTO r FROM public.resumo_cobrancas(DATE '2030-01-01', DATE '2030-01-31');
  PERFORM pg_temp.assert_ok(r.quantidade = 1501 AND r.total = 15000, 'Médico soma só as próprias (RLS), mesmo sem filtrar');
  SELECT * INTO r FROM public.resumo_cobrancas(DATE '2030-01-01', DATE '2030-01-31', 'e9000000-0000-4000-8000-000000000002');
  PERFORM pg_temp.assert_ok(r.quantidade = 0 AND r.total = 0, 'Médico não soma as de outro médico');

  PERFORM pg_temp.como('e9000000-0000-4000-8000-000000000004');
  SELECT * INTO r FROM public.resumo_cobrancas(DATE '2030-01-01', DATE '2030-01-31');
  PERFORM pg_temp.assert_ok(r.quantidade = 0 AND r.total = 0, 'Recepção não vê valores');
END;
$$;
RESET ROLE;
ROLLBACK;
