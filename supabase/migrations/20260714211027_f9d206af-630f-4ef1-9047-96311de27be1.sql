ALTER TABLE public.financeiro_lancamentos
  ADD COLUMN IF NOT EXISTS pendente_natureza boolean NOT NULL DEFAULT false;

ALTER TABLE public.financeiro_matriz_rateios
  ADD COLUMN IF NOT EXISTS data_emissao date,
  ADD COLUMN IF NOT EXISTS data_vencimento date;

CREATE INDEX IF NOT EXISTS idx_fin_matriz_vencimento
  ON public.financeiro_matriz_rateios(data_vencimento);

CREATE INDEX IF NOT EXISTS idx_fin_lanc_pendente_natureza
  ON public.financeiro_lancamentos(pendente_natureza);

CREATE OR REPLACE FUNCTION public.fn_financeiro_status_matriz(
  p_situacao text,
  p_data_vencimento date,
  p_data_snapshot date DEFAULT CURRENT_DATE
)
RETURNS smallint
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $function$
  SELECT CASE
    WHEN lower(coalesce(p_situacao, '')) LIKE '%cancel%' THEN 18::smallint
    WHEN lower(coalesce(p_situacao, '')) IN ('baixa', 'baixado') THEN 3::smallint
    WHEN lower(coalesce(p_situacao, '')) LIKE '%parcial%' THEN 15::smallint
    WHEN lower(coalesce(p_situacao, '')) LIKE '%venc%' THEN 40::smallint
    WHEN p_data_vencimento IS NOT NULL AND p_data_vencimento < p_data_snapshot THEN 40::smallint
    WHEN p_data_vencimento IS NOT NULL AND p_data_vencimento = p_data_snapshot THEN 29::smallint
    ELSE 56::smallint
  END
$function$;

CREATE OR REPLACE FUNCTION public.fn_financeiro_status_label(p_status smallint)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path TO 'public'
AS $function$
  SELECT CASE p_status
    WHEN 3 THEN 'Baixado'
    WHEN 15 THEN 'Baixado - Parcial'
    WHEN 18 THEN 'Cancelado'
    WHEN 29 THEN 'Vence Hoje'
    WHEN 40 THEN 'Vencido'
    WHEN 56 THEN 'A Vencer'
    ELSE NULL
  END
$function$;

