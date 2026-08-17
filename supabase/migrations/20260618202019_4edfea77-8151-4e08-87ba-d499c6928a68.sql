
ALTER TABLE public.ponto_registros
  ADD COLUMN IF NOT EXISTS horas_compensadas_min integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS interjornada_min integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS banco_saldo_min integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS agregado boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS centro_indireto boolean NOT NULL DEFAULT false;
