/**
 * useCardCovers — REF.2 (capa de card).
 * ARC-003 — consome hooks canônicos de `useCards` + `cardAnexosStorage`.
 */
import { useQuery } from "@tanstack/react-query";
import { cardsKeys, cardsQueryFns } from "@/hooks/quadros/useCards";
import { cardAnexosStorage } from "@/lib/repositories/storage";

export interface CardCoverMap {
  [cardId: string]: string; // signed URL
}

export function useCardCovers(cardIds: string[]) {
  const ids = [...new Set(cardIds)].sort();
  return useQuery({
    queryKey: cardsKeys.coverPaths(ids),
    enabled: ids.length > 0,
    staleTime: 50 * 60 * 1000, // 50min (signed URL dura 60min)
    queryFn: async (): Promise<CardCoverMap> => {
      const data = await cardsQueryFns.listCoverPathsByCards(ids);

      const firstPerCard = new Map<string, string>();
      for (const row of data) {
        if (!firstPerCard.has(row.card_id)) {
          firstPerCard.set(row.card_id, row.storage_path);
        }
      }
      const entries = await Promise.all(
        Array.from(firstPerCard.entries()).map(async ([cardId, path]) => {
          const { data: signed } = await cardAnexosStorage.createSignedUrl(path, 60 * 60);
          return [cardId, signed?.signedUrl ?? ""] as const;
        }),
      );
      const out: CardCoverMap = {};
      for (const [cid, url] of entries) if (url) out[cid] = url;
      return out;
    },
  });
}
