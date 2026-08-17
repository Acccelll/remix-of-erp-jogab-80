
DO $$
DECLARE t text;
DECLARE tables text[] := ARRAY[
  'financeiro_lancamentos','financeiro_rateios','financeiro_snapshots',
  'financeiro_matriz_rateios','financeiro_evolucao_rollup',
  'faturamento_nfse','notas_fiscais','aditivos_contrato'
];
DECLARE pol text;
BEGIN
  FOREACH t IN ARRAY tables LOOP
    FOR pol IN
      SELECT policyname FROM pg_policies
      WHERE schemaname='public' AND tablename=t AND cmd='SELECT' AND qual='true'
    LOOP
      EXECUTE format('DROP POLICY %I ON public.%I', pol, t);
    END LOOP;
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (public.current_is_gm() OR public.current_has_setor(''financeiro''))',
      t || '_select_fin', t
    );
  END LOOP;
END $$;