CREATE OR REPLACE FUNCTION public.fn_materializar_financeiro_evolucao_rollup(p_snapshot_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_data_snapshot date;
  v_rows integer := 0;
BEGIN
  SELECT importado_em::date INTO v_data_snapshot
  FROM public.financeiro_snapshots
  WHERE id = p_snapshot_id;

  IF v_data_snapshot IS NULL THEN
    RAISE EXCEPTION 'Snapshot financeiro não encontrado: %', p_snapshot_id;
  END IF;

  DELETE FROM public.financeiro_evolucao_rollup
  WHERE snapshot_id = p_snapshot_id;

  WITH fatias_matriz AS (
    SELECT
      l.id AS lancamento_id,
      l.ref_lancamento,
      l.status_cod,
      l.status_label,
      COALESCE(l.valor_baixado, 0) AS titulo_valor_baixado,
      COALESCE(l.valor_liquido, 0) AS titulo_valor_liquido,
      m.cod_natureza,
      m.desc_natureza,
      COALESCE(m.grupo, split_part(COALESCE(m.cod_natureza, ''), '.', 1)) AS grupo,
      m.cod_ccusto,
      GREATEST(COALESCE(m.valor_rateio, 0), 0) AS valor_rateio,
      COALESCE(cct.obra_id, l.obra_id) AS fatia_obra_id
    FROM public.financeiro_lancamentos l
    JOIN public.financeiro_matriz_rateios m ON m.ref_lancamento = l.ref_lancamento
    LEFT JOIN public.centros_custo_totvs cct ON cct.codigo = m.cod_ccusto
    WHERE l.snapshot_id = p_snapshot_id
      AND l.origem = 'totvs'
      AND l.pendente_natureza = false
      AND COALESCE(l.status_cod, 0) <> 18
  ), normalizado AS (
    SELECT
      f.*,
      SUM(f.valor_rateio) OVER (PARTITION BY f.lancamento_id) AS soma_rateios,
      CASE
        WHEN f.status_cod = 3 THEN 1::numeric
        WHEN COALESCE(f.titulo_valor_liquido, 0) = 0 THEN 0::numeric
        ELSE LEAST(1::numeric, GREATEST(0::numeric,
          COALESCE(f.titulo_valor_baixado, 0) / NULLIF(f.titulo_valor_liquido, 0)))
      END AS ratio_pago
    FROM fatias_matriz f
  ), calc AS (
    SELECT
      n.*,
      CASE
        WHEN COALESCE(n.soma_rateios, 0) = 0 THEN 0::numeric
        ELSE n.valor_rateio / n.soma_rateios
      END AS peso_fatia
    FROM normalizado n
  ), agg AS (
    SELECT
      v_data_snapshot AS data_snapshot,
      fatia_obra_id AS obra_id,
      status_cod,
      MAX(status_label) AS status_label,
      grupo,
      cod_natureza,
      MAX(desc_natureza) AS desc_natureza,
      ROUND(SUM(valor_rateio * (1 - ratio_pago))::numeric, 2) AS valor_aberto,
      ROUND(SUM(valor_rateio * ratio_pago)::numeric, 2) AS valor_pago,
      COUNT(DISTINCT lancamento_id) AS qtd_titulos
    FROM calc
    GROUP BY fatia_obra_id, status_cod, grupo, cod_natureza
  ), ins AS (
    INSERT INTO public.financeiro_evolucao_rollup (
      snapshot_id, data_snapshot, obra_id, status_cod, status_label,
      grupo, cod_natureza, desc_natureza, valor_aberto, valor_pago, qtd_titulos
    )
    SELECT
      p_snapshot_id, data_snapshot, obra_id, status_cod, status_label,
      grupo, cod_natureza, desc_natureza, valor_aberto, valor_pago, qtd_titulos
    FROM agg
    WHERE COALESCE(valor_aberto, 0) <> 0 OR COALESCE(valor_pago, 0) <> 0 OR qtd_titulos > 0
    RETURNING id
  )
  SELECT count(*) INTO v_rows FROM ins;

  RETURN v_rows;
END;
$function$;

CREATE OR REPLACE FUNCTION public.fn_reconstruir_snapshot_matriz_central(p_snapshot_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_data_snapshot date;
  v_total_titulos integer := 0;
  v_total_rateios integer := 0;
  v_total_valor numeric := 0;
  v_titulos_sem_obra integer := 0;
  v_novos_sem_natureza integer := 0;
  v_rollup_rows integer := 0;
  v_matriz_em timestamptz;
BEGIN
  SELECT importado_em::date INTO v_data_snapshot
  FROM public.financeiro_snapshots
  WHERE id = p_snapshot_id;

  IF v_data_snapshot IS NULL THEN
    RAISE EXCEPTION 'Snapshot financeiro não encontrado: %', p_snapshot_id;
  END IF;

  DROP TABLE IF EXISTS pg_temp._fin_status_src;
  CREATE TEMP TABLE _fin_status_src ON COMMIT DROP AS
  SELECT DISTINCT ON (l.ref_lancamento)
    l.ref_lancamento,
    l.filial,
    l.natureza_tipo,
    l.status_cod,
    l.status_label,
    l.tipo_documento,
    l.numero_documento,
    l.cnpj_cpf,
    l.nome,
    l.nome_fantasia,
    l.cliente_fornecedor,
    l.valor_original,
    l.valor_desconto,
    l.valor_liquido,
    l.valor_baixado,
    l.data_emissao,
    l.data_vencimento,
    l.data_baixa,
    l.data_pagamento,
    l.dias_atraso,
    l.mes_competencia,
    l.historico,
    l.centro_custo,
    l.desc_centro_custo,
    l.obra_id,
    l.centro_custo_tipo,
    l.categoria_indireta
  FROM public.financeiro_lancamentos l
  WHERE l.snapshot_id = p_snapshot_id
    AND l.origem = 'totvs'
  ORDER BY l.ref_lancamento,
    CASE WHEN l.status_cod IS NOT NULL THEN 0 ELSE 1 END,
    l.id;

  DELETE FROM public.financeiro_lancamentos
  WHERE snapshot_id = p_snapshot_id
    AND origem = 'totvs';

  WITH matriz_base AS (
    SELECT
      m.ref_lancamento,
      SUM(GREATEST(COALESCE(m.valor_rateio, 0), 0))::numeric AS valor_matriz,
      SUM(GREATEST(COALESCE(NULLIF(m.valor_original, 0), m.valor_rateio, 0), 0))::numeric AS valor_original_matriz,
      MIN(m.data_emissao) FILTER (WHERE m.data_emissao IS NOT NULL) AS data_emissao_matriz,
      MIN(m.data_vencimento) FILTER (WHERE m.data_vencimento IS NOT NULL) AS data_vencimento_matriz,
      CASE
        WHEN bool_or(lower(coalesce(m.situacao_presumida, '')) LIKE '%cancel%') THEN 'CANCELADO'
        WHEN bool_or(lower(coalesce(m.situacao_presumida, '')) LIKE '%venc%') THEN 'VENCIDO'
        WHEN bool_or(lower(coalesce(m.situacao_presumida, '')) LIKE '%aberto%') THEN 'EM ABERTO'
        WHEN bool_or(lower(coalesce(m.situacao_presumida, '')) LIKE '%parcial%') THEN 'BAIXA PARCIAL'
        WHEN bool_or(lower(coalesce(m.situacao_presumida, '')) IN ('baixa', 'baixado')) THEN 'BAIXA'
        ELSE NULL
      END AS situacao_matriz
    FROM public.financeiro_matriz_rateios m
    GROUP BY m.ref_lancamento
  ), principal_cc AS (
    SELECT DISTINCT ON (m.ref_lancamento)
      m.ref_lancamento,
      m.cod_ccusto,
      m.desc_ccusto,
      cct.obra_id,
      cct.tipo,
      cct.categoria
    FROM public.financeiro_matriz_rateios m
    LEFT JOIN public.centros_custo_totvs cct ON cct.codigo = m.cod_ccusto
    ORDER BY m.ref_lancamento, GREATEST(COALESCE(m.valor_rateio, 0), 0) DESC, m.cod_ccusto NULLS LAST
  ), matriz_ins AS (
    INSERT INTO public.financeiro_lancamentos (
      snapshot_id, ref_lancamento, filial, centro_custo, desc_centro_custo,
      obra_id, natureza_tipo, status_cod, status_label, tipo_documento, numero_documento,
      cnpj_cpf, nome, nome_fantasia, cliente_fornecedor,
      valor_original, valor_desconto, valor_liquido, valor_baixado,
      data_emissao, data_vencimento, data_baixa, data_pagamento,
      dias_atraso, mes_competencia, historico, centro_custo_tipo, categoria_indireta,
      origem, pendente_natureza
    )
    SELECT
      p_snapshot_id,
      mb.ref_lancamento,
      s.filial,
      pc.cod_ccusto,
      pc.desc_ccusto,
      COALESCE(pc.obra_id, s.obra_id),
      s.natureza_tipo,
      COALESCE(s.status_cod, public.fn_financeiro_status_matriz(mb.situacao_matriz, mb.data_vencimento_matriz, v_data_snapshot)) AS status_cod,
      COALESCE(s.status_label, public.fn_financeiro_status_label(public.fn_financeiro_status_matriz(mb.situacao_matriz, mb.data_vencimento_matriz, v_data_snapshot))) AS status_label,
      s.tipo_documento,
      s.numero_documento,
      s.cnpj_cpf,
      s.nome,
      s.nome_fantasia,
      s.cliente_fornecedor,
      COALESCE(NULLIF(mb.valor_original_matriz, 0), mb.valor_matriz, 0),
      COALESCE(s.valor_desconto, 0),
      COALESCE(mb.valor_matriz, 0),
      CASE
        WHEN COALESCE(s.status_cod, public.fn_financeiro_status_matriz(mb.situacao_matriz, mb.data_vencimento_matriz, v_data_snapshot)) = 3
          THEN COALESCE(mb.valor_matriz, 0)
        WHEN COALESCE(s.status_cod, public.fn_financeiro_status_matriz(mb.situacao_matriz, mb.data_vencimento_matriz, v_data_snapshot)) = 15
          THEN LEAST(GREATEST(COALESCE(s.valor_baixado, 0), 0), COALESCE(mb.valor_matriz, 0))
        ELSE 0
      END,
      COALESCE(mb.data_emissao_matriz, s.data_emissao),
      COALESCE(mb.data_vencimento_matriz, s.data_vencimento),
      s.data_baixa,
      s.data_pagamento,
      CASE
        WHEN COALESCE(mb.data_vencimento_matriz, s.data_vencimento) IS NULL THEN s.dias_atraso
        ELSE GREATEST((v_data_snapshot - COALESCE(mb.data_vencimento_matriz, s.data_vencimento)), 0)
      END,
      COALESCE(s.mes_competencia, date_trunc('month', COALESCE(mb.data_emissao_matriz, s.data_emissao, v_data_snapshot))::date),
      s.historico,
      COALESCE(pc.tipo, s.centro_custo_tipo, 'nao_classificado'),
      COALESCE(pc.categoria, s.categoria_indireta),
      'totvs',
      false
    FROM matriz_base mb
    LEFT JOIN principal_cc pc ON pc.ref_lancamento = mb.ref_lancamento
    LEFT JOIN pg_temp._fin_status_src s ON s.ref_lancamento = mb.ref_lancamento
    RETURNING id, ref_lancamento, obra_id, valor_liquido
  ), report_only_ins AS (
    INSERT INTO public.financeiro_lancamentos (
      snapshot_id, ref_lancamento, filial, centro_custo, desc_centro_custo,
      obra_id, natureza_tipo, status_cod, status_label, tipo_documento, numero_documento,
      cnpj_cpf, nome, nome_fantasia, cliente_fornecedor,
      valor_original, valor_desconto, valor_liquido, valor_baixado,
      data_emissao, data_vencimento, data_baixa, data_pagamento,
      dias_atraso, mes_competencia, historico, centro_custo_tipo, categoria_indireta,
      origem, pendente_natureza
    )
    SELECT
      p_snapshot_id, s.ref_lancamento, s.filial, s.centro_custo, s.desc_centro_custo,
      s.obra_id, s.natureza_tipo, s.status_cod, s.status_label, s.tipo_documento, s.numero_documento,
      s.cnpj_cpf, s.nome, s.nome_fantasia, s.cliente_fornecedor,
      COALESCE(s.valor_original, 0), COALESCE(s.valor_desconto, 0), COALESCE(s.valor_liquido, 0), COALESCE(s.valor_baixado, 0),
      s.data_emissao, s.data_vencimento, s.data_baixa, s.data_pagamento,
      s.dias_atraso, s.mes_competencia, s.historico, COALESCE(s.centro_custo_tipo, 'nao_classificado'), s.categoria_indireta,
      'totvs', true
    FROM pg_temp._fin_status_src s
    WHERE NOT EXISTS (
      SELECT 1 FROM public.financeiro_matriz_rateios m WHERE m.ref_lancamento = s.ref_lancamento
    )
    RETURNING id, ref_lancamento, obra_id, valor_liquido
  ), ins_all AS (
    SELECT * FROM matriz_ins
    UNION ALL
    SELECT * FROM report_only_ins
  )
  SELECT
    COUNT(*),
    COALESCE(SUM(valor_liquido), 0),
    COUNT(*) FILTER (WHERE obra_id IS NULL),
    COUNT(*) FILTER (WHERE EXISTS (
      SELECT 1 FROM public.financeiro_lancamentos l
      WHERE l.id = ins_all.id AND l.pendente_natureza = true
    ))
  INTO v_total_titulos, v_total_valor, v_titulos_sem_obra, v_novos_sem_natureza
  FROM ins_all;

  INSERT INTO public.financeiro_rateios (
    lancamento_id, cod_natureza, desc_natureza, grupo, subgrupo, valor_rateio, status_lancamento
  )
  SELECT
    l.id,
    m.cod_natureza,
    m.desc_natureza,
    COALESCE(m.grupo, split_part(COALESCE(m.cod_natureza, ''), '.', 1)),
    COALESCE(m.subgrupo,
      CASE WHEN m.cod_natureza ~ '^[0-9]+\.[0-9]+'
        THEN split_part(m.cod_natureza, '.', 1) || '.' || split_part(m.cod_natureza, '.', 2)
        ELSE NULL END),
    m.valor_rateio,
    m.situacao_presumida
  FROM public.financeiro_lancamentos l
  JOIN public.financeiro_matriz_rateios m ON m.ref_lancamento = l.ref_lancamento
  WHERE l.snapshot_id = p_snapshot_id
    AND l.origem = 'totvs'
    AND l.pendente_natureza = false;

  GET DIAGNOSTICS v_total_rateios = ROW_COUNT;

  SELECT MAX(atualizado_em) INTO v_matriz_em FROM public.financeiro_matriz_rateios;

  v_rollup_rows := public.fn_materializar_financeiro_evolucao_rollup(p_snapshot_id);

  UPDATE public.financeiro_snapshots
  SET total_titulos = v_total_titulos,
      total_rateios = v_total_rateios,
      total_valor = v_total_valor,
      titulos_sem_obra = v_titulos_sem_obra,
      novos_sem_natureza = v_novos_sem_natureza,
      matriz_atualizada_em = v_matriz_em
  WHERE id = p_snapshot_id;

  RETURN jsonb_build_object(
    'snapshot_id', p_snapshot_id,
    'total_titulos', v_total_titulos,
    'total_rateios', v_total_rateios,
    'total_valor', v_total_valor,
    'titulos_sem_obra', v_titulos_sem_obra,
    'novos_sem_natureza', v_novos_sem_natureza,
    'rollup_linhas', v_rollup_rows,
    'matriz_atualizada_em', v_matriz_em
  );
END;
$function$;

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
  v_reprocessados INT := 0;
BEGIN
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
    NULLIF(e->>'data_vencimento','')::DATE AS data_vencimento
  FROM jsonb_array_elements(COALESCE(p_rateios, '[]'::jsonb)) AS e
  WHERE NULLIF(e->>'ref_lancamento','') IS NOT NULL;

  SELECT COUNT(*), COUNT(DISTINCT ref_lancamento) INTO v_total, v_titulos FROM _src;

  CREATE TEMP TABLE _src_uniq ON COMMIT DROP AS
  SELECT DISTINCT ON (ref_lancamento, COALESCE(cod_natureza,''), COALESCE(cod_ccusto,''))
    *
  FROM _src
  ORDER BY ref_lancamento, COALESCE(cod_natureza,''), COALESCE(cod_ccusto,''), valor_rateio DESC;

  WITH joined AS (
    SELECT s.*,
      m.desc_natureza AS m_desc_natureza,
      m.grupo AS m_grupo,
      m.subgrupo AS m_subgrupo,
      m.desc_ccusto AS m_desc_ccusto,
      m.valor_rateio AS m_valor_rateio,
      m.valor_original AS m_valor_original,
      m.situacao_presumida AS m_situacao_presumida,
      m.data_emissao AS m_data_emissao,
      m.data_vencimento AS m_data_vencimento,
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
      OR data_emissao                    IS DISTINCT FROM m_data_emissao
      OR data_vencimento                 IS DISTINCT FROM m_data_vencimento
    )),
    COUNT(*) FILTER (WHERE NOT is_new AND NOT (
         COALESCE(desc_natureza,'')      IS DISTINCT FROM COALESCE(m_desc_natureza,'')
      OR COALESCE(grupo,'')              IS DISTINCT FROM COALESCE(m_grupo,'')
      OR COALESCE(subgrupo,'')           IS DISTINCT FROM COALESCE(m_subgrupo,'')
      OR COALESCE(desc_ccusto,'')        IS DISTINCT FROM COALESCE(m_desc_ccusto,'')
      OR valor_rateio                    IS DISTINCT FROM m_valor_rateio
      OR valor_original                  IS DISTINCT FROM m_valor_original
      OR COALESCE(situacao_presumida,'') IS DISTINCT FROM COALESCE(m_situacao_presumida,'')
      OR data_emissao                    IS DISTINCT FROM m_data_emissao
      OR data_vencimento                 IS DISTINCT FROM m_data_vencimento
    ))
  INTO v_novos, v_alterados, v_inalterados
  FROM joined;

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
    data_emissao, data_vencimento, atualizado_em
  )
  SELECT ref_lancamento, cod_natureza, desc_natureza, grupo, subgrupo,
    cod_ccusto, desc_ccusto, valor_rateio, valor_original, situacao_presumida,
    data_emissao, data_vencimento, now()
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
    OR m.data_vencimento                 IS DISTINCT FROM EXCLUDED.data_vencimento;

  PERFORM public.fn_reconstruir_snapshot_matriz_central(s.id)
  FROM public.financeiro_snapshots s;
  GET DIAGNOSTICS v_reprocessados = ROW_COUNT;

  RETURN jsonb_build_object(
    'total_rateios', v_total,
    'titulos_distintos', v_titulos,
    'novos', v_novos,
    'alterados', v_alterados,
    'removidos', v_removidos,
    'inalterados', v_inalterados,
    'snapshots_reprocessados', v_reprocessados,
    'atualizado_em', now()
  );
