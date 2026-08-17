ALTER TABLE public.itens_medicao
  ADD COLUMN IF NOT EXISTS orcamento_item_id uuid
    REFERENCES public.orcamento_itens(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS itens_medicao_orcamento_item_id_idx
  ON public.itens_medicao(orcamento_item_id);

COMMENT ON COLUMN public.itens_medicao.orcamento_item_id IS
  'Vínculo opcional com o item de orçamento medido. Usado pela curva S físico-financeira ancorada no orçamento aprovado (Fase 2b).';