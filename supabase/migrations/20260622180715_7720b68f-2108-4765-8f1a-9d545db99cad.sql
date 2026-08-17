
-- Fase 1: Evolução de dívidas — matriz de referência, pendência e rollup permanente.

-- 1) Matriz persistente de rateios (vinda do EMISSAO via SQL)
CREATE TABLE IF NOT EXISTS public.financeiro_matriz_rateios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ref_lancamento BIGINT NOT NULL,
  cod_natureza TEXT,
  desc_natureza TEXT,
  grupo TEXT,
  subgrupo TEXT,
  cod_ccusto TEXT,
  desc_ccusto TEXT,
  valor_rateio NUMERIC NOT NULL DEFAULT 0,
  valor_original NUMERIC NOT NULL DEFAULT 0,
  situacao_presumida TEXT,
  owner_id UUID,
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_fin_matriz_ref ON public.financeiro_matriz_rateios(ref_lancamento);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.financeiro_matriz_rateios TO anon, authenticated;
GRANT ALL ON public.financeiro_matriz_rateios TO service_role;
ALTER TABLE public.financeiro_matriz_rateios ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fin_matriz planifik" ON public.financeiro_matriz_rateios
  FOR ALL TO anon, authenticated, service_role USING (true) WITH CHECK (true);

-- 2) Pendência de natureza no título
ALTER TABLE public.financeiro_lancamentos
  ADD COLUMN IF NOT EXISTS pendente_natureza BOOLEAN NOT NULL DEFAULT false;

-- 3) Metadados de matriz no snapshot
ALTER TABLE public.financeiro_snapshots
  ADD COLUMN IF NOT EXISTS novos_sem_natureza INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS matriz_atualizada_em TIMESTAMPTZ;

-- 4) Rollup permanente de evolução (nunca purgado)
CREATE TABLE IF NOT EXISTS public.financeiro_evolucao_rollup (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_id UUID REFERENCES public.financeiro_snapshots(id) ON DELETE SET NULL,
  data_snapshot DATE NOT NULL,
  obra_id UUID REFERENCES public.obras(id) ON DELETE SET NULL,
  status_cod SMALLINT,
  status_label TEXT,
  grupo TEXT,
  cod_natureza TEXT,
  desc_natureza TEXT,
  valor_aberto NUMERIC NOT NULL DEFAULT 0,
  valor_pago NUMERIC NOT NULL DEFAULT 0,
  qtd_titulos INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_fin_rollup_data ON public.financeiro_evolucao_rollup(data_snapshot);
CREATE INDEX IF NOT EXISTS idx_fin_rollup_obra ON public.financeiro_evolucao_rollup(obra_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.financeiro_evolucao_rollup TO anon, authenticated;
GRANT ALL ON public.financeiro_evolucao_rollup TO service_role;
ALTER TABLE public.financeiro_evolucao_rollup ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fin_rollup planifik" ON public.financeiro_evolucao_rollup
  FOR ALL TO anon, authenticated, service_role USING (true) WITH CHECK (true);
