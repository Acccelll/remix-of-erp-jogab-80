// ARC-002/ARC-004 · Onda 6 — Funil de estágios sob leitura TanStack Query.
import { useQuery } from "@tanstack/react-query";
import { funilEstagioFromApi } from "@/contexts/app/mappers";
import { apiFetch } from "@/lib/api";
import { queryKey } from "@/lib/query-keys";
import type { FunilEstagio } from "@/types";

export const funilEstagiosKeys = {
  all: queryKey("funil_estagios"),
};

async function fetchFunilEstagios(): Promise<FunilEstagio[]> {
  const data = await apiFetch<any[]>("funil_estagios");
  return Array.isArray(data) ? data.map(funilEstagioFromApi) : [];
}

export function useFunilEstagios(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: funilEstagiosKeys.all,
    queryFn: fetchFunilEstagios,
    enabled: options?.enabled ?? true,
    staleTime: 30_000,
  });
}
