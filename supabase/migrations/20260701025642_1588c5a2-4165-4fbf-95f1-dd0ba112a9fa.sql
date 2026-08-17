
DROP MATERIALIZED VIEW IF EXISTS public.mv_obra_dashboard;

CREATE MATERIALIZED VIEW public.mv_obra_dashboard AS
SELECT
  o.id AS obra_id,
  o.codigo,
  o.nome,
  o.status,
  COALESCE(fin.total_previsto, 0)  AS financeiro_previsto,
  COALESCE(fin.total_realizado, 0) AS financeiro_realizado,
  COALESCE(fin.total_previsto, 0) - COALESCE(fin.total_realizado, 0) AS financeiro_saldo,
  COALESCE(cron.avg_progresso, 0)  AS progresso_fisico,
  COALESCE(cron.total_itens, 0)    AS cronograma_itens,
  COALESCE(sup.oc_abertas, 0)      AS ordens_compra_abertas,
  COALESCE(sup.req_pendentes, 0)   AS requisicoes_pendentes,
  now() AS atualizado_em
FROM public.obras o
LEFT JOIN LATERAL (
  SELECT
    SUM(COALESCE(fl.valor_liquido, 0)) AS total_previsto,
    SUM(COALESCE(fl.valor_baixado, 0)) AS total_realizado
  FROM public.financeiro_lancamentos fl
  WHERE fl.obra_id = o.id
) fin ON TRUE
LEFT JOIN LATERAL (
  SELECT
    AVG(COALESCE(ci.percentual_realizado, 0))::numeric(6,2) AS avg_progresso,
    COUNT(*) AS total_itens
  FROM public.cronograma_itens ci
  WHERE ci.obra_id = o.id
) cron ON TRUE
LEFT JOIN LATERAL (
  SELECT
    (SELECT COUNT(*) FROM public.ordens_compra oc
      WHERE oc.obra_id = o.id
        AND COALESCE(oc.status,'') NOT IN ('concluida','cancelada','recebida')) AS oc_abertas,
    (SELECT COUNT(*) FROM public.requisicoes rq
      WHERE rq.obra_id = o.id
        AND COALESCE(rq.status,'') NOT IN ('atendida','cancelada','concluida')) AS req_pendentes
) sup ON TRUE;

CREATE UNIQUE INDEX idx_mv_obra_dashboard_obra   ON public.mv_obra_dashboard(obra_id);
CREATE INDEX        idx_mv_obra_dashboard_status ON public.mv_obra_dashboard(status);

GRANT SELECT ON public.mv_obra_dashboard TO authenticated;
GRANT ALL    ON public.mv_obra_dashboard TO service_role;

CREATE OR REPLACE FUNCTION public.refresh_mv_obra_dashboard()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.role() <> 'service_role'
     AND NOT public.has_role(auth.uid(), 'gm'::app_role) THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_obra_dashboard;
END;
$$;

REVOKE ALL     ON FUNCTION public.refresh_mv_obra_dashboard() FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.refresh_mv_obra_dashboard() TO authenticated;
GRANT  EXECUTE ON FUNCTION public.refresh_mv_obra_dashboard() TO service_role;
