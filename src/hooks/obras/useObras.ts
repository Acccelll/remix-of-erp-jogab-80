// ARC-002/ARC-004 · Onda 6 — Obras sob leitura + mutações TanStack Query (paradigma único).
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { obraFromApi } from "@/contexts/app/mappers";
import { api, apiFetch } from "@/lib/api";
import { queryKey } from "@/lib/query-keys";
import type { Obra } from "@/types";
import { logger } from "@/lib/core/logger";

export const obrasKeys = {
  all: queryKey("obras"),
};

async function fetchObras(): Promise<Obra[]> {
  const data = await apiFetch<any[]>("obras");
  return Array.isArray(data) ? data.map(obraFromApi) : [];
}

export function useObras(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: obrasKeys.all,
    queryFn: fetchObras,
    enabled: options?.enabled ?? true,
    staleTime: 30_000,
  });
}

/**
 * ARC-004.slice-01 · Mutations otimistas para `obras` com rollback padronizado
 * (`onMutate` snapshot → `onError` restore → `onSettled` invalidate).
 * Substitui o CRUD imperativo de `useObrasState`.
 */
export function useAddObra() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (o: Omit<Obra, "id">): Promise<Obra> => {
      const result = await api.create("obras", o);
      return { ...o, id: String(result.id) } as Obra;
    },
    onSuccess: (novo) => {
      qc.setQueryData<Obra[]>(obrasKeys.all, (prev) =>
        prev ? [...prev, novo] : [novo],
      );
    },
    onError: (err) => {
      logger.error("Error adding obra:", err);
      toast.error("Erro ao salvar obra");
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: obrasKeys.all });
    },
  });
}

export function useUpdateObra() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Obra> }) => {
      await api.update("obras", id, data);
      return { id, data };
    },
    onMutate: async ({ id, data }) => {
      await qc.cancelQueries({ queryKey: obrasKeys.all });
      const prev = qc.getQueryData<Obra[]>(obrasKeys.all);
      qc.setQueryData<Obra[]>(obrasKeys.all, (curr) =>
        (curr ?? []).map((o) => (o.id === id ? { ...o, ...data } : o)),
      );
      return { prev };
    },
    onError: (err, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(obrasKeys.all, ctx.prev);
      logger.error("Error updating obra:", err);
      toast.error("Erro ao atualizar obra");
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: obrasKeys.all });
    },
  });
}

export function useDeleteObra() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.remove("obras", id);
      return id;
    },
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: obrasKeys.all });
      const prev = qc.getQueryData<Obra[]>(obrasKeys.all);
      qc.setQueryData<Obra[]>(obrasKeys.all, (curr) =>
        (curr ?? []).filter((o) => o.id !== id),
      );
      return { prev };
    },
    onError: (err, _id, ctx) => {
      if (ctx?.prev) qc.setQueryData(obrasKeys.all, ctx.prev);
      logger.error("Error deleting obra:", err);
      toast.error("Erro ao excluir obra");
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: obrasKeys.all });
    },
  });
}
