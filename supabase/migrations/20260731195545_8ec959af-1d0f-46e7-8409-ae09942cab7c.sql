CREATE OR REPLACE FUNCTION public.__bootstrap_exec_ddl(p_sql text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  EXECUTE p_sql;
END;
$$;

REVOKE ALL ON FUNCTION public.__bootstrap_exec_ddl(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.__bootstrap_exec_ddl(text) FROM anon;
REVOKE ALL ON FUNCTION public.__bootstrap_exec_ddl(text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.__bootstrap_exec_ddl(text) TO service_role;