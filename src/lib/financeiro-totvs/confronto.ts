/** @module-kind pure */
// Confronto Previsto × Realizado — agregações puras.
// IMPORTANTE: este módulo NÃO importa de bms-previstas.ts/billing.ts/recalculo.ts.
// Reescreve os cálculos mínimos necessários a partir das tabelas lidas em queries.ts.

import { round2 } from "@/lib/core/money";
import type { FinLinha } from "./agregacoes";

const STATUS_CANCELADO = 18;
const n = (v: number | null | undefined) => Number(v ?? 0) || 0;

export interface ConfrontoMes {
  mes: string; // YYYY-MM
  despesaPrevistaBms: number;
  despesaRealizadaTotvs: number;
  receitaTotvs: number;
  receitaRecebimentos: number;
  receitaNfsEmitidas: number;
  desvioDespesa: number; // previsto - realizado
  desvioReceita: number; // nfs emitidas - receita totvs (informativo)
}

export interface BmsPrevistaLite {
  data_corte: string;
  valor_previsto_dinamico: number;
}
export interface RecebimentoLite {
  data_prevista: string;
  data_recebimento: string | null;
  valor_previsto: number;
  valor_recebido: number | null;
}
export interface NotaFiscalLite {
  competencia: string | null;
  data_emissao: string | null;
  valor: number;
  status: string;
}

function mesDe(s: string | null | undefined): string | null {
  if (!s) return null;
  return s.slice(0, 7);
}

function dedupTitulos(linhas: FinLinha[]): FinLinha[] {
  const m = new Map<string, FinLinha>();
  for (const l of linhas) {
    if (!l.lancamento_id) continue;
    if (!m.has(l.lancamento_id)) m.set(l.lancamento_id, l);
  }
  return Array.from(m.values());
}

export function montarConfronto(args: {
  linhas: FinLinha[];
  bms: BmsPrevistaLite[];
  receb: RecebimentoLite[];
  nfs: NotaFiscalLite[];
}): ConfrontoMes[] {
  const acc = new Map<string, ConfrontoMes>();
  const get = (mes: string) => {
    if (!acc.has(mes)) {
      acc.set(mes, {
        mes,
        despesaPrevistaBms: 0,
        despesaRealizadaTotvs: 0,
        receitaTotvs: 0,
        receitaRecebimentos: 0,
        receitaNfsEmitidas: 0,
        desvioDespesa: 0,
        desvioReceita: 0,
      });
    }
    return acc.get(mes)!;
  };

  // BMS previstas → previsão de despesa por mes do data_corte
  for (const b of args.bms) {
    const mes = mesDe(b.data_corte);
    if (!mes) continue;
    get(mes).despesaPrevistaBms += n(b.valor_previsto_dinamico);
  }

  // TOTVS — títulos únicos, grupo ≠ 3
  const titulos = dedupTitulos(args.linhas.filter((l) => l.grupo !== "3"));
  for (const t of titulos) {
    if (t.status_cod === STATUS_CANCELADO) continue;
    const mes = mesDe(t.mes_competencia ?? t.data_vencimento);
    if (!mes) continue;
    const v = n(t.valor_liquido);
    if (t.natureza_tipo === 2) get(mes).despesaRealizadaTotvs += v;
    else if (t.natureza_tipo === 1) get(mes).receitaTotvs += v;
  }

  // Recebimentos — usa valor_recebido se houver; senão valor_previsto.
  for (const r of args.receb) {
    const mes = mesDe(r.data_recebimento ?? r.data_prevista);
    if (!mes) continue;
    get(mes).receitaRecebimentos += n(r.valor_recebido ?? r.valor_previsto);
  }

  // NFs emitidas (qualquer status != cancelada)
  for (const f of args.nfs) {
    if (f.status === "cancelada") continue;
    const mes = mesDe(f.competencia ?? f.data_emissao);
    if (!mes) continue;
    get(mes).receitaNfsEmitidas += n(f.valor);
  }

  const out = Array.from(acc.values()).sort((a, b) => a.mes.localeCompare(b.mes));
  for (const r of out) {
    r.despesaPrevistaBms = round2(r.despesaPrevistaBms);
    r.despesaRealizadaTotvs = round2(r.despesaRealizadaTotvs);
    r.receitaTotvs = round2(r.receitaTotvs);
    r.receitaRecebimentos = round2(r.receitaRecebimentos);
    r.receitaNfsEmitidas = round2(r.receitaNfsEmitidas);
    r.desvioDespesa = round2(r.despesaPrevistaBms - r.despesaRealizadaTotvs);
    r.desvioReceita = round2(r.receitaNfsEmitidas - r.receitaTotvs);
  }
  return out;
}

export interface AgregadoPorObra {
  obra_id: string | null;
  obra_codigo: string | null;
  obra_nome: string | null;
  receita: number;
  despesa: number;
  saldo: number;
}

