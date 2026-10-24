-- Profissões não médicas: cada uma só registra o que é ato da profissão.
--
-- Na migração 35, Psicólogo(a) e Fisioterapeuta herdaram tudo, menos
-- Receituário e Prescrição — inclusive Pedido de Exames, Laudo de exames
-- e Sinais Vitais; Enfermeiro(a) podia tudo, menos Receituário,
-- Prescrição e Atestado. Agora todas as profissões não médicas usam uma
-- lista do que é PERMITIDO (tipo novo nasce bloqueado):
--   Psicólogo(a), Fisioterapeuta → Consulta (atendimento), Atestado, Relatório
--   Enfermeiro(a)                → Consulta, Evolução de Enfermagem
--                                  (o atendimento da enfermagem), Sinais Vitais
--   Médico                       → tudo
--
-- Espelhada no front-end em src/constants/roles.js (TIPOS_PERMITIDOS) —
-- mantenha as duas em sincronia.

BEGIN;

CREATE OR REPLACE FUNCTION public.papel_clinico_pode_registrar(p_papel TEXT, p_tipo TEXT)
RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE
    WHEN p_papel = 'Médico' THEN true
    WHEN p_papel = 'Enfermeiro(a)'
      THEN COALESCE(p_tipo IN ('Consulta', 'Evolução de Enfermagem', 'Sinais Vitais'), false)
    WHEN p_papel IN ('Psicólogo(a)', 'Fisioterapeuta')
      THEN COALESCE(p_tipo IN ('Consulta', 'Atestado', 'Relatório'), false)
    ELSE false
  END;
$$;

REVOKE ALL ON FUNCTION public.papel_clinico_pode_registrar(TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.papel_clinico_pode_registrar(TEXT, TEXT) TO authenticated;

COMMIT;
