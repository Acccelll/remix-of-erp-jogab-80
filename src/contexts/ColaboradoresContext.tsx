import React, { useMemo } from "react";
import { createRequiredContext, useRequiredContext } from "@/contexts/createRequiredContext";
import type { Colaborador } from "@/types";
import { useApp, type AppContextType } from "@/contexts/AppContext";

/**
 * ARC-002.slice-01 · Onda 6 — subcontexto de Colaboradores.
 * Camada de compatibilidade: por ora é populado a partir de `useApp()`,
 * permitindo migração incremental de consumers sem quebrar a API pública.
 * Passos futuros moverão o estado real para cá e o AppProvider passará a
 * consumir este subcontexto internamente.
 */
export interface ColaboradoresContextType {
  colaboradores: Colaborador[];
  addColaborador: AppContextType["addColaborador"];
  updateColaborador: AppContextType["updateColaborador"];
  deleteColaborador: AppContextType["deleteColaborador"];
  mobilizarColaborador: AppContextType["mobilizarColaborador"];
  cancelarMobilizacaoColaborador: AppContextType["cancelarMobilizacaoColaborador"];
}

const ColaboradoresContext = createRequiredContext<ColaboradoresContextType>({
  hook: "useColaboradoresContext",
  provider: "ColaboradoresProvider",
  file: "src/contexts/ColaboradoresContext.tsx",
});

export const ColaboradoresProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const {
    colaboradores,
    addColaborador,
    updateColaborador,
    deleteColaborador,
    mobilizarColaborador,
    cancelarMobilizacaoColaborador,
  } = useApp();

  const value = useMemo<ColaboradoresContextType>(
    () => ({
      colaboradores,
      addColaborador,
      updateColaborador,
      deleteColaborador,
      mobilizarColaborador,
      cancelarMobilizacaoColaborador,
    }),
    [
      colaboradores,
      addColaborador,
      updateColaborador,
      deleteColaborador,
      mobilizarColaborador,
      cancelarMobilizacaoColaborador,
    ],
  );

  return <ColaboradoresContext.Provider value={value}>{children}</ColaboradoresContext.Provider>;
};

export const useColaboradoresContext = (): ColaboradoresContextType => {
  return useRequiredContext(ColaboradoresContext);
};
