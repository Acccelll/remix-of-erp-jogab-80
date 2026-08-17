
-- Lote 4: RH/DP sensível — leitura company-wide; escrita restrita a GM ou setor 'rh'.

-- Helper: 15 tabelas
-- Tabelas operacionais RH/DP (escrita: GM ou setor 'rh')
DO $$
DECLARE t text;
DECLARE tables text[] := ARRAY[
  'colaboradores','dp_holerite','fopag_entries','horas_extras',
  'decimo_terceiro','historico_salarial','custo_colaborador_competencia',
  'ponto_registros','ponto_importacoes','ponto_tratativas',
  'mobilizacoes_periodos','mobilizacoes_veiculos','responsabilidades_patrimonios'
];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format('REVOKE ALL ON public.%I FROM anon', t);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
  END LOOP;
END $$;

-- Drop old USING(true) policies
DROP POLICY IF EXISTS "Allow all access to colaboradores" ON public.colaboradores;
DROP POLICY IF EXISTS "dp_holerite full access" ON public.dp_holerite;
DROP POLICY IF EXISTS "Public access fopag" ON public.fopag_entries;
DROP POLICY IF EXISTS "Public access horas_extras" ON public.horas_extras;
DROP POLICY IF EXISTS "Public access decimo" ON public.decimo_terceiro;
DROP POLICY IF EXISTS "Public access historico" ON public.historico_salarial;
DROP POLICY IF EXISTS "auth full access custo_colaborador_competencia" ON public.custo_colaborador_competencia;
DROP POLICY IF EXISTS "Allow all access to ponto_registros" ON public.ponto_registros;
DROP POLICY IF EXISTS "Allow all access to ponto_importacoes" ON public.ponto_importacoes;
DROP POLICY IF EXISTS "Allow all access to ponto_tratativas" ON public.ponto_tratativas;
DROP POLICY IF EXISTS "Public access mobilizacoes_periodos" ON public.mobilizacoes_periodos;
DROP POLICY IF EXISTS "Allow all access to mobilizacoes_veiculos" ON public.mobilizacoes_veiculos;
DROP POLICY IF EXISTS "Acesso público responsabilidades_patrimonios" ON public.responsabilidades_patrimonios;

-- Policies for 13 operational RH tables: SELECT all authenticated, ALL for GM or setor 'rh'
DO $$
DECLARE t text;
DECLARE tables text[] := ARRAY[
  'colaboradores','dp_holerite','fopag_entries','horas_extras',
  'decimo_terceiro','historico_salarial','custo_colaborador_competencia',
  'ponto_registros','ponto_importacoes','ponto_tratativas',
  'mobilizacoes_periodos','mobilizacoes_veiculos','responsabilidades_patrimonios'
];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (true)', t||' read all', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING (public.current_has_setor(''rh'')) WITH CHECK (public.current_has_setor(''rh''))', t||' write rh', t);
  END LOOP;
END $$;

-- Lookups (funcoes, documento_tipos): SELECT all, write GM only
REVOKE ALL ON public.funcoes FROM anon;
REVOKE ALL ON public.documento_tipos FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.funcoes TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.documento_tipos TO authenticated;
GRANT ALL ON public.funcoes TO service_role;
GRANT ALL ON public.documento_tipos TO service_role;
ALTER TABLE public.funcoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documento_tipos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all access to funcoes" ON public.funcoes;
DROP POLICY IF EXISTS "Allow all access to documento_tipos" ON public.documento_tipos;

CREATE POLICY "funcoes read all" ON public.funcoes FOR SELECT TO authenticated USING (true);
CREATE POLICY "funcoes write gm" ON public.funcoes FOR ALL TO authenticated USING (public.current_is_gm()) WITH CHECK (public.current_is_gm());

CREATE POLICY "documento_tipos read all" ON public.documento_tipos FOR SELECT TO authenticated USING (true);
CREATE POLICY "documento_tipos write gm" ON public.documento_tipos FOR ALL TO authenticated USING (public.current_is_gm()) WITH CHECK (public.current_is_gm());
