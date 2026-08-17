// ARC-002/ARC-004 · Onda 6 — Patrimônios sob leitura + mutações TanStack Query.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { patrimonioFromApi } from "@/contexts/app/mappers";
import { api, apiFetch } from "@/lib/api";
import { queryKey } from "@/lib/query-keys";
import type { Patrimonio } from "@/types";
import { logger } from "@/lib/core/logger";

export const patrimoniosKeys = {
  all: queryKey("patrimonios"),
};

async function fetchPatrimonios(): Promise<Patrimonio[]> {
  const data = await apiFetch<any[]>("patrimonios");
  return Array.isArray(data) ? data.map(patrimonioFromApi) : [];
}

export function usePatrimonios(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: patrimoniosKeys.all,
    queryFn: fetchPatrimonios,
    enabled: options?.enabled ?? true,
    staleTime: 30_000,
  });
}

/**
 * ARC-004.slice-04 · Mutations otimistas para `patrimonios` — padrão canônico
 * (`onMutate` snapshot → `onError` restore → `onSettled` invalidate).
 */
export function useAddPatrimonio() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (novo: Omit<Patrimonio, "id">): Promise<Patrimonio> => {
      const result = await api.create("patrimonios", novo);
      return { ...novo, id: String(result.id) } as Patrimonio;
    },
    onSuccess: (novo) => {
      qc.setQueryData<Patrimonio[]>(patrimoniosKeys.all, (prev) =>
        prev ? [...prev, novo] : [novo],
      );
    },
    onError: (err) => {
      logger.error("Error adding patrimonio:", err);
      toast.error("Erro ao salvar patrimônio");
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: patrimoniosKeys.all });
    },
  });
}

export function useUpdatePatrimonio() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Patrimonio> }) => {
      await api.update("patrimonios", id, data);
      return { id, data };
    },
    onMutate: async ({ id, data }) => {
      await qc.cancelQueries({ queryKey: patrimoniosKeys.all });
      const prev = qc.getQueryData<Patrimonio[]>(patrimoniosKeys.all);
      qc.setQueryData<Patrimonio[]>(patrimoniosKeys.all, (curr) =>
        (curr ?? []).map((p) => (p.id === id ? { ...p, ...data } : p)),
      );
      return { prev };
    },
    onError: (err, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(patrimoniosKeys.all, ctx.prev);
      logger.error("Error updating patrimonio:", err);
      toast.error("Erro ao atualizar patrimônio. Alteração revertida.");
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: patrimoniosKeys.all });
    },
  });
}

export function useDeletePatrimonio() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.remove("patrimonios", id);
      return id;
    },
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: patrimoniosKeys.all });
      const prev = qc.getQueryData<Patrimonio[]>(patrimoniosKeys.all);
      qc.setQueryData<Patrimonio[]>(patrimoniosKeys.all, (curr) =>
        (curr ?? []).filter((p) => p.id !== id),
      );
      return { prev };
    },
    onError: (err, _id, ctx) => {
      if (ctx?.prev) qc.setQueryData(patrimoniosKeys.all, ctx.prev);
      logger.error("Error deleting patrimonio:", err);
      toast.error("Erro ao remover patrimônio. Exclusão revertida.");
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: patrimoniosKeys.all });
    },
  });
}
