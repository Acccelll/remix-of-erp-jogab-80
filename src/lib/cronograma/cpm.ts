/** @module-kind pure */
// Caminho crítico (CPM) sobre itens do cronograma + dependências.
//
// Modos:
//  - Dias corridos (padrão, retrocompatível): mantém o comportamento original.
//  - Calendário (opcional via `opts.calendarioPadrao`/`opts.calendarioPorItem`):
//    aplica lag e o gap "+1" do FS em DIAS ÚTEIS usando o calendário do item
//    (ou o padrão). Lag pode vir em minutos (`lag_minutos`) ou dias (`lag_dias`).
//
// Forward pass (ES/EF), Backward pass (LS/LF), folga = LS - ES. Crítico se folga <= 0.

import { parseISO } from "date-fns";
import { somaDiasUteis, lagParaDiasUteis, type Calendario } from "@/lib/cronograma/calendario";

export type CpmItem = {
  id: string;
  uid_mpp: string | null;
  data_inicio: string; // ISO date
  data_fim: string; // ISO date
  /** Quando presente, casa o item a um calendário em `opts.calendarioPorItem`. */
  calendario_uid_mpp?: string | null;
};

export type CpmDep = {
  item_id: string;
  predecessor_uid_mpp: string;
  predecessor_item_id?: string | null;
  tipo: "FS" | "SS" | "FF" | "SF";
  lag_dias: number;
  /** Lag em minutos vindo do MPP (preferido quando há calendário). */
  lag_minutos?: number | null;
};

export type CpmResult = {
  id: string;
  folga_dias: number;
  critico: boolean;
};

export type CpmResultDetalhado = CpmResult & {
  es: string;
  ef: string;
  ls: string;
  lf: string;
  folga_total_dias: number;
  folga_livre_dias: number;
};

export type CpmOpts = {
  calendarioPadrao?: Calendario;
  calendarioPorItem?: Map<string, Calendario>; // chave: item.id
};

const DAY = 86400000;
const toMs = (d: string) => parseISO(d).getTime();
const toIso = (ms: number) => new Date(ms).toISOString().slice(0, 10);

function calFor(item: CpmItem | undefined, opts?: CpmOpts): Calendario | undefined {
  if (!opts || !item) return opts?.calendarioPadrao;
  if (opts.calendarioPorItem) {
    const c = opts.calendarioPorItem.get(item.id);
    if (c) return c;
  }
  return opts.calendarioPadrao;
}

function addDiasUteisMs(baseMs: number, n: number, cal: Calendario): number {
  if (!n) return baseMs;
  const iso = toIso(baseMs);
  return toMs(somaDiasUteis(iso, n, cal));
}

function depLagDias(d: CpmDep, cal: Calendario | undefined): number {
  if (cal && d.lag_minutos != null) return lagParaDiasUteis(Number(d.lag_minutos), cal);
  return Number(d.lag_dias ?? 0);
}

