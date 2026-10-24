-- Separa número e complemento do logradouro do paciente para evitar que
-- informações preenchidas automaticamente pelo CEP sejam sobrescritas.

BEGIN;

ALTER TABLE public.pacientes
  ADD COLUMN IF NOT EXISTS numero TEXT,
  ADD COLUMN IF NOT EXISTS complemento TEXT;

CREATE OR REPLACE VIEW public.pacientes_view
WITH (security_barrier = true, security_invoker = false) AS
SELECT
  p.id, p.nome, p.cpf, p.nascimento, p.nome_mae, p.telefone,
  p.convenio_id, c.nome AS convenio_nome, p.cep, p.endereco,
  p.ativo, p.created_by, p.created_at, p.updated_at,
  CASE WHEN public.current_user_funcao() IN ('Médico', 'Enfermeiro(a)', 'Administrador')
       THEN p.alergias END AS alergias,
  CASE WHEN public.current_user_funcao() IN ('Médico', 'Enfermeiro(a)', 'Administrador')
       THEN p.has END AS has,
  CASE WHEN public.current_user_funcao() IN ('Médico', 'Enfermeiro(a)', 'Administrador')
       THEN p.dm END AS dm,
  CASE WHEN public.current_user_funcao() IN ('Médico', 'Enfermeiro(a)', 'Administrador')
       THEN p.dac END AS dac,
  CASE WHEN public.current_user_funcao() IN ('Médico', 'Enfermeiro(a)', 'Administrador')
       THEN p.dislipidemia END AS dislipidemia,
  CASE WHEN public.current_user_funcao() IN ('Médico', 'Enfermeiro(a)', 'Administrador')
       THEN p.tabagismo END AS tabagismo,
  CASE WHEN public.current_user_funcao() IN ('Médico', 'Enfermeiro(a)', 'Administrador')
       THEN p.etilismo END AS etilismo,
  CASE WHEN public.current_user_funcao() IN ('Médico', 'Enfermeiro(a)', 'Administrador')
       THEN p.cirurgias END AS cirurgias,
  CASE WHEN public.current_user_funcao() IN ('Médico', 'Enfermeiro(a)', 'Administrador')
       THEN p.medicamentos_uso END AS medicamentos_uso,
  CASE WHEN public.current_user_funcao() IN ('Médico', 'Enfermeiro(a)', 'Administrador')
       THEN p.outras_comorbidades END AS outras_comorbidades,
  p.numero,
  p.complemento
FROM public.pacientes p
LEFT JOIN public.convenios c ON c.id = p.convenio_id
WHERE public.current_user_ativo();

REVOKE SELECT ON public.pacientes FROM anon, authenticated;
REVOKE ALL ON public.pacientes_view FROM anon;
GRANT SELECT (id) ON public.pacientes TO authenticated;
GRANT SELECT ON public.pacientes_view TO authenticated;

COMMENT ON COLUMN public.pacientes.numero IS 'Número do endereço do paciente.';
COMMENT ON COLUMN public.pacientes.complemento IS 'Complemento do endereço do paciente.';

COMMIT;
