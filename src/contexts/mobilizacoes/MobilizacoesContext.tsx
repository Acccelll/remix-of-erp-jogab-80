import React, { useCallback, useMemo, useRef } from "react";
import { createRequiredContext, useRequiredContext } from "@/contexts/createRequiredContext";
import type { DecisoesVeiculos, Player } from "@/types";
import { useAuthState } from "@/contexts/auth/AuthContext";
import { useObrasContext } from "@/contexts/ObrasContext";
import { useColaboradoresStateContext } from "@/contexts/colaboradores/ColaboradoresStateContext";
import { usePatrimoniosStateContext } from "@/contexts/patrimonios/PatrimoniosStateContext";
import { useVeiculosStateContext } from "@/contexts/veiculos/VeiculosStateContext";
import { useContratosStateContext } from "@/contexts/contratos/ContratosStateContext";
import { useResponsabilidadesStateContext } from "@/contexts/responsabilidades/ResponsabilidadesStateContext";
import { useMobilizacoes } from "@/contexts/app/useMobilizacoes";
import { useColumnName } from "@/contexts/app/useColumnName";
import { useStableGetter } from "@/contexts/app/useStableGetter";

/**
 * ARC-002.slice-40 · Onda 6 — Provider dedicado das mobilizações.
 * Encerra ARC-002 removendo do `AppProvider` a última responsabilidade de
 * orquestração (auto-move + mobilizar/cancelar). Consome os providers de
 * domínio via bridge e expõe as operações via `useMobilizacoesContext()`.
 */
export interface MobilizacoesContextType {
  mobilizarColaborador: (
    colabId: string,
    obraDestinoId: string | null,
    dia: number,
    mes: number,
    ano: number,
    moverVeiculos?: boolean,
    decisoesVeiculos?: DecisoesVeiculos,
  ) => Promise<void>;
  cancelarMobilizacaoColaborador: (colabId: string) => Promise<void>;
  mobilizarPatrimonio: (
    patId: string,
    obraDestinoId: string | null,
    dia: number,
    mes: number,
    ano: number,
  ) => Promise<void>;
  cancelarMobilizacaoPatrimonio: (patId: string) => Promise<void>;
  mobilizarVeiculo: (
    vId: string,
    obraDestinoId: string | null,
    dia: number,
    mes: number,
    ano: number,
  ) => Promise<void>;
  mobilizarContrato: (
    cId: string,
    obraDestinoId: string | null,
    dia: number,
    mes: number,
    ano: number,
  ) => Promise<void>;
}

const MobilizacoesContext = createRequiredContext<MobilizacoesContextType>({
  hook: "useMobilizacoesContext",
  provider: "MobilizacoesProvider",
  file: "src/contexts/mobilizacoes/MobilizacoesContext.tsx",
});

export const MobilizacoesProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { currentPlayer } = useAuthState();
  const { obras } = useObrasContext();
  const {
    colaboradores,
    setColaboradores,
    colaboradoresLoaded,
    getColaboradores: getColaboradoresStable,
  } = useColaboradoresStateContext();
  const {
    setPatrimonios,
    patrimoniosLoaded,
    getPatrimonios: getPatrimoniosStable,
  } = usePatrimoniosStateContext();
  const {
    setVeiculos,
    veiculosLoaded,
    updateVeiculo,
    getVeiculos: getVeiculosStable,
  } = useVeiculosStateContext();
  const {
    setContratos,
    contratosLoaded,
    getContratos: getContratosStable,
  } = useContratosStateContext();
  const {
    responsabilidadesPatrimonios,
    setResponsabilidadesPatrimonios,
    responsabilidadesLoaded,
  } = useResponsabilidadesStateContext();

  const currentPlayerRef = useRef<Player | null>(currentPlayer);
  currentPlayerRef.current = currentPlayer;
  const getCurrentPlayer = useCallback(() => currentPlayerRef.current, []);

  const getObrasStable = useStableGetter(obras);
  const getResponsabilidadesStable = useStableGetter(responsabilidadesPatrimonios);
  const getColumnName = useColumnName({ obras, colaboradores });

  // Gate do auto-move: precisa dos domínios envolvidos carregados.
  const dataLoaded =
    colaboradoresLoaded &&
    patrimoniosLoaded &&
    veiculosLoaded &&
    contratosLoaded &&
    responsabilidadesLoaded;

  const ops = useMobilizacoes({
    dataLoaded,
    getObras: getObrasStable,
    getCurrentPlayer,
    getColumnName,
    getColaboradores: getColaboradoresStable,
    getPatrimonios: getPatrimoniosStable,
    getVeiculos: getVeiculosStable,
    getContratos: getContratosStable,
    getResponsabilidades: getResponsabilidadesStable,
    updateVeiculo,
    setColaboradores,
    setPatrimonios,
    setVeiculos,
    setContratos,
    setResponsabilidadesPatrimonios,
  });

  const value = useMemo<MobilizacoesContextType>(
    () => ({
      mobilizarColaborador: ops.mobilizarColaborador,
      cancelarMobilizacaoColaborador: ops.cancelarMobilizacaoColaborador,
      mobilizarPatrimonio: ops.mobilizarPatrimonio,
      cancelarMobilizacaoPatrimonio: ops.cancelarMobilizacaoPatrimonio,
      mobilizarVeiculo: ops.mobilizarVeiculo,
      mobilizarContrato: ops.mobilizarContrato,
    }),
    [
      ops.mobilizarColaborador,
      ops.cancelarMobilizacaoColaborador,
      ops.mobilizarPatrimonio,
      ops.cancelarMobilizacaoPatrimonio,
      ops.mobilizarVeiculo,
      ops.mobilizarContrato,
    ],
  );

  return (
    <MobilizacoesContext.Provider value={value}>
      {children}
    </MobilizacoesContext.Provider>
  );
};

export const useMobilizacoesContext = (): MobilizacoesContextType => {
  return useRequiredContext(MobilizacoesContext);
};
