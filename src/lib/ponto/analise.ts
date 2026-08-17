/** @module-kind pure */
// Agregações da Análise de Ponto — KPIs, séries dos gráficos e listas de exceção.
//
// Antes viviam em `useMemo` dentro de `PontoAnalise.tsx`, onde a única forma de conferir
// uma regra era olhar a tela. Extraídas, viram teste: é aqui que ficam as definições de
// absenteísmo, falha de marcação e falta crítica, usadas também pelo Espelho de Ponto.

import { HE60_RISCO_ALTO_MIN, LIMITE_HE_FOLHA_PCT } from "@/lib/dp/codigos";

/**
 * Registro diário de ponto, na forma mínima que as agregações precisam.
 * Estrutural de propósito: `PontoRegistroRow` (repository) satisfaz sem acoplar
 * este módulo à camada de dados.
 */
export interface RegistroPonto {
  colaborador_id: string | null;
  nome_csv: string;
  departamento_csv: string | null;
  obra_id: string | null;
  data: string;
  horas_previstas_min: number;
  horas_trabalhadas_min: number;
  horas_falta_min: number;
  horas_extra_50_min: number;
  horas_extra_60_min: number;
  horas_extra_100_min: number;
  interjornada_min: number;
  banco_saldo_min: number;
  marcacao_invalida: boolean;
  falta: boolean;
  atestado: boolean;
}

/** Nome do colaborador por id do cadastro. */
export type NomePorId = ReadonlyMap<string, string>;

/**
 * Chave de agrupamento por pessoa. Registro sem vínculo (`colaborador_id = null`,
 * quando o CPF não casou com o cadastro) cai no nome lido da origem — some do
 * relatório se agrupado por id nulo.
 */
export function chaveColaborador(r: RegistroPonto): string {
  return r.colaborador_id ?? r.nome_csv;
}

/**
 * Nome de exibição: sempre o do cadastro quando há vínculo.
 * A origem (RHiD/CSV) grafa a mesma pessoa de formas diferentes ao longo do tempo;
 * usar `nome_csv` direto fazia a mesma pessoa aparecer duas vezes na mesma tela.
 */
export function nomeExibicao(r: RegistroPonto, nomePorId: NomePorId): string {
  if (r.colaborador_id) return nomePorId.get(r.colaborador_id) ?? r.nome_csv;
  return r.nome_csv;
}

/** HE do dia somando as três faixas (50%, 60% e 100%). */
export function heTotalMin(r: RegistroPonto): number {
  return r.horas_extra_50_min + r.horas_extra_60_min + r.horas_extra_100_min;
}

/**
 * Falta que exige tratativa: dia sinalizado como falta, ou jornada prevista sem
 * nenhuma hora trabalhada. Atestado fica de fora — é falta justificada, e contá-la
 * aqui contradizia o KPI de absenteísmo, que sempre a excluiu.
 */
export function ehFaltaCritica(r: RegistroPonto): boolean {
  if (r.atestado) return false;
  return r.falta || (r.horas_previstas_min > 0 && r.horas_trabalhadas_min === 0);
}

export interface KpisPonto {
  /** % das horas previstas perdidas em falta/atraso não justificados. */
  absenteismoPct: number;
  /** Soma das três faixas de HE, em minutos. */
  heTotalMin: number;
  /** % dos dias com marcação ímpar/inconsistente. */
  marcacaoInvalidaPct: number;
  /** % dos dias com descanso interjornada violado. */
  interjornadaPct: number;
  /** Quem mais acumulou HE (todas as faixas) no período. */
  topHe: { chave: string; nome: string; min: number } | null;
  diasApurados: number;
}

export function calcularKpis(registros: readonly RegistroPonto[], nomePorId: NomePorId): KpisPonto {
  let previstas = 0;
  let faltaNaoJustificada = 0;
  let he = 0;
  let marcacaoInvalida = 0;
  let interjornada = 0;
  const hePorColaborador = new Map<string, { nome: string; min: number }>();

  for (const r of registros) {
    previstas += r.horas_previstas_min;
    if (!r.atestado) faltaNaoJustificada += r.horas_falta_min;
    he += heTotalMin(r);
    if (r.marcacao_invalida) marcacaoInvalida += 1;
    if (r.interjornada_min > 0) interjornada += 1;

    const chave = chaveColaborador(r);
    const atual = hePorColaborador.get(chave) ?? { nome: nomeExibicao(r, nomePorId), min: 0 };
    atual.min += heTotalMin(r);
    hePorColaborador.set(chave, atual);
  }

  let topHe: KpisPonto["topHe"] = null;
  for (const [chave, { nome, min }] of hePorColaborador) {
    if (min > 0 && (!topHe || min > topHe.min)) topHe = { chave, nome, min };
  }

  const total = registros.length;
  return {
    absenteismoPct: previstas > 0 ? (faltaNaoJustificada / previstas) * 100 : 0,
    heTotalMin: he,
    marcacaoInvalidaPct: total > 0 ? (marcacaoInvalida / total) * 100 : 0,
    interjornadaPct: total > 0 ? (interjornada / total) * 100 : 0,
    topHe,
    diasApurados: total,
  };
}

