
ALTER TABLE public.ponto_registros
  ADD COLUMN IF NOT EXISTS dias_falta_qtd integer NOT NULL DEFAULT 0,
  ALTER COLUMN data DROP NOT NULL;
