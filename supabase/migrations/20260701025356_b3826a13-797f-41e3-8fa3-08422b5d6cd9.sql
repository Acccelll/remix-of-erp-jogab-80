-- Fase 4 · Onda B: visão consolidada por obra + índices quentes de cards

CREATE OR REPLACE VIEW public.vw_obra_dashboard
WITH (security_invoker = true) AS
WITH crono AS (
  SELECT
    ci.obra_id,
    count(*) FILTER (WHERE ci.ativo IS DISTINCT FROM false) AS cronograma_itens_total,
    coalesce(sum(coalesce(ci.custo_baseline, ci.custo, 0)) FILTER (WHERE ci.ativo IS DISTINCT FROM false), 0) AS cronograma_custo_base,
    coalesce(sum(coalesce(ci.custo_baseline, ci.custo, 0) * coalesce(ci.percentual_previsto, 0) / 100) FILTER (WHERE ci.ativo IS DISTINCT FROM false), 0) AS cronograma_previsto_valor,
    coalesce(sum(coalesce(ci.custo_baseline, ci.custo, 0) * coalesce(ci.percentual_realizado, 0) / 100) FILTER (WHERE ci.ativo IS DISTINCT FROM false), 0) AS cronograma_realizado_valor,
    coalesce(avg(ci.percentual_previsto) FILTER (WHERE ci.ativo IS DISTINCT FROM false), 0) AS percentual_previsto_medio,
    coalesce(avg(ci.percentual_realizado) FILTER (WHERE ci.ativo IS DISTINCT FROM false), 0) AS percentual_realizado_medio,
    min(ci.data_inicio) FILTER (WHERE ci.ativo IS DISTINCT FROM false) AS cronograma_inicio,
    max(ci.data_fim) FILTER (WHERE ci.ativo IS DISTINCT FROM false) AS cronograma_fim,
    count(*) FILTER (WHERE ci.critico IS TRUE AND ci.ativo IS DISTINCT FROM false) AS itens_criticos_total
  FROM public.cronograma_itens ci
  GROUP BY ci.obra_id
), nf AS (
  SELECT
    n.obra_id,
    count(*) AS notas_fiscais_total,
    coalesce(sum(coalesce(n.valor_liquido, n.valor, 0)), 0) AS valor_faturado,
    max(n.data_emissao) AS ultima_nf_emissao
  FROM public.notas_fiscais n
  GROUP BY n.obra_id
), receb AS (
  SELECT
    r.obra_id,
    count(*) AS recebimentos_total,
    coalesce(sum(coalesce(r.valor_previsto, 0)), 0) AS valor_receber_previsto,
    coalesce(sum(coalesce(r.valor_recebido, r.valor_previsto, 0)) FILTER (WHERE r.data_recebimento IS NOT NULL), 0) AS valor_recebido
  FROM public.recebimentos r
  GROUP BY r.obra_id
), med AS (
  SELECT
    m.obra_id,
    count(*) AS medicoes_total,
    coalesce(sum(m.valor) FILTER (WHERE m.status::text IN ('aprovada', 'faturada', 'enviada')), 0) AS valor_medido_aprovado,
    max(m.data_corte) AS ultima_medicao_data
  FROM public.medicoes m
  GROUP BY m.obra_id
), sup AS (
  SELECT
    o.id AS obra_id,
    coalesce(req.requisicoes_total, 0) AS requisicoes_total,
    coalesce(oc.ordens_compra_total, 0) AS ordens_compra_total,
    coalesce(oc.valor_ordens_compra, 0) AS valor_ordens_compra
  FROM public.obras o
  LEFT JOIN (
    SELECT obra_id, count(*) AS requisicoes_total
    FROM public.requisicoes
    GROUP BY obra_id
  ) req ON req.obra_id = o.id
  LEFT JOIN (
    SELECT obra_id, count(*) AS ordens_compra_total, coalesce(sum(valor_total), 0) AS valor_ordens_compra
    FROM public.ordens_compra
    GROUP BY obra_id
  ) oc ON oc.obra_id = o.id
)
SELECT
  o.id AS obra_id,
  o.codigo,
  o.nome,
  o.status,
  o.valor_contrato,
  o.data_previsao_termino,
  o.data_fim,
  coalesce(c.cronograma_itens_total, 0) AS cronograma_itens_total,
  coalesce(c.cronograma_custo_base, 0) AS cronograma_custo_base,
  coalesce(c.cronograma_previsto_valor, 0) AS cronograma_previsto_valor,
  coalesce(c.cronograma_realizado_valor, 0) AS cronograma_realizado_valor,
  coalesce(c.percentual_previsto_medio, 0) AS percentual_previsto_medio,
  coalesce(c.percentual_realizado_medio, 0) AS percentual_realizado_medio,
  c.cronograma_inicio,
  c.cronograma_fim,
  coalesce(c.itens_criticos_total, 0) AS itens_criticos_total,
  coalesce(nf.notas_fiscais_total, 0) AS notas_fiscais_total,
  coalesce(nf.valor_faturado, 0) AS valor_faturado,
  nf.ultima_nf_emissao,
  coalesce(receb.recebimentos_total, 0) AS recebimentos_total,
  coalesce(receb.valor_receber_previsto, 0) AS valor_receber_previsto,
  coalesce(receb.valor_recebido, 0) AS valor_recebido,
  coalesce(med.medicoes_total, 0) AS medicoes_total,
  coalesce(med.valor_medido_aprovado, 0) AS valor_medido_aprovado,
  med.ultima_medicao_data,
  coalesce(sup.requisicoes_total, 0) AS requisicoes_total,
  coalesce(sup.ordens_compra_total, 0) AS ordens_compra_total,
  coalesce(sup.valor_ordens_compra, 0) AS valor_ordens_compra,
  CASE
    WHEN coalesce(o.valor_contrato, 0) > 0 THEN coalesce(nf.valor_faturado, 0) / o.valor_contrato * 100
    ELSE 0
  END AS percentual_faturado,
  CASE
    WHEN coalesce(o.valor_contrato, 0) > 0 THEN coalesce(receb.valor_recebido, 0) / o.valor_contrato * 100
    ELSE 0
  END AS percentual_recebido
FROM public.obras o
LEFT JOIN crono c ON c.obra_id = o.id
LEFT JOIN nf ON nf.obra_id = o.id
LEFT JOIN receb ON receb.obra_id = o.id
LEFT JOIN med ON med.obra_id = o.id
LEFT JOIN sup ON sup.obra_id = o.id;

GRANT SELECT ON public.vw_obra_dashboard TO authenticated;
GRANT SELECT ON public.vw_obra_dashboard TO service_role;

CREATE INDEX IF NOT EXISTS idx_card_label_links_card_only ON public.card_label_links (card_id);
CREATE INDEX IF NOT EXISTS idx_card_checklist_itens_card_concluido ON public.card_checklist_itens (card_id, concluido);
CREATE INDEX IF NOT EXISTS idx_card_atividades_card_created_desc ON public.card_atividades (card_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_card_comentarios_card_created_desc ON public.card_comentarios (card_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_card_board_posicao_card_board ON public.card_board_posicao (card_id, board_id);
