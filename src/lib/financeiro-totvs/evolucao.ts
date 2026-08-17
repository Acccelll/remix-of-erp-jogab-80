/** @module-kind pure */
// Funções puras sobre linhas do rollup `financeiro_evolucao_rollup`.
// Não tocam no banco — recebem o array já carregado e retornam séries
// prontas para gráficos/tabelas. Mesmo estilo de `agregacoes.ts`.

import { round2 } from "@/lib/core/money";

import {
  STATUS_BAIXADO,
  STATUS_CANCELADO,
  STATUS_VENCE_HOJE,
  STATUS_VENCIDO,
  STATUS_A_VENCER,
} from "./status-bucket";
// Constantes exportadas para compatibilidade com imports existentes.
export { STATUS_BAIXADO, STATUS_CANCELADO, STATUS_VENCE_HOJE, STATUS_VENCIDO, STATUS_A_VENCER };

export interface RollupLinha {
  data_snapshot: string; // YYYY-MM-DD
  obra_id: string | null;
  status_cod: number | null;
  status_label: string | null;
  grupo: string | null;
  cod_natureza: string | null;
  desc_natureza: string | null;
  valor_aberto: number | null;
  valor_pago: number | null;
  qtd_titulos: number | null;
  snapshot_id?: string | null;
}

const n = (v: number | null | undefined): number => Number(v ?? 0) || 0;

function aplicaFiltroObra<T extends { obra_id: string | null }>(
  linhas: T[],
  obraId?: string | null,
): T[] {
  if (!obraId) return linhas;
  return linhas.filter((l) => l.obra_id === obraId);
}

// ============================================================
// 1) Série temporal: vencido × a vencer × pago por data
// ============================================================
export interface PontoSerieTemporal {
  data: string;
  valor_vencido: number;
  valor_a_vencer: number;
  valor_pago: number;
}

export function serieTemporal(
  rollup: RollupLinha[],
  opts: { obraId?: string | null } = {},
): PontoSerieTemporal[] {
  const linhas = aplicaFiltroObra(rollup, opts.obraId);
  const acc = new Map<string, { venc: number; aVenc: number; pago: number }>();
  for (const l of linhas) {
    if (l.status_cod === STATUS_CANCELADO) continue;
    if (!l.data_snapshot) continue;
    const a = acc.get(l.data_snapshot) ?? { venc: 0, aVenc: 0, pago: 0 };
    if (l.status_cod === STATUS_VENCIDO) a.venc += n(l.valor_aberto);
    else if (l.status_cod === STATUS_A_VENCER || l.status_cod === STATUS_VENCE_HOJE)
      a.aVenc += n(l.valor_aberto);
    a.pago += n(l.valor_pago);
    acc.set(l.data_snapshot, a);
  }
  return Array.from(acc.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([data, v]) => ({
      data,
      valor_vencido: round2(v.venc),
      valor_a_vencer: round2(v.aVenc),
      valor_pago: round2(v.pago),
    }));
}

// ============================================================
// 2) Evolução por natureza (grupo / cod_natureza) ao longo do tempo
// ============================================================
export interface PontoNatureza {
  data: string;
  valor_aberto: number;
  valor_pago: number;
}
export interface SerieNatureza {
  grupo: string;
  cod_natureza: string;
  desc_natureza: string | null;
  pontos: PontoNatureza[];
}

