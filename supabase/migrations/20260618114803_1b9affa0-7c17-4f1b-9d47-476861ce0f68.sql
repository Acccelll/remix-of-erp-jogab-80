ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS owner_id uuid;
ALTER TABLE public.obras ADD COLUMN IF NOT EXISTS owner_id uuid;
ALTER TABLE public.obras ADD COLUMN IF NOT EXISTS prazo_emitir_nf_dias integer;
ALTER TABLE public.financeiro_snapshots ADD COLUMN IF NOT EXISTS owner_id uuid;
ALTER TABLE public.notas_fiscais ADD COLUMN IF NOT EXISTS competencia date;