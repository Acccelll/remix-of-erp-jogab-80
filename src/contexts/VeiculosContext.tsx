import React, { useMemo } from "react";
import { createRequiredContext, useRequiredContext } from "@/contexts/createRequiredContext";
import type { Veiculo } from "@/types";
import { useApp, type AppContextType } from "@/contexts/AppContext";

/**
 * ARC-002.slice-03 · Onda 6 — subcontexto de Veículos.
 * Camada de compatibilidade: por ora é populado a partir de `useApp()`,
 * permitindo migração incremental de consumers sem alterar comportamento.
 * Passos futuros moverão o estado real para cá e o AppProvider passará a
 * consumir este subcontexto internamente.
 */
export interface VeiculosContextType {
  veiculos: Veiculo[];
  addVeiculo: AppContextType["addVeiculo"];
  updateVeiculo: AppContextType["updateVeiculo"];
  deleteVeiculo: AppContextType["deleteVeiculo"];
  mobilizarVeiculo: AppContextType["mobilizarVeiculo"];
}

const VeiculosContext = createRequiredContext<VeiculosContextType>({
  hook: "useVeiculosContext",
  provider: "VeiculosProvider",
  file: "src/contexts/VeiculosContext.tsx",
});

export const VeiculosProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { veiculos, addVeiculo, updateVeiculo, deleteVeiculo, mobilizarVeiculo } = useApp();

  const value = useMemo<VeiculosContextType>(
    () => ({ veiculos, addVeiculo, updateVeiculo, deleteVeiculo, mobilizarVeiculo }),
    [veiculos, addVeiculo, updateVeiculo, deleteVeiculo, mobilizarVeiculo],
  );

  return <VeiculosContext.Provider value={value}>{children}</VeiculosContext.Provider>;
};

export const useVeiculosContext = (): VeiculosContextType => {
  return useRequiredContext(VeiculosContext);
};
