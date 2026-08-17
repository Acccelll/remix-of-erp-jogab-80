
REVOKE EXECUTE ON FUNCTION public.fn_audit_row() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.fn_seed_plano_contas() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.fn_bump_versao_otimista() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.update_dp_holerite_updated_at() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.touch_updated_at() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.update_custo_colab_updated_at() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.fn_lancamento_solicitacao_aprovada(uuid, uuid, text, numeric, date, text) FROM anon, authenticated, PUBLIC;

REVOKE EXECUTE ON FUNCTION public.fn_recalcular_apos_faturamento(uuid, uuid, numeric) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.fn_recalcular_previsao_nf(uuid, numeric) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.fn_reverter_faturamento_bms(uuid, uuid, numeric) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.fn_importar_financeiro_snapshot(text, text, text, jsonb, jsonb) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_folha_rateada(text, text) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM anon, PUBLIC;

REVOKE SELECT ON public.players FROM anon, authenticated;
GRANT SELECT (id, login, email, is_gm, acessos, created_at) ON public.players TO authenticated;
