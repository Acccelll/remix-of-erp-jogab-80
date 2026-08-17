
ALTER TABLE public.custo_colaborador_competencia DROP COLUMN IF EXISTS custo_total;
ALTER TABLE public.custo_colaborador_competencia
  ADD COLUMN custo_total NUMERIC GENERATED ALWAYS AS (
    proventos + inss_empresa + rat + inss_terceiros + fgts
    + provisao_13 + provisao_ferias
    + inss_provisao_13 + fgts_provisao_13
    + inss_provisao_ferias + fgts_provisao_ferias
  ) STORED;
