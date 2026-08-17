// ARC-002/ARC-004 · Onda 6 — Funções sob leitura/mutação TanStack Query.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { funcaoFromApi } from "@/contexts/app/mappers";
import { apiFetch } from "@/lib/api";
import { queryKey } from "@/lib/query-keys";
import type { Funcao } from "@/types";

export const funcoesKeys = {
  all: queryKey("funcoes"),
};

async function fetchFuncoes(): Promise<Funcao[]> {
  const data = await apiFetch<any[]>("funcoes");
  return Array.isArray(data) ? data.map(funcaoFromApi) : [];
}

export function useFuncoes(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: funcoesKeys.all,
    queryFn: fetchFuncoes,
    enabled: options?.enabled ?? true,
    staleTime: 30_000,
  });
}

export function useSaveFuncao() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { id?: string; payload: Omit<Funcao, "id"> | Partial<Funcao> }) => {
      if (args.id) {
        return apiFetch("funcoes", { method: "PUT", params: { id: args.id }, body: args.payload });
      }
      return apiFetch("funcoes", { method: "POST", body: args.payload });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: funcoesKeys.all }),
    onError: () => toast.error("Erro ao salvar função"),
  });
}