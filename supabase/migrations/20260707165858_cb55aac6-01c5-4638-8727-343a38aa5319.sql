
ALTER TABLE public.bms_previstas
  ADD COLUMN IF NOT EXISTS origem TEXT,
  ADD COLUMN IF NOT EXISTS editado_em TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS valor_realizado NUMERIC;

ALTER TABLE public.cronograma_itens
  ADD COLUMN IF NOT EXISTS calendario_uid_mpp TEXT,
  ADD COLUMN IF NOT EXISTS folga_livre_dias NUMERIC,
  ADD COLUMN IF NOT EXISTS fanout_sucessoras INTEGER,
  ADD COLUMN IF NOT EXISTS importancia_classe TEXT,
  ADD COLUMN IF NOT EXISTS importancia_score NUMERIC,
  ADD COLUMN IF NOT EXISTS localizacao_id UUID,
  ADD COLUMN IF NOT EXISTS recursos_count INTEGER,
  ADD COLUMN IF NOT EXISTS recursos_status TEXT,
  ADD COLUMN IF NOT EXISTS servico_lob TEXT;