export function evolucaoPorNatureza(
  rollup: RollupLinha[],
  opts: { obraId?: string | null } = {},
): SerieNatureza[] {
  const linhas = aplicaFiltroObra(rollup, opts.obraId);
  // chave: grupo|cod_natureza
  const series = new Map<
    string,
    {
      grupo: string;
      cod_natureza: string;
      desc_natureza: string | null;
      pontos: Map<string, { aberto: number; pago: number }>;
    }
  >();
  for (const l of linhas) {
    if (l.status_cod === STATUS_CANCELADO) continue;
    if (!l.data_snapshot) continue;
    const grupo = l.grupo ?? "?";
    const cod = l.cod_natureza ?? "?";
    const key = `${grupo}|${cod}`;
    if (!series.has(key)) {
      series.set(key, {
        grupo,
        cod_natureza: cod,
        desc_natureza: l.desc_natureza ?? null,
        pontos: new Map(),
      });
    }
    const s = series.get(key)!;
    if (s.desc_natureza == null && l.desc_natureza) s.desc_natureza = l.desc_natureza;
    const p = s.pontos.get(l.data_snapshot) ?? { aberto: 0, pago: 0 };
    p.aberto += n(l.valor_aberto);
    p.pago += n(l.valor_pago);
    s.pontos.set(l.data_snapshot, p);
  }
  return Array.from(series.values())
    .map((s) => ({
      grupo: s.grupo,
      cod_natureza: s.cod_natureza,
      desc_natureza: s.desc_natureza,
      pontos: Array.from(s.pontos.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([data, v]) => ({
          data,
          valor_aberto: round2(v.aberto),
          valor_pago: round2(v.pago),
        })),
    }))
    .sort((a, b) =>
      a.grupo === b.grupo
        ? a.cod_natureza.localeCompare(b.cod_natureza)
        : a.grupo.localeCompare(b.grupo),
    );
}

// ============================================================
// 3) Variação entre o último ponto e o anterior
// ============================================================
export interface VariacaoPonto {
  anterior: number;
  atual: number;
  delta: number;
  pct: number | null; // null quando anterior = 0
}
export interface VariacaoNatureza extends VariacaoPonto {
  grupo: string;
  cod_natureza: string;
  desc_natureza: string | null;
}
export interface VariacaoResultado {
  total: VariacaoPonto | null;
  porNatureza: VariacaoNatureza[];
}

function variacaoEntre(anterior: number, atual: number): VariacaoPonto {
  const delta = round2(atual - anterior);
  const pct = anterior === 0 ? null : round2((delta / anterior) * 100);
  return { anterior: round2(anterior), atual: round2(atual), delta, pct };
}

/** Recebe a série temporal e retorna a variação do total (vencido+a_vencer). */
export function variacao(serie: PontoSerieTemporal[]): VariacaoPonto | null {
  if (serie.length < 2) return null;
  const ult = serie[serie.length - 1];
  const ant = serie[serie.length - 2];
  const atual = ult.valor_vencido + ult.valor_a_vencer;
  const anterior = ant.valor_vencido + ant.valor_a_vencer;
  return variacaoEntre(anterior, atual);
}

/** Variação por natureza entre as duas últimas datas. */
export function variacaoPorNatureza(series: SerieNatureza[]): VariacaoNatureza[] {
  const out: VariacaoNatureza[] = [];
  // datas globais ordenadas
  const datas = new Set<string>();
  for (const s of series) for (const p of s.pontos) datas.add(p.data);
  const ordenadas = Array.from(datas).sort();
  if (ordenadas.length < 2) return out;
  const dAtual = ordenadas[ordenadas.length - 1];
  const dAnt = ordenadas[ordenadas.length - 2];
  for (const s of series) {
    const atual = s.pontos.find((p) => p.data === dAtual)?.valor_aberto ?? 0;
    const anterior = s.pontos.find((p) => p.data === dAnt)?.valor_aberto ?? 0;
    if (atual === 0 && anterior === 0) continue;
    out.push({
      grupo: s.grupo,
      cod_natureza: s.cod_natureza,
      desc_natureza: s.desc_natureza,
      ...variacaoEntre(anterior, atual),
    });
  }
  return out.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
}

// ============================================================
// 4) Aging dos vencidos
// ============================================================
export interface AgingLinha {
  status_cod: number | null;
  dias_atraso: number | null;
  /** valor a usar no aging — tipicamente (valor_liquido - valor_baixado) ou valor_liquido. */
  valor: number | null;
  /**
   * Balde já classificado (inclui baixas parciais vencidas). Quando presente,
   * manda sobre `status_cod` — um título com baixa parcial (15) e vencimento
   * passado é vencido, mesmo que o código TOTVS não diga isso.
   */
  bucket?: string | null;
}

// ============================================================
// 5) Aging dos a vencer (inclui status 29 e 56)
// ============================================================
const STATUS_A_VENCER_SET = new Set([STATUS_VENCE_HOJE, STATUS_A_VENCER]);

