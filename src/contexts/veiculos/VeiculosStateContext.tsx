import React, {
  useCallback,
  useMemo,
  useRef,
} from "react";
import { createRequiredContext, useRequiredContext } from "@/contexts/createRequiredContext";
import { useQueryClient } from "@tanstack/react-query";
import type { Veiculo } from "@/types";
import {
  useAddVeiculo,
  useDeleteVeiculo,
  useUpdateVeiculo,
  useVeiculos,
  veiculosKeys,
} from "@/hooks/frotas/useVeiculos";
import { buildFlagHistory, VEICULO_FLAGS } from "@/contexts/app/helpers";
import { useAuthState } from "@/contexts/auth/AuthContext";
import { useColaboradoresStateContext } from "@/contexts/colaboradores/ColaboradoresStateContext";

/**
 * ARC-002.slice-37 + ARC-004.slice-05 · Onda 6 — Provider real de `veiculos`
 * no paradigma único TanStack Query. `setVeiculos` é wrapper sobre
 * `queryClient.setQueryData`, preservando contratos de mobilizações.
 */
export interface VeiculosStateContextType {
  veiculos: Veiculo[];
  setVeiculos: React.Dispatch<React.SetStateAction<Veiculo[]>>;
  addVeiculo: (d: Omit<Veiculo, "id" | "historico" | "mobilizacaoPendente">) => void;
  updateVeiculo: (id: string, d: Partial<Veiculo>) => void;
  deleteVeiculo: (id: string) => void;
  veiculosLoaded: boolean;
  getVeiculos: () => Veiculo[];
}

const VeiculosStateContext = createRequiredContext<VeiculosStateContextType>({
  hook: "useVeiculosStateContext",
  provider: "VeiculosStateProvider",
  file: "src/contexts/veiculos/VeiculosStateContext.tsx",
});

export const VeiculosStateProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentPlayer } = useAuthState();
  const { getColaboradores } = useColaboradoresStateContext();
  const queryEnabled =
    !!currentPlayer ||
    (typeof window !== "undefined" && !!localStorage.getItem("go_token"));

  const currentPlayerRef = useRef(currentPlayer);
  currentPlayerRef.current = currentPlayer;

  const qc = useQueryClient();
  const veiculosQuery = useVeiculos({ enabled: queryEnabled });
  const addMutation = useAddVeiculo();
  const updateMutation = useUpdateVeiculo();
  const deleteMutation = useDeleteVeiculo();

  const veiculos = veiculosQuery.data ?? [];

  const setVeiculos = useCallback<React.Dispatch<React.SetStateAction<Veiculo[]>>>(
    (action) => {
      qc.setQueryData<Veiculo[]>(veiculosKeys.all, (curr) => {
        const prev = curr ?? [];
        return typeof action === "function"
          ? (action as (p: Veiculo[]) => Veiculo[])(prev)
          : action;
      });
    },
    [qc],
  );

  const addVeiculo = useCallback(
    (d: Omit<Veiculo, "id" | "historico" | "mobilizacaoPendente">) => {
      const current = currentPlayerRef.current;
      const novo: Omit<Veiculo, "id"> = {
        ...d,
        historico: [
          {
            id: crypto.randomUUID(),
            tipo: "cadastro",
            descricao: "Veículo cadastrado",
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

  const updateVeiculo = useCallback(
    (id: string, d: Partial<Veiculo>) => {
      const current = currentPlayerRef.current;
      const colaboradores = getColaboradores();
      const patch: Partial<Veiculo> = { ...d };

      // O veículo segue a obra do motorista, exceto quando o chamador manda uma
      // obra explícita: é o caso de "ficou na obra sem motorista", em que
      // derivar de `motoristaId: null` mandaria o carro para Sem Alocação.
      if (
        Object.prototype.hasOwnProperty.call(d, "motoristaId") &&
        !Object.prototype.hasOwnProperty.call(d, "obraAtualId")
      ) {
        const novoMotoristaId = d.motoristaId ?? null;
        patch.obraAtualId = novoMotoristaId
          ? colaboradores.find((c) => c.id === novoMotoristaId)?.obraAtualId ?? null
          : null;
      }

      const prev = veiculos.find((v) => v.id === id);
      const flagEntries = prev
        ? buildFlagHistory(prev, patch, VEICULO_FLAGS, current?.login)
        : [];
      if (flagEntries.length > 0) {
        patch.historico = [...(prev?.historico ?? []), ...flagEntries];
      } else if (!("historico" in patch)) {
        patch.historico = prev?.historico;
      }

      updateMutation.mutate({ id, data: patch, usuarioId: current?.id ?? null });
    },
    [getColaboradores, updateMutation, veiculos],
  );

  const deleteVeiculo = useCallback(
    (id: string) => {
      deleteMutation.mutate(id);
    },
    [deleteMutation],
  );

  const veiculosRef = useRef<Veiculo[]>(veiculos);
  veiculosRef.current = veiculos;
  const getVeiculos = useCallback(() => veiculosRef.current, []);

  const veiculosLoaded = !queryEnabled || veiculosQuery.isSuccess;

  const value = useMemo<VeiculosStateContextType>(
    () => ({
      veiculos,
      setVeiculos,
      addVeiculo,
      updateVeiculo,
      deleteVeiculo,
      veiculosLoaded,
      getVeiculos,
    }),
    [
      veiculos,
      setVeiculos,
      addVeiculo,
      updateVeiculo,
      deleteVeiculo,
      veiculosLoaded,
      getVeiculos,
    ],
  );

  return (
    <VeiculosStateContext.Provider value={value}>{children}</VeiculosStateContext.Provider>
  );
};

export const useVeiculosStateContext = (): VeiculosStateContextType => {
  return useRequiredContext(VeiculosStateContext);
};
