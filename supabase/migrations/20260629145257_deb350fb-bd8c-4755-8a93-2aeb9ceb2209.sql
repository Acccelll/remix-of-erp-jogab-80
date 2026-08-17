CREATE OR REPLACE VIEW public.vw_cutover_metrics_financeiro AS
SELECT
  obra_id,
  count(*)::bigint AS lancamentos_total,
  count(*) FILTER (WHERE valor_baixado IS NULL OR valor_baixado < valor_liquido)::bigint AS lancamentos_abertos,
  count(*) FILTER (WHERE valor_baixado IS NOT NULL AND valor_baixado >= valor_liquido)::bigint AS lancamentos_baixados,
  count(DISTINCT cnpj_cpf)::bigint AS fornecedores_distintos,
  coalesce(sum(valor_liquido),0)::numeric AS valor_total,
  coalesce(sum(valor_liquido) FILTER (WHERE valor_baixado IS NULL OR valor_baixado < valor_liquido),0)::numeric AS valor_aberto,
  max(data_emissao) AS ultima_emissao,
  count(*) FILTER (WHERE pendente_natureza)::bigint AS pendentes_natureza
FROM public.financeiro_lancamentos
WHERE obra_id IS NOT NULL
GROUP BY obra_id;
GRANT SELECT ON public.vw_cutover_metrics_financeiro TO authenticated, service_role;

CREATE OR REPLACE VIEW public.vw_cutover_metrics_ponto AS
SELECT
  pr.obra_id,
  count(DISTINCT pr.colaborador_id)::bigint AS colaboradores_distintos,
  count(*)::bigint AS registros_total,
  count(*) FILTER (WHERE pr.data >= (current_date - interval '30 days'))::bigint AS registros_30d,
  max(pr.data) AS ultimo_registro,
  count(DISTINCT pt.id)::bigint AS tratativas,
  count(*) FILTER (WHERE pr.marcacao_invalida)::bigint AS invalidas
FROM public.ponto_registros pr
LEFT JOIN public.ponto_tratativas pt ON pt.registro_id = pr.id
WHERE pr.obra_id IS NOT NULL
GROUP BY pr.obra_id;
GRANT SELECT ON public.vw_cutover_metrics_ponto TO authenticated, service_role;