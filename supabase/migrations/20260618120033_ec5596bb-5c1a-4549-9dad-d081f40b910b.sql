ALTER TABLE public.medicoes ADD COLUMN IF NOT EXISTS data_inicio date;
ALTER TABLE public.medicoes ADD COLUMN IF NOT EXISTS baseline_id uuid REFERENCES public.cronograma_baselines(id);
ALTER TABLE public.notas_fiscais ADD COLUMN IF NOT EXISTS codigo_verificacao text;
CREATE INDEX IF NOT EXISTS idx_medicoes_baseline ON public.medicoes(baseline_id);