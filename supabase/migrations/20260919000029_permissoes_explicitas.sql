-- Privilégios explícitos: RLS não protege TRUNCATE nem substitui GRANT.
-- Preserva a matriz funcional existente, restringindo modelos a prescritores ativos.
BEGIN;

REVOKE ALL ON public.perfis, public.pacientes, public.consultas,
  public.medicamentos_receita, public.modelos_receita, public.agendamentos,
  public.convenios, public.procedimentos, public.convenio_valores, public.cobrancas,
  public.configuracoes_clinica, public.filiais, public.auditoria, public.operacoes_registro
  FROM PUBLIC, anon, authenticated;
-- Remover também eventuais privilégios antigos concedidos por coluna.
DO $$
DECLARE t TEXT; colunas TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['perfis','pacientes'] LOOP
    SELECT string_agg(quote_ident(attname), ', ') INTO colunas
    FROM pg_attribute WHERE attrelid = ('public.' || t)::regclass
      AND attnum > 0 AND NOT attisdropped;
    EXECUTE format('REVOKE ALL (%s) ON public.%I FROM PUBLIC, anon, authenticated', colunas, t);
  END LOOP;
END;
$$;

GRANT SELECT (id), UPDATE ON public.perfis TO authenticated;
GRANT SELECT (id), INSERT, UPDATE ON public.pacientes TO authenticated;
GRANT SELECT ON public.consultas, public.auditoria TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.modelos_receita TO authenticated;
GRANT SELECT, UPDATE ON public.configuracoes_clinica TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.medicamentos_receita,
  public.agendamentos, public.convenios, public.procedimentos,
  public.convenio_valores, public.cobrancas, public.filiais TO authenticated;

REVOKE ALL ON public.pacientes_view, public.perfis_view FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.pacientes_view, public.perfis_view TO authenticated;

DROP POLICY "ver modelos" ON public.modelos_receita;
DROP POLICY "criar modelos" ON public.modelos_receita;
DROP POLICY "deletar modelos" ON public.modelos_receita;
CREATE POLICY "ver modelos" ON public.modelos_receita FOR SELECT TO authenticated
  USING (auth.uid() = user_id AND public.current_user_funcao() IN ('Médico', 'Administrador'));
CREATE POLICY "criar modelos" ON public.modelos_receita FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND public.current_user_funcao() IN ('Médico', 'Administrador'));
CREATE POLICY "deletar modelos" ON public.modelos_receita FOR DELETE TO authenticated
  USING (auth.uid() = user_id AND public.current_user_funcao() IN ('Médico', 'Administrador'));

COMMIT;
