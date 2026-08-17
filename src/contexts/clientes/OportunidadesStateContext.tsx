import React, { useCallback, useMemo } from "react";
import { createRequiredContext, useRequiredContext } from "@/contexts/createRequiredContext";
import type { FunilEstagio, Oportunidade } from "@/types";
import {
  useAddOportunidade,
  useConverterOportunidade,
  useDeleteOportunidade,
  useMoverEstagio,
  useOportunidades,
  useUpdateOportunidade,
} from "@/hooks/crm/useOportunidades";
import { useFunilEstagios } from "@/hooks/crm/useFunilEstagios";
import { useAuthState } from "@/contexts/auth/AuthContext";

/**
 * ARC-002.slice-34 + ARC-004.slice-07 · Onda 6 — Provider real de
 * `oportunidades` + `funilEstagios` (CRM) no paradigma único TanStack Query.
 * Sem `useState` paralelo; CRUDs delegam às mutations otimistas do hook.
 */
export interface OportunidadesStateContextType {
  oportunidades: Oportunidade[];
  addOportunidade: (
    l: Omit<Oportunidade, "id"> & { valorEstimado?: number },
  ) => Promise<Oportunidade | undefined>;
  updateOportunidade: (id: string, d: Partial<Oportunidade>) => void;
  deleteOportunidade: (id: string) => void;
  moverEstagio: (id: string, estagio: string) => void;
  converterOportunidade: (id: string) => Promise<string | undefined>;
  funilEstagios: FunilEstagio[];
  crmLoaded: boolean;
}

const OportunidadesStateContext = createRequiredContext<OportunidadesStateContextType>({
  hook: "useOportunidadesStateContext",
  provider: "OportunidadesStateProvider",
  file: "src/contexts/clientes/OportunidadesStateContext.tsx",
});

export const OportunidadesStateProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentPlayer } = useAuthState();
  const queryEnabled =
    !!currentPlayer ||
    (typeof window !== "undefined" && !!localStorage.getItem("go_token"));

  const oportunidadesQuery = useOportunidades({ enabled: queryEnabled });
  const funilEstagiosQuery = useFunilEstagios({ enabled: queryEnabled });

  const addMutation = useAddOportunidade();
  const updateMutation = useUpdateOportunidade();
  const deleteMutation = useDeleteOportunidade();
  const moverMutation = useMoverEstagio();
  const converterMutation = useConverterOportunidade();

  const oportunidades = oportunidadesQuery.data ?? [];
  const funilEstagios = funilEstagiosQuery.data ?? [];

  const addOportunidade = useCallback(
    async (l: Omit<Oportunidade, "id"> & { valorEstimado?: number }) => {
      try {
        return await addMutation.mutateAsync(l);
      } catch {
        return undefined;
      }
    },
    [addMutation],
  );

  const updateOportunidade = useCallback(
    (id: string, d: Partial<Oportunidade>) => {
      updateMutation.mutate({ id, data: d });
    },
    [updateMutation],
  );

  const deleteOportunidade = useCallback(
    (id: string) => {
      deleteMutation.mutate(id);
    },
    [deleteMutation],
  );

  const moverEstagio = useCallback(
    (id: string, estagio: string) => {
      moverMutation.mutate({ id, estagio });
    },
    [moverMutation],
  );

  const converterOportunidade = useCallback(
    async (id: string): Promise<string | undefined> => {
      try {
        const res = await converterMutation.mutateAsync(id);
        return res.clienteId;
      } catch {
        return undefined;
      }
    },
    [converterMutation],
  );

  const crmLoaded =
    !queryEnabled || (oportunidadesQuery.isSuccess && funilEstagiosQuery.isSuccess);

  const value = useMemo<OportunidadesStateContextType>(
    () => ({
      oportunidades,
      addOportunidade,
      updateOportunidade,
      deleteOportunidade,
      moverEstagio,
      converterOportunidade,
      funilEstagios,
      crmLoaded,
    }),
    [
      oportunidades,
      addOportunidade,
      updateOportunidade,
      deleteOportunidade,
      moverEstagio,
      converterOportunidade,
      funilEstagios,
      crmLoaded,
    ],
  );

  return (
    <OportunidadesStateContext.Provider value={value}>
      {children}
    </OportunidadesStateContext.Provider>
  );
};

export const useOportunidadesStateContext = (): OportunidadesStateContextType => {
  return useRequiredContext(OportunidadesStateContext);
};
