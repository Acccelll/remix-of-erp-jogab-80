
ALTER TABLE public.dp_holerite DROP COLUMN IF EXISTS custo_total;
ALTER TABLE public.dp_holerite DROP COLUMN IF EXISTS fator_k;
ALTER TABLE public.dp_holerite
  ADD COLUMN custo_total NUMERIC GENERATED ALWAYS AS (
    proventos + inss_empresa + rat + inss_terceiros + fgts
    + provisao_13 + provisao_ferias
    + inss_provisao_13 + fgts_provisao_13
    + inss_provisao_ferias + fgts_provisao_ferias
  ) STORED;
ALTER TABLE public.dp_holerite
  ADD COLUMN fator_k NUMERIC GENERATED ALWAYS AS (
    CASE WHEN salario_base > 0 THEN (
      proventos + inss_empresa + rat + inss_terceiros + fgts
      + provisao_13 + provisao_ferias
      + inss_provisao_13 + fgts_provisao_13
      + inss_provisao_ferias + fgts_provisao_ferias
    ) / salario_base ELSE NULL END
  ) STORED;
