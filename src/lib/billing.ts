/** @module-kind pure */
// Utilidades para o motor de previsão de faturamento.
import { addDays, isAfter } from "date-fns";
import { formatBRL } from "@/lib/core/currency";

export type ParcelaPrevisao = {
  id?: string;
  data_medicao: Date;
  valor_previsto: number;
  valor_realizado?: number | null;
  congelada?: boolean;
};

/**
 * Redistribui o saldo restante (valor_contrato - já realizado/congelado)
 * proporcionalmente entre as parcelas futuras (não congeladas e sem realizado).
 */
export function redistribuirSaldo(
  valorContrato: number,
  parcelas: ParcelaPrevisao[],
): ParcelaPrevisao[] {
  const consumido = parcelas.reduce((acc, p) => {
    if (p.valor_realizado != null) return acc + Number(p.valor_realizado);
    if (p.congelada) return acc + Number(p.valor_previsto);
    return acc;
  }, 0);

  const restantes = parcelas.filter((p) => p.valor_realizado == null && !p.congelada);
  const totalPrevistoRestante = restantes.reduce(
    (acc, p) => acc + Number(p.valor_previsto || 0),
    0,
  );
  const saldo = valorContrato - consumido;

  return parcelas.map((p) => {
    if (p.valor_realizado != null || p.congelada) return p;
    if (totalPrevistoRestante <= 0) return { ...p, valor_previsto: 0 };
    const proporcao = Number(p.valor_previsto || 0) / totalPrevistoRestante;
    return { ...p, valor_previsto: Math.max(0, saldo * proporcao) };
  });
}

export type BmsFuturaInput = {
  id: string;
  numero: number;
  valor_previsto_dinamico: number | string;
  status: string;
};

export type RedistribuicaoResultado = {
  delta: number;
  futuras: { id: string; valor_anterior: number; valor_novo: number }[];
};

/**
 * Redistribui proporcionalmente o delta (BMS prevista − faturado) entre as BMS
 * futuras com status 'prevista' e numero > numeroAtual.
 * - delta > 0 → faturou menos, sobra é somada às futuras
 * - delta < 0 → faturou mais, futuras diminuem
 * Se todas as futuras estão zeradas, divide igualitariamente.
 */
export function redistribuirDeltaBmsFuturas(opts: {
  numeroAtual: number;
  valorPrevistoBmsAtual: number;
  valorFaturado: number;
  todasBms: BmsFuturaInput[];
}): RedistribuicaoResultado {
  const { numeroAtual, valorPrevistoBmsAtual, valorFaturado, todasBms } = opts;
  const delta = Number(valorPrevistoBmsAtual || 0) - Number(valorFaturado || 0);
  const futuras = todasBms
    .filter((b) => b.status === "prevista" && Number(b.numero) > Number(numeroAtual))
    .map((b) => ({
      id: b.id,
      valor_anterior: Number(b.valor_previsto_dinamico || 0),
      valor_novo: Number(b.valor_previsto_dinamico || 0),
    }));
  if (futuras.length === 0 || Math.abs(delta) < 0.005) {
    return { delta, futuras };
  }
  const total = futuras.reduce((a, f) => a + f.valor_anterior, 0);
  if (total <= 0) {
    const parte = delta / futuras.length;
    for (const f of futuras) f.valor_novo = Math.max(0, f.valor_anterior + parte);
  } else {
    for (const f of futuras) {
      const peso = f.valor_anterior / total;
      f.valor_novo = Math.max(0, f.valor_anterior + delta * peso);
    }
  }
  return { delta, futuras };
}

/**
 * Calcula data de vencimento considerando DDL + dia fixo de pagamento do cliente.
 * Ex.: emissão 03/05, 30 DDL, dia fixo 15 → 02/06 → próximo dia 15 = 15/06.
 * Quando o dia fixo não existe no mês (ex.: 31/fev), cai para o último dia do mês.
 */
export function calcularVencimento(
  dataEmissao: Date,
  prazoDDL: number,
  diasFixos?: number | number[] | null,
): Date {
  const base = addDays(dataEmissao, prazoDDL);
  const lista = Array.isArray(diasFixos)
    ? diasFixos.filter((d) => Number.isFinite(d) && d >= 1 && d <= 31)
    : diasFixos != null
      ? [Number(diasFixos)].filter((d) => Number.isFinite(d) && d >= 1 && d <= 31)
      : [];
  if (lista.length === 0) return base;

  // Candidatos: para cada dia fixo, gera a data desse dia no mês corrente da `base`
  // e a no mês seguinte; aplica clamp para o último dia do mês quando necessário.
  const candidatos: Date[] = [];
  for (const offset of [0, 1, 2]) {
    const m = new Date(base.getFullYear(), base.getMonth() + offset, 1);
    const lastDay = new Date(m.getFullYear(), m.getMonth() + 1, 0).getDate();
    for (const dia of lista) {
      const d = new Date(m.getFullYear(), m.getMonth(), Math.min(dia, lastDay));
      candidatos.push(d);
    }
  }
  candidatos.sort((a, b) => a.getTime() - b.getTime());
  const escolhido = candidatos.find((d) => d.getTime() >= base.getTime());
  return escolhido ?? base;
}

export function brl(n: number | string | null | undefined): string {
  return formatBRL(n, { fallback: "R$ 0,00" });
}

export function pct(n: number | string | null | undefined, frac = 2): string {
  return `${Number(n ?? 0).toFixed(frac)}%`;
}

export function statusRecebimento(
  dataPrevista: Date,
  dataRecebimento?: Date | null,
): "pago" | "atrasado" | "a_receber" {
  if (dataRecebimento) return "pago";
  if (isAfter(new Date(), dataPrevista)) return "atrasado";
  return "a_receber";
}
