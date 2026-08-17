/** @module-kind pure */
// Curva de resultado acumulado do contrato.
// Faturamento − despesas, real (até hoje) e projetado (de hoje em diante).
// Lógica pura: recebe arrays, devolve série mensal. Sem Supabase, sem React.

import { addMonths, format, parseISO, startOfMonth } from "date-fns";

export interface NfInput {
  data_emissao: string | null;
  valor: number | null;
  status?: string | null;
}

export interface BmsInput {
  status: string | null;
  data_emissao_nfs_prevista: string | null;
  valor_previsto_dinamico: number | null;
}

export interface FinInput {
  natureza_tipo: number | null;
  status_cod: number | null;
  grupo: string | null;
  valor_rateio: number | null;
  data_pagamento: string | null;
  data_vencimento: string | null;
}

export interface PontoCurva {
  mes: string; // "yyyy-MM"
  fatReal: number;
  fatPrevisto: number;
  despReal: number;
  despAVencer: number;
  resultadoReal: number | null;
  resultadoProjetado: number | null;
}

const BMS_FECHADA = new Set(["fechada", "faturada", "paga", "cancelada"]);

function mesKey(d: Date): string {
  return format(d, "yyyy-MM");
}

function parseDataSafe(s: string | null | undefined): Date | null {
  if (!s) return null;
  try {
    const d = s.length === 10 ? parseISO(s) : new Date(s);
    return isNaN(d.getTime()) ? null : d;
  } catch {
    return null;
  }
}

export function calcularCurvaResultado(args: {
  nfs: NfInput[];
  bms: BmsInput[];
  fin: FinInput[];
  hoje: Date;
}): PontoCurva[] {
  const { nfs, bms, fin, hoje } = args;
  const hojeMes = mesKey(hoje);

  const fatReal = new Map<string, number>();
  const fatPrev = new Map<string, number>();
  const despReal = new Map<string, number>();
  const despAVencer = new Map<string, number>();

  // Faturamento real
  for (const n of nfs) {
    if (n.status === "cancelada") continue;
    const d = parseDataSafe(n.data_emissao);
    if (!d) continue;
    const k = mesKey(d);
    fatReal.set(k, (fatReal.get(k) ?? 0) + Number(n.valor ?? 0));
  }

  // Faturamento previsto (BMS abertas). Atrasadas → mês corrente.
  for (const b of bms) {
    if (BMS_FECHADA.has(String(b.status))) continue;
    const d = parseDataSafe(b.data_emissao_nfs_prevista);
    if (!d) continue;
    const k0 = mesKey(d);
    const k = k0 < hojeMes ? hojeMes : k0;
    fatPrev.set(k, (fatPrev.get(k) ?? 0) + Number(b.valor_previsto_dinamico ?? 0));
  }

  // Despesas (TOTVS)
  for (const f of fin) {
    if (f.natureza_tipo !== 2) continue;
    if (String(f.grupo) === "3") continue;
    if (f.status_cod === 18) continue;
    const baixado = f.status_cod === 3 || f.status_cod === 15;
    const dataStr = baixado ? (f.data_pagamento ?? f.data_vencimento) : f.data_vencimento;
    const d = parseDataSafe(dataStr);
    if (!d) continue;
    const k = mesKey(d);
    const v = Number(f.valor_rateio ?? 0);
    if (k <= hojeMes) {
      despReal.set(k, (despReal.get(k) ?? 0) + v);
    } else {
      despAVencer.set(k, (despAVencer.get(k) ?? 0) + v);
    }
  }

  // Eixo temporal
  const todasChaves = new Set<string>([
    ...fatReal.keys(),
    ...fatPrev.keys(),
    ...despReal.keys(),
    ...despAVencer.keys(),
  ]);
  if (todasChaves.size === 0) return [];

  const chavesOrdenadas = [...todasChaves].sort();
  const primeiro = chavesOrdenadas[0];
  const ultimo = chavesOrdenadas[chavesOrdenadas.length - 1];

  // Garantir que "hoje" esteja na série (ancoragem)
  const inicio = primeiro < hojeMes ? primeiro : hojeMes;
  const fim = ultimo > hojeMes ? ultimo : hojeMes;

  const [iy, im] = inicio.split("-").map(Number);
  const [fy, fm] = fim.split("-").map(Number);
  let cursor = startOfMonth(new Date(iy, im - 1, 1));
  const limite = startOfMonth(new Date(fy, fm - 1, 1));

  const pontos: PontoCurva[] = [];
  let accReal = 0;
  let accProj = 0;
  let ancorou = false;

  while (cursor.getTime() <= limite.getTime()) {
    const k = mesKey(cursor);
    const fr = fatReal.get(k) ?? 0;
    const fp = fatPrev.get(k) ?? 0;
    const dr = despReal.get(k) ?? 0;
    const dv = despAVencer.get(k) ?? 0;

    let resultadoReal: number | null = null;
    let resultadoProjetado: number | null = null;

    if (k <= hojeMes) {
      accReal += fr - dr;
      resultadoReal = accReal;
    }
    if (k === hojeMes) {
      // Ancoragem: projeção parte do real no mês corrente
      accProj = accReal;
      resultadoProjetado = accProj;
      ancorou = true;
    } else if (k > hojeMes) {
      if (!ancorou) {
        accProj = accReal;
        ancorou = true;
      }
      accProj += fp - dv;
      resultadoProjetado = accProj;
    }

    pontos.push({
      mes: k,
      fatReal: fr,
      fatPrevisto: fp,
      despReal: dr,
      despAVencer: dv,
      resultadoReal,
      resultadoProjetado,
    });

    cursor = addMonths(cursor, 1);
  }

  return pontos;
}
