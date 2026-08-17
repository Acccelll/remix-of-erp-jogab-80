
-- Phase 2: Add empresa_id to obras and contratos with backfill

-- 1. obras.empresa_id
ALTER TABLE public.obras
  ADD COLUMN IF NOT EXISTS empresa_id uuid REFERENCES public.empresas(id) ON DELETE RESTRICT;

UPDATE public.obras
   SET empresa_id = 'd9c3672d-0b07-4812-9b9d-d25f2d2d175d'::uuid
 WHERE empresa_id IS NULL;

ALTER TABLE public.obras
  ALTER COLUMN empresa_id SET NOT NULL,
  ALTER COLUMN empresa_id SET DEFAULT 'd9c3672d-0b07-4812-9b9d-d25f2d2d175d'::uuid;

CREATE INDEX IF NOT EXISTS idx_obras_empresa_id ON public.obras(empresa_id);

-- 2. contratos.empresa_id (herda da obra via trigger quando nulo)
ALTER TABLE public.contratos
  ADD COLUMN IF NOT EXISTS empresa_id uuid REFERENCES public.empresas(id) ON DELETE RESTRICT;

UPDATE public.contratos c
   SET empresa_id = o.empresa_id
  FROM public.obras o
 WHERE c.obra_id = o.id
   AND c.empresa_id IS NULL;

UPDATE public.contratos
   SET empresa_id = 'd9c3672d-0b07-4812-9b9d-d25f2d2d175d'::uuid
 WHERE empresa_id IS NULL;

ALTER TABLE public.contratos
  ALTER COLUMN empresa_id SET NOT NULL,
  ALTER COLUMN empresa_id SET DEFAULT 'd9c3672d-0b07-4812-9b9d-d25f2d2d175d'::uuid;

CREATE INDEX IF NOT EXISTS idx_contratos_empresa_id ON public.contratos(empresa_id);

-- 3. Trigger: contrato herda empresa_id da obra quando inserido sem empresa_id explícito
CREATE OR REPLACE FUNCTION public.fn_contrato_herda_empresa()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.empresa_id IS NULL AND NEW.obra_id IS NOT NULL THEN
    SELECT empresa_id INTO NEW.empresa_id FROM public.obras WHERE id = NEW.obra_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_contrato_herda_empresa ON public.contratos;
CREATE TRIGGER trg_contrato_herda_empresa
  BEFORE INSERT OR UPDATE OF obra_id ON public.contratos
  FOR EACH ROW EXECUTE FUNCTION public.fn_contrato_herda_empresa();
