
-- 1) Restrict SELECT on players.senha via column-level privileges
REVOKE SELECT ON public.players FROM authenticated;
GRANT SELECT (id, login, email, is_gm, acessos, created_at) ON public.players TO authenticated;
-- keep INSERT/UPDATE/DELETE as-is (still governed by RLS)
GRANT INSERT, UPDATE, DELETE ON public.players TO authenticated;
GRANT ALL ON public.players TO service_role;

-- 2) has_role: switch to SECURITY INVOKER so it does not bypass RLS on user_roles;
--    tighten EXECUTE grants (authenticated needs execute for RLS use; PUBLIC does not).
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  );
$$;

REVOKE ALL ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated, service_role;
