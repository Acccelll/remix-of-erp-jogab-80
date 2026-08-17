CREATE TABLE public.custo_colaborador_competencia (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  colaborador_id text NOT NULL,
  cpf text NOT NULL,
  competencia text NOT NULL,
  cargo_lido text,
  matricula_lida text,
  centro_custo_id text,
  centro_custo_nome text,
  proventos numeric NOT NULL DEFAULT 0,
  horas_extras numeric NOT NULL DEFAULT 0,
  inss_empresa numeric NOT NULL DEFAULT 0,
  rat numeric NOT NULL DEFAULT 0,
  inss_terceiros numeric NOT NULL DEFAULT 0,
  fgts numeric NOT NULL DEFAULT 0,
  provisao_13 numeric NOT NULL DEFAULT 0,
  inss_provisao_13 numeric NOT NULL DEFAULT 0,
  fgts_provisao_13 numeric NOT NULL DEFAULT 0,
  provisao_ferias numeric NOT NULL DEFAULT 0,
  inss_provisao_ferias numeric NOT NULL DEFAULT 0,
  fgts_provisao_ferias numeric NOT NULL DEFAULT 0,
  custo_total numeric GENERATED ALWAYS AS (
    proventos + inss_empresa + rat + inss_terceiros
    + fgts + provisao_13 + provisao_ferias
  ) STORED,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (colaborador_id, competencia)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.custo_colaborador_competencia TO authenticated;
GRANT ALL ON public.custo_colaborador_competencia TO service_role;

ALTER TABLE public.custo_colaborador_competencia ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth full access custo_colaborador_competencia"
  ON public.custo_colaborador_competencia
  FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

CREATE INDEX idx_custo_colab_competencia_comp ON public.custo_colaborador_competencia(competencia);
CREATE INDEX idx_custo_colab_competencia_colab ON public.custo_colaborador_competencia(colaborador_id);

CREATE OR REPLACE FUNCTION public.update_custo_colab_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER trg_update_custo_colab_updated_at
BEFORE UPDATE ON public.custo_colaborador_competencia
FOR EACH ROW EXECUTE FUNCTION public.update_custo_colab_updated_at();