import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { romaneiosRepo } from "@/lib/repositories/romaneios";
import { queryKey } from "@/lib/query-keys";
import { logger } from "@/lib/core/logger";

export interface RomaneioResumo {
  id: string;
  numero: string;
  status: string;
  obra_origem_id: string | null;
  obra_destino_id: string;
  veiculo_transportador_id: string | null;
  mobilizar_veiculo: boolean;
  veiculo_mobilizado_em: string | null;
  veiculo_mobilizacao_erro: string | null;
  data_programada: string | null;
  observacao: string | null;
  criado_por_nome: string | null;
  confirmado_em: string | null;
  created_at: string;
  updated_at: string;
}

export const romaneiosKeys = {
  all: queryKey("romaneios"),
  filtro: (filtro?: { status?: string; obraId?: string }) => queryKey("romaneios", filtro ?? {}),
};

export function useRomaneios(filtro?: { status?: string; obraId?: string }) {
  return useQuery({
    queryKey: romaneiosKeys.filtro(filtro),
    queryFn: () => romaneiosRepo.listResumo(filtro) as Promise<RomaneioResumo[]>,
    staleTime: 15_000,
  });
}

function gerarNumero(): string {
  const agora = new Date();
  const ano = agora.getFullYear();
  const stamp = agora.getTime().toString().slice(-6);
  return `RM-${ano}-${stamp}`;
}

export function useCreateRomaneio() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: {
      obraOrigemId: string | null;
      obraDestinoId: string;
      veiculoTransportadorId?: string | null;
      mobilizarVeiculo?: boolean;
      dataProgramada?: string | null;
      observacao?: string | null;
      criadoPorNome?: string | null;
    }) => romaneiosRepo.create({ ...payload, numero: gerarNumero() }),
    onError: (err) => {
      logger.error("Error creating romaneio:", err);
      toast.error("Erro ao criar romaneio");
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: romaneiosKeys.all });
    },
  });
}

export function useAddItemEstoque() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      romaneioId,
      item,
    }: {
      romaneioId: string;
      item: {
        insumoId: string;
        quantidade: number;
        localOrigem: string;
        localDestino: string;
        observacao?: string;
      };
    }) => romaneiosRepo.addItemEstoque(romaneioId, item),
    onError: (err) => {
      logger.error("Error adding item estoque to romaneio:", err);
      toast.error("Erro ao adicionar item de estoque");
    },
    onSettled: (_data, _err, vars) => {
      qc.invalidateQueries({ queryKey: queryKey("romaneios", "detalhe", vars.romaneioId) });
    },
  });
}

export function useRemoveItemEstoque() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ itemId }: { itemId: string; romaneioId: string }) =>
      romaneiosRepo.removeItemEstoque(itemId),
    onError: (err) => {
      logger.error("Error removing item estoque from romaneio:", err);
      toast.error("Erro ao remover item de estoque");
    },
    onSettled: (_data, _err, vars) => {
      qc.invalidateQueries({ queryKey: queryKey("romaneios", "detalhe", vars.romaneioId) });
    },
  });
}

export function useAddItemPatrimonio() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      romaneioId,
      item,
    }: {
      romaneioId: string;
      item: { patrimonioId: string; patrimonioCodigo?: string; patrimonioNome?: string };
    }) => romaneiosRepo.addItemPatrimonio(romaneioId, item),
    onError: (err) => {
      logger.error("Error adding item patrimonio to romaneio:", err);
      toast.error("Erro ao adicionar patrimônio");
    },
    onSettled: (_data, _err, vars) => {
      qc.invalidateQueries({ queryKey: queryKey("romaneios", "detalhe", vars.romaneioId) });
    },
  });
}

export function useRemoveItemPatrimonio() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ itemId }: { itemId: string; romaneioId: string }) =>
      romaneiosRepo.removeItemPatrimonio(itemId),
    onError: (err) => {
      logger.error("Error removing item patrimonio from romaneio:", err);
      toast.error("Erro ao remover patrimônio");
    },
    onSettled: (_data, _err, vars) => {
      qc.invalidateQueries({ queryKey: queryKey("romaneios", "detalhe", vars.romaneioId) });
    },
  });
}

export function useSetVeiculoTransportador() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      romaneioId,
      veiculoId,
      mobilizar,
    }: {
      romaneioId: string;
      veiculoId: string | null;
      mobilizar: boolean;
    }) => romaneiosRepo.setVeiculoTransportador(romaneioId, veiculoId, mobilizar),
    onError: (err) => {
      logger.error("Error setting veiculo transportador:", err);
      toast.error("Erro ao definir veículo transportador");
    },
    onSettled: (_data, _err, vars) => {
      qc.invalidateQueries({ queryKey: queryKey("romaneios", "detalhe", vars.romaneioId) });
    },
  });
}

export function useCancelarRomaneio() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (romaneioId: string) => romaneiosRepo.cancelar(romaneioId),
    onError: (err) => {
      logger.error("Error cancelling romaneio:", err);
      toast.error("Erro ao cancelar romaneio");
    },
    onSettled: (_data, _err, romaneioId) => {
      qc.invalidateQueries({ queryKey: romaneiosKeys.all });
      qc.invalidateQueries({ queryKey: queryKey("romaneios", "detalhe", romaneioId) });
    },
  });
}