const FAIXAS_AVENCER: { faixa: string; min: number; max: number | null; ordem: number }[] = [
  { faixa: "Vence hoje", min: 0, max: 0, ordem: 0 },
  { faixa: "1-7", min: 1, max: 7, ordem: 1 },
  { faixa: "8-15", min: 8, max: 15, ordem: 2 },
  { faixa: "16-30", min: 16, max: 30, ordem: 3 },
  { faixa: "31-60", min: 31, max: 60, ordem: 4 },
  { faixa: "61-90", min: 61, max: 90, ordem: 5 },
  { faixa: "90+", min: 91, max: null, ordem: 6 },
];

export const FAIXAS_AVENCER_DEF = FAIXAS_AVENCER;

export interface AgingAVencerLinha {
  status_cod: number | null;
  data_vencimento: string | null;
  valor: number | null;
  /** Balde já classificado; quando presente manda sobre `status_cod`. */
  bucket?: string | null;
}

export function agingAVencer(linhas: AgingAVencerLinha[], hojeIso: string): AgingFaixa[] {
  const acc = new Map<string, { titulos: number; valor: number; ordem: number }>();
  for (const def of FAIXAS_AVENCER) acc.set(def.faixa, { titulos: 0, valor: 0, ordem: def.ordem });
  const hoje = new Date(`${hojeIso}T00:00:00Z`).getTime();
  for (const l of linhas) {
    const futuro = l.bucket
      ? l.bucket === "hoje" || l.bucket === "avencer"
      : !!l.status_cod && STATUS_A_VENCER_SET.has(l.status_cod);
    if (!futuro) continue;

    if (!l.data_vencimento) continue;
    const venc = new Date(`${String(l.data_vencimento).slice(0, 10)}T00:00:00Z`).getTime();
    if (!isFinite(venc)) continue;
    const dias = Math.floor((venc - hoje) / 86400000);
    if (dias < 0) continue;
    const def = FAIXAS_AVENCER.find((f) => dias >= f.min && (f.max == null || dias <= f.max));
    if (!def) continue;
    const a = acc.get(def.faixa)!;
    a.titulos += 1;
    a.valor += n(l.valor);
  }
  return Array.from(acc.entries())
    .map(([faixa, v]) => ({ faixa, ordem: v.ordem, titulos: v.titulos, valor: round2(v.valor) }))
    .sort((a, b) => a.ordem - b.ordem);
}

export interface AgingFaixa {
  faixa: string; // "1-30", "31-60", "61-90", "91-180", "180+"
  ordem: number;
  titulos: number;
  valor: number;
}

const FAIXAS: { faixa: string; min: number; max: number | null; ordem: number }[] = [
  { faixa: "1-30", min: 1, max: 30, ordem: 1 },
  { faixa: "31-60", min: 31, max: 60, ordem: 2 },
  { faixa: "61-90", min: 61, max: 90, ordem: 3 },
  { faixa: "91-180", min: 91, max: 180, ordem: 4 },
  { faixa: "180+", min: 181, max: null, ordem: 5 },
];

export function agingVencidos(linhas: AgingLinha[]): AgingFaixa[] {
  const acc = new Map<string, { titulos: number; valor: number; ordem: number }>();
  for (const def of FAIXAS) acc.set(def.faixa, { titulos: 0, valor: 0, ordem: def.ordem });
  for (const l of linhas) {
    const vencido = l.bucket ? l.bucket === "vencido" : l.status_cod === STATUS_VENCIDO;
    if (!vencido) continue;
    const dias = Number(l.dias_atraso ?? 0);
    if (!Number.isFinite(dias) || dias < 1) continue;

    const def = FAIXAS.find((f) => dias >= f.min && (f.max == null || dias <= f.max));
    if (!def) continue;
    const a = acc.get(def.faixa)!;
    a.titulos += 1;
    a.valor += n(l.valor);
  }
  return Array.from(acc.entries())
    .map(([faixa, v]) => ({ faixa, ordem: v.ordem, titulos: v.titulos, valor: round2(v.valor) }))
    .sort((a, b) => a.ordem - b.ordem);
}
