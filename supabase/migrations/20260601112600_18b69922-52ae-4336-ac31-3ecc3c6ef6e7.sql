ALTER TABLE public.patrimonios ADD COLUMN IF NOT EXISTS sujo boolean NOT NULL DEFAULT false;
ALTER TABLE public.patrimonios ADD COLUMN IF NOT EXISTS em_manutencao boolean NOT NULL DEFAULT false;
ALTER TABLE public.veiculos ADD COLUMN IF NOT EXISTS sujo boolean NOT NULL DEFAULT false;
ALTER TABLE public.veiculos ADD COLUMN IF NOT EXISTS manutencao boolean NOT NULL DEFAULT false;