
CREATE OR REPLACE FUNCTION public.fn_importar_pacote_totvs(
  p_rateios jsonb,
  p_periodo_ref text,
  p_nome_titulos text,
  p_lancamentos jsonb,
  p_hash_arquivo text DEFAULT NULL,
  p_importado_por uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_matriz jsonb;
  v_rel jsonb;
BEGIN
  -- Ambas as chamadas rodam na MESMA transação. Se a segunda RAISE, a primeira é revertida.
  v_matriz := public.fn_importar_matriz(p_rateios);
  v_rel := public.fn_importar_relatorio_totvs(
    p_periodo_ref,
    p_nome_titulos,
    p_lancamentos,
    p_hash_arquivo,
    p_importado_por
  );

  RETURN jsonb_build_object(
    'matriz', v_matriz,
    'relatorio', v_rel
  );
END;
$$;

REVOKE ALL ON FUNCTION public.fn_importar_pacote_totvs(jsonb, text, text, jsonb, text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_importar_pacote_totvs(jsonb, text, text, jsonb, text, uuid) TO authenticated, service_role;
