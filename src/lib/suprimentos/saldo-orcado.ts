/** @module-kind pure */
/**
 * Fase 5A — Saldo orçado vs. requisitado.
 *
 * Diferencial SIECON: a requisição nasce do item de orçamento e avisa
 * quando a soma de quantidades requisitadas excede o orçado.
 *
 * Lógica pura — sem dependência de Supabase. Testada via vitest.
 */

export interface OrcamentoItemMin {
  /** quantidade orçada do item (unidade do insumo). */
  quantidade: number;
}

export interface RequisicaoMin {
  /** quantidade pedida na requisição. */
  quantidade: number;
  /** requisições canceladas não contam contra o saldo. */
  status?: string | null;
}

export interface SaldoOrcadoResult {
  orcado: number;
  requisitado: number;
  saldo: number;
  excedido: boolean;
  /** quanto passou do orçado (0 se não excedeu). */
  excesso: number;
}

const STATUS_VIVOS = new Set(["aberta", "cotando", "atendida"]);

export function saldoOrcado(
  item: OrcamentoItemMin | null | undefined,
  requisicoes: ReadonlyArray<RequisicaoMin>,
): SaldoOrcadoResult {
  const orcado = Number(item?.quantidade ?? 0) || 0;
  const requisitado = requisicoes.reduce((acc, r) => {
    const s = (r.status ?? "aberta").toLowerCase();
    if (!STATUS_VIVOS.has(s)) return acc;
    const q = Number(r.quantidade ?? 0) || 0;
    return acc + q;
  }, 0);
  const saldo = orcado - requisitado;
  const excedido = saldo < 0;
  return {
    orcado,
    requisitado,
    saldo,
    excedido,
    excesso: excedido ? -saldo : 0,
  };
}
