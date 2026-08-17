/** @module-kind pure */
/**
 * Alçadas de aprovação (lógica pura).
 *
 * Dada uma lista de faixas (valor_min..valor_max) e um valor de OC,
 * devolve a sequência de aprovadores exigidos. Sem teto ⇒ valor_max=null.
 *
 * Multi-nível: a lista pode conter várias faixas que cobrem o mesmo valor;
 * todas viram requisitos (ex.: valor alto exige Gerência + Diretoria).
 */

export interface Alcada {
  valor_min: number;
  valor_max: number | null;
  papel_aprovador: string;
  ordem: number;
}

export class AlcadaError extends Error {
  constructor(
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

function cobre(a: Alcada, valor: number): boolean {
  if (valor < Number(a.valor_min)) return false;
  if (a.valor_max != null && valor > Number(a.valor_max)) return false;
  return true;
}

/**
 * Retorna os papéis exigidos para aprovar `valor`, ordenados por `ordem`.
 * Lança se nenhuma faixa cobrir o valor.
 */
export function aprovadoresPara(valor: number, alcadas: ReadonlyArray<Alcada>): Alcada[] {
  if (!(valor >= 0)) {
    throw new AlcadaError("valor_invalido", "Valor inválido");
  }
  const aplicaveis = alcadas
    .filter((a) => cobre(a, valor))
    .slice()
    .sort((a, b) => a.ordem - b.ordem);
  if (aplicaveis.length === 0) {
    throw new AlcadaError(
      "sem_alcada",
      `Nenhuma alçada configurada cobre o valor ${valor.toFixed(2)}`,
    );
  }
  return aplicaveis;
}

/**
 * Papel único exigido — primeira alçada na ordem.
 */
export function aprovadorPara(valor: number, alcadas: ReadonlyArray<Alcada>): Alcada {
  return aprovadoresPara(valor, alcadas)[0];
}
