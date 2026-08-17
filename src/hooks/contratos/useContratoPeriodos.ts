// Períodos de alocação do contrato (rota `contratosPeriodos`), sob TanStack
// Query — mesma máquina de estado de `usePatrimonioPeriodos`.
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { queryKey } from "@/lib/query-keys";
import type { PeriodoContrato } from "@/types";

export const contratoPeriodosKeys = {
  all: (contratoId: string) => queryKey("contrato_periodos", contratoId),
};

export function useContratoPeriodos(contratoId: string | null, enabled = true) {
  const query = useQuery({
    queryKey: contratoPeriodosKeys.all(contratoId || "__none__"),
    queryFn: async (): Promise<PeriodoContrato[]> => {
      // Devolve `[]` em banco sem a migração de eventos tipados. O `try` cobre
      // o backend antigo, em que a rota não existia e o `default` do api.php
      // respondia HTTP 200 com um objeto — daí a checagem de array.
      try {
        const r = await api.getAll<PeriodoContrato>("contratosPeriodos", {
          contrato_id: contratoId as string,
        });
        return Array.isArray(r) ? r : [];
      } catch {
        return [];
      }
    },
    enabled: Boolean(contratoId) && enabled,
    staleTime: 30_000,
  });

  return {
    periodos: query.data ?? [],
    loading: query.isLoading || query.isFetching,
    refetch: query.refetch,
  };
}
