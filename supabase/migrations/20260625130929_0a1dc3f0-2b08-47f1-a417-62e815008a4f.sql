CREATE TABLE IF NOT EXISTS public.obra_localizacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  obra_id uuid NOT NULL REFERENCES public.obras(id) ON DELETE CASCADE,
  nome text NOT NULL,
  ordem integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_obra_loc ON public.obra_localizacoes(obra_id, ordem);

REVOKE ALL ON public.obra_localizacoes FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.obra_localizacoes TO authenticated;
GRANT ALL ON public.obra_localizacoes TO service_role;

ALTER TABLE public.obra_localizacoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "obra_loc read" ON public.obra_localizacoes
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "obra_loc write" ON public.obra_localizacoes
  FOR ALL TO authenticated
  USING (public.current_is_gm() OR public.current_has_setor('Engenharia'))
  WITH CHECK (public.current_is_gm() OR public.current_has_setor('Engenharia'));

ALTER TABLE public.cronograma_itens
  ADD COLUMN IF NOT EXISTS localizacao_id uuid REFERENCES public.obra_localizacoes(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS servico_lob text;

CREATE INDEX IF NOT EXISTS idx_crono_itens_loc ON public.cronograma_itens(localizacao_id);
CREATE INDEX IF NOT EXISTS idx_crono_itens_lob ON public.cronograma_itens(obra_id, servico_lob);