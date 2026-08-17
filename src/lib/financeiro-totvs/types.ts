/** @module-kind pure */
// Tipos puros do módulo financeiro TOTVS — não importam de banco.

export type NaturezaTipo = 1 | 2; // 1 = receita, 2 = despesa

/** Linha parseada de Lancamento_TOTVS.XLSX (aba "Sheet"). */
export interface LancamentoParsed {
  ref_lancamento: number;
  filial: number | null;
  natureza_tipo: NaturezaTipo | null;
  status_cod: number | null;
  status_label: string | null;
  tipo_documento: string | null;
  numero_documento: string | null;
  centro_custo: string | null;
  desc_centro_custo: string | null;
  cnpj_cpf: string | null;
  nome: string | null;
  nome_fantasia: string | null;
  cliente_fornecedor: string | null;
  valor_original: number;
  valor_desconto: number;
  valor_liquido: number;
  valor_baixado: number;
  data_emissao: string | null;
  data_vencimento: string | null;
  data_baixa: string | null;
  data_pagamento: string | null;
  dias_atraso: number | null;
  mes_competencia: string | null;
  historico: string | null;
}

/** Linha parseada de Lancamento_TOTVS_Rateios.XLSX (aba "Sheet"). */
export interface RateioParsed {
  ref_lancamento: number;
  cod_natureza: string | null;
  desc_natureza: string | null;
  status_lancamento: string | null;
  valor_rateio: number;
}

/** Linha parseada da matriz EMISSAO (uma por fatia de rateio). */
export interface MatrizRateioParsed {
  ref_lancamento: number;
  cod_natureza: string | null;
  desc_natureza: string | null;
  grupo: string | null;
  subgrupo: string | null;
  cod_ccusto: string | null;
  desc_ccusto: string | null;
  valor_rateio: number;
  valor_original: number;
  situacao_presumida: string | null;
  data_emissao: string | null;
  data_vencimento: string | null;
  /** PAGREC da matriz: 1=CR (receita), 2=CP (despesa). null quando indefinido. */
  natureza_tipo_matriz: NaturezaTipo | null;
  filial: number | null;
  tipo_documento: string | null;
  numero_documento: string | null;
  cnpj_cpf: string | null;
  nome: string | null;
  nome_fantasia: string | null;
  historico: string | null;
  valor_liquido: number;
  valor_baixado: number;
  data_baixa: string | null;
  status_cod_matriz: number | null;
}

export const STATUS_TOTVS_LEGENDA: Record<number, string> = {
  3: "Baixado",
  15: "Baixado - Parcial",
  18: "Cancelado",
  29: "Vence Hoje",
  40: "Vencido",
  56: "A Vencer",
};
