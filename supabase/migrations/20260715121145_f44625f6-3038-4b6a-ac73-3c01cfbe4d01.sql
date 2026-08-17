
-- Lacuna 2: flags de dado estimado (Matriz sem confirmação do Relatório)
ALTER TABLE public.financeiro_lancamentos
  ADD COLUMN IF NOT EXISTS mes_competencia_estimado boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS dias_atraso_estimado boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.financeiro_lancamentos.mes_competencia_estimado
  IS 'true quando mes_competencia foi inferido da Matriz (data de emissão) por ausência de valor no Relatório de Status.';
COMMENT ON COLUMN public.financeiro_lancamentos.dias_atraso_estimado
  IS 'true quando dias_atraso foi calculado a partir da data de vencimento da Matriz (não do Relatório).';

-- Lacuna 3: índice único evita duplicar divergências equivalentes entre reconstruções
CREATE UNIQUE INDEX IF NOT EXISTS uq_fin_divergencias_matriz
  ON public.financeiro_divergencias_matriz
  (ref_lancamento, campo, COALESCE(valor_matriz, ''), COALESCE(valor_relatorio, ''));

-- Recria a view para expor as flags de estimado ao cliente
DROP VIEW IF EXISTS public.vw_financeiro_obra;

CREATE VIEW public.vw_financeiro_obra
WITH (security_invoker = on)
AS
WITH ultimo AS (
  SELECT fs.id
  FROM public.financeiro_snapshots fs
  ORDER BY fs.importado_em DESC
  LIMIT 1
), base AS (
  SELECT
    l.*,
    m.id AS matriz_id,
    m.cod_natureza AS matriz_cod_natureza,
    m.desc_natureza AS matriz_desc_natureza,
    COALESCE(m.grupo, split_part(COALESCE(m.cod_natureza, ''), '.', 1)) AS matriz_grupo,
    COALESCE(
      m.subgrupo,
      CASE
        WHEN m.cod_natureza ~ '^[0-9]+\.[0-9]+'
          THEN split_part(m.cod_natureza, '.', 1) || '.' || split_part(m.cod_natureza, '.', 2)
        ELSE NULL
      END
    ) AS matriz_subgrupo,
    m.cod_ccusto AS matriz_centro_custo,
    m.desc_ccusto AS matriz_desc_centro_custo,
    GREATEST(COALESCE(m.valor_rateio, 0), 0) AS matriz_valor_rateio,
    m.situacao_presumida AS matriz_status_lancamento,
    cct.obra_id AS matriz_obra_id,
    cct.tipo AS matriz_centro_custo_tipo,
    cct.categoria AS matriz_categoria_indireta,
    SUM(GREATEST(COALESCE(m.valor_rateio, 0), 0)) OVER (
      PARTITION BY l.id, COALESCE(m.cod_ccusto, l.centro_custo, '')
    ) AS valor_total_centro
  FROM public.financeiro_lancamentos l
  JOIN ultimo u ON u.id = l.snapshot_id
  LEFT JOIN public.financeiro_matriz_rateios m
    ON m.ref_lancamento = l.ref_lancamento
   AND COALESCE(l.pendente_natureza, false) = false
  LEFT JOIN public.centros_custo_totvs cct
    ON cct.codigo = m.cod_ccusto
  WHERE l.origem = 'totvs'
), normalizado AS (
  SELECT
    b.*,
    CASE
      WHEN b.matriz_id IS NULL THEN b.id
      ELSE (
        substr(md5(b.id::text || '|' || COALESCE(b.matriz_centro_custo, b.centro_custo, '')), 1, 8) || '-' ||
        substr(md5(b.id::text || '|' || COALESCE(b.matriz_centro_custo, b.centro_custo, '')), 9, 4) || '-' ||
        substr(md5(b.id::text || '|' || COALESCE(b.matriz_centro_custo, b.centro_custo, '')), 13, 4) || '-' ||
        substr(md5(b.id::text || '|' || COALESCE(b.matriz_centro_custo, b.centro_custo, '')), 17, 4) || '-' ||
        substr(md5(b.id::text || '|' || COALESCE(b.matriz_centro_custo, b.centro_custo, '')), 21, 12)
      )::uuid
    END AS lancamento_fatia_id,
    CASE
      WHEN b.matriz_id IS NULL THEN COALESCE(b.valor_liquido, 0)
      ELSE COALESCE(b.valor_total_centro, 0)
    END AS valor_liquido_fatia,
    CASE
      WHEN b.matriz_id IS NULL THEN COALESCE(b.valor_baixado, 0)
      WHEN b.status_cod = 3 THEN COALESCE(b.valor_total_centro, 0)
      WHEN b.status_cod = 15 AND COALESCE(b.valor_liquido, 0) > 0
        THEN LEAST(
          COALESCE(b.valor_total_centro, 0),
          ROUND(COALESCE(b.valor_baixado, 0) * COALESCE(b.valor_total_centro, 0) / NULLIF(b.valor_liquido, 0), 2)
        )
      ELSE 0
    END AS valor_baixado_fatia
  FROM base b
)
SELECT
  n.lancamento_fatia_id AS lancamento_id,
  COALESCE(n.matriz_obra_id, n.obra_id) AS obra_id,
  o.nome AS obra_nome,
  o.codigo AS obra_codigo,
  COALESCE(n.matriz_centro_custo, n.centro_custo) AS centro_custo,
  COALESCE(n.matriz_desc_centro_custo, n.desc_centro_custo) AS desc_centro_custo,
  n.ref_lancamento,
  COALESCE(
    n.natureza_tipo,
    CASE
      WHEN n.matriz_grupo = '1' THEN 1::smallint
      WHEN n.matriz_grupo IN ('2', '3') THEN 2::smallint
      ELSE NULL::smallint
    END
  ) AS natureza_tipo,
  n.status_cod,
  n.status_label,
  n.nome AS contraparte,
  n.cliente_fornecedor,
  n.valor_liquido_fatia AS valor_liquido,
  n.valor_baixado_fatia AS valor_baixado,
  n.data_emissao,
  n.data_vencimento,
  n.data_pagamento,
  n.mes_competencia,
  n.mes_competencia_estimado,
  n.dias_atraso_estimado,
  n.origem,
  n.matriz_cod_natureza AS cod_natureza,
  n.matriz_desc_natureza AS desc_natureza,
  n.matriz_grupo AS grupo,
  n.matriz_subgrupo AS subgrupo,
  CASE
    WHEN n.matriz_id IS NULL THEN COALESCE(n.valor_liquido, 0)
    ELSE n.matriz_valor_rateio
  END AS valor_rateio,
  n.matriz_status_lancamento AS status_lancamento,
  n.dias_atraso,
  COALESCE(n.matriz_centro_custo_tipo, n.centro_custo_tipo, 'nao_classificado') AS centro_custo_tipo,
  COALESCE(n.matriz_categoria_indireta, n.categoria_indireta) AS categoria_indireta,
  COALESCE(n.pendente_natureza, n.matriz_id IS NULL) AS pendente_natureza
