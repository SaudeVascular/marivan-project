-- Apaga TODOS os pacientes e o que depende deles: atendimentos e
-- documentos (consultas, medicamentos_receita), agenda, cobranças,
-- registros de acesso, recibos de gravação e as linhas de auditoria
-- dessas tabelas. Usuários, clínica, filiais, convênios e catálogos ficam.
--
-- Só para a fase de testes com pacientes fictícios (decisão do
-- responsável clínico, 24/10/2026). Nunca rodar com pacientes reais:
-- prontuário tem prazo legal de guarda.
--
-- Uso: scripts/supabase-limpar-pacientes-producao.sh (produção) ou
--   psql ... -v executar=on -f scripts/limpar-pacientes.sql (local).
-- Sem -v executar=on, só mostra as contagens e desfaz.
\set ON_ERROR_STOP on
\if :{?executar}
\else
  \set executar off
\endif

BEGIN;

SELECT 'antes' AS momento,
  (SELECT count(*) FROM public.pacientes) AS pacientes,
  (SELECT count(*) FROM public.consultas) AS registros_clinicos,
  (SELECT count(*) FROM public.agendamentos) AS agendamentos,
  (SELECT count(*) FROM public.cobrancas) AS cobrancas,
  (SELECT count(*) FROM public.acessos) AS acessos,
  (SELECT count(*) FROM public.auditoria
     WHERE tabela IN ('pacientes','consultas','medicamentos_receita','agendamentos','cobrancas')) AS auditoria;

-- Sem CASCADE de propósito: se surgir outra tabela ligada aos pacientes,
-- o TRUNCATE falha em vez de apagar algo que não está nesta lista.
TRUNCATE public.medicamentos_receita, public.consultas, public.cobrancas,
         public.agendamentos, public.acessos, public.operacoes_registro,
         public.pacientes;

DELETE FROM public.auditoria
 WHERE tabela IN ('pacientes','consultas','medicamentos_receita','agendamentos','cobrancas');

SELECT 'depois' AS momento,
  (SELECT count(*) FROM public.pacientes) AS pacientes,
  (SELECT count(*) FROM public.consultas) AS registros_clinicos,
  (SELECT count(*) FROM public.agendamentos) AS agendamentos,
  (SELECT count(*) FROM public.cobrancas) AS cobrancas,
  (SELECT count(*) FROM public.acessos) AS acessos,
  (SELECT count(*) FROM public.auditoria
     WHERE tabela IN ('pacientes','consultas','medicamentos_receita','agendamentos','cobrancas')) AS auditoria;

\if :executar
  \echo 'Gravando a limpeza.'
  COMMIT;
\else
  \echo 'Ensaio: nada foi apagado (ROLLBACK).'
  ROLLBACK;
\endif
