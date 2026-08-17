CREATE OR REPLACE FUNCTION public.fn_atualizar_cpm(p_obra_id uuid, p_resultados jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  r jsonb;
  v_id uuid;
  v_critico boolean;
  v_folga numeric;
BEGIN
  IF p_resultados IS NULL OR jsonb_typeof(p_resultados) <> 'array' THEN
    RETURN;
  END IF;

  FOR r IN SELECT * FROM jsonb_array_elements(p_resultados) LOOP
    v_id := COALESCE(NULLIF(r->>'id',''), NULLIF(r->>'item_id',''))::uuid;
    v_critico := COALESCE(
      NULLIF(r->>'critico','')::boolean,
      NULLIF(r->>'caminho_critico','')::boolean,
      false
    );
    v_folga := COALESCE(
      NULLIF(r->>'folga_dias','')::numeric,
      NULLIF(r->>'folga_total_dias','')::numeric,
      NULLIF(r->>'folga_total','')::numeric
    );

    UPDATE public.cronograma_itens
       SET critico = v_critico,
           caminho_critico = v_critico,
           folga_dias = CASE WHEN v_folga IS NULL THEN folga_dias ELSE round(v_folga)::integer END,
           folga_total = COALESCE(v_folga, folga_total),
           folga_livre_dias = COALESCE(NULLIF(r->>'folga_livre_dias','')::numeric, folga_livre_dias),
           fanout_sucessoras = COALESCE(NULLIF(r->>'fanout','')::integer, NULLIF(r->>'fanout_sucessoras','')::integer, fanout_sucessoras),
           importancia_score = COALESCE(NULLIF(r->>'score','')::numeric, NULLIF(r->>'importancia_score','')::numeric, importancia_score),
           importancia_classe = COALESCE(NULLIF(r->>'classe',''), NULLIF(r->>'importancia_classe',''), importancia_classe),
           data_inicio_cpm = COALESCE(NULLIF(r->>'data_inicio_cpm','')::timestamptz, NULLIF(r->>'es','')::timestamptz, data_inicio_cpm),
           data_fim_cpm = COALESCE(NULLIF(r->>'data_fim_cpm','')::timestamptz, NULLIF(r->>'ef','')::timestamptz, data_fim_cpm)
     WHERE obra_id = p_obra_id
       AND id = v_id;
  END LOOP;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.fn_atualizar_cpm(uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_atualizar_cpm(uuid, jsonb) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';