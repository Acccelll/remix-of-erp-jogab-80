
-- riscos: links e auditoria
ALTER TABLE public.riscos
  ADD COLUMN IF NOT EXISTS card_id uuid REFERENCES public.cards(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS data_identificacao date DEFAULT CURRENT_DATE,
  ADD COLUMN IF NOT EXISTS owner_id uuid;

CREATE INDEX IF NOT EXISTS idx_riscos_card_id ON public.riscos(card_id);
CREATE INDEX IF NOT EXISTS idx_riscos_obra_id ON public.riscos(obra_id);

-- licoes_aprendidas: links, autoria, tags e timestamps
ALTER TABLE public.licoes_aprendidas
  ADD COLUMN IF NOT EXISTS risco_id uuid REFERENCES public.riscos(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS card_id uuid REFERENCES public.cards(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS responsavel text,
  ADD COLUMN IF NOT EXISTS tags text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS data_registro date NOT NULL DEFAULT CURRENT_DATE,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_licoes_obra_id ON public.licoes_aprendidas(obra_id);
CREATE INDEX IF NOT EXISTS idx_licoes_risco_id ON public.licoes_aprendidas(risco_id);
CREATE INDEX IF NOT EXISTS idx_licoes_tags ON public.licoes_aprendidas USING GIN(tags);

DROP TRIGGER IF EXISTS trg_touch_licoes_aprendidas ON public.licoes_aprendidas;
CREATE TRIGGER trg_touch_licoes_aprendidas
BEFORE UPDATE ON public.licoes_aprendidas
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
