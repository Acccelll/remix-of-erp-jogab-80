
CREATE OR REPLACE VIEW public.vw_faturamento_nfse_orfas AS
SELECT
  f.id,
  f.numero_nfse,
  f.data_emissao,
  f.competencia,
  f.tomador_cnpj,
  f.tomador_razao,
  f.tomador_municipio,
  f.tomador_uf,
  f.municipio_prestacao,
  f.codigo_obra,
  f.codigo_obra_interno,
  f.valor_servicos,
  f.valor_liquido,
  f.discriminacao,
  f.status,
  f.origem,
  f.created_at
FROM public.faturamento_nfse f
WHERE f.obra_id IS NULL
ORDER BY f.data_emissao DESC NULLS LAST, f.valor_servicos DESC NULLS LAST;

GRANT SELECT ON public.vw_faturamento_nfse_orfas TO authenticated;
GRANT SELECT ON public.vw_faturamento_nfse_orfas TO service_role;
