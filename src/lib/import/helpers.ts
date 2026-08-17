/** @module-kind pure */
// Parsers/helpers compartilhados entre os importadores (Excel/XLSX).
// Movidos de src/routes/_app.importar.tsx na Fase 2.2 da revisão arquitetural.

export function num(v: any): number {
  if (v == null || v === "") return 0;
  if (typeof v === "number") return v;
  const s = String(v)
    .replace(/\./g, "")
    .replace(",", ".")
    .replace(/[^\d.-]/g, "");
  return Number(s) || 0;
}

export function dateStr(v: any, XLSX: any): string | undefined {
  if (!v) return undefined;
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === "number") {
    const d = XLSX.SSF.parse_date_code(v);
    if (!d) return undefined;
    return `${d.y}-${String(d.m).padStart(2, "0")}-${String(d.d).padStart(2, "0")}`;
  }
  const s = String(v).trim();
  const m = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  if (m) {
    const y = m[3].length === 2 ? `20${m[3]}` : m[3];
    return `${y}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  }
  return s;
}

export function pick(row: any, keys: string[]): any {
  for (const k of keys) {
    for (const key of Object.keys(row)) {
      if (key.toLowerCase().trim().includes(k)) return row[key];
    }
  }
  return undefined;
}
