
CREATE TABLE public.inspecao_qr_alvos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  obra_id UUID NOT NULL REFERENCES public.obras(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL CHECK (tipo IN ('frente','equipamento','local','outro')),
  codigo TEXT NOT NULL,
  nome TEXT NOT NULL,
  local TEXT,
  modelo_id UUID REFERENCES public.inspecao_modelos(id) ON DELETE SET NULL,
  ativa BOOLEAN NOT NULL DEFAULT TRUE,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (obra_id, codigo)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.inspecao_qr_alvos TO authenticated;
GRANT ALL ON public.inspecao_qr_alvos TO service_role;

ALTER TABLE public.inspecao_qr_alvos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read qr alvos"
  ON public.inspecao_qr_alvos FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated insert qr alvos"
  ON public.inspecao_qr_alvos FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated update qr alvos"
  ON public.inspecao_qr_alvos FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated delete qr alvos"
  ON public.inspecao_qr_alvos FOR DELETE TO authenticated USING (true);

CREATE TRIGGER trg_inspecao_qr_alvos_touch
  BEFORE UPDATE ON public.inspecao_qr_alvos
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE INDEX idx_inspecao_qr_alvos_obra ON public.inspecao_qr_alvos(obra_id, ativa);
