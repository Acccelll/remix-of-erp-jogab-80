/** @module-kind pure */
// Helpers de calendário de trabalho (dias úteis + feriados/exceções).
// Puro: sem I/O, sem dependência de banco. Datas em ISO 'YYYY-MM-DD'.
//
// Convenção de `dia da semana`: 0=Domingo .. 6=Sábado (compatível com Date.getDay()).
// MS Project usa 1=Domingo .. 7=Sábado em WeekDay/DayType. O parser converte.
//
// Capacidade fracionária:
//   - `Excecao.horas_disponiveis` (opcional) permite que um dia conte
//     proporcionalmente. Ex.: cal de 8h/dia + excecao com 4h → o dia
//     contribui 0.5 dia útil. `null/undefined` = comportamento binário
//     pelo flag `trabalha`.

import { parseISO } from "date-fns";

const DAY_MS = 86400000;

export type Excecao = {
  data_inicio: string; // ISO
  data_fim: string; // ISO
  trabalha: boolean;
  /** Horas disponíveis no dia (override fracionário). Null/undefined = usa `trabalha`. */
  horas_disponiveis?: number | null;
};

export type Calendario = {
  dias_uteis: number[]; // subset de 0..6
  horas_por_dia: number;
  excecoes: Excecao[];
};

export const CALENDARIO_PADRAO: Calendario = {
  dias_uteis: [1, 2, 3, 4, 5],
  horas_por_dia: 8,
  excecoes: [],
};

function ymd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function dentroDaExcecao(isoData: string, ex: Excecao): boolean {
  return isoData >= ex.data_inicio && isoData <= ex.data_fim;
}

function excecaoDoDia(isoData: string, cal: Calendario): Excecao | undefined {
  for (const ex of cal.excecoes) if (dentroDaExcecao(isoData, ex)) return ex;
  return undefined;
}

/**
 * Capacidade do dia em fração de dia útil (0..1+).
 * - excecao com horas_disponiveis → ratio fracionário
 * - excecao trabalha=false → 0
 * - excecao trabalha=true sem horas → 1
 * - dia útil normal → 1, fora → 0
 */
export function capacidadeFracionariaDia(isoData: string, cal: Calendario): number {
  const ex = excecaoDoDia(isoData, cal);
  if (ex) {
    if (ex.horas_disponiveis != null) {
      const base = cal.horas_por_dia > 0 ? cal.horas_por_dia : 8;
      return Math.max(0, Number(ex.horas_disponiveis) / base);
    }
    return ex.trabalha ? 1 : 0;
  }
  const dow = parseISO(isoData).getUTCDay();
  return cal.dias_uteis.includes(dow) ? 1 : 0;
}

export function ehDiaUtil(isoData: string, cal: Calendario): boolean {
  return capacidadeFracionariaDia(isoData, cal) > 0;
}

/** Dias úteis entre `inicio` e `fim`, inclusivo nas duas pontas (soma fracionária). */
export function diasUteisEntre(inicioIso: string, fimIso: string, cal: Calendario): number {
  if (inicioIso > fimIso) return -diasUteisEntre(fimIso, inicioIso, cal);
  let count = 0;
  let cur = parseISO(inicioIso).getTime();
  const end = parseISO(fimIso).getTime();
  const temFracionario = cal.excecoes.some((e) => e.horas_disponiveis != null);
  while (cur <= end) {
    const iso = ymd(new Date(cur));
    if (temFracionario) {
      count += capacidadeFracionariaDia(iso, cal);
    } else if (ehDiaUtil(iso, cal)) {
      count += 1;
    }
    cur += DAY_MS;
  }
  // Modo binário: count é inteiro. Modo fracionário: arredondar a duas casas.
  return temFracionario ? Math.round(count * 100) / 100 : count;
}

/**
 * Soma `n` dias úteis a partir de `inicio`.
 * - n = 0: se o dia for útil (cap > 0), devolve o próprio; senão, próximo útil.
 * - Com calendário fracionário, acumula capacidade até atingir `|n|`.
 */
export function somaDiasUteis(inicioIso: string, n: number, cal: Calendario): string {
  let cur = parseISO(inicioIso).getTime();
  if (n === 0) {
    while (!ehDiaUtil(ymd(new Date(cur)), cal)) cur += DAY_MS;
    return ymd(new Date(cur));
  }
  const step = n > 0 ? DAY_MS : -DAY_MS;
  let alvo = Math.abs(n);
  const temFracionario = cal.excecoes.some((e) => e.horas_disponiveis != null);
  let acumulado = 0;
  // limite de segurança para evitar loop infinito caso todo o calendário não trabalhe
  let guard = 0;
  while (acumulado + 1e-9 < alvo) {
    cur += step;
    if (++guard > 365 * 20) break;
    const iso = ymd(new Date(cur));
    const cap = temFracionario ? capacidadeFracionariaDia(iso, cal) : ehDiaUtil(iso, cal) ? 1 : 0;
    if (cap > 0) acumulado += cap;
  }
  return ymd(new Date(cur));
}

/** Converte lag em minutos (vindo do MPP) para dias úteis usando `horas_por_dia`. */
export function lagParaDiasUteis(lagMinutos: number, cal: Calendario): number {
  if (!lagMinutos) return 0;
  const minPorDia = cal.horas_por_dia * 60;
  if (minPorDia <= 0) return 0;
  return Math.round(lagMinutos / minPorDia);
}
