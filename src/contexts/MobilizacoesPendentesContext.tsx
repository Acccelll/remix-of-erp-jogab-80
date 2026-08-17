import React, { useMemo } from "react";
import { createRequiredContext, useRequiredContext } from "@/contexts/createRequiredContext";
import { useApp, type AppContextType } from "@/contexts/AppContext";

/**
 * ARC-002.slice-10 · Onda 6 — subcontexto de Mobilizações Pendentes (cross-domínio).
 * Camada de compatibilidade populada a partir de `useApp()`. Consumers migram
 * incrementalmente em slices posteriores. Estado real segue em
 * `useMobilizacoes` por ora.
 */
export interface MobilizacoesPendentesContextType {
  mobilizarColaborador: AppContextType["mobilizarColaborador"];
  cancelarMobilizacaoColaborador: AppContextType["cancelarMobilizacaoColaborador"];
  mobilizarPatrimonio: AppContextType["mobilizarPatrimonio"];
  cancelarMobilizacaoPatrimonio: AppContextType["cancelarMobilizacaoPatrimonio"];
  mobilizarVeiculo: AppContextType["mobilizarVeiculo"];
  mobilizarContrato: AppContextType["mobilizarContrato"];
}

const MobilizacoesPendentesContext = createRequiredContext<MobilizacoesPendentesContextType>({
  hook: "useMobilizacoesPendentesContext",
  provider: "MobilizacoesPendentesProvider",
  file: "src/contexts/MobilizacoesPendentesContext.tsx",
});

export const MobilizacoesPendentesProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const {
    mobilizarColaborador,
    cancelarMobilizacaoColaborador,
    mobilizarPatrimonio,
    cancelarMobilizacaoPatrimonio,
    mobilizarVeiculo,
    mobilizarContrato,
  } = useApp();

  const value = useMemo<MobilizacoesPendentesContextType>(
    () => ({
      mobilizarColaborador,
      cancelarMobilizacaoColaborador,
      mobilizarPatrimonio,
      cancelarMobilizacaoPatrimonio,
      mobilizarVeiculo,
      mobilizarContrato,
    }),
    [
      mobilizarColaborador,
      cancelarMobilizacaoColaborador,
      mobilizarPatrimonio,
      cancelarMobilizacaoPatrimonio,
      mobilizarVeiculo,
      mobilizarContrato,
    ],
  );

  return (
    <MobilizacoesPendentesContext.Provider value={value}>
      {children}
    </MobilizacoesPendentesContext.Provider>
  );
};

export const useMobilizacoesPendentesContext = (): MobilizacoesPendentesContextType => {
  return useRequiredContext(MobilizacoesPendentesContext);
};
