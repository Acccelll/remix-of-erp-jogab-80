CREATE TABLE public.dp_holerite (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo text NOT NULL DEFAULT 'holerite',
  colaborador_id text NULL,
  cpf text NOT NULL,
  competencia text NOT NULL,
  nome_lido text,
  matricula_lida text,
  cargo_lido text,
  centro_custo_nome_lido text,
  admissao date NULL,
  proventos numeric NOT NULL DEFAULT 0,
  descontos numeric NOT NULL DEFAULT 0,
  liquido numeric NOT NULL DEFAULT 0,
  base_inss numeric NOT NULL DEFAULT 0,
  inss numeric NOT NULL DEFAULT 0,
  base_irrf numeric NOT NULL DEFAULT 0,
  irrf numeric NOT NULL DEFAULT 0,
  base_fgts numeric NOT NULL DEFAULT 0,
  fgts numeric NOT NULL DEFAULT 0,
  provisao_13 numeric NOT NULL DEFAULT 0,
  inss_provisao_13 numeric NOT NULL DEFAULT 0,
  fgts_provisao_13 numeric NOT NULL DEFAULT 0,
  provisao_ferias numeric NOT NULL DEFAULT 0,
  inss_provisao_ferias numeric NOT NULL DEFAULT 0,
  fgts_provisao_ferias numeric NOT NULL DEFAULT 0,
  inss_empresa numeric NOT NULL DEFAULT 0,
  rat numeric NOT NULL DEFAULT 0,
  inss_terceiros numeric NOT NULL DEFAULT 0,
  salario_base numeric NOT NULL DEFAULT 0,
  horas_extras_valor numeric NOT NULL DEFAULT 0,
  custo_total numeric GENERATED ALWAYS AS (
    proventos + inss_empresa + rat + inss_terceiros + fgts + provisao_13 + provisao_ferias
  ) STORED,
  fator_k numeric GENERATED ALWAYS AS (
    CASE WHEN salario_base > 0
      THEN (proventos + inss_empresa + rat + inss_terceiros + fgts + provisao_13 + provisao_ferias) / salario_base
      ELSE NULL END
  ) STORED,
  verbas jsonb NOT NULL DEFAULT '[]'::jsonb,
  origem text NOT NULL DEFAULT 'holerite_xls',
  imported_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT dp_holerite_tipo_check CHECK (tipo IN ('holerite','adiantamento')),
  CONSTRAINT dp_holerite_cpf_competencia_tipo_key UNIQUE (cpf, competencia, tipo)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.dp_holerite TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.dp_holerite TO anon;
GRANT ALL ON public.dp_holerite TO service_role;

ALTER TABLE public.dp_holerite ENABLE ROW LEVEL SECURITY;

CREATE POLICY "dp_holerite full access" ON public.dp_holerite
  FOR ALL TO anon, authenticated
  USING (true) WITH CHECK (true);

CREATE INDEX idx_dp_holerite_competencia ON public.dp_holerite (competencia);
CREATE INDEX idx_dp_holerite_colaborador ON public.dp_holerite (colaborador_id);
CREATE INDEX idx_dp_holerite_cpf_comp ON public.dp_holerite (cpf, competencia);
CREATE INDEX idx_dp_holerite_centro ON public.dp_holerite (centro_custo_nome_lido);
CREATE INDEX idx_dp_holerite_cargo ON public.dp_holerite (cargo_lido);
CREATE INDEX idx_dp_holerite_tipo ON public.dp_holerite (tipo);

CREATE OR REPLACE FUNCTION public.update_dp_holerite_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER trg_dp_holerite_updated_at
BEFORE UPDATE ON public.dp_holerite
FOR EACH ROW EXECUTE FUNCTION public.update_dp_holerite_updated_at();