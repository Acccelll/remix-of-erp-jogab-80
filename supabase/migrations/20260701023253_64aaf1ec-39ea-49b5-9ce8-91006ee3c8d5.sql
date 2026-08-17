DO $$
DECLARE r record;
DECLARE fn_list text[] := ARRAY[
  '_ensure_card_board_posicao','card_setores_auto_board_posicao','cards_auto_board_posicao',
  'cards_sync_from_cronograma','fn_audit_row','fn_cards_automacoes','fn_checklist_completo_notifica',
  'fn_contrato_herda_empresa','fn_nc_detect_reincidencia','fn_nc_notify_assignment',
  'fn_oc_atualizar_valor_oc','fn_sync_lancamentos_on_centro_change','fn_sync_medicao_para_bms_prevista',
  'trg_card_recursos_sync_crono','trg_cards_sync_crono','trg_notificar_novo_comentario',
  'trg_notificar_responsavel','trg_orcamento_recalc','ensure_profile_is_gm','fn_seed_plano_contas',
  'fin_backfill_obra_id_from_centros','fn_notificar_prazos_proximos','fn_card_recurso_sync_crono',
  'recalcular_custo_atividade','fn_lancamento_solicitacao_aprovada'
];
BEGIN
  FOR r IN
    SELECT p.oid, p.proname, pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname='public' AND p.prosecdef=true AND p.proname = ANY(fn_list)
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION public.%I(%s) FROM PUBLIC, anon, authenticated', r.proname, r.args);
    EXECUTE format('GRANT  EXECUTE ON FUNCTION public.%I(%s) TO service_role',                r.proname, r.args);
  END LOOP;
END $$;

DROP POLICY IF EXISTS card_local_write_auth       ON public.card_local;
DROP POLICY IF EXISTS card_local_select_auth      ON public.card_local;
DROP POLICY IF EXISTS card_local_write_by_access  ON public.card_local;
CREATE POLICY card_local_select_auth
  ON public.card_local FOR SELECT TO authenticated
  USING (public.has_card_access(card_id));
CREATE POLICY card_local_write_by_access
  ON public.card_local FOR ALL TO authenticated
  USING (public.has_card_access(card_id))
  WITH CHECK (public.has_card_access(card_id));

DROP POLICY IF EXISTS "auth pode registrar import runs" ON public.totvs_import_runs;
DROP POLICY IF EXISTS "gm pode registrar import runs"    ON public.totvs_import_runs;
CREATE POLICY "gm pode registrar import runs"
  ON public.totvs_import_runs FOR INSERT TO authenticated
  WITH CHECK (public.current_is_gm());