function computeAll(itens: CpmItem[], deps: CpmDep[], opts?: CpmOpts) {
  const byId = new Map(itens.map((i) => [i.id, i]));
  const byUid = new Map(itens.filter((i) => i.uid_mpp).map((i) => [String(i.uid_mpp), i]));

  const successors = new Map<
    string,
    { id: string; tipo: CpmDep["tipo"]; lag: number; calOfPred: Calendario | undefined }[]
  >();
  const predecessors = new Map<
    string,
    { id: string; tipo: CpmDep["tipo"]; lag: number; calOfPred: Calendario | undefined }[]
  >();
  for (const d of deps) {
    const pred =
      (d.predecessor_item_id && byId.get(d.predecessor_item_id)) ||
      byUid.get(String(d.predecessor_uid_mpp));
    const succ = byId.get(d.item_id);
    if (!pred || !succ) continue;
    const calOfPred = calFor(pred, opts);
    const lag = depLagDias(d, calOfPred);
    successors.set(pred.id, [
      ...(successors.get(pred.id) ?? []),
      { id: succ.id, tipo: d.tipo, lag, calOfPred },
    ]);
    predecessors.set(succ.id, [
      ...(predecessors.get(succ.id) ?? []),
      { id: pred.id, tipo: d.tipo, lag, calOfPred },
    ]);
  }

  const useCal = !!(
    opts &&
    (opts.calendarioPadrao || (opts.calendarioPorItem && opts.calendarioPorItem.size > 0))
  );

  // duração em dias (calendário civil, derivada das datas do MPP)
  const dur = (it: CpmItem) =>
    Math.max(1, Math.round((toMs(it.data_fim) - toMs(it.data_inicio)) / DAY) + 1);

  // Kahn
  const indeg = new Map<string, number>();
  for (const i of itens) indeg.set(i.id, (predecessors.get(i.id) ?? []).length);
  const queue: string[] = [...indeg.entries()].filter(([, n]) => n === 0).map(([id]) => id);
  const order: string[] = [];
  while (queue.length) {
    const id = queue.shift()!;
    order.push(id);
    for (const s of successors.get(id) ?? []) {
      indeg.set(s.id, (indeg.get(s.id) ?? 0) - 1);
      if (indeg.get(s.id) === 0) queue.push(s.id);
    }
  }
  if (order.length < itens.length)
    for (const i of itens) if (!order.includes(i.id)) order.push(i.id);

  // Forward
  const es = new Map<string, number>();
  const ef = new Map<string, number>();
  for (const id of order) {
    const it = byId.get(id)!;
    const d = dur(it);
    let startMin = toMs(it.data_inicio);
    for (const p of predecessors.get(id) ?? []) {
      const pIt = byId.get(p.id);
      if (!pIt) continue;
      const pEs = es.get(p.id) ?? toMs(pIt.data_inicio);
      const pEf = ef.get(p.id) ?? toMs(pIt.data_fim);
      let req = startMin;
      if (useCal && p.calOfPred) {
        const cal = p.calOfPred;
        switch (p.tipo) {
          case "FS":
            req = addDiasUteisMs(pEf, 1 + p.lag, cal);
            break;
          case "SS":
            req = addDiasUteisMs(pEs, p.lag, cal);
            break;
          case "FF":
            req = addDiasUteisMs(pEf, p.lag, cal) - (d - 1) * DAY;
            break;
          case "SF":
            req = addDiasUteisMs(pEs, p.lag, cal) - (d - 1) * DAY;
            break;
        }
      } else {
        const lagMs = p.lag * DAY;
        switch (p.tipo) {
          case "FS":
            req = pEf + DAY + lagMs;
            break;
          case "SS":
            req = pEs + lagMs;
            break;
          case "FF":
            req = pEf - (d - 1) * DAY + lagMs;
            break;
          case "SF":
            req = pEs - (d - 1) * DAY + lagMs;
            break;
        }
      }
      if (req > startMin) startMin = req;
    }
    es.set(id, startMin);
    ef.set(id, startMin + (d - 1) * DAY);
  }

  // Backward
  const projectFinish = Math.max(...[...ef.values()]);
  const lf = new Map<string, number>();
  const ls = new Map<string, number>();
  for (const id of [...order].reverse()) {
    const it = byId.get(id)!;
    const d = dur(it);
    const succs = successors.get(id) ?? [];
    let finishMax = succs.length === 0 ? projectFinish : Number.POSITIVE_INFINITY;
    for (const s of succs) {
      const sIt = byId.get(s.id);
      if (!sIt) continue;
      const sLs = ls.get(s.id) ?? toMs(sIt.data_inicio);
      const sLf = lf.get(s.id) ?? toMs(sIt.data_fim);
      let allowed = finishMax;
      if (useCal && s.calOfPred) {
        const cal = s.calOfPred;
        switch (s.tipo) {
          case "FS":
            allowed = addDiasUteisMs(sLs, -(1 + s.lag), cal);
            break;
          case "SS":
            allowed = addDiasUteisMs(sLs, -s.lag, cal) + (d - 1) * DAY;
            break;
          case "FF":
            allowed = addDiasUteisMs(sLf, -s.lag, cal);
            break;
          case "SF":
            allowed = addDiasUteisMs(sLf, -s.lag, cal) + (d - 1) * DAY;
            break;
        }
      } else {
        const lagMs = s.lag * DAY;
        switch (s.tipo) {
          case "FS":
            allowed = sLs - DAY - lagMs;
            break;
          case "SS":
            allowed = sLs + (d - 1) * DAY - lagMs;
            break;
          case "FF":
            allowed = sLf - lagMs;
            break;
          case "SF":
            allowed = sLf + (d - 1) * DAY - lagMs;
            break;
        }
      }
      if (allowed < finishMax) finishMax = allowed;
    }
    lf.set(id, finishMax);
    ls.set(id, finishMax - (d - 1) * DAY);
  }

  return { byId, successors, predecessors, es, ef, ls, lf };
}

