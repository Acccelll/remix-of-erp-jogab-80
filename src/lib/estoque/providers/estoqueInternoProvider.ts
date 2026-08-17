import { suprimentosRepo } from "@/lib/repositories/suprimentos";
import type {
  EstoqueProvider,
  RegistrarSaidaInput,
  SaldoEstoque,
  TransferirEstoqueInput,
} from "../EstoqueProvider";

/**
 * Implementação default: delega para o estoque interno de Suprimentos
 * (estoque_saldos/estoque_movimentacoes via suprimentosRepo). É o que roda
 * em produção nesta entrega — a troca por TOTVS RM (providers/totvsRmProvider.ts)
 * acontece por trás desta mesma interface, sem tocar a UI de Romaneio.
 */
export const estoqueInternoProvider: EstoqueProvider = {
  async listarSaldos(filtro) {
    const rows = await suprimentosRepo.listEstoqueSaldos();
    const saldos: SaldoEstoque[] = rows.map((r: any) => ({
      local: r.local,
      insumoId: r.insumo_id,
      saldo: Number(r.saldo ?? 0),
      minimo: r.minimo === null || r.minimo === undefined ? null : Number(r.minimo),
    }));
    return saldos.filter(
      (s) =>
        (!filtro?.local || s.local === filtro.local) &&
        (!filtro?.insumoId || s.insumoId === filtro.insumoId),
    );
  },

  async consultarSaldo(insumoId, local) {
    const saldos = await estoqueInternoProvider.listarSaldos({ local, insumoId });
    return saldos[0]?.saldo ?? 0;
  },

  async transferir(input: TransferirEstoqueInput) {
    await suprimentosRepo.transferirEstoque({
      insumo: input.insumoId,
      origem: input.origem,
      destino: input.destino,
      quantidade: input.quantidade,
      observacao: input.observacao,
    });
  },

  async registrarSaida(input: RegistrarSaidaInput) {
    // O schema atual de estoque (estoque_saldos/estoque_movimentacoes) só modela
    // transferências entre dois `local`s — não existe "consumo externo" sem
    // destino. Modelamos saída como transferência para o local sentinela
    // "consumido", preservando o histórico simétrico entrada/saída do RPC.
    await suprimentosRepo.transferirEstoque({
      insumo: input.insumoId,
      origem: input.local,
      destino: "consumido",
      quantidade: input.quantidade,
      observacao: input.observacao ?? input.origem,
    });
  },
};
