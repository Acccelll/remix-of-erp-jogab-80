/** @module-kind pure */
// Classificação de riscos PMBOK — funções puras.
// Severidade = probabilidade × impacto, ambos no intervalo 1..5.

export type FaixaSeveridade = "baixo" | "medio" | "alto" | "critico";

export function severidade(probabilidade: number, impacto: number): number {
  const p = Math.max(1, Math.min(5, Math.round(probabilidade)));
  const i = Math.max(1, Math.min(5, Math.round(impacto)));
  return p * i;
}

export function faixaSeveridade(sev: number): FaixaSeveridade {
  if (sev >= 15) return "critico";
  if (sev >= 10) return "alto";
  if (sev >= 5) return "medio";
  return "baixo";
}

/** Cor de fundo (Tailwind) da célula da matriz P×I. */
export function corMatriz(probabilidade: number, impacto: number): string {
  const f = faixaSeveridade(severidade(probabilidade, impacto));
  if (f === "critico") return "bg-destructive/80 text-white";
  if (f === "alto") return "bg-warning/80 text-white";
  if (f === "medio") return "bg-warning/80 text-warning";
  return "bg-success/70 text-success";
}

/** Cor de badge resumida por faixa. */
export function corBadgeSeveridade(sev: number): string {
  const f = faixaSeveridade(sev);
  if (f === "critico") return "bg-destructive text-white border-destructive/40";
  if (f === "alto") return "bg-warning text-white border-warning/40";
  if (f === "medio") return "bg-warning/30 text-warning border-warning/40";
  return "bg-success/30 text-success border-success/40";
}

export function rotuloFaixa(f: FaixaSeveridade): string {
  return f === "critico" ? "Crítico" : f === "alto" ? "Alto" : f === "medio" ? "Médio" : "Baixo";
}

export const PROBABILIDADE_LABELS: Record<number, string> = {
  1: "Raro",
  2: "Improvável",
  3: "Possível",
  4: "Provável",
  5: "Quase certo",
};
export const IMPACTO_LABELS: Record<number, string> = {
  1: "Muito baixo",
  2: "Baixo",
  3: "Médio",
  4: "Alto",
  5: "Muito alto",
};
