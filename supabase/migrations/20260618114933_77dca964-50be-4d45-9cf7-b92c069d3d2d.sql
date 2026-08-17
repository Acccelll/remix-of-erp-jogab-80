ALTER TABLE public.obras
  ADD COLUMN IF NOT EXISTS dias_ate_emissao_nf integer DEFAULT 5,
  ADD COLUMN IF NOT EXISTS dias_corte_bms integer[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS dias_fixos_pagamento integer[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS observacoes text;
ALTER TABLE public.obras ALTER COLUMN cliente DROP NOT NULL;