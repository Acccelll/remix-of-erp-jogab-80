ALTER TABLE public.financeiro_matriz_rateios
  ADD COLUMN IF NOT EXISTS filial integer,
  ADD COLUMN IF NOT EXISTS tipo_documento text,
  ADD COLUMN IF NOT EXISTS numero_documento text,
  ADD COLUMN IF NOT EXISTS cnpj_cpf text,
  ADD COLUMN IF NOT EXISTS nome text,
  ADD COLUMN IF NOT EXISTS nome_fantasia text,
  ADD COLUMN IF NOT EXISTS historico text,
  ADD COLUMN IF NOT EXISTS valor_liquido numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS valor_baixado numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS data_baixa date,
  ADD COLUMN IF NOT EXISTS status_cod_matriz smallint;

CREATE INDEX IF NOT EXISTS idx_centros_custo_totvs_codigo
  ON public.centros_custo_totvs (codigo);
CREATE INDEX IF NOT EXISTS idx_fin_lanc_snapshot_origem_ref
  ON public.financeiro_lancamentos (snapshot_id, origem, ref_lancamento);
CREATE INDEX IF NOT EXISTS idx_fin_matriz_ref
  ON public.financeiro_matriz_rateios (ref_lancamento);

CREATE OR REPLACE FUNCTION public.fn_reconstruir_snapshot_matriz_central(p_snapshot_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_data_snapshot date;
  v_total_titulos integer := 0;
  v_total_valor numeric := 0;
  v_rollup_rows integer := 0;
BEGIN
  SELECT COALESCE(data_ref, importado_em::date)
    INTO v_data_snapshot
  FROM public.financeiro_snapshots
  WHERE id = p_snapshot_id;

  IF v_data_snapshot IS NULL THEN
    RAISE EXCEPTION 'Snapshot financeiro não encontrado: %', p_snapshot_id;
  END IF;

  DELETE FROM public.financeiro_lancamentos
  WHERE snapshot_id = p_snapshot_id AND origem = 'totvs';

  WITH matriz_base AS (
    SELECT
      m.ref_lancamento,
      MAX(m.filial) AS filial,
      MAX(m.tipo_documento) AS tipo_documento,
      MAX(m.numero_documento) AS numero_documento,
      MAX(m.cnpj_cpf) AS cnpj_cpf,
      MAX(m.nome) AS nome,
      MAX(m.nome_fantasia) AS nome_fantasia,
      MAX(m.historico) AS historico,
      SUM(GREATEST(COALESCE(m.valor_rateio, 0), 0))::numeric AS valor_matriz,
      MAX(GREATEST(COALESCE(NULLIF(m.valor_original, 0), m.valor_liquido, m.valor_rateio, 0), 0))::numeric AS valor_original_matriz,
      MAX(GREATEST(COALESCE(m.valor_baixado, 0), 0))::numeric AS valor_baixado_matriz,
      MIN(m.data_emissao) FILTER (WHERE m.data_emissao IS NOT NULL) AS data_emissao_matriz,
      MIN(m.data_vencimento) FILTER (WHERE m.data_vencimento IS NOT NULL) AS data_vencimento_matriz,
      MAX(m.data_baixa) FILTER (WHERE m.data_baixa IS NOT NULL) AS data_baixa_matriz,
      MAX(m.natureza_tipo_matriz) FILTER (WHERE m.natureza_tipo_matriz IS NOT NULL) AS natureza_tipo_matriz,
      MAX(m.status_cod_matriz) FILTER (WHERE m.status_cod_matriz IS NOT NULL) AS status_cod_matriz,
      CASE
        WHEN bool_or(lower(coalesce(m.situacao_presumida, '')) LIKE '%cancel%') THEN 'CANCELADO'
        WHEN bool_or(lower(coalesce(m.situacao_presumida, '')) LIKE '%parcial%') THEN 'BAIXA PARCIAL'
        WHEN bool_or(lower(coalesce(m.situacao_presumida, '')) IN ('baixa', 'baixado')) THEN 'BAIXA'
        WHEN bool_or(lower(coalesce(m.situacao_presumida, '')) LIKE '%venc%') THEN 'VENCIDO'
        WHEN bool_or(lower(coalesce(m.situacao_presumida, '')) LIKE '%aberto%') THEN 'EM ABERTO'
        ELSE NULL
      END AS situacao_matriz
    FROM public.financeiro_matriz_rateios m
    GROUP BY m.ref_lancamento
  ), principal_cc AS (
    SELECT DISTINCT ON (m.ref_lancamento)
      m.ref_lancamento, m.cod_ccusto, m.desc_ccusto,
      cct.obra_id, cct.tipo, cct.categoria
    FROM public.financeiro_matriz_rateios m
    LEFT JOIN public.centros_custo_totvs cct ON cct.codigo = m.cod_ccusto
    ORDER BY m.ref_lancamento,
      GREATEST(COALESCE(m.valor_rateio, 0), 0) DESC,
      m.cod_ccusto NULLS LAST
  ), fonte AS (
    SELECT
      mb.*,
      pc.cod_ccusto,
      pc.desc_ccusto,
      pc.obra_id,
      pc.tipo AS centro_tipo,
      pc.categoria AS centro_categoria,
      COALESCE(
        CASE
          WHEN mb.situacao_matriz IS NOT NULL THEN
            public.fn_financeiro_status_matriz(mb.situacao_matriz, mb.data_vencimento_matriz, v_data_snapshot)
          ELSE NULL
        END,
        CASE
          WHEN mb.status_cod_matriz = 1 AND mb.valor_baixado_matriz >= mb.valor_matriz THEN 3
          WHEN mb.status_cod_matriz = 1 AND mb.valor_baixado_matriz > 0 THEN 15
          ELSE public.fn_financeiro_status_matriz(NULL, mb.data_vencimento_matriz, v_data_snapshot)
        END
      )::smallint AS status_final
    FROM matriz_base mb
    LEFT JOIN principal_cc pc ON pc.ref_lancamento = mb.ref_lancamento
  )
  INSERT INTO public.financeiro_lancamentos (
    snapshot_id, ref_lancamento, filial, centro_custo, desc_centro_custo,
    obra_id, natureza_tipo, status_cod, status_label, tipo_documento, numero_documento,
    cnpj_cpf, nome, nome_fantasia, cliente_fornecedor,
    valor_original, valor_desconto, valor_liquido, valor_baixado,
    data_emissao, data_vencimento, data_baixa, data_pagamento,
    dias_atraso, mes_competencia, historico, centro_custo_tipo, categoria_indireta,
    origem, pendente_natureza, mes_competencia_estimado, dias_atraso_estimado
  )
  SELECT
    p_snapshot_id, f.ref_lancamento, f.filial, f.cod_ccusto, f.desc_ccusto,
    f.obra_id, f.natureza_tipo_matriz, f.status_final,
    public.fn_financeiro_status_label(f.status_final),
    f.tipo_documento, f.numero_documento, f.cnpj_cpf, f.nome, f.nome_fantasia, f.nome,
    COALESCE(NULLIF(f.valor_original_matriz, 0), f.valor_matriz, 0), 0,
    f.valor_matriz,
    CASE
      WHEN f.status_final = 3 THEN f.valor_matriz
      WHEN f.status_final = 15 THEN LEAST(f.valor_baixado_matriz, f.valor_matriz)
      ELSE 0
    END,
    f.data_emissao_matriz, f.data_vencimento_matriz, f.data_baixa_matriz, f.data_baixa_matriz,
    CASE WHEN f.data_vencimento_matriz IS NULL THEN NULL
         ELSE GREATEST(v_data_snapshot - f.data_vencimento_matriz, 0) END,
    date_trunc('month', COALESCE(f.data_emissao_matriz, v_data_snapshot))::date,
    f.historico, COALESCE(f.centro_tipo, 'nao_classificado'), f.centro_categoria,
    'totvs', (f.natureza_tipo_matriz IS NULL), (f.data_emissao_matriz IS NULL),
    (f.data_vencimento_matriz IS NOT NULL)
  FROM fonte f;

  SELECT COUNT(*), COALESCE(SUM(valor_liquido), 0)
    INTO v_total_titulos, v_total_valor
  FROM public.financeiro_lancamentos
  WHERE snapshot_id = p_snapshot_id AND origem = 'totvs';

  UPDATE public.financeiro_snapshots
     SET total_titulos = v_total_titulos, total_valor = v_total_valor
   WHERE id = p_snapshot_id;

  v_rollup_rows := public.fn_materializar_financeiro_evolucao_rollup(p_snapshot_id);

  RETURN jsonb_build_object(
    'snapshot_id', p_snapshot_id,
    'total_titulos', v_total_titulos,
    'total_valor', v_total_valor,
    'rollup_rows', v_rollup_rows
  );
END
$$;

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

  WITH del AS (
    DELETE FROM public.financeiro_matriz_rateios m
    WHERE NOT EXISTS (
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
      historico, valor_liquido, valor_baixado, data_baixa, status_cod_matriz, atualizado_em
    )
    SELECT ref_lancamento, cod_natureza, desc_natureza, grupo, subgrupo,
      cod_ccusto, desc_ccusto, valor_rateio, valor_original, situacao_presumida,
      data_emissao, data_vencimento, natureza_tipo_matriz,
      filial, tipo_documento, numero_documento, cnpj_cpf, nome, nome_fantasia,
      historico, valor_liquido, valor_baixado, data_baixa, status_cod_matriz, now()
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
      status_cod_matriz=EXCLUDED.status_cod_matriz, atualizado_em=now()
    WHERE ROW(m.desc_natureza,m.grupo,m.subgrupo,m.desc_ccusto,m.valor_rateio,m.valor_original,
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