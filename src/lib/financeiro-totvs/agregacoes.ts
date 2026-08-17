/** @module-kind pure */
// Agregações puras sobre linhas da view `vw_financeiro_obra`.
//
// IMPORTANTE — Dupla contagem:
//   A view repete o título (lancamento_id) por natureza de rateio. Portanto:
//   - KPIs por título (receita/despesa, baixado, a receber/pagar, vencido) devem
//     ser somados a partir de linhas DEDUPLICADAS por `lancamento_id`, usando
//     `valor_liquido` / `valor_baixado` do próprio título.
//   - Análises por natureza usam `valor_rateio` diretamente (já é a parcela
//     correta do título naquela conta), sem deduplicar.
//
// Convenções:
//   - natureza_tipo: 1 = receita, 2 = despesa
//   - status_cod TOTVS: 3=Baixado, 15=Baixado-Parcial, 18=Cancelado,
//     29=Vence Hoje, 40=Vencido, 56=A Vencer
//   - Movimentações financeiras (grupo "3") são SEPARADAS dos KPIs da obra.

import { round2 } from "@/lib/core/money";

export interface FinLinha {
  lancamento_id: string | null;
  obra_id: string | null;
  obra_nome: string | null;
  obra_codigo: string | null;
  natureza_tipo: number | null;
  status_cod: number | null;
  status_label: string | null;
  grupo: string | null;
  subgrupo: string | null;
  cod_natureza: string | null;
  desc_natureza: string | null;
  valor_liquido: number | null;
  valor_baixado: number | null;
  valor_rateio: number | null;
  mes_competencia: string | null;
  data_vencimento: string | null;
  data_pagamento: string | null;
  data_emissao: string | null;
  contraparte: string | null;
  cnpj_cpf: string | null;
  historico: string | null;
  ref_lancamento: number | null;
  centro_custo: string | null;
  desc_centro_custo: string | null;
  centro_custo_tipo: string | null; // 'obra' | 'indireto' | 'nao_classificado'
  categoria_indireta: string | null;
  origem: string | null; // 'totvs' | 'sistema' | 'manual'
}

export interface KpisObra {
  receitaBaixada: number;
  receitaAReceber: number;
  despesaPaga: number;
  despesaAPagar: number;
  despesaVencida: number;
  saldoRealizado: number;
  movimentacoesFinanceiras: {
    receita: number;
    despesa: number;
    saldo: number;
  };
}

import {
  STATUS_BAIXADO,
  STATUS_BAIXADO_PARCIAL,
  STATUS_CANCELADO,
  STATUS_VENCE_HOJE,
  STATUS_VENCIDO,
  STATUS_A_VENCER,
} from "./status-bucket";

// Status vem do módulo central `./status-bucket`. Não redeclarar constantes aqui.

const n = (v: number | null | undefined) => Number(v ?? 0) || 0;

/** Deduplica linhas por lancamento_id (1 linha por título). */
function porTitulo(linhas: FinLinha[]): FinLinha[] {
  const seen = new Map<string, FinLinha>();
  for (const l of linhas) {
    if (!l.lancamento_id) continue;
    if (!seen.has(l.lancamento_id)) seen.set(l.lancamento_id, l);
  }
  return Array.from(seen.values());
}

export function kpisObra(linhas: FinLinha[]): KpisObra {
  // Movimentações financeiras (grupo "3") são separadas — usar linhas únicas por título também.
  const movRaw = linhas.filter((l) => l.grupo === "3");
  const obraRaw = linhas.filter((l) => l.grupo !== "3");
  const obraTitulos = porTitulo(obraRaw);
  const movTitulos = porTitulo(movRaw);

  let receitaBaixada = 0;
  let receitaAReceber = 0;
  let despesaPaga = 0;
  let despesaAPagar = 0;
  let despesaVencida = 0;

  for (const t of obraTitulos) {
    if (t.status_cod === STATUS_CANCELADO) continue;
    const liquido = n(t.valor_liquido);
    const baixado = n(t.valor_baixado);
    const aberto = round2(liquido - baixado);
    const isReceita = t.natureza_tipo === 1;
    const isDespesa = t.natureza_tipo === 2;

    if (t.status_cod === STATUS_BAIXADO) {
      if (isReceita) receitaBaixada += liquido;
      else if (isDespesa) despesaPaga += liquido;
    } else if (t.status_cod === STATUS_BAIXADO_PARCIAL) {
      if (isReceita) {
        receitaBaixada += baixado;
        receitaAReceber += Math.max(0, aberto);
      } else if (isDespesa) {
        despesaPaga += baixado;
        despesaAPagar += Math.max(0, aberto);
      }
    } else if (t.status_cod === STATUS_VENCIDO) {
      if (isReceita) receitaAReceber += Math.max(0, aberto > 0 ? aberto : liquido);
      else if (isDespesa) {
        const v = aberto > 0 ? aberto : liquido;
        despesaAPagar += Math.max(0, v);
        despesaVencida += Math.max(0, v);
      }
    } else if (t.status_cod === STATUS_VENCE_HOJE || t.status_cod === STATUS_A_VENCER) {
      const v = aberto > 0 ? aberto : liquido;
      if (isReceita) receitaAReceber += Math.max(0, v);
      else if (isDespesa) despesaAPagar += Math.max(0, v);
    }
  }

  let movReceita = 0;
  let movDespesa = 0;
  for (const t of movTitulos) {
    if (t.status_cod === STATUS_CANCELADO) continue;
    const v = n(t.valor_liquido);
    if (t.natureza_tipo === 1) movReceita += v;
    else if (t.natureza_tipo === 2) movDespesa += v;
  }

  return {
    receitaBaixada: round2(receitaBaixada),
    receitaAReceber: round2(receitaAReceber),
    despesaPaga: round2(despesaPaga),
    despesaAPagar: round2(despesaAPagar),
    despesaVencida: round2(despesaVencida),
    saldoRealizado: round2(receitaBaixada - despesaPaga),
    movimentacoesFinanceiras: {
      receita: round2(movReceita),
      despesa: round2(movDespesa),
      saldo: round2(movReceita - movDespesa),
    },
  };
}

