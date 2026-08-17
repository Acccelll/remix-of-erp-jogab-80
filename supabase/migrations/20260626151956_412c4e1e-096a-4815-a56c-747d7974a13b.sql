
CREATE TABLE public.contratos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  obra_id UUID NOT NULL REFERENCES public.obras(id) ON DELETE CASCADE,
  fornecedor_id UUID REFERENCES public.fornecedores(id) ON DELETE SET NULL,
  numero TEXT NOT NULL,
  objeto TEXT NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('material','servico','mao_obra')),
  valor NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (valor >= 0),
  data_inicio DATE,
  data_fim DATE,
  status TEXT NOT NULL DEFAULT 'ativo' CHECK (status IN ('rascunho','ativo','suspenso','encerrado','cancelado')),
  observacao TEXT,
  created_by UUID DEFAULT auth.uid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.contratos TO authenticated;
GRANT ALL ON public.contratos TO service_role;
ALTER TABLE public.contratos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "contratos read" ON public.contratos
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "contratos write" ON public.contratos
  FOR ALL TO authenticated
  USING (public.current_is_gm() OR public.current_has_setor('Contratos') OR public.current_has_setor('Compras'))
  WITH CHECK (public.current_is_gm() OR public.current_has_setor('Contratos') OR public.current_has_setor('Compras'));
CREATE INDEX idx_contratos_obra ON public.contratos(obra_id);
CREATE INDEX idx_contratos_fornecedor ON public.contratos(fornecedor_id);
CREATE TRIGGER trg_contratos_updated_at BEFORE UPDATE ON public.contratos
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.contrato_medicoes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  contrato_id UUID NOT NULL REFERENCES public.contratos(id) ON DELETE CASCADE,
  numero INT,
  data_corte DATE NOT NULL,
  percentual NUMERIC(7,4) NOT NULL DEFAULT 0 CHECK (percentual >= 0 AND percentual <= 100),
  valor NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (valor >= 0),
  status TEXT NOT NULL DEFAULT 'rascunho' CHECK (status IN ('rascunho','aprovada','faturada','cancelada')),
  observacao TEXT,
  created_by UUID DEFAULT auth.uid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.contrato_medicoes TO authenticated;
GRANT ALL ON public.contrato_medicoes TO service_role;
ALTER TABLE public.contrato_medicoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "contrato_medicoes read" ON public.contrato_medicoes
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "contrato_medicoes write" ON public.contrato_medicoes
  FOR ALL TO authenticated
  USING (public.current_is_gm() OR public.current_has_setor('Contratos') OR public.current_has_setor('Compras'))
  WITH CHECK (public.current_is_gm() OR public.current_has_setor('Contratos') OR public.current_has_setor('Compras'));
CREATE INDEX idx_contrato_medicoes_contrato ON public.contrato_medicoes(contrato_id, data_corte);
CREATE TRIGGER trg_contrato_medicoes_updated_at BEFORE UPDATE ON public.contrato_medicoes
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- aditivos_contrato.contrato_id (nullable, migração suave)
ALTER TABLE public.aditivos_contrato
  ADD COLUMN contrato_id UUID REFERENCES public.contratos(id) ON DELETE SET NULL;
CREATE INDEX idx_aditivos_contrato_contrato ON public.aditivos_contrato(contrato_id);
