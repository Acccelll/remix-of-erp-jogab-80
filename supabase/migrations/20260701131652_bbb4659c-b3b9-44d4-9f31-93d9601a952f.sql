ALTER TABLE public.itens_medicao
ADD CONSTRAINT itens_medicao_cronograma_item_id_fkey
FOREIGN KEY (cronograma_item_id) REFERENCES public.cronograma_itens(id) ON DELETE SET NULL;
NOTIFY pgrst, 'reload schema';