export interface NaturezaNode {
  cod_natureza: string;
  desc_natureza: string | null;
  valor_pago: number;
  valor_aberto: number;
  valor_total: number;
}
export interface SubgrupoNode {
  subgrupo: string;
  valor_pago: number;
  valor_aberto: number;
  valor_total: number;
  naturezas: NaturezaNode[];
}
export interface GrupoNode {
  grupo: string;
  valor_pago: number;
  valor_aberto: number;
  valor_total: number;
  subgrupos: SubgrupoNode[];
}

/** Agrupa por grupo → subgrupo → cod_natureza usando valor_rateio. */
export function porNatureza(linhas: FinLinha[]): GrupoNode[] {
  type Acc = {
    desc: string | null;
    pago: number;
    aberto: number;
    total: number;
  };
  const grupos = new Map<string, Map<string, Map<string, Acc>>>();
  for (const l of linhas) {
    if (l.status_cod === STATUS_CANCELADO) continue;
    const g = l.grupo ?? "?";
    const s = l.subgrupo ?? "?";
    const c = l.cod_natureza ?? "?";
    const v = n(l.valor_rateio);
    // proporção pago/aberto a partir do título
    const liq = n(l.valor_liquido);
    const bx = n(l.valor_baixado);
    const ratio = liq > 0 ? bx / liq : l.status_cod === STATUS_BAIXADO ? 1 : 0;
    const pagoLinha = round2(v * ratio);
    const abertoLinha = round2(v - pagoLinha);

    if (!grupos.has(g)) grupos.set(g, new Map());
    const sg = grupos.get(g)!;
    if (!sg.has(s)) sg.set(s, new Map());
    const nat = sg.get(s)!;
    if (!nat.has(c)) nat.set(c, { desc: l.desc_natureza, pago: 0, aberto: 0, total: 0 });
    const acc = nat.get(c)!;
    acc.pago += pagoLinha;
    acc.aberto += abertoLinha;
    acc.total += v;
  }

  const out: GrupoNode[] = [];
  const grupoKeys = Array.from(grupos.keys()).sort();
  for (const g of grupoKeys) {
    const subgrupos: SubgrupoNode[] = [];
    let gp = 0,
      ga = 0,
      gt = 0;
    const sgMap = grupos.get(g)!;
    const sgKeys = Array.from(sgMap.keys()).sort();
    for (const s of sgKeys) {
      const naturezas: NaturezaNode[] = [];
      let sp = 0,
        sa = 0,
        st = 0;
      const natMap = sgMap.get(s)!;
      const natKeys = Array.from(natMap.keys()).sort();
      for (const c of natKeys) {
        const a = natMap.get(c)!;
        const node = {
          cod_natureza: c,
          desc_natureza: a.desc,
          valor_pago: round2(a.pago),
          valor_aberto: round2(a.aberto),
          valor_total: round2(a.total),
        };
        naturezas.push(node);
        sp += node.valor_pago;
        sa += node.valor_aberto;
        st += node.valor_total;
      }
      subgrupos.push({
        subgrupo: s,
        valor_pago: round2(sp),
        valor_aberto: round2(sa),
        valor_total: round2(st),
        naturezas,
      });
      gp += sp;
      ga += sa;
      gt += st;
    }
    out.push({
      grupo: g,
      valor_pago: round2(gp),
      valor_aberto: round2(ga),
      valor_total: round2(gt),
      subgrupos,
    });
  }
  return out;
}

export interface MesSerie {
  mes: string;
  receita: number;
  despesa: number;
  saldo: number;
}

/** Série mensal por mes_competencia (YYYY-MM). Usa títulos únicos (exclui grupo 3). */
export function porMesCompetencia(linhas: FinLinha[]): MesSerie[] {
  const titulos = porTitulo(linhas.filter((l) => l.grupo !== "3"));
  const acc = new Map<string, { receita: number; despesa: number }>();
  for (const t of titulos) {
    if (t.status_cod === STATUS_CANCELADO) continue;
    const mes = (t.mes_competencia ?? t.data_vencimento ?? "").slice(0, 7);
    if (!mes) continue;
    if (!acc.has(mes)) acc.set(mes, { receita: 0, despesa: 0 });
    const a = acc.get(mes)!;
    const v = n(t.valor_liquido);
    if (t.natureza_tipo === 1) a.receita += v;
    else if (t.natureza_tipo === 2) a.despesa += v;
  }
  return Array.from(acc.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([mes, v]) => ({
      mes,
      receita: round2(v.receita),
      despesa: round2(v.despesa),
      saldo: round2(v.receita - v.despesa),
    }));
}
