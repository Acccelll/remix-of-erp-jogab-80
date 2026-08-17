-- Lote 3: Financeiro & Comercial RLS
-- Helper: user has financeiro sector
CREATE OR REPLACE FUNCTION public.current_has_setor(p_setor text)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.current_is_gm() OR p_setor = ANY(public.current_setores());
$$;

-- Tables in lote 3
DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'financeiro_lancamentos','financeiro_rateios','financeiro_snapshots',
    'financeiro_matriz_rateios','financeiro_evolucao_rollup',
    'faturamento_nfse','notas_fiscais','medicoes','itens_medicao',
    'bms_previstas','bms_redistribuicao',
    'clientes','plano_contas','centros_custo_totvs',
    'recebimentos','solicitacoes_financeiras','solicitacao_comentarios',
    'formas_pagamento'
  ];
  pol record;
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format('REVOKE ALL ON public.%I FROM anon', t);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
    -- drop existing policies
    FOR pol IN SELECT polname FROM pg_policy WHERE polrelid = format('public.%I', t)::regclass LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol.polname, t);
    END LOOP;
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
  END LOOP;
END$$;

-- SELECT for authenticated, write for GM or financeiro sector
-- financeiro_lancamentos
CREATE POLICY "fin_lanc_select" ON public.financeiro_lancamentos FOR SELECT TO authenticated USING (true);
CREATE POLICY "fin_lanc_write"  ON public.financeiro_lancamentos FOR ALL TO authenticated USING (public.current_has_setor('financeiro')) WITH CHECK (public.current_has_setor('financeiro'));

CREATE POLICY "fin_rat_select" ON public.financeiro_rateios FOR SELECT TO authenticated USING (true);
CREATE POLICY "fin_rat_write"  ON public.financeiro_rateios FOR ALL TO authenticated USING (public.current_has_setor('financeiro')) WITH CHECK (public.current_has_setor('financeiro'));

CREATE POLICY "fin_snap_select" ON public.financeiro_snapshots FOR SELECT TO authenticated USING (true);
CREATE POLICY "fin_snap_write"  ON public.financeiro_snapshots FOR ALL TO authenticated USING (public.current_has_setor('financeiro')) WITH CHECK (public.current_has_setor('financeiro'));

CREATE POLICY "fin_matriz_select" ON public.financeiro_matriz_rateios FOR SELECT TO authenticated USING (true);
CREATE POLICY "fin_matriz_write"  ON public.financeiro_matriz_rateios FOR ALL TO authenticated USING (public.current_has_setor('financeiro')) WITH CHECK (public.current_has_setor('financeiro'));

CREATE POLICY "fin_roll_select" ON public.financeiro_evolucao_rollup FOR SELECT TO authenticated USING (true);
CREATE POLICY "fin_roll_write"  ON public.financeiro_evolucao_rollup FOR ALL TO authenticated USING (public.current_has_setor('financeiro')) WITH CHECK (public.current_has_setor('financeiro'));

CREATE POLICY "fat_nfse_select" ON public.faturamento_nfse FOR SELECT TO authenticated USING (true);
CREATE POLICY "fat_nfse_write"  ON public.faturamento_nfse FOR ALL TO authenticated USING (public.current_has_setor('financeiro')) WITH CHECK (public.current_has_setor('financeiro'));

CREATE POLICY "nf_select" ON public.notas_fiscais FOR SELECT TO authenticated USING (true);
CREATE POLICY "nf_write"  ON public.notas_fiscais FOR ALL TO authenticated USING (public.current_has_setor('financeiro')) WITH CHECK (public.current_has_setor('financeiro'));

CREATE POLICY "med_select" ON public.medicoes FOR SELECT TO authenticated USING (true);
CREATE POLICY "med_write"  ON public.medicoes FOR ALL TO authenticated USING (public.current_has_setor('financeiro')) WITH CHECK (public.current_has_setor('financeiro'));

CREATE POLICY "itmed_select" ON public.itens_medicao FOR SELECT TO authenticated USING (true);
CREATE POLICY "itmed_write"  ON public.itens_medicao FOR ALL TO authenticated USING (public.current_has_setor('financeiro')) WITH CHECK (public.current_has_setor('financeiro'));

CREATE POLICY "bmsprev_select" ON public.bms_previstas FOR SELECT TO authenticated USING (true);
CREATE POLICY "bmsprev_write"  ON public.bms_previstas FOR ALL TO authenticated USING (public.current_has_setor('financeiro')) WITH CHECK (public.current_has_setor('financeiro'));

CREATE POLICY "bmsred_select" ON public.bms_redistribuicao FOR SELECT TO authenticated USING (true);
CREATE POLICY "bmsred_write"  ON public.bms_redistribuicao FOR ALL TO authenticated USING (public.current_has_setor('financeiro')) WITH CHECK (public.current_has_setor('financeiro'));

CREATE POLICY "cli_select" ON public.clientes FOR SELECT TO authenticated USING (true);
CREATE POLICY "cli_write"  ON public.clientes FOR ALL TO authenticated USING (public.current_has_setor('financeiro')) WITH CHECK (public.current_has_setor('financeiro'));

CREATE POLICY "pc_select" ON public.plano_contas FOR SELECT TO authenticated USING (true);
CREATE POLICY "pc_write"  ON public.plano_contas FOR ALL TO authenticated USING (public.current_is_gm()) WITH CHECK (public.current_is_gm());

CREATE POLICY "cct_select" ON public.centros_custo_totvs FOR SELECT TO authenticated USING (true);
CREATE POLICY "cct_write"  ON public.centros_custo_totvs FOR ALL TO authenticated USING (public.current_has_setor('financeiro')) WITH CHECK (public.current_has_setor('financeiro'));

CREATE POLICY "receb_select" ON public.recebimentos FOR SELECT TO authenticated USING (true);
CREATE POLICY "receb_write"  ON public.recebimentos FOR ALL TO authenticated USING (public.current_has_setor('financeiro')) WITH CHECK (public.current_has_setor('financeiro'));

-- solicitacoes_financeiras: authenticated can create their own; GM/financeiro full
CREATE POLICY "solfin_select" ON public.solicitacoes_financeiras FOR SELECT TO authenticated USING (true);
CREATE POLICY "solfin_insert" ON public.solicitacoes_financeiras FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "solfin_update" ON public.solicitacoes_financeiras FOR UPDATE TO authenticated USING (public.current_has_setor('financeiro')) WITH CHECK (public.current_has_setor('financeiro'));
CREATE POLICY "solfin_delete" ON public.solicitacoes_financeiras FOR DELETE TO authenticated USING (public.current_is_gm());

-- solicitacao_comentarios: anyone authenticated can read/write
CREATE POLICY "solcom_select" ON public.solicitacao_comentarios FOR SELECT TO authenticated USING (true);
CREATE POLICY "solcom_insert" ON public.solicitacao_comentarios FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "solcom_update" ON public.solicitacao_comentarios FOR UPDATE TO authenticated USING (public.current_is_gm()) WITH CHECK (public.current_is_gm());
CREATE POLICY "solcom_delete" ON public.solicitacao_comentarios FOR DELETE TO authenticated USING (public.current_is_gm());

CREATE POLICY "fp_select" ON public.formas_pagamento FOR SELECT TO authenticated USING (true);
CREATE POLICY "fp_write"  ON public.formas_pagamento FOR ALL TO authenticated USING (public.current_is_gm()) WITH CHECK (public.current_is_gm());
