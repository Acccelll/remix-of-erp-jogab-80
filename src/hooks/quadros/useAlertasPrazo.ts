// @ts-nocheck
/**
 * Hook compartilhado: carrega cards abertos + recursos para calcular
 * alertas de prazo em runtime. Cache de 60s (defaultOptions).
 * ARC-013.slice-07 — `cardsRepo` encapsulado por `useCards`.
 */
import { useQuery } from "@tanstack/react-query";
import { cardsQueryFns } from "@/hooks/quadros/useCards";
import {
  calcularAlertasPrazo,
  type AlertaInput,
  type AlertaSaida,
} from "@/lib/recursos/alertas-prazo";

export function useAlertasPrazo(): {
  data: AlertaSaida[] | undefined;
  isLoading: boolean;
} {
  const q = useQuery({
    queryKey: ["alertas-prazo"],
    queryFn: async (): Promise<AlertaSaida[]> => {
      const cards = await cardsQueryFns.listAbertosMin();
      const ids = cards.map((c) => c.id);
      if (ids.length === 0) return [];
      const recs = await cardsQueryFns.listAlertasRecursosPorCards(ids);
      const recMap = new Map(recs.map((r) => [r.card_id, r]));
      const entrada: AlertaInput[] = [];
      for (const c of cards) {
        const r = recMap.get(c.id);
        if (!r) continue;
        entrada.push({
          card_id: c.id,
          numero: c.numero,
          titulo: c.titulo,
          obra_id: c.obra_id,
          tipo_recurso: r.tipo_recurso,
          status_card: c.status,
          prazo_notif_compras: r.prazo_notif_compras,
          prazo_notif_producao: r.prazo_notif_producao,
        });
      }
      return calcularAlertasPrazo(entrada);
    },
  });
  return { data: q.data, isLoading: q.isLoading };
}
