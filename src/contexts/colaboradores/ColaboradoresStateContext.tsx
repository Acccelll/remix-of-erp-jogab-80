import React, {
  useCallback,
  useMemo,
  useRef,
} from "react";
import { createRequiredContext, useRequiredContext } from "@/contexts/createRequiredContext";
import { useQueryClient } from "@tanstack/react-query";
import type { Colaborador, Funcao } from "@/types";
import {
  useColaboradores,
  useAddColaborador,
  useDeleteColaborador,
  colaboradoresKeys,
} from "@/hooks/rh/useColaboradores";
import { useUpdateColaborador } from "@/contexts/app/useUpdateColaborador";
import { useAuthState } from "@/contexts/auth/AuthContext";
import { useFuncoesContext } from "@/contexts/FuncoesContext";

/**
 * ARC-002.slice-35 + ARC-004.slice-03 · Onda 6 — Provider real de
 * `colaboradores` no paradigma único TanStack Query. `setColaboradores`
 * é um wrapper sobre `queryClient.setQueryData` para preservar o contrato
 * usado por `useMobilizacoes`/`useUpdateColaborador`.
 */
export interface ColaboradoresStateContextType {
  colaboradores: Colaborador[];
  setColaboradores: React.Dispatch<React.SetStateAction<Colaborador[]>>;
  addColaborador: (
    d: Omit<
      Colaborador,
      "id" | "integracoes" | "documentos" | "historico" | "mobilizacaoPendente" | "ferias"
    >,
  ) => void;
  updateColaborador: (id: string, d: Partial<Colaborador>) => void;
  deleteColaborador: (id: string) => void;
  colaboradoresLoaded: boolean;
  getColaboradores: () => Colaborador[];
}

const ColaboradoresStateContext = createRequiredContext<ColaboradoresStateContextType>({
  hook: "useColaboradoresStateContext",
  provider: "ColaboradoresStateProvider",
  file: "src/contexts/colaboradores/ColaboradoresStateContext.tsx",
});

export const ColaboradoresStateProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { currentPlayer } = useAuthState();
  const { funcoes } = useFuncoesContext();
  const queryEnabled =
    !!currentPlayer ||
    (typeof window !== "undefined" && !!localStorage.getItem("go_token"));

  const currentPlayerRef = useRef(currentPlayer);
  currentPlayerRef.current = currentPlayer;
  const funcoesRef = useRef<Funcao[]>(funcoes);
  funcoesRef.current = funcoes;

  const qc = useQueryClient();
  const colaboradoresQuery = useColaboradores({ enabled: queryEnabled });
  const addMutation = useAddColaborador();
  const deleteMutation = useDeleteColaborador();

  const colaboradores = colaboradoresQuery.data ?? [];

  // Wrapper compatível com React.Dispatch<SetStateAction<Colaborador[]>>.
  // Escreve direto no cache TanStack — fonte única da verdade.
  const setColaboradores = useCallback<
    React.Dispatch<React.SetStateAction<Colaborador[]>>
  >(
    (action) => {
      qc.setQueryData<Colaborador[]>(colaboradoresKeys.all, (curr) => {
        const prev = curr ?? [];
        return typeof action === "function"
          ? (action as (p: Colaborador[]) => Colaborador[])(prev)
          : action;
      });
    },
    [qc],
  );

  const updateColaborador = useUpdateColaborador({ colaboradores, setColaboradores });

  const addColaborador = useCallback(
    (
      d: Omit<
        Colaborador,
        "id" | "integracoes" | "documentos" | "historico" | "mobilizacaoPendente" | "ferias"
      >,
    ) => {
      const current = currentPlayerRef.current;
      const funcoesNow = funcoesRef.current;
      const funcaoObj = funcoesNow.find((f) => f.nome === d.funcao && f.ativa);
      const nrDocs = funcaoObj
        ? funcaoObj.nrs.map((nr) => ({
            id: crypto.randomUUID(),
            nome: nr,
            dataVencimento: "",
            obrigatorio: true,
          }))
        : [];
      const novo: Omit<Colaborador, "id"> = {
        ...d,
        integracoes: [],
        documentos: [
          { id: crypto.randomUUID(), nome: "ASO", dataVencimento: "", obrigatorio: true },
          { id: crypto.randomUUID(), nome: "Férias", dataVencimento: "", obrigatorio: true },
          ...nrDocs,
        ],
        historico: [
          {
            id: crypto.randomUUID(),
            tipo: "cadastro",
            descricao: "Colaborador cadastrado",
            data: new Date().toISOString(),
            usuario: current?.login || "Sistema",
          },
        ],
        ferias: [],
        mobilizacaoPendente: null,
      };
      addMutation.mutate(novo);
    },
    [addMutation],
  );

  const deleteColaborador = useCallback(
    (id: string) => {
      deleteMutation.mutate(id);
    },
    [deleteMutation],
  );

  const colaboradoresRef = useRef<Colaborador[]>(colaboradores);
  colaboradoresRef.current = colaboradores;
  const getColaboradores = useCallback(() => colaboradoresRef.current, []);

  const colaboradoresLoaded = !queryEnabled || colaboradoresQuery.isSuccess;

  const value = useMemo<ColaboradoresStateContextType>(
    () => ({
      colaboradores,
      setColaboradores,
      addColaborador,
      updateColaborador,
      deleteColaborador,
      colaboradoresLoaded,
      getColaboradores,
    }),
    [
      colaboradores,
      setColaboradores,
      addColaborador,
      updateColaborador,
      deleteColaborador,
      colaboradoresLoaded,
      getColaboradores,
    ],
  );

  return (
    <ColaboradoresStateContext.Provider value={value}>
      {children}
    </ColaboradoresStateContext.Provider>
  );
};

export const useColaboradoresStateContext = (): ColaboradoresStateContextType => {
  return useRequiredContext(ColaboradoresStateContext);
};
