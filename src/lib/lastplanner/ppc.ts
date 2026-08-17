/** @module-kind pure */
/**
 * PPC — Percent Plan Complete: métrica central do Last Planner.
 * PPC = concluídos / comprometidos da semana (0..1).
 */

import { isoDate, semanaDe } from "./semana";

export type Compromisso = {
  semana_inicio: string | Date;
  concluido: boolean;
  causa_chave?: string | null;
};

export type PPC = {
  comprometidos: number;
  concluidos: number;
  ppc: number; // 0..1
};

export function calcularPPC(items: Compromisso[]): PPC {
  const comprometidos = items.length;
  const concluidos = items.filter((c) => c.concluido).length;
  const ppc = comprometidos === 0 ? 0 : concluidos / comprometidos;
  return { comprometidos, concluidos, ppc };
}

export type PPCSemana = PPC & { semana: string };

/** Agrega PPC por semana (chave = segunda-feira ISO). */
export function ppcPorSemana(items: Compromisso[]): PPCSemana[] {
  const grupos = new Map<string, Compromisso[]>();
  for (const c of items) {
    const k = isoDate(semanaDe(c.semana_inicio));
    const arr = grupos.get(k) ?? [];
    arr.push(c);
    grupos.set(k, arr);
  }
  return [...grupos.entries()]
    .map(([semana, lista]) => ({ semana, ...calcularPPC(lista) }))
    .sort((a, b) => a.semana.localeCompare(b.semana));
}

/** Pareto de causas no período (descendente por contagem). */
export function paretoCausas(
  items: Compromisso[],
): Array<{ causa: string; count: number; pct: number }> {
  const naoConcluidos = items.filter((c) => !c.concluido);
  const total = naoConcluidos.length;
  const counts = new Map<string, number>();
  for (const c of naoConcluidos) {
    const k = c.causa_chave || "sem_causa";
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([causa, count]) => ({ causa, count, pct: total === 0 ? 0 : count / total }))
    .sort((a, b) => b.count - a.count);
}
