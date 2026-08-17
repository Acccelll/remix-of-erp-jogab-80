/** @module-kind pure */
// EVM (Earned Value Management) — engine pura, sem dependências de React/Supabase.
//
// Diferença crítica vs. o EVM antigo em AnaliseTab.tsx:
//   AC (Actual Cost) = CUSTO INCORRIDO de fato, NÃO faturamento.
//   Aqui o AC vem das despesas reais do TOTVS (grupo "2" da view vw_financeiro_obra),
//   construído em src/lib/pmbok/ac-totvs.ts. Quando a obra não tem CC vinculado ou
//   não há dados TOTVS, usamos um fallback baseado em medições e marcamos
//   `fonteAC = "estimado_medicoes"` para que a UI possa avisar o usuário.
//
// Indicadores cobertos:
//   BAC, PV, EV, AC, SV, CV, SPI, CPI, EAC (3 cenários), ETC, VAC, TCPI,
//   e Earned Schedule: ES, AT, SV(t), SPI(t).
//
// Convenção para divisões por zero:
//   - Índices (SPI, CPI, SPIt, TCPI): retorna 0 quando denominador = 0.
//   - EAC: cai para BAC quando CPI = 0.

import {
  parseISO,
  differenceInCalendarDays,
  eachMonthOfInterval,
  startOfMonth,
  endOfMonth,
  min as dMin,
  max as dMax,
  format,
} from "date-fns";
import { round2 } from "@/lib/core/money";

export type EvmItemCrono = {
  custo: number | null;
  custo_baseline: number | null;
  percentual_previsto: number | null;
  percentual_realizado: number | null;
  data_inicio: string;
  data_fim: string;
  data_inicio_baseline: string | null;
  data_fim_baseline: string | null;
  ativo?: boolean;
};

export type EvmAcReal = {
  /** Despesa real do TOTVS agregada por mes_competencia (YYYY-MM). */
  porMes: { mes: string; valor: number }[];
  total: number;
};

export type FonteAC = "totvs" | "estimado_medicoes";

export type EvmResultado = {
  fonteAC: FonteAC;
  dataReferencia: string;
  BAC: number;
  PV: number;
  EV: number;
  AC: number;
  SV: number;
  CV: number;
  SPI: number;
  CPI: number;
  EAC_cpi: number;
  EAC_otimista: number;
  EAC_pessimista: number;
  ETC: number;
  VAC: number;
  TCPI: number;
  ES_meses: number;
  AT_meses: number;
  SVt_meses: number;
  SPIt: number;
};

export type MedicaoFallback = { status: string; valor: number | null };

const DAY = 86400000;

function custoItem(c: EvmItemCrono): number {
  return Number(c.custo_baseline ?? c.custo ?? 0) || 0;
}
function iniItem(c: EvmItemCrono): string {
  return c.data_inicio_baseline ?? c.data_inicio;
}
function fimItem(c: EvmItemCrono): string {
  return c.data_fim_baseline ?? c.data_fim;
}
function ativos(itens: EvmItemCrono[]): EvmItemCrono[] {
  return itens.filter((c) => c.ativo !== false);
}

export function calcularBAC(itens: EvmItemCrono[]): number {
  return round2(ativos(itens).reduce((acc, c) => acc + custoItem(c), 0));
}

/** PV: fração linear do custo entre data_inicio e data_fim (preferindo baseline) até dataRef. */
export function calcularPV(itens: EvmItemCrono[], dataRef: Date): number {
  let pv = 0;
  for (const c of ativos(itens)) {
    const custo = custoItem(c);
    if (!custo) continue;
    try {
      const ini = parseISO(iniItem(c));
      const fim = parseISO(fimItem(c));
      const total = Math.max(1, differenceInCalendarDays(fim, ini));
      const decorridos = Math.max(0, Math.min(total, differenceInCalendarDays(dataRef, ini)));
      pv += custo * (decorridos / total);
    } catch {
      // ignora item com datas inválidas
    }
  }
  return round2(pv);
}

export function calcularEV(itens: EvmItemCrono[]): number {
  let ev = 0;
  for (const c of ativos(itens)) {
    const custo = custoItem(c);
    ev += custo * (Number(c.percentual_realizado ?? 0) / 100);
  }
  return round2(ev);
}

/** AC a partir do TOTVS (preferido) ou fallback de medições. */
export function calcularAC(
  acReal: EvmAcReal | null | undefined,
  medicoesFallback: MedicaoFallback[] | null | undefined,
  dataRef: Date,
): { ac: number; fonte: FonteAC } {
  if (acReal && acReal.total > 0) {
    const ref = format(dataRef, "yyyy-MM");
    const total = acReal.porMes
      .filter((m) => m.mes <= ref)
      .reduce((acc, m) => acc + (m.valor || 0), 0);
    return { ac: round2(total), fonte: "totvs" };
  }
  const fallback = (medicoesFallback ?? [])
    .filter((m) => ["aprovada", "faturada", "enviada"].includes(m.status))
    .reduce((acc, m) => acc + Number(m.valor ?? 0), 0);
  return { ac: round2(fallback), fonte: "estimado_medicoes" };
}

