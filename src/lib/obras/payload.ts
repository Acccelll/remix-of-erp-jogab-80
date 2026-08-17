/** @module-kind pure */
// BIZ-002.c — payload puro para persistência de Obra.
// Sem I/O: apenas mapeia o domínio (Obra) para o shape do banco.
import type { Obra } from "@/types";

export type ObraDbPayload = ReturnType<typeof buildObraPayload>;

export function buildObraPayload(obra: Obra) {
  const status: "em_andamento" | "paralisada" = obra.ativa ? "em_andamento" : "paralisada";
  return {
    nome: obra.nome,
    codigo: obra.codigo ?? null,
    cliente: obra.cliente ?? null,
    cnpj: obra.cnpj ?? null,
    ativa: obra.ativa,
    status,
    valor_contrato: obra.valorContrato ?? 0,
    valor_antecipacao: obra.valorAntecipacao ?? null,
    pedido_contrato: obra.pedidoContrato ?? null,
    local: obra.local ?? null,
    centro_custo_totvs: obra.centroCustoTotvs ?? null,
    data_inicio: obra.dataInicio ?? null,
    data_fim: obra.dataFim ?? null,
    data_previsao_termino: obra.dataPrevisaoTermino ?? null,
    data_mobilizacao: obra.dataMobilizacao ?? null,
    data_desmobilizacao: obra.dataDesmobilizacao ?? null,
    dias_corte_bms: obra.diasCorteBms ?? null,
    dias_ate_emissao_nf: obra.diasAteEmissaoNf ?? null,
    prazo_pagamento_dias: obra.prazoPagamentoDias ?? null,
    dias_fixos_pagamento: obra.diasFixosPagamento ?? null,
    percentual_material: obra.percentualMaterial ?? 70,
    aliquota_iss: obra.aliquotaIss ?? 5,
    aliquota_inss: obra.aliquotaInss ?? 11,
    aliquota_cbs: obra.aliquotaCbs ?? 0,
    aliquota_ibs: obra.aliquotaIbs ?? 0,
    requer_integracao: obra.requerIntegracao ?? false,
    integracao_info: obra.integracaoInfo ?? "",
    observacoes: obra.observacoes ?? null,
  };
}
