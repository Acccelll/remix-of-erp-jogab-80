ALTER TABLE public.board_listas
  ADD COLUMN IF NOT EXISTS origem_externa text,
  ADD COLUMN IF NOT EXISTS origem_id text;

CREATE INDEX IF NOT EXISTS idx_board_listas_origem
  ON public.board_listas (board_id, origem_externa, origem_id)
  WHERE origem_externa IS NOT NULL AND origem_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_board_listas_origem
  ON public.board_listas (board_id, origem_externa, origem_id)
  WHERE origem_externa IS NOT NULL AND origem_id IS NOT NULL;

DROP INDEX IF EXISTS public.idx_cards_origem_board_lookup;

CREATE UNIQUE INDEX IF NOT EXISTS uq_cards_origem_trello
  ON public.cards (origem_externa, origem_id)
  WHERE origem_externa = 'trello' AND origem_id IS NOT NULL;