// ARC-002/ARC-004 · Onda 6 — Colaboradores sob leitura + mutações TanStack Query.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { colaboradorFromApi } from "@/contexts/app/mappers";
import { withBankSnakeCase } from "@/contexts/app/helpers";
import { api, apiFetch } from "@/lib/api";
import { queryKey } from "@/lib/query-keys";
import type { Colaborador } from "@/types";
import { logger } from "@/lib/core/logger";

export const colaboradoresKeys = {
  all: queryKey("colaboradores"),
};

async function fetchColaboradores(): Promise<Colaborador[]> {
  const data = await apiFetch<any[]>("colaboradores");
  return Array.isArray(data) ? data.map(colaboradorFromApi) : [];
}

export function useColaboradores(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: colaboradoresKeys.all,
    queryFn: fetchColaboradores,
    enabled: options?.enabled ?? true,
    staleTime: 30_000,
  });
}

/**
 * ARC-004.slice-03 · Mutations otimistas para `colaboradores`.
 * Payload já montado pelo provider (defaults de docs/histórico dependem de
 * `funcoes`/`currentPlayer` — responsabilidade do provider).
 */
export function useAddColaborador() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (novo: Omit<Colaborador, "id">): Promise<Colaborador> => {
      const result = await api.create("colaboradores", withBankSnakeCase(novo));
      return { ...novo, id: String(result.id) } as Colaborador;
    },
    onSuccess: (novo) => {
      qc.setQueryData<Colaborador[]>(colaboradoresKeys.all, (prev) =>
        prev ? [...prev, novo] : [novo],
      );
    },
    onError: (err) => {
      logger.error("Error adding colaborador:", err);
      toast.error("Erro ao salvar colaborador");
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: colaboradoresKeys.all });
    },
  });
}

export function useDeleteColaborador() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.remove("colaboradores", id);
      return id;
    },
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: colaboradoresKeys.all });
      const prev = qc.getQueryData<Colaborador[]>(colaboradoresKeys.all);
      qc.setQueryData<Colaborador[]>(colaboradoresKeys.all, (curr) =>
        (curr ?? []).filter((c) => c.id !== id),
      );
      return { prev };
    },
    onError: (err, _id, ctx) => {
      if (ctx?.prev) qc.setQueryData(colaboradoresKeys.all, ctx.prev);
      logger.error("Error deleting colaborador:", err);
      toast.error("Erro ao remover colaborador. Exclusão revertida.");
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: colaboradoresKeys.all });
    },
  });
}
