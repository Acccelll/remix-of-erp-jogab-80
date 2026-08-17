REVOKE EXECUTE ON FUNCTION public.fn_auto_arquivar_concluidos() FROM authenticated, anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.fn_auto_arquivar_concluidos() TO service_role;