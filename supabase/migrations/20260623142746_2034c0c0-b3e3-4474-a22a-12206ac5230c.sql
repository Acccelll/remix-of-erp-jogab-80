-- Backfill obra_id em faturamento_nfse usando o prefixo numérico do nome da obra
-- (ex: "209 - MARFRIG"), casando com codigo_obra_interno ou codigo_obra.
WITH obras_pref AS (
  SELECT id,
         NULLIF(substring(nome from '^\s*(\d{2,4}(?:\.\d+)?)\b'), '') AS pref,
         codigo,
         codigo_totvs
    FROM public.obras
)
UPDATE public.faturamento_nfse n
   SET obra_id = o.id
  FROM obras_pref o
 WHERE n.obra_id IS NULL
   AND (
     (NULLIF(trim(n.codigo_obra_interno), '') IS NOT NULL
        AND trim(n.codigo_obra_interno) = o.pref)
     OR (NULLIF(trim(n.codigo_obra), '') IS NOT NULL
        AND (trim(n.codigo_obra) = o.codigo OR trim(n.codigo_obra) = o.codigo_totvs))
   );