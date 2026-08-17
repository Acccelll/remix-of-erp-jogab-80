/** @module-kind pure */
// Fonte única para o cálculo do "valor total de venda" de um item do cronograma.
// Usado tanto pela geração de BMS previstas (`bms-previstas.ts`) quanto pelo
// fechamento (`bms-fechamento.ts`) para garantir que as duas funções concordem
// sobre quanto cada item vale no contrato — evitando drift cumulativo entre o
// previsto dinâmico das BMS e a soma item-a-item no fechamento.

export type ValorTotalItemOpts = {
  /** Custo do item (R$). Se baseline existir, prefira-o. */
  custo: number;
  /** Percentual previsto do item no contrato (0-100). Usado se `custo` <= 0. */
  percentualPrevisto?: number;
  /** Valor total do contrato (R$). */
  valorContrato: number;
  /** Valor de antecipação/mobilização separado do contrato (R$). */
  valorAntecipacao: number;
};

function n(v: unknown): number {
  return Number(v ?? 0);
}

/**
 * Converte o custo (base orçamentária) para o valor de venda proporcional
 * dentro do que sobra a distribuir após a antecipação.
 *
 *   fatorVenda = (valorContrato - valorAntecipacao) / valorContrato
 *   valorVenda = custo * fatorVenda    (quando custo > 0)
 *   valorVenda = (percentual/100) * (valorContrato - valorAntecipacao)  (fallback)
 */
export function valorTotalItem(opts: ValorTotalItemOpts): number {
  const valorContrato = n(opts.valorContrato);
  const valorAntecipacao = n(opts.valorAntecipacao);
  const custo = n(opts.custo);
  const percentual = n(opts.percentualPrevisto);
  const baseContrato = Math.max(0, valorContrato - valorAntecipacao);
  const fatorVenda = valorContrato > 0 ? baseContrato / valorContrato : 1;
  if (custo > 0) return custo * fatorVenda;
  return (percentual / 100) * baseContrato;
}
