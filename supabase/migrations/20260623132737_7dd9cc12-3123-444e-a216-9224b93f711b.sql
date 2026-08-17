CREATE OR REPLACE VIEW public.vw_financeiro_obra AS
WITH ultimo AS (
  SELECT financeiro_snapshots.id
  FROM public.financeiro_snapshots
  ORDER BY financeiro_snapshots.importado_em DESC
  LIMIT 1
)
SELECT
  l.id AS lancamento_id,
  CASE
    WHEN COALESCE(l.centro_custo_tipo, cct.tipo) = 'obra' THEN COALESCE(l.obra_id, cct.obra_id)
    ELSE NULL::uuid
  END AS obra_id,
  o.nome AS obra_nome,
  o.codigo AS obra_codigo,
  l.centro_custo,
  l.desc_centro_custo,
  l.ref_lancamento,
  l.natureza_tipo,
  l.status_cod,
  l.status_label,
  l.nome AS contraparte,
  l.cliente_fornecedor,
  l.valor_liquido,
  l.valor_baixado,
  l.data_emissao,
  l.data_vencimento,
  l.data_pagamento,
  l.mes_competencia,
  l.origem,
  r.cod_natureza,
  r.desc_natureza,
  r.grupo,
  r.subgrupo,
  r.valor_rateio,
  r.status_lancamento,
  COALESCE(l.centro_custo_tipo, cct.tipo, 'nao_classificado') AS centro_custo_tipo,
  COALESCE(l.categoria_indireta, cct.categoria) AS categoria_indireta
FROM public.financeiro_lancamentos l
JOIN ultimo u ON u.id = l.snapshot_id
LEFT JOIN public.centros_custo_totvs cct ON cct.codigo = l.centro_custo
LEFT JOIN public.obras o ON o.id = CASE
  WHEN COALESCE(l.centro_custo_tipo, cct.tipo) = 'obra' THEN COALESCE(l.obra_id, cct.obra_id)
  ELSE NULL::uuid
END
LEFT JOIN public.financeiro_rateios r ON r.lancamento_id = l.id;

GRANT SELECT ON public.vw_financeiro_obra TO authenticated;
GRANT SELECT ON public.vw_financeiro_obra TO service_role;