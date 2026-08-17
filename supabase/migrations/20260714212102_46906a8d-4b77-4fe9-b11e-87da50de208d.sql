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