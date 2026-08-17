
-- ============================================================
-- Fase 5B.1 — Last Planner System: schema + RLS
-- ============================================================

CREATE TABLE public.causas_nao_conclusao (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  chave TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  categoria TEXT,
  ordem INTEGER NOT NULL DEFAULT 0,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.causas_nao_conclusao TO authenticated;
GRANT ALL ON public.causas_nao_conclusao TO service_role;
ALTER TABLE public.causas_nao_conclusao ENABLE ROW LEVEL SECURITY;
CREATE POLICY "causas_select_auth" ON public.causas_nao_conclusao FOR SELECT TO authenticated USING (true);
CREATE POLICY "causas_write_auth" ON public.causas_nao_conclusao FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

INSERT INTO public.causas_nao_conclusao (chave, label, categoria, ordem) VALUES
  ('mao_obra', 'Mão de obra', 'interno', 1),
  ('material', 'Material', 'suprimentos', 2),
  ('equipamento', 'Equipamento', 'interno', 3),
  ('projeto', 'Projeto', 'engenharia', 4),
  ('pre_requisito', 'Pré-requisito (atividade anterior)', 'planejamento', 5),
  ('clima', 'Clima', 'externo', 6),
  ('cliente', 'Cliente', 'externo', 7),
  ('planejamento', 'Planejamento', 'planejamento', 8);

CREATE TABLE public.pacotes_trabalho (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  obra_id UUID NOT NULL REFERENCES public.obras(id) ON DELETE CASCADE,
  cronograma_item_id UUID REFERENCES public.cronograma_itens(id) ON DELETE SET NULL,
  descricao TEXT NOT NULL,
  responsavel_id UUID,
  semana_inicio DATE NOT NULL,
  semana_fim DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'planejado',
  tamanho_estimado NUMERIC,
  unidade TEXT,
  criterio_conclusao TEXT,
  owner_id UUID NOT NULL DEFAULT auth.uid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT pacotes_status_chk CHECK (status IN ('planejado','comprometido','concluido','cancelado'))
);
CREATE INDEX idx_pacotes_obra_semana ON public.pacotes_trabalho (obra_id, semana_inicio);
CREATE INDEX idx_pacotes_crono ON public.pacotes_trabalho (cronograma_item_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pacotes_trabalho TO authenticated;
GRANT ALL ON public.pacotes_trabalho TO service_role;
ALTER TABLE public.pacotes_trabalho ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pacotes_select_auth" ON public.pacotes_trabalho FOR SELECT TO authenticated USING (true);
CREATE POLICY "pacotes_write_auth" ON public.pacotes_trabalho FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE TRIGGER trg_pacotes_touch BEFORE UPDATE ON public.pacotes_trabalho FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.restricoes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  obra_id UUID NOT NULL REFERENCES public.obras(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL,
  descricao TEXT NOT NULL,
  responsavel_id UUID,
  prazo DATE,
  status TEXT NOT NULL DEFAULT 'aberta',
  resolvida_em TIMESTAMPTZ,
  card_id UUID REFERENCES public.cards(id) ON DELETE SET NULL,
  requisicao_id UUID REFERENCES public.requisicoes(id) ON DELETE SET NULL,
  observacao TEXT,
  owner_id UUID NOT NULL DEFAULT auth.uid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT restricoes_status_chk CHECK (status IN ('aberta','resolvida','cancelada')),
  CONSTRAINT restricoes_tipo_chk CHECK (tipo IN ('projeto','material','mao_obra','equipamento','area','seguranca','contrato','outro'))
);
CREATE INDEX idx_restricoes_obra_status ON public.restricoes (obra_id, status);
CREATE INDEX idx_restricoes_prazo ON public.restricoes (prazo) WHERE status = 'aberta';
GRANT SELECT, INSERT, UPDATE, DELETE ON public.restricoes TO authenticated;
GRANT ALL ON public.restricoes TO service_role;
ALTER TABLE public.restricoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "restricoes_select_auth" ON public.restricoes FOR SELECT TO authenticated USING (true);
CREATE POLICY "restricoes_write_auth" ON public.restricoes FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE TRIGGER trg_restricoes_touch BEFORE UPDATE ON public.restricoes FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE OR REPLACE FUNCTION public.fn_restricao_resolvida()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.status = 'resolvida' AND (OLD.status IS DISTINCT FROM 'resolvida') AND NEW.resolvida_em IS NULL THEN
    NEW.resolvida_em := now();
  ELSIF NEW.status <> 'resolvida' THEN
    NEW.resolvida_em := NULL;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_restricao_resolvida BEFORE UPDATE ON public.restricoes
  FOR EACH ROW EXECUTE FUNCTION public.fn_restricao_resolvida();

CREATE TABLE public.pacote_restricoes (
  pacote_id UUID NOT NULL REFERENCES public.pacotes_trabalho(id) ON DELETE CASCADE,
  restricao_id UUID NOT NULL REFERENCES public.restricoes(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (pacote_id, restricao_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pacote_restricoes TO authenticated;
GRANT ALL ON public.pacote_restricoes TO service_role;
ALTER TABLE public.pacote_restricoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pacote_restricoes_select_auth" ON public.pacote_restricoes FOR SELECT TO authenticated USING (true);
CREATE POLICY "pacote_restricoes_write_auth" ON public.pacote_restricoes FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

CREATE TABLE public.compromissos_semanais (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  pacote_id UUID NOT NULL REFERENCES public.pacotes_trabalho(id) ON DELETE CASCADE,
  obra_id UUID NOT NULL REFERENCES public.obras(id) ON DELETE CASCADE,
  semana_inicio DATE NOT NULL,
  comprometido_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  concluido BOOLEAN NOT NULL DEFAULT false,
  concluido_em TIMESTAMPTZ,
  causa_chave TEXT REFERENCES public.causas_nao_conclusao(chave) ON DELETE SET NULL,
  causa_detalhe TEXT,
  owner_id UUID NOT NULL DEFAULT auth.uid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (pacote_id, semana_inicio)
);
CREATE INDEX idx_compromissos_obra_semana ON public.compromissos_semanais (obra_id, semana_inicio);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.compromissos_semanais TO authenticated;
GRANT ALL ON public.compromissos_semanais TO service_role;
ALTER TABLE public.compromissos_semanais ENABLE ROW LEVEL SECURITY;
CREATE POLICY "compromissos_select_auth" ON public.compromissos_semanais FOR SELECT TO authenticated USING (true);
CREATE POLICY "compromissos_write_auth" ON public.compromissos_semanais FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE TRIGGER trg_compromissos_touch BEFORE UPDATE ON public.compromissos_semanais FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
