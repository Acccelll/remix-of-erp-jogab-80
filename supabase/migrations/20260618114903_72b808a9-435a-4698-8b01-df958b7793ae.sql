ALTER TABLE public.clientes
  ADD COLUMN IF NOT EXISTS prazo_emitir_nf_dias integer,
  ADD COLUMN IF NOT EXISTS percentual_material numeric,
  ADD COLUMN IF NOT EXISTS aliquota_iss numeric,
  ADD COLUMN IF NOT EXISTS aliquota_inss numeric,
  ADD COLUMN IF NOT EXISTS aliquota_cbs numeric,
  ADD COLUMN IF NOT EXISTS aliquota_ibs numeric;