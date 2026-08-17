// ARC-002/ARC-004 · Onda 6 — Contratos sob leitura + mutações TanStack Query.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { contratoFromApi } from "@/contexts/app/mappers";
import { api, apiFetch } from "@/lib/api";
import { queryKey } from "@/lib/query-keys";
import type { Contrato } from "@/types";
import { logger } from "@/lib/core/logger";

export const contratosKeys = {
  all: queryKey("contratos"),
};

async function fetchContratos(): Promise<Contrato[]> {
  const data = await apiFetch<any[]>("contratos");
  return Array.isArray(data) ? data.map(contratoFromApi) : [];
}

export function useContratos(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: contratosKeys.all,
    queryFn: fetchContratos,
    enabled: options?.enabled ?? true,
    staleTime: 30_000,
  });
}

/**
 * ARC-004.slice-06 · Mutations otimistas para `contratos` — padrão canônico
 * (`onMutate` snapshot → `onError` restore → `onSettled` invalidate).
 */
export function useAddContrato() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (novo: Omit<Contrato, "id">): Promise<Contrato> => {
      const result = await api.create("contratos", novo);
      return { ...novo, id: String(result.id) } as Contrato;
    },
    onSuccess: (novo) => {
      qc.setQueryData<Contrato[]>(contratosKeys.all, (prev) =>
        prev ? [...prev, novo] : [novo],
      );
    },
    onError: (err) => {
      logger.error("Error adding contrato:", err);
      toast.error("Erro ao salvar contrato");
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: contratosKeys.all });
    },
  });
}

export function useUpdateContrato() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Contrato> }) => {
      await api.update("contratos", id, data);
      return { id, data };
    },
    onMutate: async ({ id, data }) => {
      await qc.cancelQueries({ queryKey: contratosKeys.all });
      const prev = qc.getQueryData<Contrato[]>(contratosKeys.all);
      qc.setQueryData<Contrato[]>(contratosKeys.all, (curr) =>
        (curr ?? []).map((c) => (c.id === id ? { ...c, ...data } : c)),
      );
      return { prev };
    },
    onError: (err, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(contratosKeys.all, ctx.prev);
      logger.error("Error updating contrato:", err);
      toast.error("Erro ao atualizar contrato. Alteração revertida.");
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: contratosKeys.all });
    },
  });
}

export function useDeleteContrato() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.remove("contratos", id);
      return id;
    },
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: contratosKeys.all });
      const prev = qc.getQueryData<Contrato[]>(contratosKeys.all);
      qc.setQueryData<Contrato[]>(contratosKeys.all, (curr) =>
        (curr ?? []).filter((c) => c.id !== id),
      );
      return { prev };
    },
    onError: (err, _id, ctx) => {
      if (ctx?.prev) qc.setQueryData(contratosKeys.all, ctx.prev);
      logger.error("Error deleting contrato:", err);
      toast.error("Erro ao remover contrato. Exclusão revertida.");
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: contratosKeys.all });
    },
  });
}
