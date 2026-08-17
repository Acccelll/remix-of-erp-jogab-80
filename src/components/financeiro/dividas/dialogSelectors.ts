import { STATUS_A_VENCER, STATUS_VENCE_HOJE, STATUS_VENCIDO } from "./useDividasData";
import { PGTO_BUCKETS, type PgtoBucket } from "./types";

export const AGING_RANGES: Record<string, { min: number; max: number | null }> = {
  "1-30": { min: 1, max: 30 },
  "31-60": { min: 31, max: 60 },
  "61-90": { min: 61, max: 90 },
  "91-180": { min: 91, max: 180 },
  "180+": { min: 181, max: null },
};

export const AGING_AVENCER_RANGES: Record<string, { min: number; max: number | null }> = {
  "Vence hoje": { min: 0, max: 0 },
  "1-7": { min: 1, max: 7 },
  "8-15": { min: 8, max: 15 },
  "16-30": { min: 16, max: 30 },
  "31-60": { min: 31, max: 60 },
  "61-90": { min: 61, max: 90 },
  "90+": { min: 91, max: null },
};

/** Vencido inclui baixas parciais vencidas (bucket manda sobre o status TOTVS). */
function ehVencido(l: any) {
  return l.bucket ? l.bucket === "vencido" : l.status_cod === STATUS_VENCIDO;
}

function ehFuturo(l: any) {
  return l.bucket
    ? l.bucket === "hoje" || l.bucket === "avencer"
    : l.status_cod === STATUS_VENCE_HOJE || l.status_cod === STATUS_A_VENCER;
}

export function filtrarAging(
  lancs: any[],
  hoje: string,
  sel: { tipo: "vencido" | "avencer"; faixa: string } | null,
) {
  if (!sel) return [];
  if (sel.tipo === "vencido") {
    const r = AGING_RANGES[sel.faixa];
    if (!r) return [];
    return lancs.filter((l) => {
      if (!ehVencido(l)) return false;
      const d = Number(l.dias_atraso_efetivo ?? l.dias_atraso ?? 0);
      if (!Number.isFinite(d) || d < 1) return false;
      if (d < r.min) return false;
      if (r.max != null && d > r.max) return false;
      return true;
    });
  }
  const r = AGING_AVENCER_RANGES[sel.faixa];
  if (!r) return [];
  const hojeMs = new Date(`${hoje}T00:00:00Z`).getTime();
  return lancs.filter((l) => {
    if (!ehFuturo(l)) return false;
    if (!l.data_vencimento) return false;
    const venc = new Date(`${String(l.data_vencimento).slice(0, 10)}T00:00:00Z`).getTime();
    if (!isFinite(venc)) return false;
    const dias = Math.floor((venc - hojeMs) / 86400000);
    if (dias < 0) return false;
    if (dias < r.min) return false;
    if (r.max != null && dias > r.max) return false;
    return true;
  });
}

export function filtrarKpi(
  lancs: any[],
  hoje: string,
  kpiSel: "vencido" | "hoje" | "avencer" | "total" | null,
) {
  if (!kpiSel) return [];
  return lancs.filter((l) => {
    if (kpiSel === "vencido") return ehVencido(l);
    if (kpiSel === "avencer") return ehFuturo(l);
    if (kpiSel === "total") return ehVencido(l) || ehFuturo(l);
    if (kpiSel === "hoje") {
      if (l.bucket) return l.bucket === "hoje";
      if (!ehFuturo(l)) return false;
      if (!l.data_vencimento) return false;
      return String(l.data_vencimento).slice(0, 10) === hoje;
    }
    return false;
  });
}

export function filtrarPgto(
  lancs: any[],
  pgtoBuckets: Set<PgtoBucket>,
  pgtoSel: "avista" | "aprazo" | "indef" | null,
) {
  if (!pgtoSel) return [];
  return lancs.filter((l) => {
    if (l.bucket === "outro") return false;
    if (!pgtoBuckets.has(l.bucket as PgtoBucket)) return false;
    return l.pgto === pgtoSel;
  });
}

export { PGTO_BUCKETS };
