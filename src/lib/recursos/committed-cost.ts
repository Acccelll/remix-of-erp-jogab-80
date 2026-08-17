/** @module-kind pure */
/**
 * Custo Comprometido a partir dos cards de recurso.
 *
 * Função pura, sem I/O. Recebe a lista de `card_recursos` (já filtrada por
 * obra) e o status global do card (`cards.status`). Retorna o total
 * comprometido + breakdown por tipo.
 *
 * Regras:
 *  - `valor_oc` (Ordem de Compra emitida) prevalece sobre `valor_estimado`.
 *  - Cards `concluido` ainda contam (o custo ocorreu).
 *  - Cards sem valor de OC nem estimado contam 0.
 *  - Não toca em billing.ts / recalculo.ts (arquivos protegidos). O efeito
 *    no fluxo financeiro real é leitura derivada, exibida na UI.
 */

import type { TipoRecurso } from "./lead-times";

export interface RecursoCusto {
  tipo_recurso: TipoRecurso | string;
  valor_estimado: number | null;
  valor_oc: number | null;
  /** status global do card (tabela `cards.status`) */
  status_card?: string | null;
}

export interface CustoComprometido {
  /** soma de valor_oc quando presente, senão valor_estimado */
  total: number;
  /** soma só dos cards já com OC emitida */
  totalComOc: number;
  /** soma dos cards ainda apenas estimados (sem OC) */
  totalEstimado: number;
  /** quantos cards entraram */
  qtdCards: number;
  /** quantos têm OC emitida */
  qtdComOc: number;
  /** breakdown por tipo de recurso */
  porTipo: Record<string, number>;
}

const ZERO: CustoComprometido = {
  total: 0,
  totalComOc: 0,
  totalEstimado: 0,
  qtdCards: 0,
  qtdComOc: 0,
  porTipo: {},
};

export function calcularCustoComprometido(recursos: readonly RecursoCusto[]): CustoComprometido {
  if (!recursos || recursos.length === 0) return { ...ZERO, porTipo: {} };

  const out: CustoComprometido = {
    total: 0,
    totalComOc: 0,
    totalEstimado: 0,
    qtdCards: 0,
    qtdComOc: 0,
    porTipo: {},
  };

  for (const r of recursos) {
    const oc = Number(r.valor_oc ?? 0);
    const est = Number(r.valor_estimado ?? 0);
    const usado = oc > 0 ? oc : est;
    if (usado <= 0) continue;
    out.qtdCards += 1;
    out.total += usado;
    if (oc > 0) {
      out.qtdComOc += 1;
      out.totalComOc += oc;
    } else {
      out.totalEstimado += est;
    }
    const tipo = r.tipo_recurso || "desconhecido";
    out.porTipo[tipo] = (out.porTipo[tipo] ?? 0) + usado;
  }
  return out;
}
