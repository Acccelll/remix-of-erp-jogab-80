-- Corrige privilégios explícitos necessários para acesso via Data API/PostgREST
-- Sem estes GRANTs, as políticas RLS existem, mas o frontend não consegue enxergar os dados.

GRANT SELECT, INSERT, UPDATE, DELETE ON public.financeiro_snapshots TO authenticated;
GRANT ALL ON public.financeiro_snapshots TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.financeiro_lancamentos TO authenticated;
GRANT ALL ON public.financeiro_lancamentos TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.financeiro_rateios TO authenticated;
GRANT ALL ON public.financeiro_rateios TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.financeiro_matriz_rateios TO authenticated;
GRANT ALL ON public.financeiro_matriz_rateios TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.centros_custo_totvs TO authenticated;
GRANT ALL ON public.centros_custo_totvs TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.obras TO authenticated;
GRANT ALL ON public.obras TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.recebimentos TO authenticated;
GRANT ALL ON public.recebimentos TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.notas_fiscais TO authenticated;
GRANT ALL ON public.notas_fiscais TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.medicoes TO authenticated;
GRANT ALL ON public.medicoes TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.bms_previstas TO authenticated;
GRANT ALL ON public.bms_previstas TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.cronograma_itens TO authenticated;
GRANT ALL ON public.cronograma_itens TO service_role;

-- Views consumidas pelo módulo Financeiro
GRANT SELECT ON public.vw_financeiro_obra TO authenticated;
GRANT SELECT ON public.vw_financeiro_obra TO service_role;

DO $$
BEGIN
  IF to_regclass('public.vw_obra_valores') IS NOT NULL THEN
    GRANT SELECT ON public.vw_obra_valores TO authenticated;
    GRANT SELECT ON public.vw_obra_valores TO service_role;
  END IF;

  IF to_regclass('public.vw_nf_saldo') IS NOT NULL THEN
    GRANT SELECT ON public.vw_nf_saldo TO authenticated;
    GRANT SELECT ON public.vw_nf_saldo TO service_role;
  END IF;

  IF to_regclass('public.financeiro_evolucao_rollup') IS NOT NULL THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON public.financeiro_evolucao_rollup TO authenticated;
    GRANT ALL ON public.financeiro_evolucao_rollup TO service_role;
  END IF;
END $$;