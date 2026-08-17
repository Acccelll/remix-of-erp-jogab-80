import React, { useMemo } from "react";
import { createRequiredContext, useRequiredContext } from "@/contexts/createRequiredContext";
import type { Patrimonio, ResponsabilidadePeriodo } from "@/types";
import { useApp, type AppContextType } from "@/contexts/AppContext";

/**
 * ARC-002.slice-02 · Onda 6 — subcontexto de Patrimônios.
 * Camada de compatibilidade: por ora é populado a partir de `useApp()`,
 * permitindo migração incremental de consumers sem alterar comportamento.
 */
export interface PatrimoniosContextType {
  patrimonios: Patrimonio[];
  addPatrimonio: AppContextType["addPatrimonio"];
  updatePatrimonio: AppContextType["updatePatrimonio"];
  deletePatrimonio: AppContextType["deletePatrimonio"];
  mobilizarPatrimonio: AppContextType["mobilizarPatrimonio"];
  cancelarMobilizacaoPatrimonio: AppContextType["cancelarMobilizacaoPatrimonio"];
  responsabilidadesPatrimonios: ResponsabilidadePeriodo[];
  encerrarResponsabilidade: AppContextType["encerrarResponsabilidade"];
  encerrarResponsabilidadesDoColaborador: ReturnType<
    typeof useApp
  >["encerrarResponsabilidadesDoColaborador"];
  getResponsabilidadeAtiva: AppContextType["getResponsabilidadeAtiva"];
}

const PatrimoniosContext = createRequiredContext<PatrimoniosContextType>({
  hook: "usePatrimoniosContext",
  provider: "PatrimoniosProvider",
  file: "src/contexts/PatrimoniosContext.tsx",
});

export const PatrimoniosProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const {
    patrimonios,
    addPatrimonio,
    updatePatrimonio,
    deletePatrimonio,
    mobilizarPatrimonio,
    cancelarMobilizacaoPatrimonio,
    responsabilidadesPatrimonios,
    encerrarResponsabilidade,
    encerrarResponsabilidadesDoColaborador,
    getResponsabilidadeAtiva,
  } = useApp();

  const value = useMemo<PatrimoniosContextType>(
    () => ({
      patrimonios,
      addPatrimonio,
      updatePatrimonio,
      deletePatrimonio,
      mobilizarPatrimonio,
      cancelarMobilizacaoPatrimonio,
      responsabilidadesPatrimonios,
      encerrarResponsabilidade,
      encerrarResponsabilidadesDoColaborador,
      getResponsabilidadeAtiva,
    }),
    [
      patrimonios,
      addPatrimonio,
      updatePatrimonio,
      deletePatrimonio,
      mobilizarPatrimonio,
      cancelarMobilizacaoPatrimonio,
      responsabilidadesPatrimonios,
      encerrarResponsabilidade,
      encerrarResponsabilidadesDoColaborador,
      getResponsabilidadeAtiva,
    ],
  );

  return <PatrimoniosContext.Provider value={value}>{children}</PatrimoniosContext.Provider>;
};

export const usePatrimoniosContext = (): PatrimoniosContextType => {
  return useRequiredContext(PatrimoniosContext);
};