/** @module-kind pure */
// Helpers de precisão monetária. Padronizar arredondamento half-away-from-zero a 2 casas.
export function round2(n: number | string | null | undefined): number {
  const v = Number(n ?? 0);
  if (!isFinite(v)) return 0;
  return Math.round((v + Number.EPSILON) * 100) / 100;
}

export function sumMoney<T>(
  items: T[] | null | undefined,
  fn: (t: T) => number | string | null | undefined,
): number {
  const total = (items ?? []).reduce((acc, t) => acc + Number(fn(t) ?? 0), 0);
  return round2(total);
}

export function round4(n: number | string | null | undefined): number {
  const v = Number(n ?? 0);
  if (!isFinite(v)) return 0;
  return Math.round((v + Number.EPSILON) * 10000) / 10000;
}

/** Formata um valor em BRL de forma abreviada (R$ 1,2M, R$ 500k, R$ 350). */
export function fmtCurtoBRL(n: number | null | undefined): string {
  const v = Number(n ?? 0);
  const abs = Math.abs(v);
  const sign = v < 0 ? "-" : "";
  if (abs >= 1_000_000_000)
    return `${sign}R$ ${(abs / 1_000_000_000).toFixed(abs >= 1e10 ? 0 : 1).replace(".", ",")}B`;
  if (abs >= 1_000_000)
    return `${sign}R$ ${(abs / 1_000_000).toFixed(abs >= 1e7 ? 0 : 1).replace(".", ",")}M`;
  if (abs >= 1_000)
    return `${sign}R$ ${(abs / 1_000).toFixed(abs >= 1e4 ? 0 : 1).replace(".", ",")}k`;
  return `${sign}R$ ${abs.toFixed(0)}`;
}
