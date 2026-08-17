/** @module-kind pure */
// Projeção explícita para consultas da view `vw_financeiro_obra`.
// PERF-002 (Onda 4) — evita `select("*")` nas listas alimentadas por esta view.

export const VW_FINANCEIRO_OBRA_COLS = [
  "lancamento_id",
  "obra_id",
  "natureza_tipo",
  "status_cod",
  "status_label",
  "grupo",
  "subgrupo",
  "cod_natureza",
  "desc_natureza",
  "valor_liquido",
  "valor_baixado",
  "valor_rateio",
  "mes_competencia",
  "data_vencimento",
  "data_pagamento",
  "contraparte",
  "ref_lancamento",
  "centro_custo",
  "desc_centro_custo",
  "centro_custo_tipo",
  "categoria_indireta",
  "data_emissao",
].join(",");
