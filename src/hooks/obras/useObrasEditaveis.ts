/**
 * useObrasEditaveis
 *
 * Retorna o conjunto de obraIds nos quais o usuário atual pode escrever
 * (gestor ou membro). GM tem acesso a tudo — sinalizado por `isGM`.
 * ARC-003 — acesso a dados via `obraMembrosRepo`.
 */
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { obraMembrosRepo } from "@/lib/repositories/obras";
import { useAuth } from "@/contexts/auth/useAuth";
import { isUuid } from "@/lib/core/uuid";

export interface ObrasEditaveis {
  isLoading: boolean;
  isGM: boolean;
  editaveis: Set<string>;
  canEditObra: (obraId: string | null | undefined) => boolean;
}

export function useObrasEditaveis(): ObrasEditaveis {
  const { currentPlayer } = useAuth();
  const isGM = !!currentPlayer?.isGM;

  const { data, isLoading } = useQuery({
    queryKey: ["obras-editaveis", currentPlayer?.id],
    enabled: !!currentPlayer?.id && !isGM && isUuid(currentPlayer?.id),
    staleTime: 60_000,
    queryFn: async (): Promise<string[]> => {
      try {
        const rows = await obraMembrosRepo.listByUser(currentPlayer!.id);
        return rows.map((r) => r.obra_id);
      } catch {
        return [];
      }
    },
  });

  return useMemo<ObrasEditaveis>(() => {
    const set = new Set<string>(data ?? []);
    return {
      isLoading: isGM ? false : isLoading,
      isGM,
      editaveis: set,
      canEditObra: (obraId) => {
        if (isGM) return true;
        if (!obraId) return false;
        return set.has(obraId);
      },
    };
  }, [isGM, isLoading, data]);
}
