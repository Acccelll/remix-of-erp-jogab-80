/**
 * Carrega, para uma obra, todos os cards de recurso ativos agrupados
 * por `cronograma_item_id` e devolve a cascata consolidada de cada
 * linha (via `calcularCascataLinha`).
 *
 * Uso: o CronogramaPrincipalTab chama uma vez por obra e consulta
 * `byItem.get(item.id)` para renderizar a mini-timeline em cada linha
 * folha que tiver recursos.
 */

import { useMemo } from "react";

import { useCardsComRecursosPorObra } from "@/hooks/quadros/useCards";
import {
  calcularCascataLinha,
  type CardCascataInput,
  type CascataLinha,
} from "@/lib/recursos/cascata-marcos";

export function useCascataPorItem(obraId: string | undefined) {
  const { data } = useCardsComRecursosPorObra(obraId);

  return useMemo(() => {
    const byItem = new Map<string, CascataLinha>();
    if (!data) return byItem;

    const grouped = new Map<string, CardCascataInput[]>();
    for (const c of data as any[]) {
      const itemId = c.cronograma_item_id as string;
      const r = Array.isArray(c.card_recursos) ? c.card_recursos[0] : c.card_recursos;
      if (!r) continue;
      const arr = grouped.get(itemId) ?? [];
      arr.push({
        card_id: c.id,
        numero: c.numero ?? null,
        titulo: c.titulo ?? null,
        status_card: c.status,
        arquivado: c.arquivado,
        tipo_recurso: r.tipo_recurso,
        prazo_notif_compras: r.prazo_notif_compras ?? null,
        prazo_pedido: r.prazo_pedido ?? null,
        prazo_prod_iniciar: r.prazo_prod_iniciar ?? null,
        prazo_notif_producao: r.prazo_notif_producao ?? null,
        data_necessidade_obra: r.data_necessidade_obra ?? null,
      });
      grouped.set(itemId, arr);
    }

    for (const [itemId, cards] of grouped) {
      const linha = calcularCascataLinha(cards);
      if (linha) byItem.set(itemId, linha);
    }
    return byItem;
  }, [data]);
}
