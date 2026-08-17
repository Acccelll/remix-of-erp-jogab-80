
-- 1) Coluna natureza_tipo_matriz na matriz
ALTER TABLE public.financeiro_matriz_rateios
  ADD COLUMN IF NOT EXISTS natureza_tipo_matriz smallint;

COMMENT ON COLUMN public.financeiro_matriz_rateios.natureza_tipo_matriz
  IS 'PAGREC da matriz: 1=CR (receita), 2=CP (despesa). NULL quando indefinido.';

-- 2) Tabela de divergências Matriz × Relatório
CREATE TABLE IF NOT EXISTS public.financeiro_divergencias_matriz (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ref_lancamento bigint NOT NULL,
  campo text NOT NULL,
  valor_matriz text,
  valor_relatorio text,
  detectado_em timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fin_divergencias_ref
  ON public.financeiro_divergencias_matriz(ref_lancamento);
CREATE INDEX IF NOT EXISTS idx_fin_divergencias_detectado_em
  ON public.financeiro_divergencias_matriz(detectado_em DESC);

GRANT SELECT ON public.financeiro_divergencias_matriz TO authenticated;
GRANT ALL ON public.financeiro_divergencias_matriz TO service_role;

ALTER TABLE public.financeiro_divergencias_matriz ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "fin_divergencias select autenticado" ON public.financeiro_divergencias_matriz;
CREATE POLICY "fin_divergencias select autenticado"
  ON public.financeiro_divergencias_matriz
  FOR SELECT
  TO authenticated
  USING (true);

-- 3) fn_importar_matriz — passa a persistir natureza_tipo_matriz
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

  PERFORM public.fn_reconstruir_snapshot_matriz_central(s.id)
  FROM public.financeiro_snapshots s;
  GET DIAGNOSTICS v_reprocessados = ROW_COUNT;

  RETURN jsonb_build_object(
    'total_rateios', v_total,
    'titulos_distintos', v_titulos,
    'removidos', v_removidos,
    'snapshots_reprocessados', v_reprocessados,
    'atualizado_em', now()
  );
END
$function$;

-- 4) fn_reconstruir_snapshot_matriz_central — precedência Relatório > Matriz para natureza_tipo,
--    com registro de divergências. Mantemos a lógica de construção existente e ajustamos apenas
--    a coluna natureza_tipo no INSERT final.
CREATE OR REPLACE FUNCTION public.fn_reconstruir_snapshot_matriz_central(p_snapshot_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_data_snapshot date;
  v_total_titulos integer := 0;
  v_total_valor numeric := 0;
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

  -- Agrega Matriz por título (inclui natureza_tipo_matriz)
  DROP TABLE IF EXISTS pg_temp._matriz_base;
  CREATE TEMP TABLE _matriz_base ON COMMIT DROP AS
  SELECT
    m.ref_lancamento,
    SUM(GREATEST(COALESCE(m.valor_rateio, 0), 0))::numeric AS valor_matriz,
    SUM(GREATEST(COALESCE(NULLIF(m.valor_original, 0), m.valor_rateio, 0), 0))::numeric AS valor_original_matriz,
    MIN(m.data_emissao) FILTER (WHERE m.data_emissao IS NOT NULL) AS data_emissao_matriz,
    MIN(m.data_vencimento) FILTER (WHERE m.data_vencimento IS NOT NULL) AS data_vencimento_matriz,
    MAX(m.natureza_tipo_matriz) FILTER (WHERE m.natureza_tipo_matriz IS NOT NULL) AS natureza_tipo_matriz,
    CASE
      WHEN bool_or(lower(coalesce(m.situacao_presumida, '')) LIKE '%cancel%') THEN 'CANCELADO'
      WHEN bool_or(lower(coalesce(m.situacao_presumida, '')) LIKE '%venc%') THEN 'VENCIDO'
      WHEN bool_or(lower(coalesce(m.situacao_presumida, '')) LIKE '%aberto%') THEN 'EM ABERTO'
      WHEN bool_or(lower(coalesce(m.situacao_presumida, '')) LIKE '%parcial%') THEN 'BAIXA PARCIAL'
      WHEN bool_or(lower(coalesce(m.situacao_presumida, '')) IN ('baixa', 'baixado')) THEN 'BAIXA'
      ELSE NULL
    END AS situacao_matriz
  FROM public.financeiro_matriz_rateios m
  GROUP BY m.ref_lancamento;

  DROP TABLE IF EXISTS pg_temp._principal_cc;
  CREATE TEMP TABLE _principal_cc ON COMMIT DROP AS
  SELECT DISTINCT ON (m.ref_lancamento)
    m.ref_lancamento,
    m.cod_ccusto,
    m.desc_ccusto,
    cct.obra_id,
    cct.tipo,
    cct.categoria
  FROM public.financeiro_matriz_rateios m
  LEFT JOIN public.centros_custo_totvs cct ON cct.codigo = m.cod_ccusto
  ORDER BY m.ref_lancamento, GREATEST(COALESCE(m.valor_rateio, 0), 0) DESC, m.cod_ccusto NULLS LAST;

  -- Registra divergências de natureza_tipo (Relatório vs Matriz)
  INSERT INTO public.financeiro_divergencias_matriz (ref_lancamento, campo, valor_matriz, valor_relatorio)
  SELECT
    mb.ref_lancamento,
    'natureza_tipo',
    mb.natureza_tipo_matriz::text,
    s.natureza_tipo::text
  FROM _matriz_base mb
  JOIN _fin_status_src s ON s.ref_lancamento = mb.ref_lancamento
  WHERE mb.natureza_tipo_matriz IS NOT NULL
    AND s.natureza_tipo IS NOT NULL
    AND mb.natureza_tipo_matriz <> s.natureza_tipo;

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
    -- Precedência: Relatório > Matriz
    COALESCE(s.natureza_tipo, mb.natureza_tipo_matriz),
    COALESCE(s.status_cod, public.fn_financeiro_status_matriz(mb.situacao_matriz, mb.data_vencimento_matriz, v_data_snapshot)),
    COALESCE(s.status_label, public.fn_financeiro_status_label(public.fn_financeiro_status_matriz(mb.situacao_matriz, mb.data_vencimento_matriz, v_data_snapshot))),
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
    (COALESCE(s.natureza_tipo, mb.natureza_tipo_matriz) IS NULL)
  FROM _matriz_base mb
  LEFT JOIN _principal_cc pc ON pc.ref_lancamento = mb.ref_lancamento
  LEFT JOIN _fin_status_src s ON s.ref_lancamento = mb.ref_lancamento;

  SELECT COUNT(*), COALESCE(SUM(valor_liquido), 0)
    INTO v_total_titulos, v_total_valor
  FROM public.financeiro_lancamentos
  WHERE snapshot_id = p_snapshot_id AND origem = 'totvs';

  UPDATE public.financeiro_snapshots
  SET total_titulos = v_total_titulos, total_valor = v_total_valor
  WHERE id = p_snapshot_id;

  RETURN jsonb_build_object(
    'snapshot_id', p_snapshot_id,
    'total_titulos', v_total_titulos,
    'total_valor', v_total_valor
  );
END
$function$;
