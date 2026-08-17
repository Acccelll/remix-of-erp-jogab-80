REVOKE ALL ON FUNCTION public.current_obras() FROM anon;
REVOKE ALL ON FUNCTION public.user_em_obra(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.current_obras() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.user_em_obra(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_obras() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.user_em_obra(uuid) TO authenticated, service_role;