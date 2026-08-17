/** @module-kind pure */
/**
 * Biblioteca pura de orçamento (sem I/O).
 *
 * - `custoUnitarioComposicao`: Σ (coeficiente × preço do insumo). Usado para
 *   exibir o preço de referência ao vivo em telas de composição e como
 *   "snapshot" gravado em `orcamento_itens.preco_unitario`.
 * - `valorItemOrcamento`: valor de uma linha (quantidade × preço congelado).
 * - `custoAtividade`: rollup de uma atividade.
 * - `curvaABC`: classificação de insumos por valor acumulado (A=80, B=15, C=5).
 *
 * Não importa nada de `bms-*`, `billing.ts`, `recalculo.ts` (arquivos protegidos).
 */
import { round2, round4 } from "@/lib/core/money";

export function custoUnitarioComposicao(
  itens: { coeficiente: number; preco_unitario: number }[],
): number {
  const total = (itens ?? []).reduce(
    (a, i) => a + Number(i.coeficiente ?? 0) * Number(i.preco_unitario ?? 0),
    0,
  );
  return round4(total);
}

export function valorItemOrcamento(quantidade: number, precoUnitario: number): number {
  return round2(Number(quantidade ?? 0) * Number(precoUnitario ?? 0));
}

export function custoAtividade(itens: { valor_total: number }[]): number {
  const total = (itens ?? []).reduce((a, i) => a + Number(i.valor_total ?? 0), 0);
  return round2(total);
}

export interface InsumoAgregado {
  insumo_id: string;
  descricao: string;
  valor: number;
}

export interface InsumoABC extends InsumoAgregado {
  pct: number;
  acumulado: number;
  classe: "A" | "B" | "C";
}

/**
 * Curva ABC por valor acumulado. Ordenação decrescente; A até 80%, B até 95%, C resto.
 * Lista vazia devolve `[]`. Total zero → classifica todos como "A" com pct 0.
 */
export function curvaABC(insumos: InsumoAgregado[]): InsumoABC[] {
  const lista = (insumos ?? []).slice().sort((a, b) => b.valor - a.valor);
  const total = lista.reduce((a, i) => a + Number(i.valor ?? 0), 0);
  if (lista.length === 0) return [];
  if (total <= 0) {
    return lista.map((i) => ({ ...i, pct: 0, acumulado: 0, classe: "A" as const }));
  }
  let acc = 0;
  const EPS = 1e-9;
  return lista.map((i) => {
    const pct = i.valor / total;
    acc += pct;
    const classe: "A" | "B" | "C" = acc <= 0.8 + EPS ? "A" : acc <= 0.95 + EPS ? "B" : "C";
    return { ...i, pct: round4(pct), acumulado: round4(acc), classe };
  });
}
