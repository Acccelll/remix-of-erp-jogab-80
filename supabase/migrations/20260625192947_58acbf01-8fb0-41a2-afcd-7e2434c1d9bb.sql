
CREATE TABLE IF NOT EXISTS public.card_views_salvas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  setor text NOT NULL,
  filtros jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_card_views_salvas_setor ON public.card_views_salvas(setor);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.card_views_salvas TO authenticated;
GRANT ALL ON public.card_views_salvas TO service_role;

ALTER TABLE public.card_views_salvas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "views salvas select por setor"
  ON public.card_views_salvas FOR SELECT TO authenticated
  USING (public.current_is_gm() OR setor = ANY(public.current_setores()));

CREATE POLICY "views salvas insert por setor"
  ON public.card_views_salvas FOR INSERT TO authenticated
  WITH CHECK (public.current_is_gm() OR setor = ANY(public.current_setores()));

CREATE POLICY "views salvas delete por setor"
  ON public.card_views_salvas FOR DELETE TO authenticated
  USING (public.current_is_gm() OR setor = ANY(public.current_setores()));
