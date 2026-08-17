-- Título manual (1/3): marca origem em financeiro_matriz_rateios e escopa
-- fn_importar_matriz a 'totvs', para que a reimportação da Matriz TOTVS
-- (que é um full-replace destrutivo) nunca apague rateios lançados manualmente.

ALTER TABLE public.financeiro_matriz_rateios
  ADD COLUMN IF NOT EXISTS origem TEXT NOT NULL DEFAULT 'totvs'
    CHECK (origem IN ('totvs', 'manual'));

CREATE INDEX IF NOT EXISTS idx_fin_matriz_origem
  ON public.financeiro_matriz_rateios (origem);

CREATE OR REPLACE FUNCTION public.fn_importar_matriz(p_rateios jsonb, p_data_ref date DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total integer := 0;
  v_titulos integer := 0;
  v_removidos integer := 0;
  v_novos integer := 0;
  v_alterados integer := 0;
  v_snapshot_ativo uuid;
BEGIN
  IF auth.role() <> 'service_role'
     AND (auth.uid() IS NULL OR NOT (
       public.has_role(auth.uid(), 'financeiro')
       OR public.has_role(auth.uid(), 'gm')
       OR public.is_current_player_gm()
       OR public.current_player_has_access('financeiro')
     )) THEN
    RAISE EXCEPTION 'Usuário sem permissão para importar a Matriz SQL.' USING ERRCODE = '42501';
  END IF;

  IF NOT pg_try_advisory_xact_lock(hashtext('financeiro.importar_matriz')) THEN
    RAISE EXCEPTION 'Outra importação de Matriz está em andamento. Aguarde alguns segundos e tente novamente.'
      USING ERRCODE = '55P03';
  END IF;

  CREATE TEMP TABLE _src ON COMMIT DROP AS
  SELECT
    (e->>'ref_lancamento')::bigint AS ref_lancamento,
    NULLIF(e->>'cod_natureza','') AS cod_natureza,
    NULLIF(e->>'desc_natureza','') AS desc_natureza,
    COALESCE(NULLIF(e->>'grupo',''), split_part(NULLIF(e->>'cod_natureza',''), '.', 1)) AS grupo,
    COALESCE(NULLIF(e->>'subgrupo',''), split_part(NULLIF(e->>'cod_natureza',''), '.', 1)) AS subgrupo,
    NULLIF(e->>'cod_ccusto','') AS cod_ccusto,
    NULLIF(e->>'desc_ccusto','') AS desc_ccusto,
    COALESCE((e->>'valor_rateio')::numeric, 0) AS valor_rateio,
    COALESCE((e->>'valor_original')::numeric, 0) AS valor_original,
    NULLIF(e->>'situacao_presumida','') AS situacao_presumida,
    NULLIF(e->>'data_emissao','')::date AS data_emissao,
    NULLIF(e->>'data_vencimento','')::date AS data_vencimento,
    NULLIF(e->>'natureza_tipo_matriz','')::smallint AS natureza_tipo_matriz,
    NULLIF(e->>'filial','')::integer AS filial,
    NULLIF(e->>'tipo_documento','') AS tipo_documento,
    NULLIF(e->>'numero_documento','') AS numero_documento,
    NULLIF(e->>'cnpj_cpf','') AS cnpj_cpf,
    NULLIF(e->>'nome','') AS nome,
    NULLIF(e->>'nome_fantasia','') AS nome_fantasia,
    NULLIF(e->>'historico','') AS historico,
    COALESCE((e->>'valor_liquido')::numeric, 0) AS valor_liquido,
    COALESCE((e->>'valor_baixado')::numeric, 0) AS valor_baixado,
    NULLIF(e->>'data_baixa','')::date AS data_baixa,
    NULLIF(e->>'status_cod_matriz','')::smallint AS status_cod_matriz
  FROM jsonb_array_elements(COALESCE(p_rateios, '[]'::jsonb)) AS e
  WHERE NULLIF(e->>'ref_lancamento','') IS NOT NULL;

  CREATE INDEX ON _src (ref_lancamento, cod_natureza, cod_ccusto);
  SELECT COUNT(*), COUNT(DISTINCT ref_lancamento) INTO v_total, v_titulos FROM _src;

  CREATE TEMP TABLE _src_uniq ON COMMIT DROP AS
  SELECT DISTINCT ON (ref_lancamento, COALESCE(cod_natureza,''), COALESCE(cod_ccusto,'')) *
  FROM _src
  ORDER BY ref_lancamento, COALESCE(cod_natureza,''), COALESCE(cod_ccusto,''), valor_rateio DESC;
  CREATE INDEX ON _src_uniq (ref_lancamento, cod_natureza, cod_ccusto);

  -- SEC/DB-crítico: o full-sync só pode tocar linhas origem='totvs'. Linhas
  -- 'manual' (lançamentos manuais de título) nunca entram no diff nem são
  -- removidas por uma reimportação TOTVS.
  WITH del AS (
    DELETE FROM public.financeiro_matriz_rateios m
    WHERE m.origem = 'totvs'
      AND NOT EXISTS (
      SELECT 1 FROM _src_uniq s
      WHERE s.ref_lancamento = m.ref_lancamento
        AND COALESCE(s.cod_natureza,'') = COALESCE(m.cod_natureza,'')
        AND COALESCE(s.cod_ccusto,'') = COALESCE(m.cod_ccusto,'')
    ) RETURNING 1
  ) SELECT COUNT(*) INTO v_removidos FROM del;

  WITH upserted AS (
    INSERT INTO public.financeiro_matriz_rateios AS m (
      ref_lancamento, cod_natureza, desc_natureza, grupo, subgrupo,
      cod_ccusto, desc_ccusto, valor_rateio, valor_original, situacao_presumida,
      data_emissao, data_vencimento, natureza_tipo_matriz,
      filial, tipo_documento, numero_documento, cnpj_cpf, nome, nome_fantasia,
      historico, valor_liquido, valor_baixado, data_baixa, status_cod_matriz,
      origem, atualizado_em
    )
    SELECT ref_lancamento, cod_natureza, desc_natureza, grupo, subgrupo,
      cod_ccusto, desc_ccusto, valor_rateio, valor_original, situacao_presumida,
      data_emissao, data_vencimento, natureza_tipo_matriz,
      filial, tipo_documento, numero_documento, cnpj_cpf, nome, nome_fantasia,
      historico, valor_liquido, valor_baixado, data_baixa, status_cod_matriz,
      'totvs', now()
    FROM _src_uniq
    ON CONFLICT (ref_lancamento, COALESCE(cod_natureza, ''), COALESCE(cod_ccusto, ''))
    DO UPDATE SET
      desc_natureza=EXCLUDED.desc_natureza, grupo=EXCLUDED.grupo, subgrupo=EXCLUDED.subgrupo,
      desc_ccusto=EXCLUDED.desc_ccusto, valor_rateio=EXCLUDED.valor_rateio,
      valor_original=EXCLUDED.valor_original, situacao_presumida=EXCLUDED.situacao_presumida,
      data_emissao=EXCLUDED.data_emissao, data_vencimento=EXCLUDED.data_vencimento,
      natureza_tipo_matriz=EXCLUDED.natureza_tipo_matriz, filial=EXCLUDED.filial,
      tipo_documento=EXCLUDED.tipo_documento, numero_documento=EXCLUDED.numero_documento,
      cnpj_cpf=EXCLUDED.cnpj_cpf, nome=EXCLUDED.nome, nome_fantasia=EXCLUDED.nome_fantasia,
      historico=EXCLUDED.historico, valor_liquido=EXCLUDED.valor_liquido,
      valor_baixado=EXCLUDED.valor_baixado, data_baixa=EXCLUDED.data_baixa,
      status_cod_matriz=EXCLUDED.status_cod_matriz, origem='totvs', atualizado_em=now()
    WHERE m.origem = 'totvs'
      AND ROW(m.desc_natureza,m.grupo,m.subgrupo,m.desc_ccusto,m.valor_rateio,m.valor_original,
      m.situacao_presumida,m.data_emissao,m.data_vencimento,m.natureza_tipo_matriz,m.filial,
      m.tipo_documento,m.numero_documento,m.cnpj_cpf,m.nome,m.nome_fantasia,m.historico,
      m.valor_liquido,m.valor_baixado,m.data_baixa,m.status_cod_matriz)
      IS DISTINCT FROM
      ROW(EXCLUDED.desc_natureza,EXCLUDED.grupo,EXCLUDED.subgrupo,EXCLUDED.desc_ccusto,
      EXCLUDED.valor_rateio,EXCLUDED.valor_original,EXCLUDED.situacao_presumida,
      EXCLUDED.data_emissao,EXCLUDED.data_vencimento,EXCLUDED.natureza_tipo_matriz,
      EXCLUDED.filial,EXCLUDED.tipo_documento,EXCLUDED.numero_documento,EXCLUDED.cnpj_cpf,
      EXCLUDED.nome,EXCLUDED.nome_fantasia,EXCLUDED.historico,EXCLUDED.valor_liquido,
      EXCLUDED.valor_baixado,EXCLUDED.data_baixa,EXCLUDED.status_cod_matriz)
    RETURNING (xmax = 0) AS inserted
  ) SELECT COUNT(*) FILTER (WHERE inserted), COUNT(*) FILTER (WHERE NOT inserted)
      INTO v_novos, v_alterados FROM upserted;

  IF p_data_ref IS NOT NULL THEN
    INSERT INTO public.financeiro_snapshots (periodo_ref, nome_arquivo_titulos, data_ref, importado_em)
    VALUES (to_char(p_data_ref, 'YYYY-MM-DD'), 'matriz', p_data_ref, (p_data_ref + time '12:00')::timestamptz)
    ON CONFLICT (data_ref) WHERE data_ref IS NOT NULL AND nome_arquivo_titulos = 'matriz'
    DO UPDATE SET importado_em = EXCLUDED.importado_em
    RETURNING id INTO v_snapshot_ativo;
  ELSE
    SELECT id INTO v_snapshot_ativo FROM public.financeiro_snapshots ORDER BY importado_em DESC LIMIT 1;
  END IF;

  IF v_snapshot_ativo IS NOT NULL THEN
    PERFORM public.fn_reconstruir_snapshot_matriz_central(v_snapshot_ativo);
  END IF;

  RETURN jsonb_build_object(
    'total_rateios', v_total, 'titulos_distintos', v_titulos,
    'novos', v_novos, 'alterados', v_alterados, 'removidos', v_removidos,
    'inalterados', GREATEST(v_total - v_novos - v_alterados, 0),
    'snapshots_reprocessados', CASE WHEN v_snapshot_ativo IS NULL THEN 0 ELSE 1 END,
    'snapshot_id', v_snapshot_ativo, 'data_ref', p_data_ref, 'atualizado_em', now()
  );
END
$$;

REVOKE EXECUTE ON FUNCTION public.fn_importar_matriz(jsonb, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_importar_matriz(jsonb, date) TO authenticated, service_role;
