ALTER TABLE public.solicitacoes_financeiras
  ADD COLUMN IF NOT EXISTS aprovado_por text,
  ADD COLUMN IF NOT EXISTS data_aprovacao timestamptz,
  ADD COLUMN IF NOT EXISTS recusado_por text,
  ADD COLUMN IF NOT EXISTS data_recusa timestamptz,
  ADD COLUMN IF NOT EXISTS cancelado_por text,
  ADD COLUMN IF NOT EXISTS data_cancelamento timestamptz;