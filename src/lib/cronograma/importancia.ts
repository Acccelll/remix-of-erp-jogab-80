/** @module-kind pure */
// Cálculo de importância do item de cronograma.
// Score 0..100 a partir de: folga total, folga livre, fan-out transitivo e custo.
// Classes: Crítica / Alta / Média / Baixa.

export type ImportanciaInput = {
  id: string;
  folga_total_dias: number;
  folga_livre_dias: number;
  custo: number;
};

export type ImportanciaPesos = {
  folgaTotal: number;
  folgaLivre: number;
  fanout: number;
  custo: number;
};

export const PESOS_PADRAO: ImportanciaPesos = {
  folgaTotal: 0.45,
  folgaLivre: 0.2,
  fanout: 0.25,
  custo: 0.1,
};

export type ImportanciaClasse = "Crítica" | "Alta" | "Média" | "Baixa";

export type ImportanciaResult = {
  id: string;
  fanout: number;
  score: number;
  classe: ImportanciaClasse;
};

/** Calcula fan-out transitivo: nº de sucessores (diretos+indiretos) por item. */
export function calcularFanoutTransitivo(
  itens: { id: string }[],
  deps: { item_id: string; predecessor_item_id?: string | null }[],
): Map<string, number> {
  const sucs = new Map<string, Set<string>>();
  for (const i of itens) sucs.set(i.id, new Set());
  for (const d of deps) {
    if (!d.predecessor_item_id) continue;
    sucs.get(d.predecessor_item_id)?.add(d.item_id);
  }
  const cache = new Map<string, Set<string>>();
  function reach(id: string, stack: Set<string>): Set<string> {
    if (cache.has(id)) return cache.get(id)!;
    if (stack.has(id)) return new Set(); // ciclo
    stack.add(id);
    const acc = new Set<string>();
    for (const s of sucs.get(id) ?? []) {
      acc.add(s);
      for (const t of reach(s, stack)) acc.add(t);
    }
    stack.delete(id);
    cache.set(id, acc);
    return acc;
  }
  const out = new Map<string, number>();
  for (const i of itens) out.set(i.id, reach(i.id, new Set()).size);
  return out;
}

function norm(value: number, max: number): number {
  if (max <= 0) return 0;
  return Math.max(0, Math.min(1, value / max));
}

export function calcularImportancia(
  itens: ImportanciaInput[],
  fanoutPorId: Map<string, number>,
  pesos: ImportanciaPesos = PESOS_PADRAO,
): ImportanciaResult[] {
  if (itens.length === 0) return [];
  const maxFolgaT = Math.max(1, ...itens.map((i) => Math.max(0, i.folga_total_dias)));
  const maxFolgaL = Math.max(1, ...itens.map((i) => Math.max(0, i.folga_livre_dias)));
  const maxFan = Math.max(1, ...itens.map((i) => fanoutPorId.get(i.id) ?? 0));
  const maxCusto = Math.max(1, ...itens.map((i) => i.custo || 0));

  return itens.map((i) => {
    const fan = fanoutPorId.get(i.id) ?? 0;
    // Menor folga = mais importante → invertemos
    const sFT = 1 - norm(Math.max(0, i.folga_total_dias), maxFolgaT);
    const sFL = 1 - norm(Math.max(0, i.folga_livre_dias), maxFolgaL);
    const sFan = norm(fan, maxFan);
    const sCusto = norm(i.custo || 0, maxCusto);
    const score = Math.round(
      (pesos.folgaTotal * sFT +
        pesos.folgaLivre * sFL +
        pesos.fanout * sFan +
        pesos.custo * sCusto) *
        100,
    );
    const classe: ImportanciaClasse = classificar(score, i.folga_total_dias);
    return { id: i.id, fanout: fan, score, classe };
  });
}

export function classificar(score: number, folgaTotal: number): ImportanciaClasse {
  if (folgaTotal <= 0) return "Crítica";
  if (score >= 70 || folgaTotal <= 3) return "Alta";
  if (score >= 40 || folgaTotal <= 10) return "Média";
  return "Baixa";
}
