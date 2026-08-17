/** @module-kind pure */
/**
 * Rateio de folha de pagamento entre obras, a partir dos períodos de alocação
 * do colaborador (rota `mobilizacoesPeriodos`).
 *
 * Contexto: até a criação daquela rota, `mobPeriodos` era sempre uma lista
 * vazia — a rota não existia e o api.php respondia HTTP 200 com uma mensagem de
 * "recurso não encontrado". O rateio, portanto, nunca rodou de fato: o
 * denominador dava zero e a tela mostrava lista vazia. Ao ligar a rota, o
 * cálculo passa a produzir número, e a lista agora traz também os períodos de
 * férias, folga e afastamento.
 *
 * REGRA ADOTADA (premissa a validar com o DP): o denominador considera apenas
 * dias EM OBRA, de modo que o custo do colaborador é distribuído integralmente
 * entre as obras em que ele esteve. Incluir os períodos de status faria a obra
 * receber menos que o proporcional, com a diferença não atribuída a ninguém.
 */

import type { PeriodoAlocacao } from "@/types";

/** Apenas períodos que representam alocação em obra, atribuíveis a um centro. */
export function periodosEmObra(periodos: PeriodoAlocacao[]): PeriodoAlocacao[] {
  return (periodos || []).filter((p) => p.tipo === "obra" && !!p.obra_id);
}

/**
 * Fração dos dias em obra que pertence a `obraId` (0 a 1).
 *
 * Usa o `dias` calculado pelo backend, que é inclusivo do primeiro e do último
 * dia do período; o cálculo local anterior derivava os dias de um `Math.ceil`
 * sobre a diferença de datas e perdia um dia em cada período.
 */
export function proporcaoPorObra(periodos: PeriodoAlocacao[], obraId: string): number {
  let diasNaObra = 0;
  let diasTotal = 0;

  for (const p of periodosEmObra(periodos)) {
    const dias = p.dias ?? 0;
    diasTotal += dias;
    if (String(p.obra_id) === String(obraId)) diasNaObra += dias;
  }

  return diasTotal > 0 ? diasNaObra / diasTotal : 0;
}
