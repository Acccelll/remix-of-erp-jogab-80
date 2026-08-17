/** @module-kind pure */
/**
 * Tokens semânticos de severidade (Qualidade/NC).
 * Use sempre via `BadgeSeveridade` ou `severidadeToken()` —
 * nunca aplique `bg-red-500/text-warning` direto, quebra o dark mode.
 */
export type Severidade = "baixa" | "media" | "alta" | "critica";
export type SeveridadeOuAtraso = Severidade | "atraso";

export const SEVERIDADE_LABEL: Record<SeveridadeOuAtraso, string> = {
  baixa: "Baixa",
  media: "Média",
  alta: "Alta",
  critica: "Crítica",
  atraso: "Em atraso",
};

/** Classes Tailwind baseadas nos tokens `--sev-*` (claro/escuro). */
export function severidadeToken(sev: SeveridadeOuAtraso): {
  bg: string;
  text: string;
  border: string;
  className: string;
} {
  const base = `bg-sev-${sev}/15 text-sev-${sev} border-sev-${sev}/40`;
  return {
    bg: `bg-sev-${sev}/15`,
    text: `text-sev-${sev}`,
    border: `border-sev-${sev}/40`,
    className: base,
  };
}

/** Ordem canônica (baixo → alto) — útil para ordenação. */
export const SEVERIDADE_ORDEM: Record<SeveridadeOuAtraso, number> = {
  baixa: 0,
  media: 1,
  alta: 2,
  critica: 3,
  atraso: 4,
};