FROM normalizado n
LEFT JOIN public.obras o ON o.id = COALESCE(n.matriz_obra_id, n.obra_id);

GRANT SELECT ON public.vw_financeiro_obra TO authenticated;
GRANT SELECT ON public.vw_financeiro_obra TO service_role;

-- Reescreve a reconstrução central para (a) popular as flags de estimado
-- e (b) registrar divergências de status_cod e natureza_tipo sem duplicar.
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

  -- Divergências natureza_tipo (Relatório vs Matriz), sem duplicar
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
    AND mb.natureza_tipo_matriz <> s.natureza_tipo
    AND NOT EXISTS (
      SELECT 1 FROM public.financeiro_divergencias_matriz d
      WHERE d.ref_lancamento = mb.ref_lancamento
        AND d.campo = 'natureza_tipo'
        AND COALESCE(d.valor_matriz, '') = COALESCE(mb.natureza_tipo_matriz::text, '')
        AND COALESCE(d.valor_relatorio, '') = COALESCE(s.natureza_tipo::text, '')
    );

  -- Divergências status_cod (Relatório vs Matriz), sem duplicar
  INSERT INTO public.financeiro_divergencias_matriz (ref_lancamento, campo, valor_matriz, valor_relatorio)
  SELECT
    mb.ref_lancamento,
    'status_cod',
    public.fn_financeiro_status_matriz(mb.situacao_matriz, mb.data_vencimento_matriz, v_data_snapshot)::text,
    s.status_cod::text
  FROM _matriz_base mb
  JOIN _fin_status_src s ON s.ref_lancamento = mb.ref_lancamento
  WHERE s.status_cod IS NOT NULL
    AND s.status_cod IS DISTINCT FROM
        public.fn_financeiro_status_matriz(mb.situacao_matriz, mb.data_vencimento_matriz, v_data_snapshot)
    AND NOT EXISTS (
      SELECT 1 FROM public.financeiro_divergencias_matriz d
      WHERE d.ref_lancamento = mb.ref_lancamento
        AND d.campo = 'status_cod'
        AND COALESCE(d.valor_matriz, '') = COALESCE(
              public.fn_financeiro_status_matriz(mb.situacao_matriz, mb.data_vencimento_matriz, v_data_snapshot)::text, '')
        AND COALESCE(d.valor_relatorio, '') = COALESCE(s.status_cod::text, '')
    );

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
    p_snapshot_id,
    mb.ref_lancamento,
    s.filial,
    pc.cod_ccusto,
    pc.desc_ccusto,
    COALESCE(pc.obra_id, s.obra_id),
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
    (COALESCE(s.natureza_tipo, mb.natureza_tipo_matriz) IS NULL),
    -- mes_competencia_estimado: verdadeiro quando o valor não veio do Relatório
    (s.mes_competencia IS NULL),
    -- dias_atraso_estimado: verdadeiro quando o Relatório não trouxe dias_atraso
    -- e o cálculo caiu sobre a data de vencimento da Matriz.
    (s.dias_atraso IS NULL AND mb.data_vencimento_matriz IS NOT NULL)
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
