/** @module-kind pure */
/**
 * Tradução da situação de um colaborador para o estado visual do seu pin.
 *
 * Fica fora dos componentes para não quebrar o fast refresh (um arquivo .tsx
 * que exporta componente e função perde o hot reload) e para poder ser testada
 * sem montar o mapa.
 */
import { estaDisponivel } from "@/lib/logistica/equipes";
import { computeDocStatus } from "@/lib/rh/documentos";
import type { Colaborador } from "@/types";

export type EstadoPin = "disponivel" | "alocado" | "pendente" | "atencao";

/**
 * Ordem de precedência: documento vencido impede a mobilização, então vence
 * tudo; mobilização pendente vem depois; e só então disponível × alocado.
 */
export function estadoDoPin(c: Colaborador): EstadoPin {
  if (computeDocStatus(c)?.kind === "vencido") return "atencao";
  if (c.mobilizacaoPendente) return "pendente";
  return estaDisponivel(c) ? "disponivel" : "alocado";
}

/** Prioridade de exibição do pin representante de um agrupamento. */
export const PESO_ESTADO_PIN: Record<EstadoPin, number> = {
  disponivel: 0,
  atencao: 1,
  pendente: 2,
  alocado: 3,
};
