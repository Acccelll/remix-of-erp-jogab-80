import React, { useMemo } from "react";
import { createRequiredContext, useRequiredContext } from "@/contexts/createRequiredContext";
import type { Contrato } from "@/types";
import { useApp, type AppContextType } from "@/contexts/AppContext";

/**
 * ARC-002.slice-04 · Onda 6 — subcontexto de Contratos.
 * Camada de compatibilidade populada a partir de `useApp()`. Consumers
 * migram incrementalmente; estado real segue no AppProvider por ora.
 */
export interface ContratosContextType {
  contratos: Contrato[];
  addContrato: AppContextType["addContrato"];
  updateContrato: AppContextType["updateContrato"];
  deleteContrato: AppContextType["deleteContrato"];
  mobilizarContrato: AppContextType["mobilizarContrato"];
}

const ContratosContext = createRequiredContext<ContratosContextType>({
  hook: "useContratosContext",
  provider: "ContratosProvider",
  file: "src/contexts/ContratosContext.tsx",
});

export const ContratosProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { contratos, addContrato, updateContrato, deleteContrato, mobilizarContrato } = useApp();

  const value = useMemo<ContratosContextType>(
    () => ({ contratos, addContrato, updateContrato, deleteContrato, mobilizarContrato }),
    [contratos, addContrato, updateContrato, deleteContrato, mobilizarContrato],
  );

  return <ContratosContext.Provider value={value}>{children}</ContratosContext.Provider>;
};

export const useContratosContext = (): ContratosContextType => {
  return useRequiredContext(ContratosContext);
};
