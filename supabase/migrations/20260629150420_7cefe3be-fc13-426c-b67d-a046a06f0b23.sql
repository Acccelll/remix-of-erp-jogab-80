
CREATE OR REPLACE VIEW public.vw_cutover_legacy_status AS
WITH legacy_flags AS (
  SELECT unnest(ARRAY[
    'legacy.trello_import',
    'legacy.cronograma_import',
    'legacy.financeiro_import',
    'legacy.ponto_import'
  ]) AS flag_key
),
obra_flag AS (
  SELECT
    o.id AS obra_id,
    o.nome AS obra_nome,
    o.ativa,
    lf.flag_key,
    COALESCE(
      (SELECT ff.enabled
         FROM public.feature_flags ff
        WHERE ff.flag_key = lf.flag_key
          AND ff.obra_id = o.id
        LIMIT 1),
      (SELECT ff.enabled
         FROM public.feature_flags ff
        WHERE ff.flag_key = lf.flag_key
          AND ff.obra_id IS NULL
        LIMIT 1),
      true
    ) AS enabled
  FROM public.obras o
  CROSS JOIN legacy_flags lf
)
SELECT
  obra_id,
  obra_nome,
  ativa,
  COUNT(*) FILTER (WHERE enabled = false) AS legados_desligados,
  COUNT(*) AS legados_total,
  bool_and(enabled = false) AS todos_desligados
FROM obra_flag
GROUP BY obra_id, obra_nome, ativa;

GRANT SELECT ON public.vw_cutover_legacy_status TO authenticated;
GRANT ALL  ON public.vw_cutover_legacy_status TO service_role;
