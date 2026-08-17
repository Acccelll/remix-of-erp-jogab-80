/** @module-kind pure */
import type { Oportunidade } from "@/types";

export type Temperatura = "frio" | "morno" | "quente" | null | undefined;

const RANK: Record<Exclude<Temperatura, null | undefined>, number> = {
  frio: 1,
  morno: 2,
  quente: 3,
};

/** Retorna a temperatura mais "quente" entre uma lista. Null se nenhuma. */
export function hottestOf(values: Array<Temperatura>): Temperatura {
  let best: Temperatura = null;
  let bestRank = 0;
  for (const v of values) {
    if (!v) continue;
    const r = RANK[v as keyof typeof RANK] ?? 0;
    if (r > bestRank) {
      bestRank = r;
      best = v;
    }
  }
  return best;
}

/** Temperatura mais quente entre as oportunidades vinculadas ao cliente. */
export function hottestForCliente(
  clienteId: string | null | undefined,
  oportunidades: Oportunidade[],
): Temperatura {
  if (!clienteId) return null;
  return hottestOf(
    oportunidades
      .filter((l) => l.clienteId === clienteId)
      .map((l) => l.temperatura_temperatura as Temperatura),
  );
}
