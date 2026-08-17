REVOKE EXECUTE ON FUNCTION public.refresh_mv_obra_dashboard() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.refresh_mv_obra_dashboard() FROM anon;
REVOKE EXECUTE ON FUNCTION public.refresh_mv_obra_dashboard() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.refresh_mv_obra_dashboard() TO service_role;

CREATE OR REPLACE FUNCTION public.refresh_mv_obra_dashboard()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
BEGIN
  IF NOT public.current_is_gm() THEN
    RAISE EXCEPTION 'Acesso negado: GM requerido';
  END IF;

  REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_obra_dashboard;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.refresh_mv_obra_dashboard() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.refresh_mv_obra_dashboard() FROM anon;
GRANT EXECUTE ON FUNCTION public.refresh_mv_obra_dashboard() TO authenticated;
GRANT EXECUTE ON FUNCTION public.refresh_mv_obra_dashboard() TO service_role;