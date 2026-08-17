
GRANT SELECT, INSERT, UPDATE, DELETE ON public.financeiro_lancamentos TO authenticated;
GRANT ALL ON public.financeiro_lancamentos TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.financeiro_snapshots TO authenticated;
GRANT ALL ON public.financeiro_snapshots TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.financeiro_rateios TO authenticated;
GRANT ALL ON public.financeiro_rateios TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.financeiro_matriz_rateios TO authenticated;
GRANT ALL ON public.financeiro_matriz_rateios TO service_role;

GRANT SELECT ON public.vw_financeiro_obra TO authenticated;
GRANT SELECT ON public.vw_financeiro_obra TO service_role;
