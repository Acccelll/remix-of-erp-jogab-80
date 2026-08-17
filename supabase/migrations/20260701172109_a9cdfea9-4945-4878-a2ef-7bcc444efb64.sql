DO $$
DECLARE
  r record;
  v_keep text[] := ARRAY[
    'aprovar_orcamento_obra',
    'board_atividades_recentes',
    'board_items_resumo',
    'criar_card_board_atomico',
    'criar_medicao_atomica',
    'emitir_oc_atomico',
    'excluir_nf_atomica',
    'fechar_bms_atomica',
    'fn_atualizar_cpm',
    'fn_auto_arquivar_concluidos',
    'fn_estoque_transferir',
    'fn_importar_financeiro_snapshot',
    'fn_importar_matriz',
    'fn_importar_relatorio_totvs',
    'fn_inspecao_materializar_pendentes',
    'fn_nc_notificar_prazos',
    'fn_oc_aprovar',
    'fn_recalcular_apos_faturamento',
    'fn_recalcular_previsao_nf',
    'fn_reverter_faturamento_bms',
    'gm_query_performance',
    'is_flag_enabled',
    'rdo_upsert_from_checklist',
    'registrar_recebimento_atomico',
    'salvar_nf_atomica'
  ];
BEGIN
  FOR r IN
    SELECT p.oid, p.proname, pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prosecdef = true
      AND has_function_privilege('authenticated', p.oid, 'EXECUTE')
      AND p.proname <> ALL(v_keep)
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION public.%I(%s) FROM authenticated, anon, PUBLIC', r.proname, r.args);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%I(%s) TO service_role', r.proname, r.args);
  END LOOP;
END $$;