/**
 * Variação relativa entre dois valores, em %. `null` quando não há base de comparação
 * (período anterior zerado) — a tela mostra "—" em vez de um "+100%" sem sentido.
 */
export function variacaoPct(atual: number, anterior: number): number | null {
  if (anterior === 0) return null;
  return ((atual - anterior) / Math.abs(anterior)) * 100;
}

export interface TendenciasPonto {
  /** Diferença em pontos percentuais (a métrica já é um %). */
  absenteismoPp: number | null;
  /** Variação relativa do volume de HE, em %. */
  heTotalPct: number | null;
  marcacaoInvalidaPp: number | null;
  interjornadaPp: number | null;
}

/** Compara os KPIs do período com os do período anterior de igual duração. */
export function compararPeriodos(atual: KpisPonto, anterior: KpisPonto | null): TendenciasPonto {
  if (!anterior || anterior.diasApurados === 0) {
    return {
      absenteismoPp: null,
      heTotalPct: null,
      marcacaoInvalidaPp: null,
      interjornadaPp: null,
    };
  }
  return {
    absenteismoPp: atual.absenteismoPct - anterior.absenteismoPct,
    heTotalPct: variacaoPct(atual.heTotalMin, anterior.heTotalMin),
    marcacaoInvalidaPp: atual.marcacaoInvalidaPct - anterior.marcacaoInvalidaPct,
    interjornadaPp: atual.interjornadaPct - anterior.interjornadaPct,
  };
}

export interface OcorrenciaObra {
  obraId: string | null;
  obra: string;
  ocorrencias: number;
}

/** Ocorrências (falta crítica ou marcação inválida) por obra, da maior para a menor. */
export function ocorrenciasPorObra(
  registros: readonly RegistroPonto[],
  nomeObra: (obraId: string) => string,
  limite = 10,
): OcorrenciaObra[] {
  const m = new Map<string | null, number>();
  for (const r of registros) {
    if (!ehFaltaCritica(r) && !r.marcacao_invalida) continue;
    m.set(r.obra_id, (m.get(r.obra_id) ?? 0) + 1);
  }
  return Array.from(m.entries())
    .map(([obraId, ocorrencias]) => ({
      obraId,
      obra: obraId ? nomeObra(obraId) : "Sem obra",
      ocorrencias,
    }))
    .sort((a, b) => b.ocorrencias - a.ocorrencias)
    .slice(0, limite);
}

export interface PontoDiario {
  data: string;
  horas: number;
}

/** Série diária de HE, em horas decimais (o gráfico não lê minutos). */
export function heDiario(registros: readonly RegistroPonto[]): PontoDiario[] {
  const m = new Map<string, number>();
  for (const r of registros) m.set(r.data, (m.get(r.data) ?? 0) + heTotalMin(r));
  return Array.from(m.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([data, min]) => ({ data, horas: +(min / 60).toFixed(2) }));
}

export interface FatiaAbsenteismo {
  name: string;
  value: number;
}

/**
 * Distribuição das horas não trabalhadas. Um dia entra em uma fatia só, na ordem
 * atestado → falta → atraso, para o total bater com as horas de falta do período.
 */
export function distribuicaoAbsenteismo(registros: readonly RegistroPonto[]): FatiaAbsenteismo[] {
  let falta = 0;
  let atestado = 0;
  let atraso = 0;
  for (const r of registros) {
    if (r.atestado) atestado += r.horas_falta_min;
    else if (r.falta) falta += r.horas_falta_min;
    else if (r.horas_falta_min > 0) atraso += r.horas_falta_min;
  }
  return [
    { name: "Faltas", value: falta },
    { name: "Atrasos", value: atraso },
    { name: "Atestados", value: atestado },
  ].filter((x) => x.value > 0);
}

export interface LinhaFaltaCritica {
  chave: string;
  colaboradorId: string | null;
  nome: string;
  departamento: string;
  dias: number;
  minutos: number;
}

