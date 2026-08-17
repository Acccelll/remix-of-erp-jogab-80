/** @module-kind pure */
/**
 * Motor de cálculo puro do módulo de Antecipação de Recebíveis.
 *
 * Regra fundamental: a base de dias de TODA taxa é a EXPOSIÇÃO DO FUNDO —
 * da data da operação até o vencimento do título. Nunca a partir da emissão.
 *
 * Dinheiro é manipulado internamente em centavos (inteiros) para evitar
 * acúmulo de erro de ponto flutuante em rateios.
 */

// ─────────────── helpers de centavos ───────────────
const toCents = (v: number): number => Math.round((Number.isFinite(v) ? v : 0) * 100);
const fromCents = (c: number): number => Math.round(c) / 100;

// ─────────────── datas ───────────────
export function diasExposicao(dataOperacao: string, dataVencimento: string): number {
  const a = new Date(`${dataOperacao}T00:00:00Z`).getTime();
  const b = new Date(`${dataVencimento}T00:00:00Z`).getTime();
  if (!Number.isFinite(a) || !Number.isFinite(b)) return 0;
  return Math.round((b - a) / 86_400_000);
}

// ─────────────── deságio e taxas ───────────────
export function desagio(valorFace: number, valorLiquido: number): number {
  return fromCents(toCents(valorFace) - toCents(valorLiquido));
}

/** Taxa efetiva no período de exposição, como fração (0.0129 = 1,29%). */
export function taxaPeriodo(desagioValor: number, valorFace: number): number | null {
  if (toCents(valorFace) <= 0) return 0;
  const t = desagioValor / valorFace;
  return Number.isFinite(t) ? t : null;
}

export function taxaMensalEquivalente(taxaPer: number, dias: number): number | null {
  if (!Number.isFinite(taxaPer) || dias <= 0) return null;
  return Math.pow(1 + taxaPer, 30 / dias) - 1;
}

export function taxaAnualEquivalente(taxaPer: number, dias: number): number | null {
  if (!Number.isFinite(taxaPer) || dias <= 0) return null;
  return Math.pow(1 + taxaPer, 365 / dias) - 1;
}

// ─────────────── CET ───────────────
export function custoEfetivoTotal(args: {
  valorFace: number;
  desagio: number;
  iof: number;
  tarifas: number;
}): { valorLiquidoEfetivo: number; cetPeriodo: number | null } {
  const face = toCents(args.valorFace);
  const custo = toCents(args.desagio) + toCents(args.iof) + toCents(args.tarifas);
  const liquido = face - custo;
  const cet = face > 0 ? custo / face : 0;
  return {
    valorLiquidoEfetivo: fromCents(liquido),
    cetPeriodo: Number.isFinite(cet) ? cet : null,
  };
}

// ─────────────── prazo médio ponderado ───────────────
export function prazoMedioPonderado(
  titulos: { valorFace: number; dias: number }[],
): number {
  const somaFace = titulos.reduce((acc, t) => acc + toCents(t.valorFace), 0);
  if (somaFace <= 0) return 0;
  const somaPond = titulos.reduce(
    (acc, t) => acc + toCents(t.valorFace) * (Number.isFinite(t.dias) ? t.dias : 0),
    0,
  );
  return somaPond / somaFace;
}

// ─────────────── rateio proporcional (fecha em centavos) ───────────────
export function ratearPorTitulo(
  total: number,
  titulos: { id: string; valorFace: number }[],
): { id: string; valor: number }[] {
  if (titulos.length === 0) return [];
  const totalC = toCents(total);
  const somaFaceC = titulos.reduce((acc, t) => acc + toCents(t.valorFace), 0);
  if (somaFaceC <= 0) {
    // distribui igualmente em centavos
    const base = Math.floor(totalC / titulos.length);
    const resto = totalC - base * titulos.length;
    return titulos.map((t, i) => ({
      id: t.id,
      valor: fromCents(base + (i === titulos.length - 1 ? resto : 0)),
    }));
  }
  let acumC = 0;
  const out = titulos.map((t, i) => {
    const isLast = i === titulos.length - 1;
    const faceC = toCents(t.valorFace);
    const parcelaC = isLast
      ? totalC - acumC
      : Math.round((faceC * totalC) / somaFaceC);
    acumC += parcelaC;
    return { id: t.id, valor: fromCents(parcelaC) };
  });
  return out;
}

// ─────────────── métricas de carteira ───────────────
export interface OperacaoResumo {
  operadorId?: string;
  valorFaceTotal: number;
  desagioTotal: number;
  iof: number;
  tarifas: number;
  diasExposicaoPonderado: number;
}

export function custoCarteira(operacoes: OperacaoResumo[]): {
  desagioTotal: number;
  iofTotal: number;
  tarifasTotal: number;
  cetMedioPonderado: number | null;
} {
  const desagioTotalC = operacoes.reduce((a, o) => a + toCents(o.desagioTotal), 0);
  const iofTotalC = operacoes.reduce((a, o) => a + toCents(o.iof), 0);
  const tarifasTotalC = operacoes.reduce((a, o) => a + toCents(o.tarifas), 0);
  const faceTotalC = operacoes.reduce((a, o) => a + toCents(o.valorFaceTotal), 0);
  const cet = faceTotalC > 0 ? (desagioTotalC + iofTotalC + tarifasTotalC) / faceTotalC : null;
  return {
    desagioTotal: fromCents(desagioTotalC),
    iofTotal: fromCents(iofTotalC),
    tarifasTotal: fromCents(tarifasTotalC),
    cetMedioPonderado: cet,
  };
}

export function comparativoOperadores(
  operacoes: OperacaoResumo[],
): { operadorId: string; volume: number; taxaMediaAm: number | null; operacoes: number }[] {
  const grupos = new Map<string, { volumeC: number; taxaPondSum: number; qtd: number }>();
  for (const op of operacoes) {
    const id = op.operadorId ?? "—";
    const faceC = toCents(op.valorFaceTotal);
    const taxaPer = taxaPeriodo(op.desagioTotal, op.valorFaceTotal) ?? 0;
    const taxaAm = taxaMensalEquivalente(taxaPer, op.diasExposicaoPonderado);
    const g = grupos.get(id) ?? { volumeC: 0, taxaPondSum: 0, qtd: 0 };
    g.volumeC += faceC;
    if (taxaAm !== null) g.taxaPondSum += taxaAm * faceC;
    g.qtd += 1;
    grupos.set(id, g);
  }
  return Array.from(grupos.entries()).map(([operadorId, g]) => ({
    operadorId,
    volume: fromCents(g.volumeC),
    taxaMediaAm: g.volumeC > 0 ? g.taxaPondSum / g.volumeC : null,
    operacoes: g.qtd,
  }));
}
