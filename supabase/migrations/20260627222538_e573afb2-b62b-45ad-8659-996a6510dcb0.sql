
CREATE TABLE public.cronograma_cenarios (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  obra_id UUID NOT NULL REFERENCES public.obras(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  descricao TEXT,
  criado_por UUID REFERENCES auth.users(id),
  status TEXT NOT NULL DEFAULT 'rascunho',
  aplicado_em TIMESTAMPTZ,
  aplicado_por UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_cenarios_obra ON public.cronograma_cenarios(obra_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cronograma_cenarios TO authenticated;
GRANT ALL ON public.cronograma_cenarios TO service_role;
ALTER TABLE public.cronograma_cenarios ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cenarios select" ON public.cronograma_cenarios FOR SELECT TO authenticated USING (true);
CREATE POLICY "cenarios insert" ON public.cronograma_cenarios FOR INSERT TO authenticated WITH CHECK (auth.uid() = criado_por OR public.current_is_gm());
CREATE POLICY "cenarios update" ON public.cronograma_cenarios FOR UPDATE TO authenticated USING (auth.uid() = criado_por OR public.current_is_gm());
CREATE POLICY "cenarios delete" ON public.cronograma_cenarios FOR DELETE TO authenticated USING (auth.uid() = criado_por OR public.current_is_gm());

CREATE TABLE public.cronograma_cenario_itens (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cenario_id UUID NOT NULL REFERENCES public.cronograma_cenarios(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES public.cronograma_itens(id) ON DELETE CASCADE,
  data_inicio_origem DATE NOT NULL,
  data_fim_origem DATE NOT NULL,
  data_inicio_sim DATE NOT NULL,
  data_fim_sim DATE NOT NULL,
  observacao TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(cenario_id, item_id)
);
CREATE INDEX idx_cenario_itens_cenario ON public.cronograma_cenario_itens(cenario_id);
CREATE INDEX idx_cenario_itens_item ON public.cronograma_cenario_itens(item_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cronograma_cenario_itens TO authenticated;
GRANT ALL ON public.cronograma_cenario_itens TO service_role;
ALTER TABLE public.cronograma_cenario_itens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cenario_itens select" ON public.cronograma_cenario_itens FOR SELECT TO authenticated USING (true);
CREATE POLICY "cenario_itens write" ON public.cronograma_cenario_itens FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.cronograma_cenarios c WHERE c.id = cenario_id AND (c.criado_por = auth.uid() OR public.current_is_gm())))
  WITH CHECK (EXISTS (SELECT 1 FROM public.cronograma_cenarios c WHERE c.id = cenario_id AND (c.criado_por = auth.uid() OR public.current_is_gm())));

CREATE TRIGGER trg_cenarios_updated_at BEFORE UPDATE ON public.cronograma_cenarios
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_cenario_itens_updated_at BEFORE UPDATE ON public.cronograma_cenario_itens
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
