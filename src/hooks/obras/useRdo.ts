// ARC-013 · Onda 6 — RDO sob leitura + mutações via TanStack Query (fonte única).
// Encapsula `rdoRepo` como camada interna; páginas devem consumir estes hooks.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { rdoRepo } from "@/lib/repositories/rdo";
import { cardsQueryFns } from "@/hooks/quadros/useCards";
import { queryKey } from "@/lib/query-keys";

export const rdoKeys = {
  all: queryKey("rdo"),
  ultimoParaCard: (cardId: string) => queryKey("ultimo-rdo-card", cardId),
};

export type UltimoRdoResumo = {
  data: string;
  pessoas: number;
  quantidade: number;
} | null;

/** Encapsula a leitura “última execução em RDO” para um card do quadro. */
export function useUltimoRdoParaCard(cardId: string | null | undefined) {
  return useQuery<UltimoRdoResumo>({
    enabled: !!cardId,
    queryKey: rdoKeys.ultimoParaCard(cardId ?? ""),
    staleTime: 60_000,
    queryFn: async () => {
      const cronId = await cardsQueryFns.getCronogramaItemId(cardId!);
      if (!cronId) return null;

      const atividades = await rdoRepo.listAtividadesPorItem(cronId);
      type Row = {
        rdo_id: string;
        quantidade: number | null;
        rdo: { data: string; obra_id: string } | null;
      };
      const rows = (atividades ?? []) as unknown as Row[];
      if (rows.length === 0) return null;

      const sorted = [...rows]
        .filter((r) => r.rdo?.data)
        .sort((a, b) => (b.rdo!.data > a.rdo!.data ? 1 : -1));
      const ultima = sorted[0];
      if (!ultima) return null;

      const ef = await rdoRepo.listEfetivoPorRdo(ultima.rdo_id);
      const pessoas = ef
        .filter((e: any) => e.presente)
        .reduce((s: number, e: any) => s + (e.quantidade ?? 0), 0);

      return {
        data: ultima.rdo!.data,
        pessoas,
        quantidade: ultima.quantidade ?? 0,
      };
    },
  });
}

function invalidateAllRdo(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: rdoKeys.all });
  qc.invalidateQueries({
    predicate: (q) => {
      const root = q.queryKey[0];
      return typeof root === "string" && (root === "ultimo-rdo-card" || root.startsWith("rdo-"));
    },
  });
}

/** Upsert de RDO a partir de linha do Checklist Fácil (RPC `rdo_upsert_from_checklist`). */
export function useUpsertRdoFromChecklist() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (params: Record<string, unknown>) => rdoRepo.upsertFromChecklist(params),
    onError: (err: Error) => toast.error("Erro ao importar RDO: " + err.message),
    onSettled: () => invalidateAllRdo(qc),
  });
}
