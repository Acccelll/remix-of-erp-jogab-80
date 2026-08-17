/** @module-kind pure */
/**
 * Matriz de Riscos 5×5 — Probabilidade × Impacto.
 * Cada eixo vai de 1 (muito baixo) a 5 (muito alto).
 * Score = P × I (1..25). Classificação em 4 níveis de severidade.
 */

export type Severidade = "baixo" | "medio" | "alto" | "critico";

export const ESCALA_PROBABILIDADE: Record<number, string> = {
  1: "Muito baixa",
  2: "Baixa",
  3: "Média",
  4: "Alta",
  5: "Muito alta",
};

export const ESCALA_IMPACTO: Record<number, string> = {
  1: "Desprezível",
  2: "Baixo",
  3: "Moderado",
  4: "Alto",
  5: "Catastrófico",
};

export const SEVERIDADE_LABEL: Record<Severidade, string> = {
  baixo: "Baixo",
  medio: "Médio",
  alto: "Alto",
  critico: "Crítico",
};

export function scoreRisco(probabilidade: number, impacto: number): number {
  const p = Math.max(0, Math.min(5, Math.round(probabilidade || 0)));
  const i = Math.max(0, Math.min(5, Math.round(impacto || 0)));
  return p * i;
}

export function classificarRisco(score: number): Severidade {
  if (score >= 16) return "critico";
  if (score >= 10) return "alto";
  if (score >= 5) return "medio";
  return "baixo";
}

export function severidadeDe(p: number, i: number): Severidade {
  return classificarRisco(scoreRisco(p, i));
}

/** Classes Tailwind para cor de fundo (heatmap) e badge. */
export const SEVERIDADE_BG: Record<Severidade, string> = {
  baixo: "bg-success/15 border-success/40 text-success",
  medio: "bg-warning/15 border-warning/40 text-warning",
  alto: "bg-warning/20 border-warning/50 text-warning",
  critico: "bg-destructive/25 border-destructive/60 text-destructive",
};

export const SEVERIDADE_DOT: Record<Severidade, string> = {
  baixo: "bg-success",
  medio: "bg-warning",
  alto: "bg-warning",
  critico: "bg-destructive",
};

/** Matriz 5×5 pré-calculada: linhas = impacto (5→1), colunas = probabilidade (1→5). */
export type Celula = { p: number; i: number; score: number; severidade: Severidade };

export const MATRIZ_5x5: Celula[][] = (() => {
  const m: Celula[][] = [];
  for (let i = 5; i >= 1; i--) {
    const row: Celula[] = [];
    for (let p = 1; p <= 5; p++) {
      const score = scoreRisco(p, i);
      row.push({ p, i, score, severidade: classificarRisco(score) });
    }
    m.push(row);
  }
  return m;
})();

export type RiscoLite = {
  probabilidade: number | null;
  impacto: number | null;
  status: string;
};

/** Conta riscos por célula (P×I) — usado pelo heatmap. */
export function contarRiscosNaMatriz(riscos: RiscoLite[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const r of riscos) {
    if (r.status !== "aberto" && r.status !== "em_andamento") continue;
    const p = r.probabilidade ?? 0;
    const i = r.impacto ?? 0;
    if (p < 1 || p > 5 || i < 1 || i > 5) continue;
    const k = `${p}:${i}`;
    m.set(k, (m.get(k) ?? 0) + 1);
  }
  return m;
}
