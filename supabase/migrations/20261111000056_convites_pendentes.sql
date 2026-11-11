-- Quem foi convidado e ainda não ativou a conta (11/11/2026), para a tela
-- de usuários mostrar "Convite pendente" e o botão "Reenviar convite"
-- (Edge Function admin-create-user, ação "reenviar").
--
-- Só ids, só para Administrador ativo: o resto de auth.users continua
-- fora do alcance do app.
BEGIN;

CREATE OR REPLACE FUNCTION public.convites_pendentes()
RETURNS SETOF UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT u.id FROM auth.users u
   WHERE u.email_confirmed_at IS NULL
     AND u.last_sign_in_at IS NULL
     AND COALESCE(public.current_user_ativo(), false)
     AND public.current_user_funcao() = 'Administrador';
$$;
REVOKE ALL ON FUNCTION public.convites_pendentes() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.convites_pendentes() TO authenticated;

COMMIT;
