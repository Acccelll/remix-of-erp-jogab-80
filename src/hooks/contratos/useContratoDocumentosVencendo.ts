// PRO-021 · slice-04 — Documentos de contratos a vencer, agregando todos os
// registros persistidos localmente. Usa o mesmo storage do `useContratoDocumentos`.
import { useEffect, useMemo, useState } from "react";
import { STORAGE_KEYS } from "@/lib/core/storage/keys";
import {
  documentosContratoVencendo,
  type ContratoDocumento,
  type DocumentoVencendo,
} from "@/lib/contratos/documentos";

function lerTodos(): ContratoDocumento[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEYS.contratoDocumentos);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function useContratoDocumentosVencendo(dias = 30, enabled = true): DocumentoVencendo[] {
  const [todos, setTodos] = useState<ContratoDocumento[]>(() => (enabled ? lerTodos() : []));

  useEffect(() => {
    if (!enabled) {
      setTodos([]);
      return;
    }
    setTodos(lerTodos());
    const h = (e: StorageEvent) => {
      if (e.key === STORAGE_KEYS.contratoDocumentos) setTodos(lerTodos());
    };
    window.addEventListener("storage", h);
    return () => window.removeEventListener("storage", h);
  }, [enabled]);

  return useMemo(
    () => (enabled ? documentosContratoVencendo(todos, dias) : []),
    [todos, dias, enabled],
  );
}
