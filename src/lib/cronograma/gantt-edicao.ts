/** @module-kind pure */
// Lib pura para edição interativa do Gantt: drag, resize e criação de dependência.
// Sem side-effects, sem chamadas de banco. Datas sempre como string ISO (YYYY-MM-DD).

import { addDays, differenceInCalendarDays, parseISO, format } from "date-fns";

export type GanttEdicaoItem = {
  id: string;
  data_inicio: string;
  data_fim: string;
};

export type GanttEdicaoDep = {
  item_id: string;
  predecessor_item_id: string | null;
  tipo?: string;
};

function toISO(d: Date): string {
  return format(d, "yyyy-MM-dd");
}

/**
 * Move o item inteiro mantendo a duração.
 * Retorna a nova janela. Não persiste.
 */
export function aplicarDrag(
  item: Pick<GanttEdicaoItem, "data_inicio" | "data_fim">,
  deltaDias: number,
): { data_inicio: string; data_fim: string } {
  const ini = parseISO(item.data_inicio);
  const fim = parseISO(item.data_fim);
  return {
    data_inicio: toISO(addDays(ini, deltaDias)),
    data_fim: toISO(addDays(fim, deltaDias)),
  };
}

/**
 * Redimensiona o item por uma borda. Garante duração mínima de 1 dia
 * (data_fim >= data_inicio).
 */
export function aplicarResize(
  item: Pick<GanttEdicaoItem, "data_inicio" | "data_fim">,
  borda: "inicio" | "fim",
  deltaDias: number,
): { data_inicio: string; data_fim: string } {
  let ini = parseISO(item.data_inicio);
  let fim = parseISO(item.data_fim);
  if (borda === "inicio") {
    const cand = addDays(ini, deltaDias);
    // não deixa início passar o fim (mínimo 1 dia de duração).
    ini = differenceInCalendarDays(fim, cand) >= 0 ? cand : fim;
  } else {
    const cand = addDays(fim, deltaDias);
    fim = differenceInCalendarDays(cand, ini) >= 0 ? cand : ini;
  }
  return { data_inicio: toISO(ini), data_fim: toISO(fim) };
}

export type ValidacaoDependencia =
  { ok: true } | { ok: false; motivo: "self" | "duplicata" | "ciclo" };

/**
 * Valida criação de nova dependência (predecessor → item).
 * Bloqueia auto-ligação, duplicata exata e ciclo.
 */
export function validarNovaDependencia(
  deps: GanttEdicaoDep[],
  predecessorId: string,
  itemId: string,
): ValidacaoDependencia {
  if (!predecessorId || !itemId) return { ok: false, motivo: "self" };
  if (predecessorId === itemId) return { ok: false, motivo: "self" };

  const jaExiste = deps.some(
    (d) => d.predecessor_item_id === predecessorId && d.item_id === itemId,
  );
  if (jaExiste) return { ok: false, motivo: "duplicata" };

  // BFS a partir do itemId seguindo o sentido predecessor→sucessor.
  // Se alcançar predecessorId, fechou ciclo.
  const adj = new Map<string, string[]>();
  for (const d of deps) {
    if (!d.predecessor_item_id) continue;
    const arr = adj.get(d.predecessor_item_id) ?? [];
    arr.push(d.item_id);
    adj.set(d.predecessor_item_id, arr);
  }
  // Adiciona a aresta candidata.
  const candArr = adj.get(predecessorId) ?? [];
  candArr.push(itemId);
  adj.set(predecessorId, candArr);

  const visited = new Set<string>();
  const stack = [itemId];
  while (stack.length) {
    const cur = stack.pop()!;
    if (cur === predecessorId) return { ok: false, motivo: "ciclo" };
    if (visited.has(cur)) continue;
    visited.add(cur);
    const next = adj.get(cur);
    if (next) stack.push(...next);
  }

  return { ok: true };
}

/**
 * Converte deslocamento horizontal em pixels para delta em dias inteiros,
 * dado o zoom atual (pixels por dia).
 */
export function pxToDias(deltaPx: number, dayPx: number): number {
  if (dayPx <= 0) return 0;
  return Math.round(deltaPx / dayPx);
}

/**
 * Dado um conjunto de itens, dependências e o id da atividade que acabou
 * de ser movida por `deltaDias`, devolve a lista de sucessoras transitivas
 * com suas novas datas (todas deslocadas pelo mesmo delta).
 *
 * Simples e previsível — não tenta resolver lag/SS/FF caso a caso. Casa com
 * o que o usuário espera de "mover com sucessoras" no MS Project.
 *
 * O item raiz NÃO é incluído no resultado.
 */
export function calcularCascata(
  itens: GanttEdicaoItem[],
  deps: GanttEdicaoDep[],
  raizId: string,
  deltaDias: number,
): { id: string; data_inicio: string; data_fim: string }[] {
  if (deltaDias === 0) return [];
  const adj = new Map<string, string[]>();
  for (const d of deps) {
    if (!d.predecessor_item_id) continue;
    const arr = adj.get(d.predecessor_item_id) ?? [];
    arr.push(d.item_id);
    adj.set(d.predecessor_item_id, arr);
  }
  const itemById = new Map(itens.map((i) => [i.id, i]));
  const visitados = new Set<string>([raizId]);
  const fila = [...(adj.get(raizId) ?? [])];
  const resultado: { id: string; data_inicio: string; data_fim: string }[] = [];
  while (fila.length) {
    const id = fila.shift()!;
    if (visitados.has(id)) continue;
    visitados.add(id);
    const it = itemById.get(id);
    if (it) {
      resultado.push({ id, ...aplicarDrag(it, deltaDias) });
    }
    const filhos = adj.get(id);
    if (filhos) fila.push(...filhos);
  }
  return resultado;
}