export interface AgregarPorObraOptions {
  /**
   * Rateia centros indiretos/administrativos proporcionalmente à despesa direta
   * de cada obra. Mantém `false` por padrão para preservar a visão operacional.
   */
  ratearAdministrativo?: boolean;
}

/** Agregado por obra a partir das linhas da view (snapshot ativo). */
export function agregarPorObra(
  linhas: FinLinha[],
  options: AgregarPorObraOptions = {},
): AgregadoPorObra[] {
  const titulos = dedupTitulos(
    linhas.filter((l) => l.grupo !== "3" && l.centro_custo_tipo !== "indireto"),
  );
  const m = new Map<string, AgregadoPorObra>();
  for (const t of titulos) {
    if (t.status_cod === STATUS_CANCELADO) continue;
    const key = t.obra_id ?? "__sem_obra__";
    if (!m.has(key)) {
      m.set(key, {
        obra_id: t.obra_id,
        obra_codigo: t.obra_codigo ?? null,
        obra_nome: t.obra_nome ?? null,
        receita: 0,
        despesa: 0,
        saldo: 0,
      });
    }
    const a = m.get(key)!;
    const v = n(t.valor_liquido);
    if (t.natureza_tipo === 1) a.receita += v;
    else if (t.natureza_tipo === 2) a.despesa += v;
  }
  if (options.ratearAdministrativo) {
    const indiretos = dedupTitulos(
      linhas.filter((l) => l.grupo === "3" || l.centro_custo_tipo === "indireto"),
    );
    const bases = Array.from(m.values()).filter((a) => a.obra_id && a.despesa > 0);
    const baseTotal = bases.reduce((acc, a) => acc + a.despesa, 0);
    const despesaIndireta = indiretos.reduce((acc, t) => {
      if (t.status_cod === STATUS_CANCELADO || t.natureza_tipo !== 2) return acc;
      return acc + n(t.valor_liquido);
    }, 0);
    if (baseTotal > 0 && despesaIndireta > 0) {
      for (const a of bases) {
        a.despesa += (despesaIndireta * a.despesa) / baseTotal;
      }
    }
  }
  const out = Array.from(m.values()).map((a) => ({
    ...a,
    receita: round2(a.receita),
    despesa: round2(a.despesa),
    saldo: round2(a.receita - a.despesa),
  }));
  return out.sort((a, b) => (a.obra_codigo ?? "zzz").localeCompare(b.obra_codigo ?? "zzz"));
}

export interface AgregadoPorCategoria {
  categoria: string;
  titulos: number;
  receita: number;
  despesa: number;
  saldo: number;
}

/** Agregado por categoria indireta (ADM, RH, Frota…). */
export function agregarPorCategoriaIndireta(linhas: FinLinha[]): AgregadoPorCategoria[] {
  const titulos = dedupTitulos(linhas.filter((l) => l.centro_custo_tipo === "indireto"));
  const m = new Map<string, AgregadoPorCategoria>();
  for (const t of titulos) {
    if (t.status_cod === STATUS_CANCELADO) continue;
    const cat = t.categoria_indireta ?? "(sem categoria)";
    if (!m.has(cat)) m.set(cat, { categoria: cat, titulos: 0, receita: 0, despesa: 0, saldo: 0 });
    const a = m.get(cat)!;
    a.titulos += 1;
    const v = n(t.valor_liquido);
    if (t.natureza_tipo === 1) a.receita += v;
    else if (t.natureza_tipo === 2) a.despesa += v;
  }
  return Array.from(m.values())
    .map((a) => ({
      ...a,
      receita: round2(a.receita),
      despesa: round2(a.despesa),
      saldo: round2(a.receita - a.despesa),
    }))
    .sort((a, b) => b.despesa - a.despesa);
}

export interface AgregadoNaoClassificado {
  centro_custo: string;
  desc_centro_custo: string | null;
  titulos: number;
  total: number;
}

/** Centros que apareceram no snapshot mas não estão cadastrados em centros_custo_totvs. */
export function agregarNaoClassificados(linhas: FinLinha[]): AgregadoNaoClassificado[] {
  const titulos = dedupTitulos(
    linhas.filter((l) => l.centro_custo_tipo === "nao_classificado" && !!l.centro_custo),
  );
  const m = new Map<string, AgregadoNaoClassificado>();
  for (const t of titulos) {
    if (t.status_cod === STATUS_CANCELADO) continue;
    const cc = t.centro_custo!;
    if (!m.has(cc))
      m.set(cc, { centro_custo: cc, desc_centro_custo: t.desc_centro_custo, titulos: 0, total: 0 });
    const a = m.get(cc)!;
    a.titulos += 1;
    a.total += n(t.valor_liquido);
  }
  return Array.from(m.values()).sort((a, b) => b.total - a.total);
}

/** CSV simples — strings com vírgula/aspas são encapsuladas. */
export function toCsv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0]);
  const esc = (v: unknown) => {
    const s = v == null ? "" : String(v);
    return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [headers.join(";")];
  for (const r of rows) lines.push(headers.map((h) => esc(r[h])).join(";"));
  return lines.join("\n");
}
