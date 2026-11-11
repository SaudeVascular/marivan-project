-- Auditoria de acesso: o registro informado precisa ser do paciente
-- informado (quarta avaliação, 25/10/2026).
--
-- A reimpressão aceitava uma URL com o paciente B e um registro de A; o
-- app foi corrigido, mas registrar_acesso também gravava essa combinação
-- sem conferir. Agora recusa (22023) qualquer p_registro_id que não seja
-- uma consulta de p_paciente_id.
BEGIN;

CREATE OR REPLACE FUNCTION public.registrar_acesso(
  p_paciente_id UUID, p_acao TEXT, p_detalhe TEXT DEFAULT NULL, p_registro_id UUID DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.current_user_ativo() THEN
    RAISE EXCEPTION 'Usuário inativo ou não autenticado' USING ERRCODE = '42501';
  END IF;
  IF p_acao NOT IN ('abrir_prontuario', 'imprimir_documento') THEN
    RAISE EXCEPTION 'Ação de acesso desconhecida: %', p_acao USING ERRCODE = '22023';
  END IF;
  IF p_registro_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.consultas c WHERE c.id = p_registro_id AND c.paciente_id = p_paciente_id
  ) THEN
    RAISE EXCEPTION 'Registro não pertence ao paciente informado' USING ERRCODE = '22023';
  END IF;
  INSERT INTO public.acessos (usuario_id, paciente_id, acao, detalhe, registro_id)
  VALUES (auth.uid(), p_paciente_id, p_acao, left(NULLIF(btrim(p_detalhe), ''), 120), p_registro_id);
END;
$$;

REVOKE ALL ON FUNCTION public.registrar_acesso(UUID, TEXT, TEXT, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.registrar_acesso(UUID, TEXT, TEXT, UUID) TO authenticated;

COMMIT;
