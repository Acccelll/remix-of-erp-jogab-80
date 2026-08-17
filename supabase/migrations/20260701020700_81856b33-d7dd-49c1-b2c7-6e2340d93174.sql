
DO $$
DECLARE t text;
DECLARE tables text[] := ARRAY[
  'colaboradores','custo_colaborador_competencia','decimo_terceiro',
  'dp_holerite','fopag_entries','historico_salarial','horas_extras',
  'ponto_importacoes','ponto_registros','ponto_tratativas','provisoes'
];
DECLARE pol text;
BEGIN
  FOREACH t IN ARRAY tables LOOP
    -- descobrir e derrubar policies SELECT com USING true
    FOR pol IN
      SELECT policyname FROM pg_policies
      WHERE schemaname='public' AND tablename=t AND cmd='SELECT' AND qual='true'
    LOOP
      EXECUTE format('DROP POLICY %I ON public.%I', pol, t);
    END LOOP;
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (public.current_is_gm() OR public.current_has_setor(''rh''))',
      t || '_select_rh', t
    );
  END LOOP;
END $$;
