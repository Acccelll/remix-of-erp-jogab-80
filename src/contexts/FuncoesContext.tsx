import React, { useCallback, useMemo } from "react";
import { createRequiredContext, useRequiredContext } from "@/contexts/createRequiredContext";
import type { DocumentoTipo, Funcao } from "@/types";
import { useFuncoes, useSaveFuncao } from "@/hooks/rh/useFuncoes";
import {
  useDocumentoTipos,
  useDeleteDocumentoTipo,
  useSaveDocumentoTipo,
} from "@/hooks/rh/useDocumentoTipos";
import { useAuthState } from "@/contexts/auth/AuthContext";

/**
 * ARC-002.slice-30 · Onda 6 — Extração real de `funcoes` + `documentosTipo`
 * (catálogos) para provider próprio. Detém o estado (via TanStack Query),
 * expõe mutações e um flag `catalogosLoaded` que o AppProvider usa para
 * compor `dataLoaded`. Deixa de ser fachada sobre o AppContext.
 */
export interface FuncoesContextType {
  funcoes: Funcao[];
  addFuncao: (f: Omit<Funcao, "id">) => void;
  updateFuncao: (id: string, d: Partial<Funcao>) => void;
  documentosTipo: DocumentoTipo[];
  addDocumentoTipo: (d: Omit<DocumentoTipo, "id">) => void;
  updateDocumentoTipo: (id: string, d: Partial<DocumentoTipo>) => void;
  deleteDocumentoTipo: (id: string) => void;
  catalogosLoaded: boolean;
}

const FuncoesContext = createRequiredContext<FuncoesContextType>({
  hook: "useFuncoesContext",
  provider: "FuncoesProvider",
  file: "src/contexts/FuncoesContext.tsx",
});

export const FuncoesProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentPlayer } = useAuthState();
  const queryEnabled =
    !!currentPlayer ||
    (typeof window !== "undefined" && !!localStorage.getItem("go_token"));

  const funcoesQuery = useFuncoes({ enabled: queryEnabled });
  const documentosTipoQuery = useDocumentoTipos({ enabled: queryEnabled });

  const saveFuncao = useSaveFuncao();
  const saveDocumentoTipo = useSaveDocumentoTipo();
  const removeDocumentoTipo = useDeleteDocumentoTipo();

  const addFuncao = useCallback(
    (f: Omit<Funcao, "id">) => {
      saveFuncao.mutate({ payload: f });
    },
    [saveFuncao],
  );
  const updateFuncao = useCallback(
    (id: string, d: Partial<Funcao>) => {
      saveFuncao.mutate({ id, payload: d });
    },
    [saveFuncao],
  );
  const addDocumentoTipo = useCallback(
    (d: Omit<DocumentoTipo, "id">) => {
      saveDocumentoTipo.mutate({ payload: d });
    },
    [saveDocumentoTipo],
  );
  const updateDocumentoTipo = useCallback(
    (id: string, d: Partial<DocumentoTipo>) => {
      saveDocumentoTipo.mutate({ id, payload: d });
    },
    [saveDocumentoTipo],
  );
  const deleteDocumentoTipo = useCallback(
    (id: string) => {
      removeDocumentoTipo.mutate(id);
    },
    [removeDocumentoTipo],
  );

  const funcoes = funcoesQuery.data ?? [];
  const documentosTipo = documentosTipoQuery.data ?? [];
  const catalogosLoaded =
    !queryEnabled || (funcoesQuery.isSuccess && documentosTipoQuery.isSuccess);

  const value = useMemo<FuncoesContextType>(
    () => ({
      funcoes,
      addFuncao,
      updateFuncao,
      documentosTipo,
      addDocumentoTipo,
      updateDocumentoTipo,
      deleteDocumentoTipo,
      catalogosLoaded,
    }),
    [
      funcoes,
      addFuncao,
      updateFuncao,
      documentosTipo,
      addDocumentoTipo,
      updateDocumentoTipo,
      deleteDocumentoTipo,
      catalogosLoaded,
    ],
  );

  return <FuncoesContext.Provider value={value}>{children}</FuncoesContext.Provider>;
};

export const useFuncoesContext = (): FuncoesContextType => {
  return useRequiredContext(FuncoesContext);
};
