
-- card_membros: múltiplos membros por card (além do responsável)
CREATE TABLE IF NOT EXISTS public.card_membros (
  card_id uuid NOT NULL REFERENCES public.cards(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (card_id, user_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.card_membros TO authenticated;
GRANT ALL ON public.card_membros TO service_role;

ALTER TABLE public.card_membros ENABLE ROW LEVEL SECURITY;

CREATE POLICY "card_membros select por acesso"
  ON public.card_membros FOR SELECT TO authenticated
  USING (public.has_card_access(card_id));

CREATE POLICY "card_membros insert por acesso"
  ON public.card_membros FOR INSERT TO authenticated
  WITH CHECK (public.has_card_access(card_id));

CREATE POLICY "card_membros delete por acesso"
  ON public.card_membros FOR DELETE TO authenticated
  USING (public.has_card_access(card_id));

-- Checklist itens: responsável e prazo opcionais por item
ALTER TABLE public.card_checklist_itens
  ADD COLUMN IF NOT EXISTS responsavel_id uuid,
  ADD COLUMN IF NOT EXISTS prazo date;
