
REVOKE EXECUTE ON FUNCTION public.fn_cards_automacoes() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.fn_checklist_completo_notifica() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_cards_automacoes() TO service_role;
GRANT EXECUTE ON FUNCTION public.fn_checklist_completo_notifica() TO service_role;
