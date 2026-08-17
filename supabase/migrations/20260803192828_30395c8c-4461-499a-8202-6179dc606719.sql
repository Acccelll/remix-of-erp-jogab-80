ALTER TABLE public.financeiro_previsao_carrinho_itens
  ADD COLUMN IF NOT EXISTS solicitacao_id uuid;

ALTER TABLE public.financeiro_previsao_carrinho_itens
  ALTER COLUMN ref_lancamento DROP NOT NULL;

ALTER TABLE public.financeiro_previsao_carrinho_itens
  DROP CONSTRAINT IF EXISTS financeiro_previsao_carrinho_itens_ref_ou_solicitacao;
ALTER TABLE public.financeiro_previsao_carrinho_itens
  ADD CONSTRAINT financeiro_previsao_carrinho_itens_ref_ou_solicitacao
  CHECK (ref_lancamento IS NOT NULL OR solicitacao_id IS NOT NULL);

CREATE UNIQUE INDEX IF NOT EXISTS financeiro_previsao_carrinho_itens_solicitacao_uidx
  ON public.financeiro_previsao_carrinho_itens (carrinho_id, solicitacao_id)
  WHERE solicitacao_id IS NOT NULL;

ALTER TABLE public.financeiro_previsao_carrinho_fechado_itens
  ADD COLUMN IF NOT EXISTS solicitacao_id uuid;

ALTER TABLE public.financeiro_previsao_carrinho_fechado_itens
  ALTER COLUMN ref_lancamento DROP NOT NULL;