DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'empresas','user_empresas','boards','board_listas','card_grupos_negociacao','cards',
    'card_board_posicao','card_setores','card_labels','card_label_links','card_checklist_itens',
    'card_comentarios','card_atividades','card_anexos','board_campos','card_custom_field_valores',
    'board_membros','card_views_salvas','card_membros_externos','card_recursos','card_membros',
    'card_secoes_visiveis','card_local','card_campos_valores'
  ] LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_auth_select', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_auth_insert', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_auth_update', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_auth_delete', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_auth_all', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL)', t || '_auth_select', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL)', t || '_auth_insert', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL)', t || '_auth_update', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR DELETE TO authenticated USING (auth.uid() IS NOT NULL)', t || '_auth_delete', t);
  END LOOP;
END $$;