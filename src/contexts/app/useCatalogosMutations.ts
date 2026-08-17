import { useCallback } from "react";
import type { DocumentoTipo, Funcao } from "@/types";
import { useSaveFuncao } from "@/hooks/rh/useFuncoes";
import {
  useDeleteDocumentoTipo,
  useSaveDocumentoTipo,
} from "@/hooks/rh/useDocumentoTipos";

/**
 * ARC-002/ARC-004 · Onda 6 — Concentra as mutações CRUD de catálogos
 * (`funcoes`, `documentosTipo`) usadas pelo `AppContext`, encapsulando
 * as chamadas de `mutate` em callbacks estáveis. Reduz o `AppProvider`
 * à orquestração de estado.
 */
export function useCatalogosMutations() {
  const saveFuncao = useSaveFuncao();
  const saveDocumentoTipo = useSaveDocumentoTipo();
  const removeDocumentoTipo = useDeleteDocumentoTipo();

  const addFuncao = useCallback(
    (f: Omit<Funcao, "id">) => {
      saveFuncao.mutate({ payload: f });
    },
    [saveFuncao],
  );
  const updateFuncao = useCallback(
    (id: string, d: Partial<Funcao>) => {
      saveFuncao.mutate({ id, payload: d });
    },
    [saveFuncao],
  );
  const addDocumentoTipo = useCallback(
    (d: Omit<DocumentoTipo, "id">) => {
      saveDocumentoTipo.mutate({ payload: d });
    },
    [saveDocumentoTipo],
  );
  const updateDocumentoTipo = useCallback(
    (id: string, d: Partial<DocumentoTipo>) => {
      saveDocumentoTipo.mutate({ id, payload: d });
    },
    [saveDocumentoTipo],
  );
  const deleteDocumentoTipo = useCallback(
    (id: string) => {
      removeDocumentoTipo.mutate(id);
    },
    [removeDocumentoTipo],
  );

  return {
    addFuncao,
    updateFuncao,
    addDocumentoTipo,
    updateDocumentoTipo,
    deleteDocumentoTipo,
  };
}
