import React, {
  useCallback,
  useMemo,
  useRef,
} from "react";
import { createRequiredContext, useRequiredContext } from "@/contexts/createRequiredContext";
import { useQueryClient } from "@tanstack/react-query";
import type { Patrimonio } from "@/types";
import {
  patrimoniosKeys,
  useAddPatrimonio,
  useDeletePatrimonio,
  usePatrimonios,
  useUpdatePatrimonio,
} from "@/hooks/patrimonios/usePatrimonios";
import { buildFlagHistory, PATRIMONIO_FLAGS } from "@/contexts/app/helpers";
import { useAuthState } from "@/contexts/auth/AuthContext";

/**
 * ARC-002.slice-36 + ARC-004.slice-04 · Onda 6 — Provider real de
 * `patrimonios` no paradigma único TanStack Query. `setPatrimonios` é
 * wrapper sobre `queryClient.setQueryData`, preservando contratos de
 * mobilizações/responsabilidades sem estado local paralelo.
 */
export interface PatrimoniosStateContextType {
  patrimonios: Patrimonio[];
  setPatrimonios: React.Dispatch<React.SetStateAction<Patrimonio[]>>;
  addPatrimonio: (
    d: Omit<Patrimonio, "id" | "historico" | "mobilizacaoPendente">,
  ) => void;
  updatePatrimonio: (id: string, d: Partial<Patrimonio>) => void;
  deletePatrimonio: (id: string) => void;
  patrimoniosLoaded: boolean;
  getPatrimonios: () => Patrimonio[];
}

const PatrimoniosStateContext = createRequiredContext<PatrimoniosStateContextType>({
  hook: "usePatrimoniosStateContext",
  provider: "PatrimoniosStateProvider",
  file: "src/contexts/patrimonios/PatrimoniosStateContext.tsx",
});

export const PatrimoniosStateProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { currentPlayer } = useAuthState();
  const queryEnabled =
    !!currentPlayer ||
    (typeof window !== "undefined" && !!localStorage.getItem("go_token"));

  const currentPlayerRef = useRef(currentPlayer);
  currentPlayerRef.current = currentPlayer;

  const qc = useQueryClient();
  const patrimoniosQuery = usePatrimonios({ enabled: queryEnabled });
  const addMutation = useAddPatrimonio();
  const updateMutation = useUpdatePatrimonio();
  const deleteMutation = useDeletePatrimonio();

  const patrimonios = patrimoniosQuery.data ?? [];

  const setPatrimonios = useCallback<React.Dispatch<React.SetStateAction<Patrimonio[]>>>(
    (action) => {
      qc.setQueryData<Patrimonio[]>(patrimoniosKeys.all, (curr) => {
        const prev = curr ?? [];
        return typeof action === "function"
          ? (action as (p: Patrimonio[]) => Patrimonio[])(prev)
          : action;
      });
    },
    [qc],
  );

  const addPatrimonio = useCallback(
    (d: Omit<Patrimonio, "id" | "historico" | "mobilizacaoPendente">) => {
      const current = currentPlayerRef.current;
      const novo: Omit<Patrimonio, "id"> = {
        ...d,
        historico: [
          {
            id: crypto.randomUUID(),
            tipo: "cadastro",
            descricao: "Patrimônio cadastrado",
            data: new Date().toISOString(),
            usuario: current?.login || "Sistema",
          },
        ],
        mobilizacaoPendente: null,
      };
      addMutation.mutate(novo);
    },
    [addMutation],
  );

  const updatePatrimonio = useCallback(
    (id: string, d: Partial<Patrimonio>) => {
      const current = currentPlayerRef.current;
      const prev = patrimonios.find((pat) => pat.id === id);
      const flagEntries = prev
        ? buildFlagHistory(prev, d, PATRIMONIO_FLAGS, current?.login)
        : [];
      const patchHistorico =
        flagEntries.length > 0 ? [...(prev?.historico ?? []), ...flagEntries] : d.historico;
      const finalPatch = patchHistorico ? { ...d, historico: patchHistorico } : d;
      updateMutation.mutate({ id, data: finalPatch });
    },
    [patrimonios, updateMutation],
  );

  const deletePatrimonio = useCallback(
    (id: string) => {
      deleteMutation.mutate(id);
    },
    [deleteMutation],
  );

  const patrimoniosRef = useRef<Patrimonio[]>(patrimonios);
  patrimoniosRef.current = patrimonios;
  const getPatrimonios = useCallback(() => patrimoniosRef.current, []);

  const patrimoniosLoaded = !queryEnabled || patrimoniosQuery.isSuccess;

  const value = useMemo<PatrimoniosStateContextType>(
    () => ({
      patrimonios,
      setPatrimonios,
      addPatrimonio,
      updatePatrimonio,
      deletePatrimonio,
      patrimoniosLoaded,
      getPatrimonios,
    }),
    [
      patrimonios,
      setPatrimonios,
      addPatrimonio,
      updatePatrimonio,
      deletePatrimonio,
      patrimoniosLoaded,
      getPatrimonios,
    ],
  );

  return (
    <PatrimoniosStateContext.Provider value={value}>
      {children}
    </PatrimoniosStateContext.Provider>
  );
};

export const usePatrimoniosStateContext = (): PatrimoniosStateContextType => {
  return useRequiredContext(PatrimoniosStateContext);
};
