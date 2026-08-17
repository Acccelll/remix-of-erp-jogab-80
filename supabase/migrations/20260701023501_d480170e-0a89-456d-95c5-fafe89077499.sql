-- Helpers de autorização
CREATE OR REPLACE FUNCTION public._require_gm_or_financeiro()
RETURNS void
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Não autenticado' USING ERRCODE = '42501';
  END IF;
  IF NOT (public.current_is_gm() OR public.current_has_setor('Financeiro')) THEN
    RAISE EXCEPTION 'Acesso negado: requer GM ou Financeiro' USING ERRCODE = '42501';
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION public._require_gm_or_financeiro() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public._require_gm_or_financeiro() TO authenticated;

CREATE OR REPLACE FUNCTION public._require_gm()
RETURNS void
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Não autenticado' USING ERRCODE = '42501';
  END IF;
  IF NOT public.current_is_gm() THEN
    RAISE EXCEPTION 'Acesso negado: requer GM' USING ERRCODE = '42501';
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION public._require_gm() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public._require_gm() TO authenticated;

-- Renomear implementações originais para _impl (idempotente)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
             WHERE n.nspname='public' AND p.proname='fn_importar_relatorio_totvs')
     AND NOT EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
             WHERE n.nspname='public' AND p.proname='fn_importar_relatorio_totvs_impl') THEN
    ALTER FUNCTION public.fn_importar_relatorio_totvs(text, text, jsonb)
      RENAME TO fn_importar_relatorio_totvs_impl;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
             WHERE n.nspname='public' AND p.proname='fn_importar_matriz')
     AND NOT EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
             WHERE n.nspname='public' AND p.proname='fn_importar_matriz_impl') THEN
    ALTER FUNCTION public.fn_importar_matriz(jsonb)
      RENAME TO fn_importar_matriz_impl;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
             WHERE n.nspname='public' AND p.proname='fn_importar_financeiro_snapshot')
     AND NOT EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
             WHERE n.nspname='public' AND p.proname='fn_importar_financeiro_snapshot_impl') THEN
    ALTER FUNCTION public.fn_importar_financeiro_snapshot(text, text, text, jsonb, jsonb)
      RENAME TO fn_importar_financeiro_snapshot_impl;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
             WHERE n.nspname='public' AND p.proname='aprovar_orcamento_obra')
     AND NOT EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
             WHERE n.nspname='public' AND p.proname='aprovar_orcamento_obra_impl') THEN
    ALTER FUNCTION public.aprovar_orcamento_obra(uuid)
      RENAME TO aprovar_orcamento_obra_impl;
  END IF;
END $$;

-- Trancar execução direta das _impl
REVOKE ALL ON FUNCTION public.fn_importar_relatorio_totvs_impl(text, text, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_importar_matriz_impl(jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_importar_financeiro_snapshot_impl(text, text, text, jsonb, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.aprovar_orcamento_obra_impl(uuid) FROM PUBLIC, anon, authenticated;

-- Wrappers com o nome original
CREATE OR REPLACE FUNCTION public.fn_importar_relatorio_totvs(p_periodo_ref text, p_nome_titulos text, p_lancamentos jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  PERFORM public._require_gm_or_financeiro();
  RETURN public.fn_importar_relatorio_totvs_impl(p_periodo_ref, p_nome_titulos, p_lancamentos);
END;
$$;
REVOKE ALL ON FUNCTION public.fn_importar_relatorio_totvs(text, text, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_importar_relatorio_totvs(text, text, jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.fn_importar_matriz(p_rateios jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  PERFORM public._require_gm_or_financeiro();
  RETURN public.fn_importar_matriz_impl(p_rateios);
END;
$$;
REVOKE ALL ON FUNCTION public.fn_importar_matriz(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_importar_matriz(jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.fn_importar_financeiro_snapshot(
  p_periodo_ref text, p_nome_titulos text, p_nome_rateios text, p_lancamentos jsonb, p_rateios jsonb
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  PERFORM public._require_gm_or_financeiro();
  RETURN public.fn_importar_financeiro_snapshot_impl(p_periodo_ref, p_nome_titulos, p_nome_rateios, p_lancamentos, p_rateios);
END;
$$;
REVOKE ALL ON FUNCTION public.fn_importar_financeiro_snapshot(text, text, text, jsonb, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_importar_financeiro_snapshot(text, text, text, jsonb, jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.aprovar_orcamento_obra(p_obra uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  PERFORM public._require_gm();
  RETURN public.aprovar_orcamento_obra_impl(p_obra);
END;
$$;
REVOKE ALL ON FUNCTION public.aprovar_orcamento_obra(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.aprovar_orcamento_obra(uuid) TO authenticated;