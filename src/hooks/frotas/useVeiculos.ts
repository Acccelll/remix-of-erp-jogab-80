// ARC-002/ARC-004 · Onda 6 — Veículos sob leitura + mutações TanStack Query.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { veiculoFromApi } from "@/contexts/app/mappers";
import { api, apiFetch } from "@/lib/api";
import { queryKey } from "@/lib/query-keys";
import type { Veiculo } from "@/types";
import { logger } from "@/lib/core/logger";

export const veiculosKeys = {
  all: queryKey("veiculos"),
};

async function fetchVeiculos(): Promise<Veiculo[]> {
  const data = await apiFetch<any[]>("veiculos");
  return Array.isArray(data) ? data.map(veiculoFromApi) : [];
}

export function useVeiculos(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: veiculosKeys.all,
    queryFn: fetchVeiculos,
    enabled: options?.enabled ?? true,
    staleTime: 30_000,
  });
}

/**
 * ARC-004.slice-05 · Mutations otimistas para `veiculos` — padrão canônico
 * (`onMutate` snapshot → `onError` restore → `onSettled` invalidate).
 */
export function useAddVeiculo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (novo: Omit<Veiculo, "id">): Promise<Veiculo> => {
      const result = await api.create("veiculos", novo);
      return { ...novo, id: String(result.id) } as Veiculo;
    },
    onSuccess: (novo) => {
      qc.setQueryData<Veiculo[]>(veiculosKeys.all, (prev) =>
        prev ? [...prev, novo] : [novo],
      );
    },
    onError: (err) => {
      logger.error("Error adding veiculo:", err);
      toast.error("Erro ao salvar veículo");
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: veiculosKeys.all });
    },
  });
}

export function useUpdateVeiculo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      data,
      usuarioId,
    }: {
      id: string;
      data: Partial<Veiculo>;
      usuarioId?: string | null;
    }) => {
      await api.update("veiculos", id, { ...data, usuarioId });
      return { id, data };
    },
    onMutate: async ({ id, data }) => {
      await qc.cancelQueries({ queryKey: veiculosKeys.all });
      const prev = qc.getQueryData<Veiculo[]>(veiculosKeys.all);
      qc.setQueryData<Veiculo[]>(veiculosKeys.all, (curr) =>
        (curr ?? []).map((v) => (v.id === id ? { ...v, ...data } : v)),
      );
      return { prev };
    },
    onError: (err, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(veiculosKeys.all, ctx.prev);
      logger.error("Error updating veiculo:", err);
      toast.error("Erro ao atualizar veículo. Alteração revertida.");
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: veiculosKeys.all });
    },
  });
}

export function useDeleteVeiculo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.remove("veiculos", id);
      return id;
    },
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: veiculosKeys.all });
      const prev = qc.getQueryData<Veiculo[]>(veiculosKeys.all);
      qc.setQueryData<Veiculo[]>(veiculosKeys.all, (curr) =>
        (curr ?? []).filter((v) => v.id !== id),
      );
      return { prev };
    },
    onError: (err, _id, ctx) => {
      if (ctx?.prev) qc.setQueryData(veiculosKeys.all, ctx.prev);
      logger.error("Error deleting veiculo:", err);
      toast.error("Erro ao remover veículo. Exclusão revertida.");
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: veiculosKeys.all });
    },
  });
}
