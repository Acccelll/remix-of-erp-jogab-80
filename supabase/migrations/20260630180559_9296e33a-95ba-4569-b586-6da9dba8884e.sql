ALTER TABLE public.board_listas ADD COLUMN IF NOT EXISTS cor TEXT NULL;
ALTER TABLE public.board_listas DROP CONSTRAINT IF EXISTS board_listas_cor_hex_chk;
ALTER TABLE public.board_listas ADD CONSTRAINT board_listas_cor_hex_chk CHECK (cor IS NULL OR cor ~* '^#([0-9a-f]{3}|[0-9a-f]{6})$');