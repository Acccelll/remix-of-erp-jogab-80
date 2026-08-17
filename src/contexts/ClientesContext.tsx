import React, { useMemo } from "react";
import { createRequiredContext, useRequiredContext } from "@/contexts/createRequiredContext";
import type { Cliente, FunilEstagio, Oportunidade } from "@/types";
import { useApp, type AppContextType } from "@/contexts/AppContext";

/**
 * ARC-002.slice-06 · Onda 6 — subcontexto de CRM (Clientes + Funil/Oportunidades).
 * Camada de compatibilidade populada a partir de `useApp()`. Consumers migram
 * incrementalmente; estado real segue no AppProvider por ora.
 *
 * slice-19: expande cobertura com `moverEstagio` e `converterOportunidade`
 * para permitir migração dos últimos consumers CRM.
 */
export interface ClientesContextType {
  clientes: Cliente[];
  addCliente: AppContextType["addCliente"];
  updateCliente: AppContextType["updateCliente"];
  deleteCliente: AppContextType["deleteCliente"];
  oportunidades: Oportunidade[];
  funilEstagios: FunilEstagio[];
  addOportunidade: AppContextType["addOportunidade"];
  updateOportunidade: AppContextType["updateOportunidade"];
  deleteOportunidade: AppContextType["deleteOportunidade"];
  moverEstagio: AppContextType["moverEstagio"];
  converterOportunidade: AppContextType["converterOportunidade"];
}

const ClientesContext = createRequiredContext<ClientesContextType>({
  hook: "useClientesContext",
  provider: "ClientesProvider",
  file: "src/contexts/ClientesContext.tsx",
});

export const ClientesProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const {
    clientes,
    addCliente,
    updateCliente,
    deleteCliente,
    oportunidades,
    funilEstagios,
    addOportunidade,
    updateOportunidade,
    deleteOportunidade,
    moverEstagio,
    converterOportunidade,
  } = useApp();

  const value = useMemo<ClientesContextType>(
    () => ({
      clientes,
      addCliente,
      updateCliente,
      deleteCliente,
      oportunidades,
      funilEstagios,
      addOportunidade,
      updateOportunidade,
      deleteOportunidade,
      moverEstagio,
      converterOportunidade,
    }),
    [
      clientes,
      addCliente,
      updateCliente,
      deleteCliente,
      oportunidades,
      funilEstagios,
      addOportunidade,
      updateOportunidade,
      deleteOportunidade,
      moverEstagio,
      converterOportunidade,
    ],
  );

  return <ClientesContext.Provider value={value}>{children}</ClientesContext.Provider>;
};

export const useClientesContext = (): ClientesContextType => {
  return useRequiredContext(ClientesContext);
};
