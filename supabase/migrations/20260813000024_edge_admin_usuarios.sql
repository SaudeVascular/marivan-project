-- Permite que a Edge Function administrativa conclua o perfil de uma conta
-- criada via auth.admin. A service_role nunca é exposta ao navegador e ainda
-- precisa passar pela validação de Administrador feita na função backend.
CREATE OR REPLACE FUNCTION public.proteger_campos_seguranca_perfil()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role'
     AND public.current_user_funcao() IS DISTINCT FROM 'Administrador'
     AND (
       NEW.funcao IS DISTINCT FROM OLD.funcao OR
       NEW.ativo IS DISTINCT FROM OLD.ativo OR
       NEW.email IS DISTINCT FROM OLD.email
     ) THEN
    RAISE EXCEPTION 'Somente administradores podem alterar função, status ou e-mail';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.proteger_campos_seguranca_perfil() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.proteger_campos_seguranca_perfil() TO service_role;
