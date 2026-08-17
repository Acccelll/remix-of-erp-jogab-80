import React, {
  useCallback,
  useMemo,
  useRef,
} from "react";
import { createRequiredContext, useRequiredContext } from "@/contexts/createRequiredContext";
import { useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { ResponsabilidadePeriodo } from "@/types";
import { useAuthState } from "@/contexts/auth/AuthContext";
import { usePatrimoniosStateContext } from "@/contexts/patrimonios/PatrimoniosStateContext";
import { reportError } from "@/lib/core/errors";
import {
  responsabilidadesKeys,
  useEncerrarResponsabilidade,
  useEncerrarResponsabilidadesDoColaborador,
  useResponsabilidadesPatrimonios,
} from "@/hooks/patrimonios/useResponsabilidadesPatrimonios";

/**
 * ARC-004.slice-09 · Onda 6 — Responsabilidades migrado ao paradigma único
 * TanStack Query. Leitura direta do cache; mutações delegadas às mutations
 * otimistas. `setResponsabilidadesPatrimonios` vira wrapper de cache para
 * preservar assinatura pública.
 */
export interface ResponsabilidadesStateContextType {
  responsabilidadesPatrimonios: ResponsabilidadePeriodo[];
  setResponsabilidadesPatrimonios: React.Dispatch<
    React.SetStateAction<ResponsabilidadePeriodo[]>
  >;
  encerrarResponsabilidade: (
    responsabilidadeId: string,
    dataFim?: string,
  ) => Promise<void>;
  encerrarResponsabilidadesDoColaborador: (
    colaboradorId: string,
    dataFim?: string,
  ) => Promise<void>;
  getResponsabilidadeAtiva: (patrimonioId: string) => ResponsabilidadePeriodo | null;
  responsabilidadesLoaded: boolean;
}

const ResponsabilidadesStateContext = createRequiredContext<ResponsabilidadesStateContextType>({
  hook: "useResponsabilidadesStateContext",
  provider: "ResponsabilidadesStateProvider",
  file: "src/contexts/responsabilidades/ResponsabilidadesStateContext.tsx",
});

export const ResponsabilidadesStateProvider: React.FC<{
  children: React.ReactNode;
}> = ({ children }) => {
  const { currentPlayer } = useAuthState();
  const { setPatrimonios } = usePatrimoniosStateContext();
  const qc = useQueryClient();

  const queryEnabled =
    !!currentPlayer ||
    (typeof window !== "undefined" && !!localStorage.getItem("go_token"));

  const responsabilidadesQuery = useResponsabilidadesPatrimonios({
    enabled: queryEnabled,
  });
  const responsabilidadesPatrimonios = useMemo<ResponsabilidadePeriodo[]>(
    () => responsabilidadesQuery.data ?? [],
    [responsabilidadesQuery.data],
  );

  const responsabilidadesRef = useRef<ResponsabilidadePeriodo[]>(
    responsabilidadesPatrimonios,
  );
  responsabilidadesRef.current = responsabilidadesPatrimonios;

  const setResponsabilidadesPatrimonios = useCallback<
    React.Dispatch<React.SetStateAction<ResponsabilidadePeriodo[]>>
  >(
    (value) => {
      qc.setQueryData<ResponsabilidadePeriodo[]>(
        responsabilidadesKeys.all,
        (curr) => {
          const base = curr ?? [];
          return typeof value === "function"
            ? (value as (prev: ResponsabilidadePeriodo[]) => ResponsabilidadePeriodo[])(base)
            : value;
        },
      );
    },
    [qc],
  );

  const encerrarResp = useEncerrarResponsabilidade();
  const encerrarRespColab = useEncerrarResponsabilidadesDoColaborador();

  const encerrarResponsabilidade = useCallback(
    async (responsabilidadeId: string, dataFim?: string) => {
      const fim = dataFim || new Date().toISOString().split("T")[0];
      const resp = responsabilidadesRef.current.find(
        (r) => r.id === responsabilidadeId,
      );
      try {
        await encerrarResp.mutateAsync({ id: responsabilidadeId, dataFim: fim });
        if (resp && fim <= new Date().toISOString().split("T")[0]) {
          setPatrimonios((prev) =>
            prev.map((p) =>
              p.id === resp.patrimonioId ? { ...p, responsavelId: null } : p,
            ),
          );
          try {
            await api.update("patrimonios", resp.patrimonioId, {
              responsavelId: null,
              responsavel_id: null,
            });
          } catch (e) {
            reportError("responsabilidades.falha-ao-limpar-responsavel-id", e);
          }
        }
      } catch {
        // toast já emitido pela mutation
      }
    },
    [encerrarResp, setPatrimonios],
  );

  const encerrarResponsabilidadesDoColaborador = useCallback(
    async (colaboradorId: string, dataFim?: string) => {
      const fim = dataFim || new Date().toISOString().split("T")[0];
      const abertas = responsabilidadesRef.current.filter(
        (r) => r.colaboradorId === colaboradorId && r.dataFim === null,
      );
      if (abertas.length === 0) return;
      try {
        await encerrarRespColab.mutateAsync({ colaboradorId, dataFim: fim });
        for (const r of abertas) {
          setPatrimonios((prev) =>
            prev.map((p) =>
              p.id === r.patrimonioId
                ? { ...p, responsavelId: null, obraAtualId: null }
                : p,
            ),
          );
          try {
            await api.update("patrimonios", r.patrimonioId, {
              responsavelId: null,
              responsavel_id: null,
              obraAtualId: null,
              obra_atual_id: null,
            });
          } catch (e) {
            reportError("responsabilidades.falha-ao-desvincular-patrim-nio-na-inati", e);
          }
        }
      } catch (e) {
        reportError("responsabilidades.falha-ao-encerrar-responsabilidades-do-c", e);
      }
    },
    [encerrarRespColab, setPatrimonios],
  );

  const getResponsabilidadeAtiva = useCallback(
    (patrimonioId: string): ResponsabilidadePeriodo | null => {
      const hoje = new Date().toISOString().split("T")[0];
      return (
        responsabilidadesRef.current.find(
          (r) =>
            r.patrimonioId === patrimonioId &&
            r.dataInicio <= hoje &&
            (r.dataFim === null || r.dataFim >= hoje),
        ) || null
      );
    },
    [],
  );

  const responsabilidadesLoaded = !queryEnabled || responsabilidadesQuery.isSuccess;

  const value = useMemo<ResponsabilidadesStateContextType>(
    () => ({
      responsabilidadesPatrimonios,
      setResponsabilidadesPatrimonios,
      encerrarResponsabilidade,
      encerrarResponsabilidadesDoColaborador,
      getResponsabilidadeAtiva,
      responsabilidadesLoaded,
    }),
    [
      responsabilidadesPatrimonios,
      setResponsabilidadesPatrimonios,
      encerrarResponsabilidade,
      encerrarResponsabilidadesDoColaborador,
      getResponsabilidadeAtiva,
      responsabilidadesLoaded,
    ],
  );

  return (
    <ResponsabilidadesStateContext.Provider value={value}>
      {children}
    </ResponsabilidadesStateContext.Provider>
  );
};

export const useResponsabilidadesStateContext =
  (): ResponsabilidadesStateContextType => {
    return useRequiredContext(ResponsabilidadesStateContext);
  };
