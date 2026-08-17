// ARC-004 · Onda 6 — RH/DP por colaborador sob TanStack Query (uma máquina de estado servidor).
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { queryKey } from "@/lib/query-keys";
import type { PeriodoAlocacao } from "@/types";

function toArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

export const colaboradorDpKeys = {
  all: (colaboradorId: string) => queryKey("dp_colaborador", colaboradorId),
};

export interface ColaboradorDpData {
  historico: any[];
  horasExtras: any[];
  fopag: any[];
  provisoes: any[];
  mobPeriodos: PeriodoAlocacao[];
}

async function fetchColaboradorDp(colaboradorId: string): Promise<ColaboradorDpData> {
  const byColab = (arr: any[]) =>
    arr.filter((r) => String(r.colaborador_id) === String(colaboradorId));

  // Cada fatia degrada sozinha. As rotas de DP (folha, salário, horas extras,
  // provisões) exigem o módulo `dp` no servidor; quem abre este diálogo pelo
  // perfil de RH (EmployeeProfileDialog, que só consome `mobPeriodos`) leva 403
  // nelas. Com `allSettled`, isso devolve lista vazia em vez de derrubar a
  // query inteira e sumir com os períodos de mobilização.
  const [h, he, f, p] = (
    await Promise.allSettled([
      api.getAll("historicoSalarial", { colaborador_id: colaboradorId }),
      api.getAll("horasExtras", { colaborador_id: colaboradorId }),
      api.getAll("fopagEntries", { colaborador_id: colaboradorId }),
      api.getAll("provisoes", { colaborador_id: colaboradorId }),
    ])
  ).map((r) => (r.status === "fulfilled" ? r.value : []));

  // A rota devolve `[]` em banco sem a migração de eventos tipados, onde não há
  // como distinguir período de obra de período de status. O `try` cobre o
  // backend antigo, em que a rota não existia e a resposta era um objeto de
  // "recurso não encontrado" com HTTP 200 — daí o `toArray` continuar sendo
  // necessário: sem ele, um objeto viraria período.
  let mobPeriodos: PeriodoAlocacao[] = [];
  try {
    const mp = await api.getAll("mobilizacoesPeriodos", { colaborador_id: colaboradorId });
    mobPeriodos = toArray<PeriodoAlocacao>(mp);
  } catch {
    mobPeriodos = [];
  }

  return {
    historico: byColab(toArray(h)),
    horasExtras: byColab(toArray(he)),
    fopag: byColab(toArray(f)),
    provisoes: byColab(toArray(p)),
    mobPeriodos,
  };
}

export function useColaboradorDp(colaboradorId: string | null, enabled = true) {
  const query = useQuery({
    queryKey: colaboradorDpKeys.all(colaboradorId || "__none__"),
    queryFn: () => fetchColaboradorDp(colaboradorId as string),
    enabled: Boolean(colaboradorId) && enabled,
    staleTime: 30_000,
  });

  const data = query.data;
  return {
    historico: data?.historico ?? [],
    horasExtras: data?.horasExtras ?? [],
    fopag: data?.fopag ?? [],
    provisoes: data?.provisoes ?? [],
    mobPeriodos: data?.mobPeriodos ?? [],
    loading: query.isLoading || query.isFetching,
    refetch: query.refetch,
  };
}
