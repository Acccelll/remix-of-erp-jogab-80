import React, { useMemo } from "react";
import { createRequiredContext, useRequiredContext } from "@/contexts/createRequiredContext";
import { useColaboradoresStateContext } from "@/contexts/colaboradores/ColaboradoresStateContext";
import { useFuncoesContext } from "@/contexts/FuncoesContext";
import { useExpiringDocuments, type ExpiringDoc } from "@/contexts/app/useExpiringDocuments";

/**
 * ARC-002.slice-25 · Onda 6 — subcontexto de Documentos/Vencimentos.
 * O cálculo real foi domiciliado aqui, usando os subcontextos de Colaboradores
 * e Funções/Tipos de Documento como fontes, sem repasse pelo AppContext.
 */
export interface DocumentosContextType {
  getExpiringDocuments: () => ExpiringDoc[];
  getAllExpiringDocuments: () => ExpiringDoc[];
}

const DocumentosContext = createRequiredContext<DocumentosContextType>({
  hook: "useDocumentosContext",
  provider: "DocumentosProvider",
  file: "src/contexts/DocumentosContext.tsx",
});

export const DocumentosProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { colaboradores } = useColaboradoresStateContext();
  const { documentosTipo } = useFuncoesContext();
  const { getExpiringDocuments, getAllExpiringDocuments } = useExpiringDocuments({
    colaboradores,
    documentosTipo,
  });

  const value = useMemo<DocumentosContextType>(
    () => ({ getExpiringDocuments, getAllExpiringDocuments }),
    [getExpiringDocuments, getAllExpiringDocuments],
  );

  return <DocumentosContext.Provider value={value}>{children}</DocumentosContext.Provider>;
};

export const useDocumentosContext = (): DocumentosContextType => {
  return useRequiredContext(DocumentosContext);
};