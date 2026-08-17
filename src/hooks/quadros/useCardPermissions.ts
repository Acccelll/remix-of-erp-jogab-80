/**
 * useCardPermissions
 *
 * Espelha no frontend a regra de RLS `has_card_setor`: usuário pode editar o card
 * se for GM ou se algum setor do card estiver entre os setores do usuário.
 * É só para gating de UI — o banco continua sendo a última linha de defesa.
 */
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { userSetoresRepo } from "@/lib/repositories/auth";
import { useAuth } from "@/contexts/auth/useAuth";

export function useUserSetores() {
  const { currentPlayer } = useAuth();
  const uid = currentPlayer?.id;
  const isUuid =
    typeof uid === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(uid);
  return useQuery({
    queryKey: ["user-setores", uid],
    enabled: !!uid && isUuid,
    staleTime: 60_000,
    queryFn: async (): Promise<string[]> => {
      try {
        return await userSetoresRepo.listByUser(uid!);
      } catch {
        return [];
      }
    },
  });
}

export interface CardPermissions {
  isGM: boolean;
  canEdit: boolean;
  canArchive: boolean;
  canComment: boolean;
  reason: string | null;
}

/**
 * @param cardSetores setores associados ao card (vindos de `card_setores`).
 *                    Passe `undefined` se ainda estiver carregando.
 */
export function useCardPermissions(cardSetores: string[] | undefined): CardPermissions {
  const { currentPlayer } = useAuth();
  const { data: meusSetores = [] } = useUserSetores();
  return useMemo(() => {
    const isGM = !!currentPlayer?.isGM;
    if (isGM) {
      return { isGM, canEdit: true, canArchive: true, canComment: true, reason: null };
    }
    if (!cardSetores) {
      // Carregando — não bloqueia ainda, mas também não libera
      return { isGM, canEdit: false, canArchive: false, canComment: false, reason: null };
    }
    if (cardSetores.length === 0) {
      // Card sem setor → qualquer authenticated pode (mantém comportamento atual)
      return { isGM, canEdit: true, canArchive: true, canComment: true, reason: null };
    }
    const overlap = cardSetores.some((s) => meusSetores.includes(s));
    if (overlap) {
      return { isGM, canEdit: true, canArchive: true, canComment: true, reason: null };
    }
    return {
      isGM,
      canEdit: false,
      canArchive: false,
      canComment: false,
      reason: `Apenas usuários dos setores ${cardSetores.join(", ")} podem editar este card.`,
    };
  }, [currentPlayer?.isGM, cardSetores, meusSetores]);
}
