
-- frota_abastecimentos
CREATE TABLE public.frota_abastecimentos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  veiculo_id TEXT,
  patrimonio_id TEXT,
  obra_id TEXT,
  data DATE NOT NULL,
  litros NUMERIC(12,3) NOT NULL CHECK (litros > 0),
  valor NUMERIC(14,2) NOT NULL CHECK (valor >= 0),
  odometro NUMERIC(14,2),
  horimetro NUMERIC(14,2),
  combustivel TEXT,
  posto TEXT,
  observacao TEXT,
  created_by UUID DEFAULT auth.uid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (veiculo_id IS NOT NULL OR patrimonio_id IS NOT NULL)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.frota_abastecimentos TO authenticated;
GRANT ALL ON public.frota_abastecimentos TO service_role;
ALTER TABLE public.frota_abastecimentos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "frota_abast read" ON public.frota_abastecimentos
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "frota_abast write" ON public.frota_abastecimentos
  FOR ALL TO authenticated
  USING (public.current_is_gm() OR public.current_has_setor('Producao') OR public.current_has_setor('Compras'))
  WITH CHECK (public.current_is_gm() OR public.current_has_setor('Producao') OR public.current_has_setor('Compras'));
CREATE INDEX idx_frota_abast_veiculo ON public.frota_abastecimentos(veiculo_id, data);
CREATE INDEX idx_frota_abast_patrim ON public.frota_abastecimentos(patrimonio_id, data);
CREATE INDEX idx_frota_abast_obra ON public.frota_abastecimentos(obra_id, data);

-- frota_manutencoes
CREATE TABLE public.frota_manutencoes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  veiculo_id TEXT,
  patrimonio_id TEXT,
  obra_id TEXT,
  tipo TEXT NOT NULL CHECK (tipo IN ('preventiva','corretiva')),
  data DATE NOT NULL,
  valor NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (valor >= 0),
  descricao TEXT,
  fornecedor TEXT,
  odometro NUMERIC(14,2),
  horimetro NUMERIC(14,2),
  proxima_preventiva_horimetro NUMERIC(14,2),
  proxima_preventiva_data DATE,
  created_by UUID DEFAULT auth.uid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (veiculo_id IS NOT NULL OR patrimonio_id IS NOT NULL)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.frota_manutencoes TO authenticated;
GRANT ALL ON public.frota_manutencoes TO service_role;
ALTER TABLE public.frota_manutencoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "frota_manut read" ON public.frota_manutencoes
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "frota_manut write" ON public.frota_manutencoes
  FOR ALL TO authenticated
  USING (public.current_is_gm() OR public.current_has_setor('Producao') OR public.current_has_setor('Compras'))
  WITH CHECK (public.current_is_gm() OR public.current_has_setor('Producao') OR public.current_has_setor('Compras'));
CREATE INDEX idx_frota_manut_veic ON public.frota_manutencoes(veiculo_id, data);
CREATE INDEX idx_frota_manut_patrim ON public.frota_manutencoes(patrimonio_id, data);
CREATE INDEX idx_frota_manut_obra ON public.frota_manutencoes(obra_id, data);

-- frota_apropriacao
CREATE TABLE public.frota_apropriacao (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  veiculo_id TEXT,
  patrimonio_id TEXT,
  obra_id TEXT NOT NULL,
  data_inicio DATE NOT NULL,
  data_fim DATE,
  custo_periodo NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (custo_periodo >= 0),
  tipo_custo TEXT NOT NULL DEFAULT 'aluguel' CHECK (tipo_custo IN ('aluguel','depreciacao','outro')),
  observacao TEXT,
  created_by UUID DEFAULT auth.uid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (veiculo_id IS NOT NULL OR patrimonio_id IS NOT NULL),
  CHECK (data_fim IS NULL OR data_fim >= data_inicio)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.frota_apropriacao TO authenticated;
GRANT ALL ON public.frota_apropriacao TO service_role;
ALTER TABLE public.frota_apropriacao ENABLE ROW LEVEL SECURITY;
CREATE POLICY "frota_aprop read" ON public.frota_apropriacao
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "frota_aprop write" ON public.frota_apropriacao
  FOR ALL TO authenticated
  USING (public.current_is_gm() OR public.current_has_setor('Producao') OR public.current_has_setor('Compras'))
  WITH CHECK (public.current_is_gm() OR public.current_has_setor('Producao') OR public.current_has_setor('Compras'));
CREATE INDEX idx_frota_aprop_obra ON public.frota_apropriacao(obra_id, data_inicio);
CREATE INDEX idx_frota_aprop_veic ON public.frota_apropriacao(veiculo_id);
CREATE INDEX idx_frota_aprop_patrim ON public.frota_apropriacao(patrimonio_id);

-- updated_at triggers
CREATE TRIGGER trg_frota_abast_updated_at BEFORE UPDATE ON public.frota_abastecimentos
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_frota_manut_updated_at BEFORE UPDATE ON public.frota_manutencoes
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_frota_aprop_updated_at BEFORE UPDATE ON public.frota_apropriacao
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
