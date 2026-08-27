-- Kanban (system design §3.4/§5.3): remove `cards.cover_color`/`cards.cover_url`,
-- par de colunas vestigiais. Só o importador do Trello ainda escrevia nelas
-- (sempre em paralelo com `capa_cor`/`capa_url`, o par de fato lido em toda a
-- UI) — nenhum código lê `cover_color`/`cover_url` (confirmado por grep).
ALTER TABLE public.cards
  DROP COLUMN IF EXISTS cover_color,
  DROP COLUMN IF EXISTS cover_url;
