/** @module-kind pure */
/**
 * Contrato de leitura/escrita de estoque usado pela composição de Romaneios
 * (src/components/logisticaAtivos/). Hoje só existe implementação sobre o
 * estoque interno (Suprimentos/Postgres) — ver providers/estoqueInternoProvider.ts.
 * A baixa transacional de um romaneio confirmado continua via RPC Postgres
 * (fn_romaneio_confirmar_estoque), independente deste contrato; a interface
 * aqui serve à UI de composição (listar/consultar saldo disponível) e a uma
 * futura fonte externa de estoque (ver providers/totvsRmProvider.ts).
 */

export interface SaldoEstoque {
  local: string;
  insumoId: string;
  saldo: number;
  minimo: number | null;
}

export interface RegistrarSaidaInput {
  insumoId: string;
  local: string;
  quantidade: number;
  origem: string;
  observacao?: string;
}

export interface TransferirEstoqueInput {
  insumoId: string;
  origem: string;
  destino: string;
  quantidade: number;
  observacao?: string;
}

/** Contrato que todo provider de estoque (interno ou TOTVS RM) implementa. */
export interface EstoqueProvider {
  listarSaldos(filtro?: { local?: string; insumoId?: string }): Promise<SaldoEstoque[]>;
  consultarSaldo(insumoId: string, local: string): Promise<number>;
  transferir(input: TransferirEstoqueInput): Promise<void>;
  registrarSaida(input: RegistrarSaidaInput): Promise<void>;
}
