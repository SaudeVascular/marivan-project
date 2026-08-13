-- =====================================================================
-- Módulo de Enfermagem — Fase 3 do Documento Mestre.
-- =====================================================================
--
-- Cobre a seção 2.2 do Documento Mestre (perfil Enfermeiro: triagem,
-- sinais vitais, evolução de enfermagem — sem os atos exclusivos de
-- quem tem CRM, listados só em 2.1 Médico: receitas/prescrições e
-- atestados).
--
-- Este script:
--   1. adiciona 'Sinais Vitais' e 'Evolução de Enfermagem' aos tipos
--      aceitos em `consultas.tipo` (mesmo padrão de
--      supabase_pedido_exames.sql);
--   2. impede, via RLS, que Enfermeiro(a) crie ou edite registros do
--      tipo Receituário/Prescrição/Atestado — a tela já bloqueia isso
--      (App.js, SomenteMedico), mas RLS é a camada que realmente conta.
--      Leitura desses registros continua liberada pra todo perfil
--      clínico (enfermagem precisa ver o que o médico prescreveu).
--
-- Mesmo conjunto de tipos restritos a Médico/Administrador em App.js
-- (FUNCOES_MEDICO) — mantenha os dois em sincronia.
--
-- Pressupõe supabase_schema.sql, supabase_rls_rbac.sql e
-- supabase_pedido_exames.sql já rodados. Seguro rodar mais de uma vez.
-- =====================================================================

ALTER TABLE consultas DROP CONSTRAINT IF EXISTS consultas_tipo_check;

ALTER TABLE consultas ADD CONSTRAINT consultas_tipo_check
  CHECK (tipo IN (
    'Consulta',
    'Atestado',
    'Receituário',
    'Prescrição',
    'Relatório',
    'Pedido de Exames',
    'Laudo',
    'Sinais Vitais',
    'Evolução de Enfermagem'
  ));

DROP POLICY IF EXISTS "criar consultas" ON consultas;
CREATE POLICY "criar consultas" ON consultas
  FOR INSERT
  WITH CHECK (
    current_user_ativo() AND (
      current_user_funcao() IN ('Médico', 'Administrador')
      OR (current_user_funcao() = 'Enfermeiro(a)' AND tipo NOT IN ('Receituário', 'Prescrição', 'Atestado'))
    )
  );

DROP POLICY IF EXISTS "editar consultas" ON consultas;
CREATE POLICY "editar consultas" ON consultas
  FOR UPDATE
  USING (current_user_ativo() AND current_user_funcao() IN ('Médico', 'Enfermeiro(a)', 'Administrador'))
  WITH CHECK (
    current_user_ativo() AND (
      current_user_funcao() IN ('Médico', 'Administrador')
      OR (current_user_funcao() = 'Enfermeiro(a)' AND tipo NOT IN ('Receituário', 'Prescrição', 'Atestado'))
    )
  );
