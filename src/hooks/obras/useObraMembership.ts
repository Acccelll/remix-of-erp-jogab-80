/**
 * useObraMembership
 *
 * Lê `public.obra_membros` para expor o papel do usuário atual na obra
 * (gestor | membro | observador) e helpers de UI. Complementa a Onda B da
 * Fase 2 no frontend: em vez de inferir permissão só por setor, as telas de
 * detalhe da obra podem gatear ações (editar, adicionar membros, arquivar)
 * pelo vínculo real registrado no backend. RLS continua sendo a última
 * linha de defesa.
 */
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { obraMembrosRepo } from "@/lib/repositories/obras";
import { useAuth } from "@/contexts/auth/useAuth";
import { isUuid } from "@/lib/core/uuid";

export type ObraPapel = "gestor" | "membro" | "observador";

export interface ObraMembership {
  isLoading: boolean;
  isGM: boolean;
  papel: ObraPapel | null;
  isGestor: boolean;
  isMembro: boolean;
  isObservador: boolean;
  /** GM ou gestor/membro da obra. */
  canEdit: boolean;
  /** GM ou gestor da obra. */
  canManage: boolean;
  /** Qualquer vínculo (inclui observador) ou GM. */
  hasAccess: boolean;
}

export function useObraMembership(obraId: string | null | undefined): ObraMembership {
  const { currentPlayer } = useAuth();
  const isGM = !!currentPlayer?.isGM;

  const { data: papel, isLoading } = useQuery({
    queryKey: ["obra-membership", obraId, currentPlayer?.id],
    enabled: !!obraId && !!currentPlayer?.id && !isGM && isUuid(currentPlayer?.id),
    staleTime: 60_000,
    queryFn: async (): Promise<ObraPapel | null> => {
      try {
        const papel = await obraMembrosRepo.getPapel(obraId!, currentPlayer!.id);
        return (papel as ObraPapel | null) ?? null;
      } catch {
        return null;
      }
    },
  });

  return useMemo<ObraMembership>(() => {
    if (isGM) {
      return {
        isLoading: false,
        isGM: true,
        papel: "gestor",
        isGestor: true,
        isMembro: false,
        isObservador: false,
        canEdit: true,
        canManage: true,
        hasAccess: true,
      };
    }
    const p = papel ?? null;
    return {
      isLoading,
      isGM: false,
      papel: p,
      isGestor: p === "gestor",
      isMembro: p === "membro",
      isObservador: p === "observador",
      canEdit: p === "gestor" || p === "membro",
      canManage: p === "gestor",
      hasAccess: p !== null,
    };
  }, [isGM, isLoading, papel]);
}
