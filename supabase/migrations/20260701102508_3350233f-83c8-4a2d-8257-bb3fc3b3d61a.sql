CREATE OR REPLACE FUNCTION public.gm_query_performance(p_limit integer DEFAULT 10)
RETURNS TABLE (
  queryid bigint,
  calls bigint,
  total_ms numeric,
  mean_ms numeric,
  p95_ms numeric,
  max_ms numeric,
  rows bigint,
  categoria text,
  statement text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  PERFORM public._require_gm();

  RETURN QUERY
  SELECT
    s.queryid,
    s.calls,
    round(s.total_exec_time::numeric, 2) AS total_ms,
    round(s.mean_exec_time::numeric, 2) AS mean_ms,
    round(least(s.max_exec_time, s.mean_exec_time + (1.645 * coalesce(s.stddev_exec_time, 0)))::numeric, 2) AS p95_ms,
    round(s.max_exec_time::numeric, 2) AS max_ms,
    s.rows,
    CASE
      WHEN s.query ILIKE '%card_%' OR s.query ILIKE '%"cards"%' THEN 'Cards'
      WHEN s.query ILIKE '%financeiro_%' OR s.query ILIKE '%vw_financeiro%' OR s.query ILIKE '%totvs%' THEN 'Financeiro'
      WHEN s.query ILIKE '%cronograma_%' OR s.query ILIKE '%pacotes_trabalho%' THEN 'Planejamento'
      WHEN s.query ILIKE '%inspec%' OR s.query ILIKE '%nao_conformidades%' THEN 'Qualidade'
      WHEN s.query ILIKE '%ordens_compra%' OR s.query ILIKE '%requisicoes%' OR s.query ILIKE '%recebimento%' THEN 'Suprimentos'
      ELSE 'Geral'
    END AS categoria,
    left(regexp_replace(s.query, '\s+', ' ', 'g'), 220) AS statement
  FROM extensions.pg_stat_statements s
  WHERE s.dbid = (SELECT oid FROM pg_database WHERE datname = current_database())
    AND s.toplevel IS TRUE
    AND s.query NOT ILIKE '%pg_stat_statements%'
    AND s.query NOT ILIKE '%information_schema%'
    AND s.query NOT ILIKE '%pg_catalog%'
    AND s.query ILIKE ANY (ARRAY[
      '%public.%',
      '%"public".%',
      '%"cards"%',
      '%card_%',
      '%financeiro_%',
      '%cronograma_%',
      '%ordens_compra%',
      '%requisicoes%',
      '%recebimento%',
      '%inspec%',
      '%nao_conformidades%'
    ])
  ORDER BY s.total_exec_time DESC
  LIMIT greatest(1, least(coalesce(p_limit, 10), 50));
END;
$$;

REVOKE EXECUTE ON FUNCTION public.gm_query_performance(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.gm_query_performance(integer) TO authenticated, service_role;

COMMENT ON FUNCTION public.gm_query_performance(integer) IS 'GM-only operational query performance summary for /gm/saude using pg_stat_statements. p95 is estimated from mean/stddev and capped by max.';