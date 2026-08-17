/** @module-kind pure */
/**
 * Rateio de custo financeiro de antecipação por obra e por competência.
 *
 * Regra: o custo total de uma operação (deságio + IOF + tarifas) é rateado entre
 * seus títulos proporcionalmente ao valor de face. O custo de cada título é
 * atribuído à obra do título e à competência da data da operação (YYYY-MM).
 */
import { ratearPorTitulo } from "./calculo";

export interface TituloRateio {
  id: string;
  operacaoId: string;
  obraId: string | null;
  valorFace: number;
}

export interface OperacaoRateio {
  id: string;
  dataOperacao: string; // YYYY-MM-DD
  desagio: number;
  iof: number;
  tarifas: number;
  titulos: TituloRateio[];
}

export interface RateioObra {
  obraId: string;
  desagio: number;
  iof: number;
  tarifas: number;
  custoTotal: number;
  valorFace: number;
  operacoes: number;
  titulos: number;
}

export interface RateioCompetencia {
  competencia: string; // YYYY-MM
  desagio: number;
  iof: number;
  tarifas: number;
  custoTotal: number;
  valorFace: number;
  operacoes: number;
}

const toCents = (v: number): number => Math.round((Number.isFinite(v) ? v : 0) * 100);
const fromCents = (c: number): number => Math.round(c) / 100;

function competenciaOf(iso: string): string {
  return (iso ?? "").slice(0, 7);
}

/** Distribui o custo (deságio, IOF, tarifas) de cada operação por título e agrega por obra. */
export function ratearPorObra(operacoes: OperacaoRateio[]): RateioObra[] {
  const acc = new Map<string, RateioObra & { _ops: Set<string> }>();

  for (const op of operacoes) {
    if (op.titulos.length === 0) continue;
    const partsDesagio = ratearPorTitulo(op.desagio, op.titulos.map((t) => ({ id: t.id, valorFace: t.valorFace })));
    const partsIof = ratearPorTitulo(op.iof, op.titulos.map((t) => ({ id: t.id, valorFace: t.valorFace })));
    const partsTar = ratearPorTitulo(op.tarifas, op.titulos.map((t) => ({ id: t.id, valorFace: t.valorFace })));
    const byId = new Map(op.titulos.map((t) => [t.id, t]));

    for (const p of partsDesagio) {
      const t = byId.get(p.id)!;
      const obraId = t.obraId ?? "__sem_obra__";
      const cur =
        acc.get(obraId) ??
        ({ obraId, desagio: 0, iof: 0, tarifas: 0, custoTotal: 0, valorFace: 0, operacoes: 0, titulos: 0, _ops: new Set<string>() } as any);
      cur.desagio = fromCents(toCents(cur.desagio) + toCents(p.valor));
      cur.valorFace = fromCents(toCents(cur.valorFace) + toCents(t.valorFace));
      cur.titulos += 1;
      cur._ops.add(op.id);
      acc.set(obraId, cur);
    }
    for (const p of partsIof) {
      const t = byId.get(p.id)!;
      const obraId = t.obraId ?? "__sem_obra__";
      const cur = acc.get(obraId)!;
      cur.iof = fromCents(toCents(cur.iof) + toCents(p.valor));
    }
    for (const p of partsTar) {
      const t = byId.get(p.id)!;
      const obraId = t.obraId ?? "__sem_obra__";
      const cur = acc.get(obraId)!;
      cur.tarifas = fromCents(toCents(cur.tarifas) + toCents(p.valor));
    }
  }

  return Array.from(acc.values()).map(({ _ops, ...r }) => ({
    ...r,
    operacoes: _ops.size,
    custoTotal: fromCents(toCents(r.desagio) + toCents(r.iof) + toCents(r.tarifas)),
  }));
}

/** Agrega o custo por competência (YYYY-MM) da data da operação. */
export function ratearPorCompetencia(operacoes: OperacaoRateio[]): RateioCompetencia[] {
  const acc = new Map<string, RateioCompetencia>();
  for (const op of operacoes) {
    const comp = competenciaOf(op.dataOperacao);
    if (!comp) continue;
    const face = op.titulos.reduce((a, t) => a + toCents(t.valorFace), 0);
    const cur =
      acc.get(comp) ??
      ({ competencia: comp, desagio: 0, iof: 0, tarifas: 0, custoTotal: 0, valorFace: 0, operacoes: 0 } as RateioCompetencia);
    cur.desagio = fromCents(toCents(cur.desagio) + toCents(op.desagio));
    cur.iof = fromCents(toCents(cur.iof) + toCents(op.iof));
    cur.tarifas = fromCents(toCents(cur.tarifas) + toCents(op.tarifas));
    cur.valorFace = fromCents(toCents(cur.valorFace) + face);
    cur.operacoes += 1;
    cur.custoTotal = fromCents(toCents(cur.desagio) + toCents(cur.iof) + toCents(cur.tarifas));
    acc.set(comp, cur);
  }
  return Array.from(acc.values()).sort((a, b) => a.competencia.localeCompare(b.competencia));
}

/** Resumo por obra específica (atalho). */
export function resumoObra(obraId: string, operacoes: OperacaoRateio[]): RateioObra | null {
  return ratearPorObra(operacoes).find((r) => r.obraId === obraId) ?? null;
}
