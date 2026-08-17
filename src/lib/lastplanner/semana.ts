/** @module-kind pure */
/**
 * Helpers de semana ISO (segunda a domingo) para Last Planner.
 * Toda semana é identificada pela DATA DA SEGUNDA-FEIRA (UTC, YYYY-MM-DD).
 */

const MS_DIA = 86_400_000;

/** Normaliza date para 00:00 UTC do dia. */
function toUtcDay(d: Date | string): Date {
  const x =
    typeof d === "string" ? new Date(d + (d.length === 10 ? "T00:00:00Z" : "")) : new Date(d);
  return new Date(Date.UTC(x.getUTCFullYear(), x.getUTCMonth(), x.getUTCDate()));
}

/** Retorna a segunda-feira (00:00 UTC) da semana que contém a data informada. */
export function semanaDe(date: Date | string): Date {
  const d = toUtcDay(date);
  const dow = d.getUTCDay(); // 0=domingo .. 6=sábado
  const offset = dow === 0 ? -6 : 1 - dow;
  return new Date(d.getTime() + offset * MS_DIA);
}

/** Formata uma data como YYYY-MM-DD (UTC). */
export function isoDate(d: Date | string): string {
  return toUtcDay(d).toISOString().slice(0, 10);
}

/** Lista as próximas n semanas (incluindo a atual) como segundas-feiras. */
export function proximasNSemanas(n: number, ref: Date | string = new Date()): Date[] {
  const base = semanaDe(ref);
  const out: Date[] = [];
  for (let i = 0; i < n; i++) {
    out.push(new Date(base.getTime() + i * 7 * MS_DIA));
  }
  return out;
}

/** "Sem X: DD/MM–DD/MM" para exibição compacta. */
export function formatSemana(seg: Date | string): string {
  const inicio = semanaDe(seg);
  const fim = new Date(inicio.getTime() + 6 * MS_DIA);
  const fmt = (d: Date) =>
    `${String(d.getUTCDate()).padStart(2, "0")}/${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
  return `${fmt(inicio)}–${fmt(fim)}`;
}

/** True se as duas datas caem na mesma semana ISO. */
export function mesmaSemana(a: Date | string, b: Date | string): boolean {
  return isoDate(semanaDe(a)) === isoDate(semanaDe(b));
}
