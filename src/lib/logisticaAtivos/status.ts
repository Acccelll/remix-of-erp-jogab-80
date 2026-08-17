/** @module-kind pure */
/**
 * Regras puras de status/validação de Romaneios — sem I/O, testável isolado.
 */

export type RomaneioStatus =
  | "rascunho"
  | "estoque_baixado"
  | "confirmado"
  | "confirmado_parcial"
  | "falha_estoque"
  | "cancelado";

export const ROMANEIO_STATUS_LABEL: Record<RomaneioStatus, string> = {
  rascunho: "Rascunho",
  estoque_baixado: "Estoque baixado",
  confirmado: "Confirmado",
  confirmado_parcial: "Confirmado (parcial)",
  falha_estoque: "Falha no estoque",
  cancelado: "Cancelado",
};

export interface NovoRomaneioPayload {
  obraOrigemId: string | null;
  obraDestinoId: string | null;
  itensEstoqueCount: number;
  itensPatrimonioCount: number;
}

/** Valida os dados mínimos para criar/confirmar um romaneio. Retorna lista de erros (vazia = válido). */
export function validarNovoRomaneio(payload: NovoRomaneioPayload): string[] {
  const erros: string[] = [];
  if (!payload.obraDestinoId) erros.push("Obra de destino é obrigatória");
  if (payload.obraOrigemId && payload.obraOrigemId === payload.obraDestinoId) {
    erros.push("Obra de origem e destino devem ser diferentes");
  }
  if (payload.itensEstoqueCount === 0 && payload.itensPatrimonioCount === 0) {
    erros.push("Adicione pelo menos um item de estoque ou patrimônio");
  }
  return erros;
}

/** Status final a partir da contagem de falhas nas legs de mobilização (leg 1 já confirmada). */
export function calcularStatusFinal(totalFalhas: number): "confirmado" | "confirmado_parcial" {
  return totalFalhas === 0 ? "confirmado" : "confirmado_parcial";
}

/** true quando o romaneio ainda pode ser editado (itens adicionados/removidos). */
export function isRomaneioEditavel(status: RomaneioStatus): boolean {
  return status === "rascunho";
}

/** true quando a UI deve oferecer "tentar novamente" as legs de mobilização pendentes. */
export function podeRetentarMobilizacao(status: RomaneioStatus): boolean {
  return status === "confirmado_parcial" || status === "estoque_baixado";
}
