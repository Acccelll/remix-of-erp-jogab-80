CREATE OR REPLACE VIEW public.vw_cutover_metrics_trello AS
SELECT
  c.obra_id,
  COUNT(*) FILTER (WHERE COALESCE(c.arquivado, false) = false) AS cards_ativos,
  COUNT(*) AS cards_total,
  COUNT(DISTINCT c.status) AS listas_distintas,
  (SELECT COUNT(DISTINCT cm.user_id) FROM public.card_membros cm
     JOIN public.cards c2 ON c2.id = cm.card_id WHERE c2.obra_id = c.obra_id) AS membros_distintos,
  MAX(c.updated_at) AS ultima_atividade
FROM public.cards c
GROUP BY c.obra_id;

GRANT SELECT ON public.vw_cutover_metrics_trello TO authenticated;
GRANT SELECT ON public.vw_cutover_metrics_trello TO service_role;

CREATE OR REPLACE VIEW public.vw_cutover_metrics_cronograma AS
SELECT
  ci.obra_id,
  COUNT(*) AS linhas_atual,
  COUNT(*) FILTER (WHERE ci.critico = true) AS criticas,
  (SELECT COUNT(*) FROM public.cronograma_baselines cb WHERE cb.obra_id = ci.obra_id) AS baselines,
  MIN(ci.data_inicio) AS data_inicio_min,
  MAX(ci.data_fim) AS data_fim_max,
  AVG(COALESCE(ci.percentual_realizado, 0))::numeric(5,2) AS pct_medio_realizado,
  AVG(COALESCE(ci.percentual_previsto, 0))::numeric(5,2) AS pct_medio_previsto
FROM public.cronograma_itens ci
WHERE ci.ativo = true
GROUP BY ci.obra_id;

GRANT SELECT ON public.vw_cutover_metrics_cronograma TO authenticated;
GRANT SELECT ON public.vw_cutover_metrics_cronograma TO service_role;