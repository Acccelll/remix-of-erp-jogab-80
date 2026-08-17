import React, {
  useCallback,
  useMemo,
  useRef,
} from "react";
import { createRequiredContext, useRequiredContext } from "@/contexts/createRequiredContext";
import { useQueryClient } from "@tanstack/react-query";
import type { Contrato } from "@/types";
import {
  contratosKeys,
  useAddContrato,
  useContratos,
  useDeleteContrato,
  useUpdateContrato,
} from "@/hooks/contratos/useContratos";
import { useAuthState } from "@/contexts/auth/AuthContext";
import { useEmpresaOptional } from "@/contexts/EmpresaContext";
import { emitirNumeroCustomizado } from "@/lib/empresa/numeracao-documentos";
import {
  registrarDocumentoNumeroImportadoLocal,
  registrarDocumentoNumeroLocal,
} from "@/lib/empresa/documento-numeracao-local";

export interface AddContratoOptions {
  numeroDocumento?: string | null;
}

/**
 * ARC-002.slice-38 + ARC-004.slice-06 · Onda 6 — Provider real de `contratos`
 * no paradigma único TanStack Query. `setContratos` é wrapper sobre
 * `queryClient.setQueryData`, preservando contratos de outros hooks.
 */
export interface ContratosStateContextType {
  contratos: Contrato[];
  setContratos: React.Dispatch<React.SetStateAction<Contrato[]>>;
  addContrato: (
    d: Omit<Contrato, "id" | "historico" | "mobilizacaoPendente" | "aditivos">,
    options?: AddContratoOptions,
  ) => Promise<Contrato | undefined>;
  updateContrato: (id: string, d: Partial<Contrato>) => void;
  deleteContrato: (id: string) => void;
  contratosLoaded: boolean;
  getContratos: () => Contrato[];
}

const ContratosStateContext = createRequiredContext<ContratosStateContextType>({
  hook: "useContratosStateContext",
  provider: "ContratosStateProvider",
  file: "src/contexts/contratos/ContratosStateContext.tsx",
});

export const ContratosStateProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { currentPlayer } = useAuthState();
  const queryEnabled =
    !!currentPlayer ||
    (typeof window !== "undefined" && !!localStorage.getItem("go_token"));

  const currentPlayerRef = useRef(currentPlayer);
  currentPlayerRef.current = currentPlayer;

  const qc = useQueryClient();
  const contratosQuery = useContratos({ enabled: queryEnabled });
  const addMutation = useAddContrato();
  const updateMutation = useUpdateContrato();
  const deleteMutation = useDeleteContrato();

  const contratos = contratosQuery.data ?? [];

  const setContratos = useCallback<React.Dispatch<React.SetStateAction<Contrato[]>>>(
    (action) => {
      qc.setQueryData<Contrato[]>(contratosKeys.all, (curr) => {
        const prev = curr ?? [];
        return typeof action === "function"
          ? (action as (p: Contrato[]) => Contrato[])(prev)
          : action;
      });
    },
    [qc],
  );

  const empresaCtx = useEmpresaOptional();
  const empresaIdRef = useRef<string | null>(empresaCtx?.empresaAtualId ?? null);
  empresaIdRef.current = empresaCtx?.empresaAtualId ?? null;

  const addContrato = useCallback(
    (
      d: Omit<Contrato, "id" | "historico" | "mobilizacaoPendente" | "aditivos">,
      options?: AddContratoOptions,
    ): Promise<Contrato | undefined> => {
      const current = currentPlayerRef.current;
      const novo: Omit<Contrato, "id"> = {
        ...d,
        historico: [
          {
            id: crypto.randomUUID(),
            tipo: "cadastro",
            descricao: "Contrato cadastrado",
            data: new Date().toISOString(),
            usuario: current?.login || "Sistema",
          },
        ],
        mobilizacaoPendente: null,
        aditivos: [],
      };
      // PRO-031.slice-18 — emissão de número customizado por empresa.
      const empresaId = empresaIdRef.current;
      const numeroImportado = options?.numeroDocumento?.trim() || "";
      const numeroParametrizado = numeroImportado
        ? null
        : emitirNumeroCustomizado(empresaId, "contrato");
      return addMutation
        .mutateAsync(novo)
        .then((criado) => {
          if (numeroImportado) {
            registrarDocumentoNumeroImportadoLocal({
              documentoId: criado.id,
              tipo: "contrato",
              empresaId: empresaId ?? undefined,
              numero: numeroImportado,
            });
          } else if (numeroParametrizado) {
            registrarDocumentoNumeroLocal({
              documentoId: criado.id,
              tipo: "contrato",
              empresaId: empresaId ?? undefined,
              numero: numeroParametrizado.numero,
              sequencial: numeroParametrizado.emitido,
            });
          }
          return criado;
        })
        .catch(() => {
          numeroParametrizado?.rollback();
          return undefined;
        });
    },
    [addMutation],
  );

  const updateContrato = useCallback(
    (id: string, d: Partial<Contrato>) => {
      updateMutation.mutate({ id, data: d });
    },
    [updateMutation],
  );

  const deleteContrato = useCallback(
    (id: string) => {
      deleteMutation.mutate(id);
    },
    [deleteMutation],
  );

  const contratosRef = useRef<Contrato[]>(contratos);
  contratosRef.current = contratos;
  const getContratos = useCallback(() => contratosRef.current, []);

  const contratosLoaded = !queryEnabled || contratosQuery.isSuccess;

  const value = useMemo<ContratosStateContextType>(
    () => ({
      contratos,
      setContratos,
      addContrato,
      updateContrato,
      deleteContrato,
      contratosLoaded,
      getContratos,
    }),
    [
      contratos,
      setContratos,
      addContrato,
      updateContrato,
      deleteContrato,
      contratosLoaded,
      getContratos,
    ],
  );

  return (
    <ContratosStateContext.Provider value={value}>
      {children}
    </ContratosStateContext.Provider>
  );
};

export const useContratosStateContext = (): ContratosStateContextType => {
  return useRequiredContext(ContratosStateContext);
};
