import { useCallback, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { romaneiosRepo } from "@/lib/repositories/romaneios";
import { queryKey } from "@/lib/query-keys";
import { usePatrimoniosContext } from "@/contexts/PatrimoniosContext";
import { useVeiculosContext } from "@/contexts/VeiculosContext";
import { logger } from "@/lib/core/logger";
import type { RomaneioDetalhe } from "./useRomaneioDetalhe";
import { romaneiosKeys } from "./useRomaneios";

export interface ConfirmarRomaneioFailure {
  nome: string;
  motivo: string;
}

export interface ConfirmarRomaneioProgress {
  done: number;
  total: number;
}

function partesData(dataProgramada: string | null): { dia: number; mes: number; ano: number } {
  const base = dataProgramada ? new Date(`${dataProgramada}T00:00:00`) : new Date();
  return { dia: base.getDate(), mes: base.getMonth() + 1, ano: base.getFullYear() };
}

/**
 * Orquestra a confirmação de um romaneio em 3 legs sequenciais:
 *   1. Estoque (Postgres, atômica via RPC fn_romaneio_confirmar_estoque) — se
 *      falhar, nada de patrimônio/veículo é tocado.
 *   2. Patrimônios (MySQL legado, item a item via o mesmo `mobilizarPatrimonio`
 *      já usado em QuadroPatrimonios — reusar aqui é obrigatório: ele também
 *      grava obraAtualId/histórico no patrimônio, não só o evento de
 *      mobilização; chamar a rota crua duplicaria/incompleta o caminho de
 *      escrita já estabelecido).
 *   3. Veículo transportador (opcional, mesmo padrão via `mobilizarVeiculo`).
 *
 * LIMITAÇÃO CONHECIDA: `mobilizarPatrimonio`/`mobilizarVeiculo` (definidos em
 * src/contexts/app/useMobilizacoes.ts) capturam erro internamente (toast +
 * rollback do estado otimista local) e não repropagam a falha para quem
 * chamou. Isso significa que hoje não é possível distinguir com certeza uma
 * falha real de mobilização a partir daqui — na prática, toda leg 2/3 que não
 * lançar uma exceção síncrona é tratada como sucesso, e o status
 * "confirmado_parcial" só é alcançado por falhas que escaparem desse
 * catch-all (ex.: erro antes da chamada em si). Fechar essa lacuna exige
 * alterar `useMobilizacoes.ts` para repropagar erro (ou retornar boolean) —
 * fora do escopo desta entrega; documentado aqui para não ser confundido com
 * garantia de atomicidade que não existe.
 */
export function useConfirmarRomaneio() {
  const qc = useQueryClient();
  const { mobilizarPatrimonio } = usePatrimoniosContext();
  const { mobilizarVeiculo } = useVeiculosContext();
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState<ConfirmarRomaneioProgress | null>(null);
  const [failures, setFailures] = useState<ConfirmarRomaneioFailure[]>([]);
  const [error, setError] = useState<string>("");

  const confirmar = useCallback(
    async (romaneioId: string) => {
      setLoading(true);
      setError("");
      setFailures([]);
      setProgress(null);

      try {
        await romaneiosRepo.confirmarEstoque(romaneioId);
      } catch (err) {
        logger.error("Error confirming estoque leg of romaneio:", err);
        setError(err instanceof Error ? err.message : "Falha ao baixar estoque do romaneio");
        setLoading(false);
        qc.invalidateQueries({ queryKey: queryKey("romaneios", "detalhe", romaneioId) });
        qc.invalidateQueries({ queryKey: romaneiosKeys.all });
        return;
      }

      const detalhe = (await romaneiosRepo.getById(romaneioId)) as RomaneioDetalhe;
      const { dia, mes, ano } = partesData(detalhe.romaneio.data_programada);
      const pendentesPatrimonio = detalhe.itensPatrimonio.filter((it) => !it.mobilizado);
      const total = pendentesPatrimonio.length + (detalhe.romaneio.mobilizar_veiculo ? 1 : 0);
      let done = 0;
      const falhasLocais: ConfirmarRomaneioFailure[] = [];
      setProgress({ done, total });

      for (const item of pendentesPatrimonio) {
        try {
          await mobilizarPatrimonio(
            item.patrimonio_id,
            detalhe.romaneio.obra_destino_id,
            dia,
            mes,
            ano,
          );
          await romaneiosRepo.marcarItemPatrimonioMobilizado(item.id, true);
        } catch (err) {
          logger.error("Error mobilizing patrimonio in romaneio:", err);
          const motivo = err instanceof Error ? err.message : "Falha ao mobilizar";
          falhasLocais.push({ nome: item.patrimonio_nome ?? item.patrimonio_id, motivo });
          await romaneiosRepo.marcarItemPatrimonioMobilizado(item.id, false, motivo);
        }
        done += 1;
        setProgress({ done, total });
      }

      if (detalhe.romaneio.mobilizar_veiculo && detalhe.romaneio.veiculo_transportador_id) {
        try {
          await mobilizarVeiculo(
            detalhe.romaneio.veiculo_transportador_id,
            detalhe.romaneio.obra_destino_id,
            dia,
            mes,
            ano,
          );
          await romaneiosRepo.marcarVeiculoMobilizado(romaneioId, true);
        } catch (err) {
          logger.error("Error mobilizing veiculo in romaneio:", err);
          const motivo = err instanceof Error ? err.message : "Falha ao mobilizar veículo";
          falhasLocais.push({ nome: "Veículo transportador", motivo });
          await romaneiosRepo.marcarVeiculoMobilizado(romaneioId, false, motivo);
        }
        done += 1;
        setProgress({ done, total });
      }

      setFailures(falhasLocais);
      await romaneiosRepo.setStatusFinal(
        romaneioId,
        falhasLocais.length === 0 ? "confirmado" : "confirmado_parcial",
      );

      qc.invalidateQueries({ queryKey: queryKey("romaneios", "detalhe", romaneioId) });
      qc.invalidateQueries({ queryKey: romaneiosKeys.all });
      setLoading(false);
    },
    [mobilizarPatrimonio, mobilizarVeiculo, qc],
  );

  return { confirmar, loading, progress, failures, error };
}
