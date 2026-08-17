/** @module-kind pure */
/**
 * Medições de contrato de fornecimento (lógica pura).
 *
 * Regra: medições aprovadas/faturadas acumulam até o valor do contrato + aditivos.
 * Medições em rascunho ou canceladas não contam.
 */

export interface MedicaoContrato {
  id?: string;
  contrato_id: string;
  data_corte: string; // ISO
  percentual: number; // 0..100
  valor: number;
  status: "rascunho" | "aprovada" | "faturada" | "cancelada";
}

export interface AditivoContrato {
  contrato_id?: string | null;
  valor: number;
  status?: string | null;
}

export interface ContratoBase {
  id: string;
  valor: number;
}

export class MedicaoError extends Error {
  constructor(
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

function isContabil(m: MedicaoContrato): boolean {
  return m.status === "aprovada" || m.status === "faturada";
}

function aditivosContabeis(aditivos: ReadonlyArray<AditivoContrato>): number {
  return aditivos
    .filter((a) => !a.status || a.status === "aprovado" || a.status === "ativo")
    .reduce((s, a) => s + (Number(a.valor) || 0), 0);
}

export function acumuladoMedido(medicoes: ReadonlyArray<MedicaoContrato>): number {
  return medicoes.filter(isContabil).reduce((s, m) => s + (Number(m.valor) || 0), 0);
}

export function valorTotalContrato(
  contrato: ContratoBase,
  aditivos: ReadonlyArray<AditivoContrato>,
): number {
  return Number(contrato.valor || 0) + aditivosContabeis(aditivos);
}

export function saldoContrato(
  contrato: ContratoBase,
  medicoes: ReadonlyArray<MedicaoContrato>,
  aditivos: ReadonlyArray<AditivoContrato>,
): number {
  return valorTotalContrato(contrato, aditivos) - acumuladoMedido(medicoes);
}

/**
 * Valida uma nova medição: verifica que o acumulado + nova ≤ valor total.
 * Lança MedicaoError se ultrapassar.
 */
export function validarNovaMedicao(
  contrato: ContratoBase,
  medicoesExistentes: ReadonlyArray<MedicaoContrato>,
  aditivos: ReadonlyArray<AditivoContrato>,
  nova: Pick<MedicaoContrato, "valor" | "status">,
): void {
  const novaValor = Number(nova.valor) || 0;
  if (novaValor < 0) throw new MedicaoError("valor_negativo", "Valor não pode ser negativo");
  const contabilizaNova = nova.status === "aprovada" || nova.status === "faturada";
  if (!contabilizaNova) return;
  const total = valorTotalContrato(contrato, aditivos);
  const acumulado = acumuladoMedido(medicoesExistentes);
  const novoAcumulado = acumulado + novaValor;
  if (novoAcumulado > total + 0.005) {
    throw new MedicaoError(
      "excede_saldo",
      `Medição excede saldo do contrato (acumulado ${novoAcumulado.toFixed(2)} > total ${total.toFixed(2)})`,
    );
  }
}

/**
 * Converte percentual em valor (com base no valor total).
 */
export function percentualParaValor(
  contrato: ContratoBase,
  aditivos: ReadonlyArray<AditivoContrato>,
  percentual: number,
): number {
  const total = valorTotalContrato(contrato, aditivos);
  return Math.round(((total * percentual) / 100) * 100) / 100;
}