/** Faltas e dias sem registro por colaborador, do maior volume para o menor. */
export function faltasCriticas(
  registros: readonly RegistroPonto[],
  nomePorId: NomePorId,
): LinhaFaltaCritica[] {
  const m = new Map<string, LinhaFaltaCritica>();
  for (const r of registros) {
    if (!ehFaltaCritica(r)) continue;
    const chave = chaveColaborador(r);
    const linha = m.get(chave) ?? {
      chave,
      colaboradorId: r.colaborador_id,
      nome: nomeExibicao(r, nomePorId),
      departamento: r.departamento_csv ?? "",
      dias: 0,
      minutos: 0,
    };
    linha.dias += 1;
    // Dia sem marcação nenhuma não traz horas de falta: a jornada prevista é a perda.
    linha.minutos += r.horas_falta_min || r.horas_previstas_min;
    m.set(chave, linha);
  }
  return Array.from(m.values()).sort((a, b) => b.minutos - a.minutos);
}

export interface LinhaHeEstourada {
  chave: string;
  colaboradorId: string | null;
  nome: string;
  previstasMin: number;
  he60Min: number;
  /** HE 60% como % das horas previstas — o critério do alerta. */
  pct: number;
  risco: "alto" | "medio";
}

/**
 * Colaboradores cuja HE 60% acumulada passou de `LIMITE_HE_FOLHA_PCT`% das horas
 * previstas no período.
 */
export function heEstouradas(
  registros: readonly RegistroPonto[],
  nomePorId: NomePorId,
): LinhaHeEstourada[] {
  const m = new Map<
    string,
    { colaboradorId: string | null; nome: string; prev: number; he60: number }
  >();
  for (const r of registros) {
    const chave = chaveColaborador(r);
    const atual = m.get(chave) ?? {
      colaboradorId: r.colaborador_id,
      nome: nomeExibicao(r, nomePorId),
      prev: 0,
      he60: 0,
    };
    atual.prev += r.horas_previstas_min;
    atual.he60 += r.horas_extra_60_min;
    m.set(chave, atual);
  }

  const linhas: LinhaHeEstourada[] = [];
  for (const [chave, v] of m) {
    if (v.prev <= 0) continue;
    const pct = (v.he60 / v.prev) * 100;
    if (pct < LIMITE_HE_FOLHA_PCT) continue;
    linhas.push({
      chave,
      colaboradorId: v.colaboradorId,
      nome: v.nome,
      previstasMin: v.prev,
      he60Min: v.he60,
      pct,
      risco: v.he60 > HE60_RISCO_ALTO_MIN ? "alto" : "medio",
    });
  }
  return linhas.sort((a, b) => b.he60Min - a.he60Min);
}

export interface LinhaAtraso {
  chave: string;
  colaboradorId: string | null;
  nome: string;
  previstasMin: number;
  faltaMin: number;
}

/** Jornadas incompletas: houve trabalho no dia, mas abaixo do previsto. */
export function atrasos(registros: readonly RegistroPonto[], nomePorId: NomePorId): LinhaAtraso[] {
  const m = new Map<string, LinhaAtraso>();
  for (const r of registros) {
    if (r.falta || r.atestado || r.horas_falta_min <= 0) continue;
    const chave = chaveColaborador(r);
    const linha = m.get(chave) ?? {
      chave,
      colaboradorId: r.colaborador_id,
      nome: nomeExibicao(r, nomePorId),
      previstasMin: 0,
      faltaMin: 0,
    };
    linha.previstasMin += r.horas_previstas_min;
    linha.faltaMin += r.horas_falta_min;
    m.set(chave, linha);
  }
  return Array.from(m.values()).sort((a, b) => b.faltaMin - a.faltaMin);
}

/**
 * Período imediatamente anterior, de mesma duração — base da comparação de tendência.
 * Datas em YYYY-MM-DD; o cálculo é em UTC para não depender do fuso do navegador.
 */
export function periodoAnterior(
  inicio: string,
  fim: string,
): { inicio: string; fim: string } | null {
  const ini = Date.parse(`${inicio}T00:00:00Z`);
  const f = Date.parse(`${fim}T00:00:00Z`);
  if (Number.isNaN(ini) || Number.isNaN(f) || f < ini) return null;
  const DIA = 86_400_000;
  const duracao = f - ini + DIA;
  return {
    inicio: new Date(ini - duracao).toISOString().slice(0, 10),
    fim: new Date(ini - DIA).toISOString().slice(0, 10),
  };
}