export function computeCpm(itens: CpmItem[], deps: CpmDep[], opts?: CpmOpts): CpmResult[] {
  if (itens.length === 0) return [];
  const { es, ls } = computeAll(itens, deps, opts);
  return itens.map((i) => {
    const slackMs = (ls.get(i.id) ?? toMs(i.data_inicio)) - (es.get(i.id) ?? toMs(i.data_inicio));
    const folga = Math.round(slackMs / DAY);
    return { id: i.id, folga_dias: folga, critico: folga <= 0 };
  });
}

/** Versão detalhada — devolve ES/EF/LS/LF, folga total e folga livre. */
export function computeCpmDetalhado(
  itens: CpmItem[],
  deps: CpmDep[],
  opts?: CpmOpts,
): CpmResultDetalhado[] {
  if (itens.length === 0) return [];
  const { byId, successors, es, ef, ls, lf } = computeAll(itens, deps, opts);
  return itens.map((i) => {
    const e = es.get(i.id) ?? toMs(i.data_inicio);
    const f = ef.get(i.id) ?? toMs(i.data_fim);
    const lsi = ls.get(i.id) ?? e;
    const lfi = lf.get(i.id) ?? f;
    const folgaTotal = Math.round((lsi - e) / DAY);
    // Folga livre: min(ES sucessor) - EF - 1 (em dias corridos). Sem sucessor → folga total.
    const succs = successors.get(i.id) ?? [];
    let folgaLivre = folgaTotal;
    if (succs.length > 0) {
      let minStart = Number.POSITIVE_INFINITY;
      for (const s of succs) {
        const sIt = byId.get(s.id);
        if (!sIt) continue;
        const sEs = es.get(s.id) ?? toMs(sIt.data_inicio);
        if (sEs < minStart) minStart = sEs;
      }
      folgaLivre = Math.max(0, Math.round((minStart - f) / DAY) - 1);
    }
    return {
      id: i.id,
      folga_dias: folgaTotal,
      critico: folgaTotal <= 0,
      es: toIso(e),
      ef: toIso(f),
      ls: toIso(lsi),
      lf: toIso(lfi),
      folga_total_dias: folgaTotal,
      folga_livre_dias: folgaLivre,
    };
  });
}

/**
 * Atraso máximo (em dias corridos) entre `data_fim` e `data_fim_baseline`.
 */
export function diasAtrasoMaximo(
  itens: { data_fim: string; data_fim_baseline: string | null }[],
): number {
  let max = 0;
  for (const i of itens) {
    if (!i.data_fim_baseline) continue;
    const d = Math.round((toMs(i.data_fim) - toMs(i.data_fim_baseline)) / DAY);
    if (d > max) max = d;
  }
  return max;
}

/** @deprecated Use `diasAtrasoMaximo` ou `diasAtrasoCaminhoCritico`. */
export const diasAtraso = diasAtrasoMaximo;

export function diasAtrasoCaminhoCritico(
  itens: { id: string; data_fim: string; data_fim_baseline: string | null }[],
  cpmResult: CpmResult[],
): number {
  const criticos = new Set(cpmResult.filter((r) => r.critico).map((r) => r.id));
  const candidatos = itens.filter((i) => criticos.has(i.id) && i.data_fim_baseline);
  if (candidatos.length === 0) return 0;
  const ultimo = candidatos.reduce((acc, i) => (toMs(i.data_fim) > toMs(acc.data_fim) ? i : acc));
  return Math.round((toMs(ultimo.data_fim) - toMs(ultimo.data_fim_baseline!)) / DAY);
}

export { toIso };
