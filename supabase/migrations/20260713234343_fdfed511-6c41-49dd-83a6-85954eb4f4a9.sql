ALTER TABLE public.medicoes
  ADD COLUMN IF NOT EXISTS aprovada_por text,
  ADD COLUMN IF NOT EXISTS aprovada_em timestamptz,
  ADD COLUMN IF NOT EXISTS enviada_por text,
  ADD COLUMN IF NOT EXISTS enviada_em timestamptz,
  ADD COLUMN IF NOT EXISTS rejeitada_por text,
  ADD COLUMN IF NOT EXISTS rejeitada_em timestamptz,
  ADD COLUMN IF NOT EXISTS rejeicao_motivo text;
COMMENT ON COLUMN public.medicoes.aprovada_por IS 'PRO-016: login de quem aprovou a medição (auditoria).';
COMMENT ON COLUMN public.medicoes.enviada_por IS 'PRO-016: login de quem enviou a medição para aprovação.';
COMMENT ON COLUMN public.medicoes.rejeitada_por IS 'PRO-016: login de quem rejeitou a medição.';