DROP VIEW IF EXISTS public.vw_financeiro_obra;

CREATE VIEW public.vw_financeiro_obra
WITH (security_invoker = on) AS
WITH ultimo AS (
  SELECT id FROM public.financeiro_snapshots
  ORDER BY importado_em DESC LIMIT 1
)
SELECT
  l.id AS lancamento_id,
  l.obra_id,
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
  r.status_lancamento
FROM public.financeiro_lancamentos l
JOIN ultimo u ON u.id = l.snapshot_id
LEFT JOIN public.obras o ON o.id = l.obra_id
LEFT JOIN public.financeiro_rateios r ON r.lancamento_id = l.id

UNION ALL

SELECT
  NULL::uuid AS lancamento_id,
  cct.obra_id,
  o.nome AS obra_nome,
  o.codigo AS obra_codigo,
  m.cod_ccusto AS centro_custo,
  m.desc_ccusto AS desc_centro_custo,
  m.ref_lancamento,
  NULL::smallint AS natureza_tipo,
  NULL::smallint AS status_cod,
  m.situacao_presumida AS status_label,
  NULL::text AS contraparte,
  NULL::text AS cliente_fornecedor,
  m.valor_original AS valor_liquido,
  0::numeric AS valor_baixado,
  NULL::date AS data_emissao,
  NULL::date AS data_vencimento,
  NULL::date AS data_pagamento,
  NULL::date AS mes_competencia,
  'totvs_matriz'::text AS origem,
  m.cod_natureza,
  m.desc_natureza,
  COALESCE(m.grupo, split_part(m.cod_natureza,'.',1)) AS grupo,
  m.subgrupo,
  m.valor_rateio,
  m.situacao_presumida AS status_lancamento
FROM public.financeiro_matriz_rateios m
LEFT JOIN public.centros_custo_totvs cct ON cct.codigo = m.cod_ccusto
LEFT JOIN public.obras o ON o.id = cct.obra_id
WHERE NOT EXISTS (SELECT 1 FROM ultimo);

GRANT SELECT ON public.vw_financeiro_obra TO authenticated;
GRANT SELECT ON public.vw_financeiro_obra TO service_role;