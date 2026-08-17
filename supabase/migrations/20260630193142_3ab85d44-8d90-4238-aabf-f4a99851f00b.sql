ALTER TABLE public.board_listas
  ADD COLUMN IF NOT EXISTS origem_externa text,
  ADD COLUMN IF NOT EXISTS origem_id text;

CREATE INDEX IF NOT EXISTS idx_board_listas_origem
  ON public.board_listas (board_id, origem_externa, origem_id)
  WHERE origem_externa IS NOT NULL AND origem_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_board_listas_origem
  ON public.board_listas (board_id, origem_externa, origem_id)
  WHERE origem_externa IS NOT NULL AND origem_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_cards_origem_board_lookup
  ON public.cards (origem_externa, origem_id, created_at)
  WHERE origem_externa IS NOT NULL AND origem_id IS NOT NULL;