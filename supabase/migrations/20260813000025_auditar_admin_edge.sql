-- A Edge Function passou a atualizar o perfil com o JWT do Administrador
-- solicitante, preservando autoria na auditoria. Remove a exceção temporária
-- de service_role introduzida na migração anterior.
CREATE OR REPLACE FUNCTION public.proteger_campos_seguranca_perfil()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.current_user_funcao() IS DISTINCT FROM 'Administrador' AND (
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
