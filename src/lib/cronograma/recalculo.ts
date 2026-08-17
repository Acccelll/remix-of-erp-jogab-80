/** @module-kind io */
import { financeiroRepo } from "@/lib/repositories/financeiro";

/**
 * Redistribui o saldo (contrato − faturado) entre os recebimentos futuros
 * proporcionalmente ao valor_previsto atual de cada um. Quando todos estão
 * zerados, divide igualmente. Executado atomicamente no Postgres.
 */
export async function recalcularPrevisaoNF(obraId: string, valorContrato: number) {
  await financeiroRepo.rpcRecalcularPrevisaoNf(obraId, valorContrato);
}

export type RecalcAposFaturamentoResultado = {
  delta: number;
  futurasAtualizadas: number;
  valorFaturado: number;
};

/**
 * Após salvar/editar uma NF, redistribui o delta (BMS prevista − líquido faturado)
 * proporcionalmente entre as BMS futuras (status='prevista', numero > BMS atual),
 * usando o snapshot pré-faturamento para evitar acumular erros em edições sucessivas.
 *
 * Tudo executa numa única transação no Postgres via RPC.
 */
export async function recalcularAposFaturamento(
  obraId: string,
  nfId: string,
  valorContrato: number,
): Promise<RecalcAposFaturamentoResultado> {
  const data = await financeiroRepo.rpcRecalcularAposFaturamento(obraId, nfId, valorContrato);
  const payload = (data ?? {}) as {
    delta?: number;
    futuras_atualizadas?: number;
    valor_faturado?: number;
  };
  return {
    delta: Number(payload.delta ?? 0),
    futurasAtualizadas: Number(payload.futuras_atualizadas ?? 0),
    valorFaturado: Number(payload.valor_faturado ?? 0),
  };
}

/**
 * Quando uma NF é excluída, devolve o valor previsto da BMS ao snapshot
 * pré-faturamento e redistribui o delta inverso entre as futuras.
 */
export async function reverterFaturamentoBms(obraId: string, bmsId: string, valorContrato: number) {
  await financeiroRepo.rpcReverterFaturamentoBms(obraId, bmsId, valorContrato);
}
