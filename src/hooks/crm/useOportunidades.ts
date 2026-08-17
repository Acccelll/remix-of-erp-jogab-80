// ARC-002/ARC-004 · Onda 6 — Oportunidades sob leitura + mutações TanStack Query.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { oportunidadeFromApi } from "@/contexts/app/mappers";
import { api, apiFetch } from "@/lib/api";
import { queryKey } from "@/lib/query-keys";
import type { Oportunidade } from "@/types";
import { logger } from "@/lib/core/logger";

export const oportunidadesKeys = {
  all: queryKey("oportunidades"),
};

async function fetchOportunidades(): Promise<Oportunidade[]> {
  const data = await apiFetch<any[]>("oportunidades");
  return Array.isArray(data) ? data.map(oportunidadeFromApi) : [];
}

export function useOportunidades(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: oportunidadesKeys.all,
    queryFn: fetchOportunidades,
    enabled: options?.enabled ?? true,
    staleTime: 30_000,
  });
}

/**
 * ARC-004.slice-07 · Mutations otimistas para `oportunidades` — padrão canônico
 * (`onMutate` snapshot → `onError` restore → `onSettled` invalidate). Inclui
 * ações específicas `moverEstagio` e `converterOportunidade`.
 */
export function useAddOportunidade() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (
      l: Omit<Oportunidade, "id"> & { valorEstimado?: number },
    ): Promise<Oportunidade> => {
      const result = await api.create("oportunidades", l);
      return {
        ...l,
        id: String(result.id),
        valorEstimado: Number(l.valorEstimado) || 0,
      } as Oportunidade;
    },
    onSuccess: (novo) => {
      qc.setQueryData<Oportunidade[]>(oportunidadesKeys.all, (prev) =>
        prev ? [novo, ...prev] : [novo],
      );
    },
    onError: (err) => {
      logger.error("Error adding oportunidade:", err);
      toast.error("Erro ao salvar oportunidade");
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: oportunidadesKeys.all });
    },
  });
}

export function useUpdateOportunidade() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Oportunidade> }) => {
      await api.update("oportunidades", id, data);
      return { id, data };
    },
    onMutate: async ({ id, data }) => {
      await qc.cancelQueries({ queryKey: oportunidadesKeys.all });
      const prev = qc.getQueryData<Oportunidade[]>(oportunidadesKeys.all);
      qc.setQueryData<Oportunidade[]>(oportunidadesKeys.all, (curr) =>
        (curr ?? []).map((l) => (l.id === id ? { ...l, ...data } : l)),
      );
      return { prev };
    },
    onError: (err, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(oportunidadesKeys.all, ctx.prev);
      logger.error("Error updating oportunidade:", err);
      toast.error("Erro ao atualizar oportunidade. Alteração revertida.");
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: oportunidadesKeys.all });
    },
  });
}

export function useDeleteOportunidade() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.remove("oportunidades", id);
      return id;
    },
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: oportunidadesKeys.all });
      const prev = qc.getQueryData<Oportunidade[]>(oportunidadesKeys.all);
      qc.setQueryData<Oportunidade[]>(oportunidadesKeys.all, (curr) =>
        (curr ?? []).filter((l) => l.id !== id),
      );
      return { prev };
    },
    onError: (err, _id, ctx) => {
      if (ctx?.prev) qc.setQueryData(oportunidadesKeys.all, ctx.prev);
      logger.error("Error deleting oportunidade:", err);
      toast.error("Erro ao remover oportunidade. Exclusão revertida.");
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: oportunidadesKeys.all });
    },
  });
}

export function useMoverEstagio() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, estagio }: { id: string; estagio: string }) => {
      await apiFetch("oportunidadeEstagio", {
        method: "POST",
        body: { oportunidadeId: id, estagio },
      });
      return { id, estagio };
    },
    onMutate: async ({ id, estagio }) => {
      await qc.cancelQueries({ queryKey: oportunidadesKeys.all });
      const prev = qc.getQueryData<Oportunidade[]>(oportunidadesKeys.all);
      qc.setQueryData<Oportunidade[]>(oportunidadesKeys.all, (curr) =>
        (curr ?? []).map((l) => (l.id === id ? { ...l, estagio } : l)),
      );
      return { prev };
    },
    onError: (err, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(oportunidadesKeys.all, ctx.prev);
      logger.error("Error moving oportunidade:", err);
      toast.error("Erro ao mover oportunidade");
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: oportunidadesKeys.all });
    },
  });
}

export function useConverterOportunidade() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await apiFetch<{ id: string; alreadyConverted?: boolean }>(
        "oportunidadeConverter",
        { method: "POST", body: { oportunidadeId: id } },
      );
      return { id, clienteId: String(res.id), alreadyConverted: !!res.alreadyConverted };
    },
    onSuccess: ({ id, clienteId, alreadyConverted }) => {
      qc.setQueryData<Oportunidade[]>(oportunidadesKeys.all, (curr) =>
        (curr ?? []).map((l) =>
          l.id === id
            ? { ...l, clienteId, estagio: "fechado_ganho", status: "convertido" }
            : l,
        ),
      );
      toast.success(
        alreadyConverted
          ? "Oportunidade já estava convertida"
          : "Oportunidade convertida em cliente",
      );
    },
    onError: (err: any) => {
      logger.error("Error converting oportunidade:", err);
      toast.error(`Erro ao converter oportunidade: ${err?.message ?? err}`);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: oportunidadesKeys.all });
    },
  });
}

export const reloadOportunidades = async (): Promise<Oportunidade[]> => {
  const rows = await api.getAll("oportunidades").catch(() => []);
  return rows.map(oportunidadeFromApi);
};
