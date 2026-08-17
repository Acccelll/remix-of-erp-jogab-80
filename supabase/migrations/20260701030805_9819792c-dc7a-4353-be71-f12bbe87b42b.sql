CREATE OR REPLACE VIEW public.vw_mv_obra_dashboard
WITH (security_invoker = true) AS
SELECT
  m.obra_id,
  m.codigo,
  m.nome,
  m.status,
  m.financeiro_previsto,
  m.financeiro_realizado,
  m.financeiro_saldo,
  m.progresso_fisico,
  m.cronograma_itens,
  m.ordens_compra_abertas,
  m.requisicoes_pendentes,
  m.atualizado_em
FROM public.mv_obra_dashboard m
JOIN public.obras o ON o.id = m.obra_id;

GRANT SELECT ON public.vw_mv_obra_dashboard TO authenticated;
GRANT SELECT ON public.vw_mv_obra_dashboard TO service_role;
REVOKE ALL ON public.vw_mv_obra_dashboard FROM anon;

REVOKE ALL ON public.mv_obra_dashboard FROM PUBLIC;
REVOKE ALL ON public.mv_obra_dashboard FROM anon;
REVOKE ALL ON public.mv_obra_dashboard FROM authenticated;
GRANT ALL ON public.mv_obra_dashboard TO service_role;

CREATE OR REPLACE FUNCTION public.refresh_mv_obra_dashboard()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
BEGIN
  IF auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'Acesso negado: service_role requerido';
  END IF;

  REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_obra_dashboard;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.refresh_mv_obra_dashboard() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.refresh_mv_obra_dashboard() TO service_role;