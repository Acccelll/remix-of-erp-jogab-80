
CREATE TABLE public.financeiro_previsao_carrinho (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id TEXT NOT NULL,
  titulo TEXT NOT NULL DEFAULT 'Simulação',
  status TEXT NOT NULL DEFAULT 'aberto' CHECK (status IN ('aberto', 'fechado')),
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  fechado_em TIMESTAMPTZ
);
CREATE INDEX idx_prev_carrinho_usuario ON public.financeiro_previsao_carrinho(usuario_id, status);

CREATE TABLE public.financeiro_previsao_carrinho_itens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  carrinho_id UUID NOT NULL REFERENCES public.financeiro_previsao_carrinho(id) ON DELETE CASCADE,
  ref_lancamento BIGINT NOT NULL,
  adicionado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (carrinho_id, ref_lancamento)
);
CREATE INDEX idx_prev_carrinho_itens_carrinho ON public.financeiro_previsao_carrinho_itens(carrinho_id);

CREATE TABLE public.financeiro_previsao_carrinho_fechado_itens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  carrinho_id UUID NOT NULL REFERENCES public.financeiro_previsao_carrinho(id) ON DELETE CASCADE,
  ref_lancamento BIGINT NOT NULL,
  nome TEXT,
  centro_custo TEXT,
  centro_nome TEXT,
  natureza_cod TEXT,
  natureza_desc TEXT,
  status_label TEXT,
  valor_congelado NUMERIC NOT NULL,
  previsto BOOLEAN NOT NULL DEFAULT false
);
CREATE INDEX idx_prev_carrinho_fechado_carrinho ON public.financeiro_previsao_carrinho_fechado_itens(carrinho_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.financeiro_previsao_carrinho TO authenticated, anon;
GRANT ALL ON public.financeiro_previsao_carrinho TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.financeiro_previsao_carrinho_itens TO authenticated, anon;
GRANT ALL ON public.financeiro_previsao_carrinho_itens TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.financeiro_previsao_carrinho_fechado_itens TO authenticated, anon;
GRANT ALL ON public.financeiro_previsao_carrinho_fechado_itens TO service_role;

ALTER TABLE public.financeiro_previsao_carrinho ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financeiro_previsao_carrinho_itens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financeiro_previsao_carrinho_fechado_itens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "carrinho_all" ON public.financeiro_previsao_carrinho FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "carrinho_itens_all" ON public.financeiro_previsao_carrinho_itens FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "carrinho_fechado_all" ON public.financeiro_previsao_carrinho_fechado_itens FOR ALL USING (true) WITH CHECK (true);
