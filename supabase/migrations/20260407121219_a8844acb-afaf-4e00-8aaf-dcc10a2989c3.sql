
-- Formas de pagamento
CREATE TABLE public.formas_pagamento (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  tipo TEXT NOT NULL DEFAULT 'pix',
  nome_cartao TEXT,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.formas_pagamento ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public access formas_pagamento" ON public.formas_pagamento FOR ALL USING (true) WITH CHECK (true);

-- Solicitações financeiras
CREATE TABLE public.solicitacoes_financeiras (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  setor TEXT NOT NULL DEFAULT '',
  valor NUMERIC NOT NULL DEFAULT 0,
  data_pagamento TEXT,
  prazo_estimado TEXT,
  forma_pagamento_id UUID REFERENCES public.formas_pagamento(id),
  nivel_prioridade TEXT NOT NULL DEFAULT 'normal',
  condicao_pagamento TEXT,
  centro_custo_id TEXT,
  solicitante TEXT NOT NULL DEFAULT '',
  fornecedor TEXT,
  referencia TEXT,
  observacao TEXT,
  status TEXT NOT NULL DEFAULT 'em_analise',
  comentario_aprovacao TEXT,
  criado_por TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.solicitacoes_financeiras ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public access solicitacoes_financeiras" ON public.solicitacoes_financeiras FOR ALL USING (true) WITH CHECK (true);

-- Comentários por campo
CREATE TABLE public.solicitacao_comentarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  solicitacao_id UUID NOT NULL REFERENCES public.solicitacoes_financeiras(id) ON DELETE CASCADE,
  campo TEXT NOT NULL,
  texto TEXT NOT NULL,
  autor TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.solicitacao_comentarios ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public access solicitacao_comentarios" ON public.solicitacao_comentarios FOR ALL USING (true) WITH CHECK (true);

-- Controle de despesas
CREATE TABLE public.controle_despesas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  solicitacao_id UUID REFERENCES public.solicitacoes_financeiras(id),
  data_compra TEXT,
  responsavel TEXT NOT NULL DEFAULT '',
  descricao TEXT NOT NULL DEFAULT '',
  centro_custo_id TEXT,
  fornecedor TEXT,
  valor NUMERIC NOT NULL DEFAULT 0,
  parcelas INTEGER NOT NULL DEFAULT 1,
  cartao TEXT,
  log_alteracoes JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.controle_despesas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public access controle_despesas" ON public.controle_despesas FOR ALL USING (true) WITH CHECK (true);
