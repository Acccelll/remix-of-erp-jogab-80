ALTER TABLE public.financeiro_snapshots
  ADD COLUMN IF NOT EXISTS data_ref date;

CREATE UNIQUE INDEX IF NOT EXISTS ux_financeiro_snapshots_matriz_data_ref
  ON public.financeiro_snapshots (data_ref)
  WHERE data_ref IS NOT NULL AND nome_arquivo_titulos = 'matriz';

DROP FUNCTION IF EXISTS public.fn_importar_matriz(jsonb);

CREATE OR REPLACE FUNCTION public.fn_importar_matriz(p_rateios jsonb, p_data_ref date DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total INT := 0;
  v_titulos INT := 0;
  v_removidos INT := 0;
  v_reprocessados INT := 0;
  v_snapshot_ativo UUID;
BEGIN
  IF NOT pg_try_advisory_xact_lock(hashtext('financeiro.importar_matriz')) THEN
    RAISE EXCEPTION 'Outra importação de Matriz está em andamento. Aguarde alguns segundos e tente novamente.'
      USING ERRCODE = '55P03';
  END IF;

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
    NULLIF(e->>'situacao_presumida','') AS situacao_presumida,
    NULLIF(e->>'data_emissao','')::DATE AS data_emissao,
    NULLIF(e->>'data_vencimento','')::DATE AS data_vencimento,
    NULLIF(e->>'natureza_tipo_matriz','')::SMALLINT AS natureza_tipo_matriz
  FROM jsonb_array_elements(COALESCE(p_rateios, '[]'::jsonb)) AS e
  WHERE NULLIF(e->>'ref_lancamento','') IS NOT NULL;

  SELECT COUNT(*), COUNT(DISTINCT ref_lancamento) INTO v_total, v_titulos FROM _src;

  CREATE TEMP TABLE _src_uniq ON COMMIT DROP AS
  SELECT DISTINCT ON (ref_lancamento, COALESCE(cod_natureza,''), COALESCE(cod_ccusto,''))
    *
  FROM _src
  ORDER BY ref_lancamento, COALESCE(cod_natureza,''), COALESCE(cod_ccusto,''), valor_rateio DESC;

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

  INSERT INTO public.financeiro_matriz_rateios AS m (
    ref_lancamento, cod_natureza, desc_natureza, grupo, subgrupo,
    cod_ccusto, desc_ccusto, valor_rateio, valor_original, situacao_presumida,
    data_emissao, data_vencimento, natureza_tipo_matriz, atualizado_em
  )
  SELECT ref_lancamento, cod_natureza, desc_natureza, grupo, subgrupo,
    cod_ccusto, desc_ccusto, valor_rateio, valor_original, situacao_presumida,
    data_emissao, data_vencimento, natureza_tipo_matriz, now()
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
    data_emissao = EXCLUDED.data_emissao,
    data_vencimento = EXCLUDED.data_vencimento,
    natureza_tipo_matriz = EXCLUDED.natureza_tipo_matriz,
    atualizado_em = now()
  WHERE
       COALESCE(m.desc_natureza,'')      IS DISTINCT FROM COALESCE(EXCLUDED.desc_natureza,'')
    OR COALESCE(m.grupo,'')              IS DISTINCT FROM COALESCE(EXCLUDED.grupo,'')
    OR COALESCE(m.subgrupo,'')           IS DISTINCT FROM COALESCE(EXCLUDED.subgrupo,'')
    OR COALESCE(m.desc_ccusto,'')        IS DISTINCT FROM COALESCE(EXCLUDED.desc_ccusto,'')
    OR m.valor_rateio                    IS DISTINCT FROM EXCLUDED.valor_rateio
    OR m.valor_original                  IS DISTINCT FROM EXCLUDED.valor_original
    OR COALESCE(m.situacao_presumida,'') IS DISTINCT FROM COALESCE(EXCLUDED.situacao_presumida,'')
    OR m.data_emissao                    IS DISTINCT FROM EXCLUDED.data_emissao
    OR m.data_vencimento                 IS DISTINCT FROM EXCLUDED.data_vencimento
    OR m.natureza_tipo_matriz            IS DISTINCT FROM EXCLUDED.natureza_tipo_matriz;

  IF p_data_ref IS NOT NULL THEN
    -- Ponto oficial da série: um snapshot por data de referência informada.
    SELECT id INTO v_snapshot_ativo
    FROM public.financeiro_snapshots
    WHERE data_ref = p_data_ref AND nome_arquivo_titulos = 'matriz'
    LIMIT 1;

    IF v_snapshot_ativo IS NULL THEN
      INSERT INTO public.financeiro_snapshots (periodo_ref, nome_arquivo_titulos, data_ref, importado_em)
      VALUES (to_char(p_data_ref, 'YYYY-MM-DD'), 'matriz', p_data_ref, (p_data_ref + time '12:00')::timestamptz)
      RETURNING id INTO v_snapshot_ativo;
    ELSE
      UPDATE public.financeiro_snapshots
         SET importado_em = (p_data_ref + time '12:00')::timestamptz
       WHERE id = v_snapshot_ativo;
    END IF;
  ELSE
    SELECT id INTO v_snapshot_ativo
    FROM public.financeiro_snapshots
    ORDER BY importado_em DESC
    LIMIT 1;
  END IF;

  IF v_snapshot_ativo IS NOT NULL THEN
    PERFORM public.fn_reconstruir_snapshot_matriz_central(v_snapshot_ativo);
    v_reprocessados := 1;
  END IF;

  RETURN jsonb_build_object(
    'total_rateios', v_total,
    'titulos_distintos', v_titulos,
    'removidos', v_removidos,
    'snapshots_reprocessados', v_reprocessados,
    'snapshot_id', v_snapshot_ativo,
    'data_ref', p_data_ref,
    'atualizado_em', now()
  );
END
$$;