/** Curva PV acumulada por mês (YYYY-MM). Usado para Earned Schedule. */
export function curvaPVMensal(itens: EvmItemCrono[]): { mes: string; pvAcum: number }[] {
  const at = ativos(itens);
  if (!at.length) return [];
  let dini: Date, dfim: Date;
  try {
    dini = dMin(at.map((c) => parseISO(iniItem(c))));
    dfim = dMax(at.map((c) => parseISO(fimItem(c))));
  } catch {
    return [];
  }
  const meses = eachMonthOfInterval({ start: startOfMonth(dini), end: endOfMonth(dfim) });

  const porMes = new Map<string, number>();
  for (const c of at) {
    const custo = custoItem(c);
    if (!custo) continue;
    let ini: Date, fim: Date;
    try {
      ini = parseISO(iniItem(c));
      fim = parseISO(fimItem(c));
    } catch {
      continue;
    }
    const totalDias = Math.max(1, differenceInCalendarDays(fim, ini) + 1);
    for (const m of meses) {
      const mIni = startOfMonth(m);
      const mFim = endOfMonth(m);
      const overlapIni = mIni.getTime() > ini.getTime() ? mIni : ini;
      const overlapFim = mFim.getTime() < fim.getTime() ? mFim : fim;
      const overlapDias = Math.max(0, differenceInCalendarDays(overlapFim, overlapIni) + 1);
      if (overlapDias <= 0) continue;
      const chave = format(m, "yyyy-MM");
      porMes.set(chave, (porMes.get(chave) ?? 0) + custo * (overlapDias / totalDias));
    }
  }
  let acc = 0;
  return meses.map((m) => {
    const chave = format(m, "yyyy-MM");
    acc += porMes.get(chave) ?? 0;
    return { mes: chave, pvAcum: round2(acc) };
  });
}

/** Earned Schedule (em meses): instante na curva PV em que PV(t) = EV atual. */
export function calcularEarnedSchedule(
  curvaPV: { mes: string; pvAcum: number }[],
  EV: number,
  dataRef: Date,
): { ES_meses: number; AT_meses: number; SVt_meses: number; SPIt: number } {
  if (!curvaPV.length || EV <= 0) {
    return { ES_meses: 0, AT_meses: 0, SVt_meses: 0, SPIt: 0 };
  }
  // Acha o índice i onde pvAcum[i] >= EV
  let ES = 0;
  for (let i = 0; i < curvaPV.length; i++) {
    if (curvaPV[i].pvAcum >= EV) {
      if (i === 0) {
        ES = curvaPV[0].pvAcum > 0 ? EV / curvaPV[0].pvAcum : 1;
      } else {
        const prev = curvaPV[i - 1].pvAcum;
        const cur = curvaPV[i].pvAcum;
        const frac = cur > prev ? (EV - prev) / (cur - prev) : 0;
        ES = i + frac; // ponto entre mês i-1 (=índice i base 1) e mês i+1
      }
      break;
    }
    if (i === curvaPV.length - 1) {
      // EV ultrapassa o último ponto da curva → projeto está adiantado além do baseline
      ES = curvaPV.length;
    }
  }
  // AT: meses entre o início do projeto e dataRef
  const inicio = parseISO(curvaPV[0].mes + "-01");
  const diasDecorridos = Math.max(0, differenceInCalendarDays(dataRef, inicio));
  const AT = diasDecorridos / 30.4375; // média de dias/mês
  const SPIt = AT > 0 ? ES / AT : 0;
  return {
    ES_meses: Number(ES.toFixed(2)),
    AT_meses: Number(AT.toFixed(2)),
    SVt_meses: Number((ES - AT).toFixed(2)),
    SPIt: Number(SPIt.toFixed(3)),
  };
}

