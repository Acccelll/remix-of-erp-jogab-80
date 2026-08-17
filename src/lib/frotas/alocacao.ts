/** @module-kind pure */
/**
 * Regras de atribuição de veículo a uma coluna/obra do quadro.
 *
 * A fórmula vivia duplicada entre `Board.tsx` (contador da coluna) e
 * `histograma.ts` (preview da semana atual, com o comentário "fórmula do
 * Board"). Domiciliada aqui para que as duas telas não divirjam.
 */
import type { Colaborador, Veiculo } from "@/types";

/** Responsabilidade que habilita o colaborador a ser motorista de um veículo. */
export const RESPONSABILIDADE_MOTORISTA = "quadroVeiculos";

/**
 * Veículo COM motorista continua sendo contado pela coluna do motorista — regra
 * original, preservada. Veículo SEM motorista passa a ser contado pela obra dele
 * próprio: é o que mantém na obra o carro cujo motorista saiu de folga sem levá-lo.
 */
export function veiculoNaColuna(
  v: Pick<Veiculo, "ativo" | "motoristaId" | "obraAtualId">,
  colColabIds: ReadonlySet<string>,
  colId: string,
): boolean {
  if (!v.ativo) return false;
  return v.motoristaId ? colColabIds.has(v.motoristaId) : v.obraAtualId === colId;
}

/** Colaboradores ativos habilitados a assumir um veículo. */
export function motoristasElegiveis<C extends Pick<Colaborador, "ativo" | "responsabilidades">>(
  colaboradores: C[],
): C[] {
  return colaboradores.filter(
    (c) => c.ativo && (c.responsabilidades || []).includes(RESPONSABILIDADE_MOTORISTA),
  );
}
