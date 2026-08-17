ALTER TABLE public.card_comentarios
  ADD COLUMN IF NOT EXISTS reply_to uuid REFERENCES public.card_comentarios(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS card_comentarios_reply_to_idx
  ON public.card_comentarios(reply_to);