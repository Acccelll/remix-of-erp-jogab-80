// ARC-013 · Onda 6 — Requisições sob leitura + mutações via TanStack Query (fonte única).
// Encapsula `requisicoesRepo` como camada interna; páginas devem consumir estes hooks.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  requisicoesRepo,
  type RequisicaoRow,
  type RequisicaoInsert,
  type RequisicaoUpdate,
} from "@/lib/repositories/requisicoes";
import { queryKey } from "@/lib/query-keys";

export type RequisicaoResumoObra = Pick<RequisicaoRow, "id" | "obra_id" | "observacao">;

export const requisicoesKeys = {
  all: queryKey("requisicoes"),
  list: (cols?: string) =>
    cols ? queryKey("requisicoes", "list", cols) : queryKey("requisicoes", "list"),
  resumoObra: (limit: number) => queryKey("requisicoes", "resumo-obra", limit),
};

export function useRequisicoesAll(cols?: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: requisicoesKeys.list(cols),
    queryFn: () =>
      (cols ? requisicoesRepo.listAll(cols) : requisicoesRepo.listAll()) as Promise<
        RequisicaoRow[]
      >,
    enabled: options?.enabled ?? true,
    staleTime: 30_000,
  });
}

export function useRequisicoesResumoObra(limit = 500, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: requisicoesKeys.resumoObra(limit),
    queryFn: () => requisicoesRepo.listResumoObra(limit) as Promise<RequisicaoResumoObra[]>,
    enabled: options?.enabled ?? true,
    staleTime: 30_000,
  });
}

function invalidateAllRequisicoes(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: requisicoesKeys.all });
}

export function useCreateRequisicao() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: RequisicaoInsert) => requisicoesRepo.create(payload),
    onError: (err: Error) => toast.error("Erro ao criar requisição: " + err.message),
    onSettled: () => invalidateAllRequisicoes(qc),
  });
}

export function useUpdateRequisicaoStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      requisicoesRepo.updateStatus(id, status),
    onError: (err: Error) => toast.error("Erro ao atualizar status: " + err.message),
    onSettled: () => invalidateAllRequisicoes(qc),
  });
}

export function useUpdateRequisicao() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: RequisicaoUpdate }) =>
      requisicoesRepo.update(id, patch),
    onError: (err: Error) => toast.error("Erro ao atualizar requisição: " + err.message),
    onSettled: () => invalidateAllRequisicoes(qc),
  });
}
