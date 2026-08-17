// ARC-002/ARC-004 · Onda 6 — Responsabilidades de patrimônios sob leitura + mutações TanStack Query.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api, apiFetch } from "@/lib/api";
import { queryKey } from "@/lib/query-keys";
import type { ResponsabilidadePeriodo } from "@/types";
import { logger } from "@/lib/core/logger";

export const responsabilidadesKeys = {
  all: queryKey("responsabilidades"),
};

async function fetchResponsabilidades(): Promise<ResponsabilidadePeriodo[]> {
  const data = await apiFetch<any[]>("responsabilidades");
  if (!Array.isArray(data)) return [];
  return data.map((r: any) => ({
    id: String(r.id),
    patrimonioId: String(r.patrimonio_id),
    colaboradorId: String(r.colaborador_id),
    dataInicio: r.data_inicio,
    dataFim: r.data_fim,
  }));
}

export function useResponsabilidadesPatrimonios(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: responsabilidadesKeys.all,
    queryFn: fetchResponsabilidades,
    enabled: options?.enabled ?? true,
    staleTime: 30_000,
  });
}

/**
 * ARC-004.slice-09 · Mutations otimistas para `responsabilidades` — padrão canônico
 * (`onMutate` snapshot → `onError` restore → `onSettled` invalidate).
 */
export function useEncerrarResponsabilidade() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, dataFim }: { id: string; dataFim: string }) => {
      await api.update("responsabilidades", id, { data_fim: dataFim });
      return { id, dataFim };
    },
    onMutate: async ({ id, dataFim }) => {
      await qc.cancelQueries({ queryKey: responsabilidadesKeys.all });
      const prev = qc.getQueryData<ResponsabilidadePeriodo[]>(responsabilidadesKeys.all);
      qc.setQueryData<ResponsabilidadePeriodo[]>(responsabilidadesKeys.all, (curr) =>
        (curr ?? []).map((r) => (r.id === id ? { ...r, dataFim } : r)),
      );
      return { prev };
    },
    onError: (err, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(responsabilidadesKeys.all, ctx.prev);
      logger.error("Falha ao encerrar responsabilidade", err);
      toast.error("Erro ao encerrar responsabilidade.");
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: responsabilidadesKeys.all });
    },
  });
}

export function useEncerrarResponsabilidadesDoColaborador() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      colaboradorId,
      dataFim,
    }: {
      colaboradorId: string;
      dataFim: string;
    }) => {
      const curr = qc.getQueryData<ResponsabilidadePeriodo[]>(responsabilidadesKeys.all) ?? [];
      const abertas = curr.filter(
        (r) => r.colaboradorId === colaboradorId && r.dataFim === null,
      );
      await Promise.all(
        abertas.map((r) =>
          api.update("responsabilidades", r.id, { data_fim: dataFim }).catch(() => null),
        ),
      );
      return { colaboradorId, dataFim, abertas };
    },
    onMutate: async ({ colaboradorId, dataFim }) => {
      await qc.cancelQueries({ queryKey: responsabilidadesKeys.all });
      const prev = qc.getQueryData<ResponsabilidadePeriodo[]>(responsabilidadesKeys.all);
      qc.setQueryData<ResponsabilidadePeriodo[]>(responsabilidadesKeys.all, (curr) =>
        (curr ?? []).map((r) =>
          r.colaboradorId === colaboradorId && r.dataFim === null
            ? { ...r, dataFim }
            : r,
        ),
      );
      return { prev };
    },
    onError: (err, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(responsabilidadesKeys.all, ctx.prev);
      logger.error("Falha ao encerrar responsabilidades do colaborador", err);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: responsabilidadesKeys.all });
    },
  });
}
