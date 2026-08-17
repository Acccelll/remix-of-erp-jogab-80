-- Fase 2.1 — Orçamento: insumos, composições, orçamento por atividade

-- INSUMOS (catálogo)
CREATE TABLE IF NOT EXISTS public.insumos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo text,
  descricao text NOT NULL,
  tipo text NOT NULL CHECK (tipo IN ('material','mao_obra','equipamento','servico')),
  unidade text NOT NULL,
  preco_unitario numeric(14,4) NOT NULL DEFAULT 0,
  fonte text NOT NULL DEFAULT 'proprio',
  referencia_externa text,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- COMPOSIÇÕES
CREATE TABLE IF NOT EXISTS public.composicoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo text,
  descricao text NOT NULL,
  unidade text NOT NULL,
  fonte text NOT NULL DEFAULT 'proprio',
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.composicao_itens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  composicao_id uuid NOT NULL REFERENCES public.composicoes(id) ON DELETE CASCADE,
  insumo_id uuid NOT NULL REFERENCES public.insumos(id) ON DELETE RESTRICT,
  coeficiente numeric(14,6) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_comp_itens ON public.composicao_itens(composicao_id);

-- ORÇAMENTO DA OBRA
CREATE TABLE IF NOT EXISTS public.orcamento_itens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  obra_id uuid NOT NULL REFERENCES public.obras(id) ON DELETE CASCADE,
  cronograma_item_id uuid REFERENCES public.cronograma_itens(id) ON DELETE SET NULL,
  composicao_id uuid REFERENCES public.composicoes(id) ON DELETE SET NULL,
  descricao text NOT NULL DEFAULT '',
  unidade text NOT NULL DEFAULT 'un',
  quantidade numeric(14,4) NOT NULL DEFAULT 0,
  preco_unitario numeric(14,4) NOT NULL DEFAULT 0,
  valor_total numeric(14,2) GENERATED ALWAYS AS
    (round((quantidade * preco_unitario)::numeric, 2)) STORED,
  ordem integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_orc_obra ON public.orcamento_itens(obra_id);
CREATE INDEX IF NOT EXISTS idx_orc_crono ON public.orcamento_itens(cronograma_item_id);

-- GRANTS (sem anon — leitura authenticated)
REVOKE ALL ON public.insumos, public.composicoes, public.composicao_itens, public.orcamento_itens FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE
  ON public.insumos, public.composicoes, public.composicao_itens, public.orcamento_itens
  TO authenticated;
GRANT ALL
  ON public.insumos, public.composicoes, public.composicao_itens, public.orcamento_itens
  TO service_role;

-- RLS
ALTER TABLE public.insumos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.composicoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.composicao_itens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orcamento_itens ENABLE ROW LEVEL SECURITY;

-- Catálogos: leitura authenticated, escrita GM ou Engenharia
CREATE POLICY "insumos read" ON public.insumos FOR SELECT TO authenticated USING (true);
CREATE POLICY "insumos write" ON public.insumos FOR ALL TO authenticated
  USING (public.current_is_gm() OR 'Engenharia' = ANY(public.current_setores()))
  WITH CHECK (public.current_is_gm() OR 'Engenharia' = ANY(public.current_setores()));

CREATE POLICY "comp read" ON public.composicoes FOR SELECT TO authenticated USING (true);
CREATE POLICY "comp write" ON public.composicoes FOR ALL TO authenticated
  USING (public.current_is_gm() OR 'Engenharia' = ANY(public.current_setores()))
  WITH CHECK (public.current_is_gm() OR 'Engenharia' = ANY(public.current_setores()));

CREATE POLICY "compitens read" ON public.composicao_itens FOR SELECT TO authenticated USING (true);
CREATE POLICY "compitens write" ON public.composicao_itens FOR ALL TO authenticated
  USING (public.current_is_gm() OR 'Engenharia' = ANY(public.current_setores()))
  WITH CHECK (public.current_is_gm() OR 'Engenharia' = ANY(public.current_setores()));

-- Orçamento: leitura company-wide, escrita por papel
CREATE POLICY "orc read" ON public.orcamento_itens FOR SELECT TO authenticated USING (true);
CREATE POLICY "orc write" ON public.orcamento_itens FOR ALL TO authenticated
  USING (public.current_is_gm() OR 'Engenharia' = ANY(public.current_setores()))
  WITH CHECK (public.current_is_gm() OR 'Engenharia' = ANY(public.current_setores()));

-- updated_at triggers (reusa touch_updated_at já existente)
DROP TRIGGER IF EXISTS touch_insumos ON public.insumos;
CREATE TRIGGER touch_insumos BEFORE UPDATE ON public.insumos
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS touch_composicoes ON public.composicoes;
CREATE TRIGGER touch_composicoes BEFORE UPDATE ON public.composicoes
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS touch_orcamento_itens ON public.orcamento_itens;
CREATE TRIGGER touch_orcamento_itens BEFORE UPDATE ON public.orcamento_itens
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();