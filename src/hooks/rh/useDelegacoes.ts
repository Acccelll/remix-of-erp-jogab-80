// Delegações — subdivisões de funções para o Histograma (MySQL via api.php).
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";
import { queryKey } from "@/lib/query-keys";
import type { Delegacao } from "@/types";

export const delegacoesKeys = {
  all: queryKey("delegacoes"),
};

export function useDelegacoes() {
  return useQuery({
    queryKey: delegacoesKeys.all,
    queryFn: async (): Promise<Delegacao[]> => {
      const data = await apiFetch<any[]>("delegacoes");
      return (Array.isArray(data) ? data : []).map((r) => ({
        id: String(r.id),
        nome: r.nome ?? "",
        ordem: Number(r.ordem) || 0,
      }));
    },
    staleTime: 60_000,
  });
}

export function useSaveDelegacao() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (args: { id?: string; payload: { nome: string; ordem?: number } }) =>
      args.id
        ? apiFetch("delegacoes", { method: "PUT", params: { id: args.id }, body: args.payload })
        : apiFetch("delegacoes", { method: "POST", body: args.payload }),
    onSuccess: () => qc.invalidateQueries({ queryKey: delegacoesKeys.all }),
    onError: () => toast.error("Erro ao salvar delegação"),
  });
}

export function useDeleteDelegacao() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch("delegacoes", { method: "DELETE", params: { id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: delegacoesKeys.all });
      // Funções desvinculadas no backend — renova a lista.
      qc.invalidateQueries({ queryKey: queryKey("funcoes") });
    },
    onError: () => toast.error("Erro ao remover delegação"),
  });
}
