import React, { useCallback, useMemo } from "react";
import { createRequiredContext, useRequiredContext } from "@/contexts/createRequiredContext";
import type { Obra } from "@/types";
import {
  useObras,
  useAddObra,
  useUpdateObra,
  useDeleteObra,
} from "@/hooks/obras/useObras";
import { useAuthState } from "@/contexts/auth/AuthContext";

/**
 * ARC-002.slice-32 + ARC-004.slice-01 · Onda 6 — Provider real de `obras`.
 * Paradigma único: dados vêm do cache TanStack (`useObras`) e CRUDs são
 * mutações com otimismo + rollback padronizado (`useAddObra`/`useUpdateObra`/
 * `useDeleteObra`). Deixa de existir estado local paralelo.
 */
export interface ObrasContextType {
  obras: Obra[];
  addObra: (o: Omit<Obra, "id">) => Promise<Obra | undefined>;
  updateObra: (id: string, d: Partial<Obra>) => void;
  deleteObra: (id: string) => void;
  obrasLoaded: boolean;
}

const ObrasContext = createRequiredContext<ObrasContextType>({
  hook: "useObrasContext",
  provider: "ObrasProvider",
  file: "src/contexts/ObrasContext.tsx",
});

export const ObrasProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentPlayer } = useAuthState();
  const queryEnabled =
    !!currentPlayer ||
    (typeof window !== "undefined" && !!localStorage.getItem("go_token"));

  const obrasQuery = useObras({ enabled: queryEnabled });
  const addMutation = useAddObra();
  const updateMutation = useUpdateObra();
  const deleteMutation = useDeleteObra();

  const obras = obrasQuery.data ?? [];
  const obrasLoaded = !queryEnabled || obrasQuery.isSuccess;

  const addObra = useCallback(
    async (o: Omit<Obra, "id">) => {
      try {
        return await addMutation.mutateAsync(o);
      } catch {
        return undefined;
      }
    },
    [addMutation],
  );

  const updateObra = useCallback(
    (id: string, d: Partial<Obra>) => {
      updateMutation.mutate({ id, data: d });
    },
    [updateMutation],
  );

  const deleteObra = useCallback(
    (id: string) => {
      deleteMutation.mutate(id);
    },
    [deleteMutation],
  );

  const value = useMemo<ObrasContextType>(
    () => ({ obras, addObra, updateObra, deleteObra, obrasLoaded }),
    [obras, addObra, updateObra, deleteObra, obrasLoaded],
  );

  return <ObrasContext.Provider value={value}>{children}</ObrasContext.Provider>;
};

export const useObrasContext = (): ObrasContextType => {
  return useRequiredContext(ObrasContext);
};
