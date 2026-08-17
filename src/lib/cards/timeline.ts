/** @module-kind pure */
/**
 * timeline.ts — Fase F (Quadros).
 *
 * Função pura que intercala comentários (`card_comentarios`) e atividades
 * (`card_atividades`) ordenadas cronologicamente, com toggle "Mostrar/Ocultar
 * detalhes":
 *
 *   - `detalhes: true`  → comentários + atividades juntos, asc por timestamp
 *   - `detalhes: false` → só comentários, asc por timestamp
 *
 * Empate de timestamp: comentário antes de atividade (UX Trello-like) e, dentro
 * do mesmo tipo, ordem estável pela ordem original recebida.
 */

export type ComentarioBase = {
  id: string;
  created_at: string;
  reply_to?: string | null;
  texto?: string | null;
};

export type AtividadeBase = {
  id: string;
  created_at: string;
};

export type TimelineItem<C extends ComentarioBase, A extends AtividadeBase> =
  | { kind: "comentario"; at: number; idx: number; data: C }
  | { kind: "atividade"; at: number; idx: number; data: A };

function toMs(ts: string): number {
  const n = new Date(ts).getTime();
  return Number.isFinite(n) ? n : 0;
}

export function montarTimeline<C extends ComentarioBase, A extends AtividadeBase>(
  comentarios: C[],
  atividades: A[],
  opts: { detalhes: boolean },
): TimelineItem<C, A>[] {
  const comItems: TimelineItem<C, A>[] = (comentarios ?? []).map((c, i) => ({
    kind: "comentario",
    at: toMs(c.created_at),
    idx: i,
    data: c,
  }));
  if (!opts.detalhes) {
    return comItems.sort(comparar);
  }
  const atItems: TimelineItem<C, A>[] = (atividades ?? []).map((a, i) => ({
    kind: "atividade",
    at: toMs(a.created_at),
    idx: i,
    data: a,
  }));
  return [...comItems, ...atItems].sort(comparar);
}

function comparar<C extends ComentarioBase, A extends AtividadeBase>(
  a: TimelineItem<C, A>,
  b: TimelineItem<C, A>,
): number {
  if (a.at !== b.at) return a.at - b.at;
  // Empate: comentário antes de atividade.
  if (a.kind !== b.kind) return a.kind === "comentario" ? -1 : 1;
  // Mesmo tipo: preserva ordem de entrada (estável).
  return a.idx - b.idx;
}

/**
 * Resolve o "pai" de uma resposta dentro da lista atual de comentários.
 * Retorna `null` quando o pai foi apagado/SET NULL.
 */
export function resolverPai<C extends ComentarioBase>(
  comentarios: C[],
  reply_to: string | null | undefined,
): C | null {
  if (!reply_to) return null;
  return comentarios.find((c) => c.id === reply_to) ?? null;
}

/**
 * Resumo curto de um comentário para exibir como citação (max ~120 chars,
 * uma linha). Não interpreta markdown — corta texto cru.
 */
export function resumoCitacao(texto: string | null | undefined, max = 120): string {
  const t = (texto ?? "").replace(/\s+/g, " ").trim();
  if (!t) return "";
  return t.length > max ? t.slice(0, max - 1) + "…" : t;
}