END
$function$;

CREATE OR REPLACE FUNCTION public.fn_importar_relatorio_totvs(p_periodo_ref text, p_nome_titulos text, p_lancamentos jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_snapshot_id UUID;
  v_result jsonb;
  v_purged INT := 0;
BEGIN
  INSERT INTO public.financeiro_snapshots (periodo_ref, nome_arquivo_titulos)
  VALUES (p_periodo_ref, p_nome_titulos)
  RETURNING id INTO v_snapshot_id;

  WITH src AS (
    SELECT (e->>'ref_lancamento')::BIGINT AS ref_lancamento,
      NULLIF(e->>'filial','')::INT AS filial,
      e->>'centro_custo' AS centro_custo,
      e->>'desc_centro_custo' AS desc_centro_custo,
      cct.obra_id,
      cct.tipo AS centro_custo_tipo,
      cct.categoria AS categoria_indireta,
      NULLIF(e->>'natureza_tipo','')::SMALLINT AS natureza_tipo,
      NULLIF(e->>'status_cod','')::SMALLINT AS status_cod,
      e->>'status_label' AS status_label,
      e->>'tipo_documento' AS tipo_documento,
      e->>'numero_documento' AS numero_documento,
      e->>'cnpj_cpf' AS cnpj_cpf,
      e->>'nome' AS nome,
      e->>'nome_fantasia' AS nome_fantasia,
      e->>'cliente_fornecedor' AS cliente_fornecedor,
      COALESCE((e->>'valor_original')::NUMERIC,0) AS valor_original,
      COALESCE((e->>'valor_desconto')::NUMERIC,0) AS valor_desconto,
      COALESCE((e->>'valor_liquido')::NUMERIC,0) AS valor_liquido,
      COALESCE((e->>'valor_baixado')::NUMERIC,0) AS valor_baixado,
      NULLIF(e->>'data_emissao','')::DATE AS data_emissao,
      NULLIF(e->>'data_vencimento','')::DATE AS data_vencimento,
      NULLIF(e->>'data_baixa','')::DATE AS data_baixa,
      NULLIF(e->>'data_pagamento','')::DATE AS data_pagamento,
      NULLIF(e->>'dias_atraso','')::INT AS dias_atraso,
      NULLIF(e->>'mes_competencia','')::DATE AS mes_competencia,
      e->>'historico' AS historico
    FROM jsonb_array_elements(COALESCE(p_lancamentos,'[]'::jsonb)) AS e
    LEFT JOIN public.centros_custo_totvs cct ON cct.codigo = e->>'centro_custo'
    WHERE NULLIF(e->>'ref_lancamento','') IS NOT NULL
  ), dedup AS (
    SELECT DISTINCT ON (ref_lancamento) *
    FROM src
    ORDER BY ref_lancamento,
      CASE WHEN status_cod IS NOT NULL THEN 0 ELSE 1 END,
      data_emissao DESC NULLS LAST
  )
  INSERT INTO public.financeiro_lancamentos (
    snapshot_id, ref_lancamento, filial, centro_custo, desc_centro_custo,
    obra_id, natureza_tipo, status_cod, status_label, tipo_documento, numero_documento,
    cnpj_cpf, nome, nome_fantasia, cliente_fornecedor,
    valor_original, valor_desconto, valor_liquido, valor_baixado,
    data_emissao, data_vencimento, data_baixa, data_pagamento,
    dias_atraso, mes_competencia, historico, centro_custo_tipo, categoria_indireta, origem,
    pendente_natureza
  )
  SELECT v_snapshot_id, ref_lancamento, filial, centro_custo, desc_centro_custo,
    obra_id, natureza_tipo, status_cod, status_label, tipo_documento, numero_documento,
    cnpj_cpf, nome, nome_fantasia, cliente_fornecedor,
    valor_original, valor_desconto, valor_liquido, valor_baixado,
    data_emissao, data_vencimento, data_baixa, data_pagamento,
    dias_atraso, mes_competencia, historico, COALESCE(centro_custo_tipo, 'nao_classificado'), categoria_indireta, 'totvs',
    NOT EXISTS (SELECT 1 FROM public.financeiro_matriz_rateios m WHERE m.ref_lancamento = dedup.ref_lancamento)
  FROM dedup;

  v_result := public.fn_reconstruir_snapshot_matriz_central(v_snapshot_id);

  WITH ranked AS (
    SELECT id, ROW_NUMBER() OVER (ORDER BY importado_em DESC) AS rn
    FROM public.financeiro_snapshots
  ), deleted AS (
    DELETE FROM public.financeiro_snapshots WHERE id IN (SELECT id FROM ranked WHERE rn > 12) RETURNING id
  )
  SELECT COUNT(*) INTO v_purged FROM deleted;

  RETURN v_result || jsonb_build_object('snapshots_purgados', v_purged);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.fn_financeiro_status_matriz(text, date, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_financeiro_status_matriz(text, date, date) TO service_role;
GRANT EXECUTE ON FUNCTION public.fn_financeiro_status_label(smallint) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_financeiro_status_label(smallint) TO service_role;
GRANT EXECUTE ON FUNCTION public.fn_reconstruir_snapshot_matriz_central(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_reconstruir_snapshot_matriz_central(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.fn_materializar_financeiro_evolucao_rollup(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_materializar_financeiro_evolucao_rollup(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.fn_importar_matriz(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_importar_matriz(jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.fn_importar_relatorio_totvs(text, text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_importar_relatorio_totvs(text, text, jsonb) TO service_role;

SELECT public.fn_reconstruir_snapshot_matriz_central(id)
FROM public.financeiro_snapshots;
