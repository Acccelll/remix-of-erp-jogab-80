/** @module-kind pure */
/** Converte minutos inteiros para "HH:MM". Aceita negativos. */
export function formatMinutes(min: number | null | undefined): string {
  if (min == null || isNaN(Number(min))) return "00:00";
  const neg = min < 0;
  const abs = Math.abs(Math.round(min));
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  return `${neg ? "-" : ""}${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** Converte "HH:MM" ou "H:MM" (com sinal opcional) para minutos inteiros. */
export function parseHHMM(value: string | null | undefined): number {
  if (!value) return 0;
  const s = String(value).trim();
  if (!s) return 0;
  const neg = s.startsWith("-");
  const clean = s.replace(/^-/, "");
  // Aceita "1.5" como horas decimais
  if (/^\d+([.,]\d+)?$/.test(clean) && !clean.includes(":")) {
    const dec = parseFloat(clean.replace(",", "."));
    return Math.round(dec * 60) * (neg ? -1 : 1);
  }
  const parts = clean.split(":");
  if (parts.length < 2) return 0;
  const h = parseInt(parts[0], 10) || 0;
  const m = parseInt(parts[1], 10) || 0;
  return (h * 60 + m) * (neg ? -1 : 1);
}

export function minutesToHours(min: number): number {
  return min / 60;
}
