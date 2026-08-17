
-- Unique key for matriz upsert (ref_lancamento + cod_natureza + cod_ccusto identifies a slice)
CREATE UNIQUE INDEX IF NOT EXISTS financeiro_matriz_rateios_chave_uk
  ON public.financeiro_matriz_rateios (
    ref_lancamento,
    COALESCE(cod_natureza, ''),
    COALESCE(cod_ccusto, '')
  );

CREATE OR REPLACE FUNCTION public.fn_importar_matriz(p_rateios jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_total INT := 0;
  v_titulos INT := 0;
  v_novos INT := 0;
  v_alterados INT := 0;
  v_removidos INT := 0;
  v_inalterados INT := 0;
BEGIN
  -- Stage incoming payload in a temp table with derived fields normalized.
  CREATE TEMP TABLE _src ON COMMIT DROP AS
  SELECT
    (e->>'ref_lancamento')::BIGINT AS ref_lancamento,
    NULLIF(e->>'cod_natureza','') AS cod_natureza,
    NULLIF(e->>'desc_natureza','') AS desc_natureza,
    COALESCE(NULLIF(e->>'grupo',''), split_part(NULLIF(e->>'cod_natureza',''), '.', 1)) AS grupo,
    COALESCE(
      NULLIF(e->>'subgrupo',''),
      CASE
        WHEN NULLIF(e->>'cod_natureza','') ~ '^[0-9]+\.[0-9]+'
          THEN split_part(e->>'cod_natureza','.',1)||'.'||split_part(e->>'cod_natureza','.',2)
        ELSE split_part(NULLIF(e->>'cod_natureza',''), '.', 1)
      END
    ) AS subgrupo,
    NULLIF(e->>'cod_ccusto','') AS cod_ccusto,
    NULLIF(e->>'desc_ccusto','') AS desc_ccusto,
    COALESCE((e->>'valor_rateio')::NUMERIC, 0) AS valor_rateio,
    COALESCE((e->>'valor_original')::NUMERIC, 0) AS valor_original,
    NULLIF(e->>'situacao_presumida','') AS situacao_presumida
  FROM jsonb_array_elements(COALESCE(p_rateios, '[]'::jsonb)) AS e
  WHERE NULLIF(e->>'ref_lancamento','') IS NOT NULL;

  SELECT COUNT(*), COUNT(DISTINCT ref_lancamento) INTO v_total, v_titulos FROM _src;

  -- Deduplicate src on the natural key (last write wins) so ON CONFLICT works.
  CREATE TEMP TABLE _src_uniq ON COMMIT DROP AS
  SELECT DISTINCT ON (ref_lancamento, COALESCE(cod_natureza,''), COALESCE(cod_ccusto,''))
    *
  FROM _src
  ORDER BY ref_lancamento, COALESCE(cod_natureza,''), COALESCE(cod_ccusto,''), valor_rateio DESC;

  -- Count what is new vs changed vs unchanged BEFORE writing.
  WITH joined AS (
    SELECT s.*,
      m.cod_natureza AS m_cod_natureza,
      m.desc_natureza AS m_desc_natureza,
      m.grupo AS m_grupo,
      m.subgrupo AS m_subgrupo,
      m.desc_ccusto AS m_desc_ccusto,
      m.valor_rateio AS m_valor_rateio,
      m.valor_original AS m_valor_original,
      m.situacao_presumida AS m_situacao_presumida,
      m.id IS NULL AS is_new
    FROM _src_uniq s
    LEFT JOIN public.financeiro_matriz_rateios m
      ON m.ref_lancamento = s.ref_lancamento
     AND COALESCE(m.cod_natureza,'') = COALESCE(s.cod_natureza,'')
     AND COALESCE(m.cod_ccusto,'')   = COALESCE(s.cod_ccusto,'')
  )
  SELECT
    COUNT(*) FILTER (WHERE is_new),
    COUNT(*) FILTER (WHERE NOT is_new AND (
         COALESCE(desc_natureza,'')      IS DISTINCT FROM COALESCE(m_desc_natureza,'')
      OR COALESCE(grupo,'')              IS DISTINCT FROM COALESCE(m_grupo,'')
      OR COALESCE(subgrupo,'')           IS DISTINCT FROM COALESCE(m_subgrupo,'')
      OR COALESCE(desc_ccusto,'')        IS DISTINCT FROM COALESCE(m_desc_ccusto,'')
      OR valor_rateio                    IS DISTINCT FROM m_valor_rateio
      OR valor_original                  IS DISTINCT FROM m_valor_original
      OR COALESCE(situacao_presumida,'') IS DISTINCT FROM COALESCE(m_situacao_presumida,'')
    )),
    COUNT(*) FILTER (WHERE NOT is_new AND NOT (
         COALESCE(desc_natureza,'')      IS DISTINCT FROM COALESCE(m_desc_natureza,'')
      OR COALESCE(grupo,'')              IS DISTINCT FROM COALESCE(m_grupo,'')
      OR COALESCE(subgrupo,'')           IS DISTINCT FROM COALESCE(m_subgrupo,'')
      OR COALESCE(desc_ccusto,'')        IS DISTINCT FROM COALESCE(m_desc_ccusto,'')
      OR valor_rateio                    IS DISTINCT FROM m_valor_rateio
      OR valor_original                  IS DISTINCT FROM m_valor_original
      OR COALESCE(situacao_presumida,'') IS DISTINCT FROM COALESCE(m_situacao_presumida,'')
    ))
  INTO v_novos, v_alterados, v_inalterados
  FROM joined;

  -- Remove rows that no longer exist in src (proper WHERE clause).
  WITH del AS (
    DELETE FROM public.financeiro_matriz_rateios m
    WHERE NOT EXISTS (
      SELECT 1 FROM _src_uniq s
      WHERE s.ref_lancamento = m.ref_lancamento
        AND COALESCE(s.cod_natureza,'') = COALESCE(m.cod_natureza,'')
        AND COALESCE(s.cod_ccusto,'')   = COALESCE(m.cod_ccusto,'')
    )
    RETURNING 1
  )
  SELECT COUNT(*) INTO v_removidos FROM del;

  -- Upsert new + changed rows. Unchanged rows are skipped via WHERE on the DO UPDATE.
  INSERT INTO public.financeiro_matriz_rateios AS m (
    ref_lancamento, cod_natureza, desc_natureza, grupo, subgrupo,
    cod_ccusto, desc_ccusto, valor_rateio, valor_original, situacao_presumida,
    atualizado_em
  )
  SELECT ref_lancamento, cod_natureza, desc_natureza, grupo, subgrupo,
    cod_ccusto, desc_ccusto, valor_rateio, valor_original, situacao_presumida,
    now()
  FROM _src_uniq
  ON CONFLICT (ref_lancamento, COALESCE(cod_natureza, ''), COALESCE(cod_ccusto, ''))
  DO UPDATE SET
    desc_natureza = EXCLUDED.desc_natureza,
    grupo = EXCLUDED.grupo,
    subgrupo = EXCLUDED.subgrupo,
    desc_ccusto = EXCLUDED.desc_ccusto,
    valor_rateio = EXCLUDED.valor_rateio,
    valor_original = EXCLUDED.valor_original,
    situacao_presumida = EXCLUDED.situacao_presumida,
    atualizado_em = now()
  WHERE
       COALESCE(m.desc_natureza,'')      IS DISTINCT FROM COALESCE(EXCLUDED.desc_natureza,'')
    OR COALESCE(m.grupo,'')              IS DISTINCT FROM COALESCE(EXCLUDED.grupo,'')
    OR COALESCE(m.subgrupo,'')           IS DISTINCT FROM COALESCE(EXCLUDED.subgrupo,'')
    OR COALESCE(m.desc_ccusto,'')        IS DISTINCT FROM COALESCE(EXCLUDED.desc_ccusto,'')
    OR m.valor_rateio                    IS DISTINCT FROM EXCLUDED.valor_rateio
    OR m.valor_original                  IS DISTINCT FROM EXCLUDED.valor_original
    OR COALESCE(m.situacao_presumida,'') IS DISTINCT FROM COALESCE(EXCLUDED.situacao_presumida,'');

  RETURN jsonb_build_object(
    'total_rateios', v_total,
    'titulos_distintos', v_titulos,
    'novos', v_novos,
    'alterados', v_alterados,
    'removidos', v_removidos,
    'inalterados', v_inalterados,
    'atualizado_em', now()
  );
END
$function$;
