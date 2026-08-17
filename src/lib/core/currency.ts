/** @module-kind pure */
/**
 * Helpers de máscara de moeda BRL (R$ #.##0,00).
 * - formatBRLInput: formata enquanto o usuário digita (mantém apenas dígitos e divide por 100).
 * - parseBRL: converte string formatada em número (ex.: "R$ 1.234,56" -> 1234.56).
 * - formatBRLFromNumber: formata um número para exibição (ex.: 1234.56 -> "R$ 1.234,56").
 */

export function formatBRLInput(raw: string): string {
  // Mantém apenas dígitos
  const digits = raw.replace(/\D/g, "");
  if (!digits) return "";
  const num = parseInt(digits, 10) / 100;
  return num.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function parseBRL(masked: string): number {
  if (!masked) return 0;
  const digits = masked.replace(/\D/g, "");
  if (!digits) return 0;
  return parseInt(digits, 10) / 100;
}

export function formatBRLFromNumber(n: number | string | null | undefined): string {
  const num = typeof n === "string" ? parseFloat(n) : n;
  if (num == null || isNaN(num as number)) return "";
  return (num as number).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/**
 * Fonte única para formatação de moeda BRL (DS-006).
 * Aceita number|string|null|undefined; nulos/NaN retornam "—" (placeholder configurável).
 */
export function formatBRL(
  n: number | string | null | undefined,
  opts?: { minDigits?: number; maxDigits?: number; fallback?: string },
): string {
  const num = typeof n === "string" ? parseFloat(n) : n;
  const fallback = opts?.fallback ?? "—";
  if (num == null || isNaN(num as number)) return fallback;
  return (num as number).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: opts?.minDigits ?? 2,
    maximumFractionDigits: opts?.maxDigits ?? 2,
  });
}
