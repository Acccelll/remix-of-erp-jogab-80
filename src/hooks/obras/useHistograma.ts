// Histograma — leitura/gravação dos valores por semana (MySQL via api.php).
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";
import { queryKey } from "@/lib/query-keys";
import { celulaKey, type RecursoTipo } from "@/lib/obras/histograma";

export interface CelulaHistograma {
  obra_key: string;
  recurso_tipo: RecursoTipo;
  recurso_chave: string;
  valor: number;
}

export const histogramaKeys = {
  semana: (semana: string) => queryKey("histograma", semana),
};

/** Valores salvos de uma semana como Map<celulaKey, valor>. */
export function useHistogramaSemana(semana: string) {
  return useQuery({
    queryKey: histogramaKeys.semana(semana),
    queryFn: async (): Promise<Map<string, number>> => {
      const rows = await apiFetch<CelulaHistograma[]>("histograma", { params: { semana } });
      const map = new Map<string, number>();
      for (const r of Array.isArray(rows) ? rows : []) {
        map.set(celulaKey(r.obra_key, r.recurso_tipo, r.recurso_chave), Number(r.valor) || 0);
      }
      return map;
    },
    staleTime: 30_000,
  });
}

export function useSalvarHistograma() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (args: { semana: string; rows: CelulaHistograma[] }) =>
      apiFetch("histograma", { method: "POST", body: args }),
    onSuccess: (_r, args) => {
      qc.invalidateQueries({ queryKey: histogramaKeys.semana(args.semana) });
      toast.success("Histograma salvo.");
    },
    onError: () => toast.error("Erro ao salvar o histograma"),
  });
}
