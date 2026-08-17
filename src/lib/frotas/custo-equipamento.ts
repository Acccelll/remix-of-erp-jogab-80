/** @module-kind pure */
/**
 * Custo de frota por obra (lógica pura).
 *
 * Combina abastecimentos + manutenções (eventos pontuais) com apropriações
 * (janelas de alocação com custo de período rateado por dias).
 *
 * Premissa: AC do EVM continua vindo do TOTVS — esta visão é paralela,
 * usada só no card "Custo de Frota por Obra".
 */

export interface AbastecimentoCusto {
  veiculo_id?: string | null;
  patrimonio_id?: string | null;
  obra_id?: string | null;
  data: string; // ISO YYYY-MM-DD
  valor: number;
  horimetro?: number | null;
}

export interface ManutencaoCusto {
  veiculo_id?: string | null;
  patrimonio_id?: string | null;
  obra_id?: string | null;
  data: string;
  valor: number;
  tipo: "preventiva" | "corretiva";
  proxima_preventiva_horimetro?: number | null;
}

export interface ApropriacaoCusto {
  veiculo_id?: string | null;
  patrimonio_id?: string | null;
  obra_id: string;
  data_inicio: string; // ISO
  data_fim?: string | null; // ISO, null = aberta
  custo_periodo: number; // custo TOTAL da janela
}

export interface PeriodoFiltro {
  inicio: string; // ISO
  fim: string; // ISO
}

export interface CustoFrotaResult {
  combustivel: number;
  manutencao: number;
  periodo: number;
  total: number;
  porAtivo: Record<
    string,
    { combustivel: number; manutencao: number; periodo: number; total: number }
  >;
}

function ativoKey(r: { veiculo_id?: string | null; patrimonio_id?: string | null }): string {
  if (r.veiculo_id) return `v:${r.veiculo_id}`;
  if (r.patrimonio_id) return `p:${r.patrimonio_id}`;
  return "desconhecido";
}

function inRange(dateISO: string, periodo: PeriodoFiltro): boolean {
  return dateISO >= periodo.inicio && dateISO <= periodo.fim;
}

function diasEntre(aISO: string, bISO: string): number {
  const a = new Date(aISO + "T00:00:00Z").getTime();
  const b = new Date(bISO + "T00:00:00Z").getTime();
  return Math.max(0, Math.round((b - a) / 86400000) + 1);
}

function bump(
  acc: CustoFrotaResult,
  key: string,
  campo: "combustivel" | "manutencao" | "periodo",
  valor: number,
) {
  if (!acc.porAtivo[key])
    acc.porAtivo[key] = { combustivel: 0, manutencao: 0, periodo: 0, total: 0 };
  acc.porAtivo[key][campo] += valor;
  acc.porAtivo[key].total += valor;
  acc[campo] += valor;
  acc.total += valor;
}

export function custoEquipamentoObra(
  abastecimentos: ReadonlyArray<AbastecimentoCusto>,
  manutencoes: ReadonlyArray<ManutencaoCusto>,
  apropriacoes: ReadonlyArray<ApropriacaoCusto>,
  filtro: { obra_id: string; periodo: PeriodoFiltro },
): CustoFrotaResult {
  const acc: CustoFrotaResult = {
    combustivel: 0,
    manutencao: 0,
    periodo: 0,
    total: 0,
    porAtivo: {},
  };
  const { obra_id, periodo } = filtro;

  for (const a of abastecimentos) {
    if (a.obra_id !== obra_id) continue;
    if (!inRange(a.data, periodo)) continue;
    bump(acc, ativoKey(a), "combustivel", Number(a.valor) || 0);
  }

  for (const m of manutencoes) {
    if (m.obra_id !== obra_id) continue;
    if (!inRange(m.data, periodo)) continue;
    bump(acc, ativoKey(m), "manutencao", Number(m.valor) || 0);
  }

  for (const ap of apropriacoes) {
    if (ap.obra_id !== obra_id) continue;
    const fim = ap.data_fim ?? periodo.fim;
    // Interseção da janela [data_inicio, fim] com [periodo.inicio, periodo.fim]
    const iniOverlap = ap.data_inicio > periodo.inicio ? ap.data_inicio : periodo.inicio;
    const fimOverlap = fim < periodo.fim ? fim : periodo.fim;
    if (iniOverlap > fimOverlap) continue;
    const diasJanela = diasEntre(ap.data_inicio, fim);
    const diasOverlap = diasEntre(iniOverlap, fimOverlap);
    const fator = diasJanela > 0 ? diasOverlap / diasJanela : 0;
    const valor = (Number(ap.custo_periodo) || 0) * fator;
    if (valor > 0) bump(acc, ativoKey(ap), "periodo", valor);
  }

  return acc;
}

/**
 * Alerta de preventiva próxima: retorna ativos cujo horímetro atual está
 * dentro de `margem` horas da próxima preventiva planejada.
 */
export function alertasPreventiva(
  ultimasManutencoes: ReadonlyArray<ManutencaoCusto>,
  horimetroAtualPorAtivo: Record<string, number>,
  margem = 50,
): Array<{ ativo: string; horimetroAtual: number; proxima: number; faltam: number }> {
  const out: Array<{ ativo: string; horimetroAtual: number; proxima: number; faltam: number }> = [];
  for (const m of ultimasManutencoes) {
    if (m.proxima_preventiva_horimetro == null) continue;
    const key = ativoKey(m);
    const atual = horimetroAtualPorAtivo[key];
    if (atual == null) continue;
    const faltam = m.proxima_preventiva_horimetro - atual;
    if (faltam <= margem) {
      out.push({
        ativo: key,
        horimetroAtual: atual,
        proxima: m.proxima_preventiva_horimetro,
        faltam,
      });
    }
  }
  return out;
}
