-- 1. search_path fixo
ALTER FUNCTION public.pode_admin_board(uuid, uuid) SET search_path = public, private;
ALTER FUNCTION public.card_pode_editar(uuid) SET search_path = public, private;

-- 2. Revogar EXECUTE de PUBLIC/anon em todas as funções SECURITY DEFINER de public;
--    manter EXECUTE para authenticated apenas nas RPCs usadas pelo app.
DO $$
DECLARE
  r record;
  allowed text[] := ARRAY[
    'aprovar_orcamento_obra','board_atividades_recentes','board_reordenar',
    'card_entity_link_criar','card_entity_link_definir_principal','card_entity_link_remover',
    'card_entity_link_reordenar','card_entity_links_listar','cards_por_entidade',
    'criar_card_board_atomico','criar_medicao_atomica','emitir_oc_atomico',
    'excluir_nf_atomica','fechar_bms_atomica','fn_atualizar_cpm','fn_auto_arquivar_concluidos',
    'fn_estoque_transferir','fn_importar_faturamento_lote','fn_importar_financeiro_snapshot',
    'fn_importar_matriz','fn_lancamento_solicitacao_aprovada','fn_nc_notificar_prazos',
    'fn_oc_aprovar','fn_recalcular_apos_faturamento','fn_recalcular_previsao_nf',
    'fn_reverter_faturamento_bms','fn_reverter_revisao_cronograma',
    'fn_romaneio_confirmar_estoque','gm_query_performance','kanban_extensao_registrar_acao',
    'obras_upsert_lote','rdo_upsert_from_checklist','registrar_recebimento_atomico',
    'salvar_nf_atomica','user_pode_aprovar_medicao',
    'card_pode_ver','card_pode_editar','pode_admin_board','board_papel','board_items_resumo',
    'has_role','current_user_has_role','current_login','is_current_player_gm',
    'current_player_has_access','kanban_entidade_info'
  ];
  sig text;
BEGIN
  FOR r IN
    SELECT p.oid, p.proname, pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prokind = 'f' AND p.prosecdef
  LOOP
    sig := format('public.%I(%s)', r.proname, r.args);
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon', sig);
    IF r.proname = ANY (allowed) THEN
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', sig);
    ELSE
      EXECUTE format('REVOKE ALL ON FUNCTION %s FROM authenticated', sig);
    END IF;
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', sig);
  END LOOP;
END $$;

-- 3. aditivos_contrato: alterações/exclusões apenas em rascunho ou cancelado
DROP POLICY IF EXISTS "aditivos_contrato_auth_update" ON public.aditivos_contrato;
DROP POLICY IF EXISTS "aditivos_contrato_auth_delete" ON public.aditivos_contrato;

CREATE POLICY "aditivos_contrato_auth_update"
ON public.aditivos_contrato FOR UPDATE TO authenticated
USING (status IN ('rascunho'::aditivo_status, 'cancelado'::aditivo_status))
WITH CHECK (status IN ('rascunho'::aditivo_status, 'cancelado'::aditivo_status, 'aprovado'::aditivo_status));

-- 4. rollup/matriz financeira: leitura para autenticados, escrita apenas financeiro/gm
DROP POLICY IF EXISTS "fin_rollup_authenticated" ON public.financeiro_evolucao_rollup;
DROP POLICY IF EXISTS "fin_matriz_authenticated" ON public.financeiro_matriz_rateios;

DROP POLICY IF EXISTS "fin_rollup_select" ON public.financeiro_evolucao_rollup;
DROP POLICY IF EXISTS "fin_rollup_write" ON public.financeiro_evolucao_rollup;
DROP POLICY IF EXISTS "fin_matriz_select" ON public.financeiro_matriz_rateios;
DROP POLICY IF EXISTS "fin_matriz_write" ON public.financeiro_matriz_rateios;

CREATE POLICY "fin_rollup_select" ON public.financeiro_evolucao_rollup
FOR SELECT TO authenticated USING (true);

CREATE POLICY "fin_rollup_write" ON public.financeiro_evolucao_rollup
FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'financeiro'::app_role) OR public.has_role(auth.uid(), 'gm'::app_role) OR private.current_player_has_access('financeiro'))
WITH CHECK (public.has_role(auth.uid(), 'financeiro'::app_role) OR public.has_role(auth.uid(), 'gm'::app_role) OR private.current_player_has_access('financeiro'));

CREATE POLICY "fin_matriz_select" ON public.financeiro_matriz_rateios
FOR SELECT TO authenticated USING (true);

CREATE POLICY "fin_matriz_write" ON public.financeiro_matriz_rateios
FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'financeiro'::app_role) OR public.has_role(auth.uid(), 'gm'::app_role) OR private.current_player_has_access('financeiro'))
WITH CHECK (public.has_role(auth.uid(), 'financeiro'::app_role) OR public.has_role(auth.uid(), 'gm'::app_role) OR private.current_player_has_access('financeiro'));