/** @module-kind pure */
/**
 * Util puro para ordenação e agrupamento de cards do AllocationBoard.
 * Mantido fora do componente para ser testável sem render.
 */

export type SortDirection = "asc" | "desc";

export interface SortDef<T> {
  value: string;
  label: string;
  compare: (a: T, b: T) => number;
}

export interface GroupResult<T> {
  key: string;
  label: string;
  items: T[];
}

export function sortCards<T>(
  cards: T[],
  sort?: SortDef<T> | null,
  direction: SortDirection = "asc",
): T[] {
  if (!sort) return cards;
  const sign = direction === "desc" ? -1 : 1;
  return cards.slice().sort((a, b) => sign * sort.compare(a, b));
}

export function groupCards<T>(
  cards: T[],
  getGroupKey: ((c: T) => string) | null,
): GroupResult<T>[] {
  if (!getGroupKey) return [{ key: "__all__", label: "", items: cards }];
  const map = new Map<string, T[]>();
  for (const c of cards) {
    const k = getGroupKey(c) || "Sem categoria";
    const arr = map.get(k);
    if (arr) arr.push(c);
    else map.set(k, [c]);
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b, "pt-BR"))
    .map(([key, items]) => ({ key, label: key, items }));
}

export interface ExtraFilter<T> {
  key: string;
  label: string;
  predicate: (card: T) => boolean;
}

export function applyExtraFilters<T>(
  cards: T[],
  filters: ExtraFilter<T>[],
  activeKeys: Set<string>,
): T[] {
  if (activeKeys.size === 0) return cards;
  const active = filters.filter((f) => activeKeys.has(f.key));
  if (active.length === 0) return cards;
  return cards.filter((c) => active.every((f) => f.predicate(c)));
}
