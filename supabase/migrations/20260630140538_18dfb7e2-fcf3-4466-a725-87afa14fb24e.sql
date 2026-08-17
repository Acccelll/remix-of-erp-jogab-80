-- H1: visibilidade de seções por card (Trello "Add to card")
CREATE TABLE IF NOT EXISTS public.card_secoes_visiveis (
  card_id      uuid NOT NULL REFERENCES public.cards(id) ON DELETE CASCADE,
  secao        text NOT NULL,
  criado_em    timestamptz NOT NULL DEFAULT now(),
  criado_por   uuid,
  CONSTRAINT card_secoes_visiveis_pk PRIMARY KEY (card_id, secao),
  CONSTRAINT card_secoes_visiveis_secao_chk CHECK (
    secao IN ('datas','etiquetas','checklist','membros','anexos','local','lembrete','campos_custom','cronograma')
  )
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.card_secoes_visiveis TO authenticated;
GRANT ALL ON public.card_secoes_visiveis TO service_role;

ALTER TABLE public.card_secoes_visiveis ENABLE ROW LEVEL SECURITY;

-- Mesma regra do card: quem enxerga o card enxerga/gerencia suas seções.
DROP POLICY IF EXISTS card_secoes_visiveis_select ON public.card_secoes_visiveis;
CREATE POLICY card_secoes_visiveis_select ON public.card_secoes_visiveis
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.cards c WHERE c.id = card_id));

DROP POLICY IF EXISTS card_secoes_visiveis_write ON public.card_secoes_visiveis;
CREATE POLICY card_secoes_visiveis_write ON public.card_secoes_visiveis
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.cards c WHERE c.id = card_id))
  WITH CHECK (EXISTS (SELECT 1 FROM public.cards c WHERE c.id = card_id));

CREATE INDEX IF NOT EXISTS idx_card_secoes_visiveis_card ON public.card_secoes_visiveis(card_id);