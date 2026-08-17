/** @module-kind pure */
/**
 * Fonte única de formatação de datas (BIZ-004).
 *
 * Todas as telas devem usar estes helpers em vez de `toLocaleDateString`/`toLocaleString`
 * inline. Nulos/inválidos retornam "—" (fallback configurável).
 */

type Input = string | number | Date | null | undefined;

function toDate(d: Input): Date | null {
  if (d == null || d === "") return null;
  const dt = d instanceof Date ? d : new Date(d);
  return isNaN(dt.getTime()) ? null : dt;
}

/** Formata como dd/MM/yyyy usando UTC (evita drift para strings "YYYY-MM-DD"). */
export function fmtData(d: Input, fallback = "—"): string {
  const dt = toDate(d);
  if (!dt) return fallback;
  const dd = String(dt.getUTCDate()).padStart(2, "0");
  const mm = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const yy = dt.getUTCFullYear();
  return `${dd}/${mm}/${yy}`;
}

/** Formata como dd/MM/yyyy usando fuso local. Usar para timestamps completos. */
export function fmtDataLocal(d: Input, fallback = "—"): string {
  const dt = toDate(d);
  if (!dt) return fallback;
  return dt.toLocaleDateString("pt-BR");
}

/** Formata como dd/MM/yyyy HH:mm (fuso local). */
export function fmtDataHora(d: Input, fallback = "—"): string {
  const dt = toDate(d);
  if (!dt) return fallback;
  return dt.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Formata como "segunda-feira, 15 de janeiro" (fuso local). Usado em agrupadores. */
export function fmtDiaExtenso(d: Input, fallback = "—"): string {
  const dt = toDate(d);
  if (!dt) return fallback;
  return dt.toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
  });
}

/** Retorna a data de hoje no fuso America/Sao_Paulo como string YYYY-MM-DD. */
export function hojeBrasilia(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

/**
 * Primeiro dia do mês corrente no fuso America/Sao_Paulo (YYYY-MM-DD).
 *
 * Derivado de `hojeBrasilia()` — `new Date().setDate(1)` seguido de `toISOString()`
 * usa o horário local e devolve o mês seguinte quando o UTC já virou (após as 21h no
 * horário de Brasília).
 */
export function primeiroDiaMesBrasilia(): string {
  return `${hojeBrasilia().slice(0, 7)}-01`;
}
