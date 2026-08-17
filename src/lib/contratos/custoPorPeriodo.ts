/** @module-kind pure */
/**
 * Custo do contrato atribuído a cada obra, a partir dos períodos de alocação
 * (rota `contratosPeriodos`).
 *
 * ATENÇÃO — ESTE NÚMERO MUDOU DE COMPORTAMENTO.
 *
 * Até a migração 2026_08_01 o cálculo rodava sobre períodos falsos. A origem:
 * `$loadHistoricoContrato` derivava a descrição de `movimentacoes_contratos`,
 * cujas 31 linhas têm `obra_destino_id` e `data_programada` nulos. A prosa saía
 * como "Mobilizado de Sem Alocação para Sem Alocação", sem aspas e sem data, e
 * o regex do componente exigia as duas coisas — nunca casava. Resultado: todo
 * período de contrato era rotulado "Sem Alocação" e o custo por obra não
 * significava nada.
 *
 * Com os períodos reais o número passa a fazer sentido. **Conferir com o
 * financeiro antes de tratá-lo como fonte para fechamento.**
 */

import type { PeriodoContrato } from "@/types";

/** Períodos que representam alocação numa obra, atribuíveis a um centro de custo. */
export function periodosEmObra(periodos: PeriodoContrato[]): PeriodoContrato[] {
  return (periodos || []).filter((p) => p.tipo === "obra" && !!p.obra_id && !p.substituido);
}

/**
 * Custo diário do contrato: valor total dividido pela vigência.
 *
 * `diasVigencia` menor que 1 devolve 0 em vez de dividir por zero — contrato sem
 * datas de início e término não tem custo diário definido, e devolver
 * `Infinity` contaminaria toda a soma seguinte.
 */
export function custoPorDia(valorTotal: number, diasVigencia: number): number {
  if (!Number.isFinite(valorTotal) || !Number.isFinite(diasVigencia)) return 0;
  if (diasVigencia < 1) return 0;
  return valorTotal / diasVigencia;
}

export interface CustoObra {
  obraId: string;
  obraNome: string;
  dias: number;
  custo: number;
}

/**
 * Distribui o custo do contrato entre as obras onde ele esteve, proporcional
 * aos dias de cada período.
 *
 * Períodos ociosos ficam de fora: o contrato não estava a serviço de obra
 * nenhuma, e atribuir esse custo a uma delas seria inventar rateio.
 */
export function custoPorObra(
  periodos: PeriodoContrato[],
  valorTotal: number,
  diasVigencia: number,
): CustoObra[] {
  const diaria = custoPorDia(valorTotal, diasVigencia);
  const acc = new Map<string, CustoObra>();

  for (const p of periodosEmObra(periodos)) {
    const id = String(p.obra_id);
    const atual = acc.get(id) ?? { obraId: id, obraNome: p.obra_nome || "Obra", dias: 0, custo: 0 };
    atual.dias += p.dias ?? 0;
    atual.custo += (p.dias ?? 0) * diaria;
    acc.set(id, atual);
  }

  return Array.from(acc.values()).sort((a, b) => b.dias - a.dias);
}

/** Dias em que o contrato esteve ocioso — fora de qualquer obra. */
export function diasOcioso(periodos: PeriodoContrato[]): number {
  return (periodos || [])
    .filter((p) => p.tipo === "status" && !p.substituido)
    .reduce((s, p) => s + (p.dias ?? 0), 0);
}