export function calcularEVM(args: {
  itens: EvmItemCrono[];
  dataRef?: Date;
  acReal?: EvmAcReal | null;
  medicoesFallback?: MedicaoFallback[] | null;
}): EvmResultado {
  const dataRef = args.dataRef ?? new Date();
  const BAC = calcularBAC(args.itens);
  const PV = calcularPV(args.itens, dataRef);
  const EV = calcularEV(args.itens);
  const { ac: AC, fonte: fonteAC } = calcularAC(args.acReal, args.medicoesFallback, dataRef);

  const SV = round2(EV - PV);
  const CV = round2(EV - AC);
  const SPI = PV > 0 ? Number((EV / PV).toFixed(3)) : 0;
  const CPI = AC > 0 ? Number((EV / AC).toFixed(3)) : 0;

  const EAC_cpi = CPI > 0 ? round2(BAC / CPI) : BAC;
  const EAC_otimista = round2(AC + (BAC - EV));
  const denomPess = CPI > 0 && SPI > 0 ? CPI * SPI : 0;
  const EAC_pessimista = denomPess > 0 ? round2(AC + (BAC - EV) / denomPess) : EAC_cpi;
  const ETC = round2(EAC_cpi - AC);
  const VAC = round2(BAC - EAC_cpi);
  const TCPI = BAC - AC !== 0 ? Number(((BAC - EV) / (BAC - AC)).toFixed(3)) : 0;

  const curva = curvaPVMensal(args.itens);
  const es = calcularEarnedSchedule(curva, EV, dataRef);

  return {
    fonteAC,
    dataReferencia: format(dataRef, "yyyy-MM-dd"),
    BAC,
    PV,
    EV,
    AC,
    SV,
    CV,
    SPI,
    CPI,
    EAC_cpi,
    EAC_otimista,
    EAC_pessimista,
    ETC,
    VAC,
    TCPI,
    ...es,
  };
}

export type FaixaIndice = "bom" | "alerta" | "critico";

/** Semáforo padrão para SPI/CPI/SPIt: ≥1 bom, 0.9–1.0 alerta, <0.9 crítico. */
export function classificarIndice(v: number): FaixaIndice {
  if (v >= 1) return "bom";
  if (v >= 0.9) return "alerta";
  return "critico";
}

/**
 * BIZ-001 — Distribui um valor por item proporcionalmente aos dias sobrepostos
 * a cada mês da janela do item (mesma base de rateio de `curvaPVMensal`).
 * Interno; usado por `curvaSMensal` para PV/EV mensal.
 */
function distribuirPorMes(
  itens: EvmItemCrono[],
  valorItem: (c: EvmItemCrono) => number,
): Map<string, number> {
  const at = ativos(itens);
  const porMes = new Map<string, number>();
  if (!at.length) return porMes;
  for (const c of at) {
    const valor = valorItem(c);
    if (!valor) continue;
    let ini: Date, fim: Date;
    try {
      ini = parseISO(iniItem(c));
      fim = parseISO(fimItem(c));
    } catch {
      continue;
    }
    const total = Math.max(1, differenceInCalendarDays(fim, ini) + 1);
    const meses = eachMonthOfInterval({ start: startOfMonth(ini), end: endOfMonth(fim) });
    for (const m of meses) {
      const mIni = startOfMonth(m);
      const mFim = endOfMonth(m);
      const oIni = mIni.getTime() > ini.getTime() ? mIni : ini;
      const oFim = mFim.getTime() < fim.getTime() ? mFim : fim;
      const dias = Math.max(0, differenceInCalendarDays(oFim, oIni) + 1);
      if (!dias) continue;
      const chave = format(m, "yyyy-MM");
      porMes.set(chave, (porMes.get(chave) ?? 0) + valor * (dias / total));
    }
  }
  return porMes;
}

export type CurvaSPonto = {
  mes: string;
  mesLabel: string;
  PV: number;
  EV: number | null;
  AC: number | null;
};

/**
 * BIZ-001 — Curva S mensal acumulada (PV/EV/AC). EV e AC ficam `null` após
 * o mês de `dataRef`. AC entra pré-agregado em `acPorMes` (usar
 * `construirAcReal` de `ac-totvs.ts` ou `ac-folha.ts`).
 */
export function curvaSMensal(
  itens: EvmItemCrono[],
  acPorMes: { mes: string; valor: number }[],
  dataRef: Date,
): CurvaSPonto[] {
  const at = ativos(itens);
  if (!at.length) return [];
  let dini: Date, dfim: Date;
  try {
    dini = dMin(at.map((c) => parseISO(iniItem(c))));
    dfim = dMax(at.map((c) => parseISO(fimItem(c))));
  } catch {
    return [];
  }
  const meses = eachMonthOfInterval({ start: startOfMonth(dini), end: endOfMonth(dfim) });
  const pvMap = distribuirPorMes(at, (c) => custoItem(c));
  const evMap = distribuirPorMes(
    at,
    (c) => custoItem(c) * (Number(c.percentual_realizado ?? 0) / 100),
  );
  const acMap = new Map(acPorMes.map((m) => [m.mes, m.valor]));
  const ref = format(dataRef, "yyyy-MM");
  let pvAcc = 0;
  let evAcc = 0;
  let acAcc = 0;
  return meses.map((m) => {
    const chave = format(m, "yyyy-MM");
    pvAcc += pvMap.get(chave) ?? 0;
    if (chave <= ref) {
      evAcc += evMap.get(chave) ?? 0;
      acAcc += acMap.get(chave) ?? 0;
    }
    return {
      mes: chave,
      mesLabel: format(m, "MM/yy"),
      PV: Math.round(pvAcc),
      EV: chave <= ref ? Math.round(evAcc) : null,
      AC: chave <= ref ? Math.round(acAcc) : null,
    };
  });
}
