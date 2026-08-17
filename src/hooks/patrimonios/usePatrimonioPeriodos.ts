// Períodos de alocação do patrimônio (rota `patrimoniosPeriodos`), sob
// TanStack Query — mesma máquina de estado usada por `useColaboradorDp`.
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { queryKey } from "@/lib/query-keys";
import type { PeriodoPatrimonio } from "@/types";

export const patrimonioPeriodosKeys = {
  all: (patrimonioId: string) => queryKey("patrimonio_periodos", patrimonioId),
};

export function usePatrimonioPeriodos(patrimonioId: string | null, enabled = true) {
  const query = useQuery({
    queryKey: patrimonioPeriodosKeys.all(patrimonioId || "__none__"),
    queryFn: async (): Promise<PeriodoPatrimonio[]> => {
      // A rota devolve `[]` em banco sem a migração de eventos tipados, onde
      // não há como distinguir período de obra de período de status. O `try`
      // cobre o backend antigo, em que a rota não existia e o `default` do
      // api.php respondia HTTP 200 com um objeto — daí a checagem de array.
      try {
        const r = await api.getAll<PeriodoPatrimonio>("patrimoniosPeriodos", {
          patrimonio_id: patrimonioId as string,
        });
        return Array.isArray(r) ? r : [];
      } catch {
        return [];
      }
    },
    enabled: Boolean(patrimonioId) && enabled,
    staleTime: 30_000,
  });

  return {
    periodos: query.data ?? [],
    loading: query.isLoading || query.isFetching,
    refetch: query.refetch,
  };
}
