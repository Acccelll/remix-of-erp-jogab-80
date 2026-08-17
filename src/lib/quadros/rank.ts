/** @module-kind pure */
/**
 * ETAPA 1 · Ordenação fracionária (fractional ranking) do Kanban genérico.
 *
 * Motivação (ver `docs/implementacao-etapa-1/01-arquitetura-kanban.md`):
 * mover um card não pode reescrever a posição de todos os cards da lista.
 * Com rank fracionário, uma movimentação grava **uma única linha**.
 *
 * Estratégia: `posicao` é `numeric` no banco (`card_board_posicao.posicao`,
 * `board_listas.posicao`). O novo rank é a média entre o vizinho anterior e o
 * seguinte. Quando a distância entre vizinhos fica menor que `EPSILON`, a lista
 * precisa ser recompactada (`recompactar`) — evento raro e detectável.
 *
 * Funções puras, sem I/O: testáveis em Node/Vitest.
 */

/** Espaçamento padrão entre itens recém-criados/recompactados. */
export const RANK_STEP = 1024;

/** Distância mínima aceitável entre dois ranks antes de exigir recompactação. */
export const RANK_EPSILON = 1e-6;

/**
 * Calcula o rank de um item posicionado entre `antes` e `depois`.
 *
 * - `antes = null` → item vai para o topo.
 * - `depois = null` → item vai para o fim.
 * - ambos `null` → primeira posição da lista.
 */
export function rankEntre(antes: number | null, depois: number | null): number {
  if (antes == null && depois == null) return RANK_STEP;
  if (antes == null) return (depois as number) - RANK_STEP;
  if (depois == null) return antes + RANK_STEP;
  return (antes + depois) / 2;
}

/** Indica se o par de vizinhos está colapsado e exige recompactação da lista. */
export function precisaRecompactar(antes: number | null, depois: number | null): boolean {
  if (antes == null || depois == null) return false;
  return Math.abs(depois - antes) < RANK_EPSILON * 2;
}

/**
 * Rank de destino ao mover `itemId` para o índice `destino` dentro de `ordenados`
 * (lista já ordenada por rank crescente, podendo conter o próprio item).
 */
export function rankParaIndice<T extends { id: string; posicao: number }>(
  ordenados: T[],
  itemId: string,
  destino: number,
): number {
  const semItem = ordenados.filter((i) => i.id !== itemId);
  const idx = Math.max(0, Math.min(destino, semItem.length));
  const antes = idx > 0 ? semItem[idx - 1].posicao : null;
  const depois = idx < semItem.length ? semItem[idx].posicao : null;
  return rankEntre(antes, depois);
}

/**
 * Recompacta uma lista devolvendo os pares `{ id, posicao }` que mudaram.
 * Usado apenas quando `precisaRecompactar` acusa colapso de precisão.
 */
export function recompactar<T extends { id: string; posicao: number }>(
  ordenados: T[],
): { id: string; posicao: number }[] {
  return ordenados
    .map((item, i) => ({ id: item.id, posicao: (i + 1) * RANK_STEP }))
    .filter((novo, i) => novo.posicao !== ordenados[i].posicao);
}

/** Ordena de forma estável por rank e, em empate, por id (determinístico). */
export function ordenarPorRank<T extends { id: string; posicao: number }>(itens: T[]): T[] {
  return [...itens].sort((a, b) => a.posicao - b.posicao || a.id.localeCompare(b.id));
}
