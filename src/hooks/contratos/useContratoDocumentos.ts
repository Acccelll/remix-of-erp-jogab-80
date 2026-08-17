import { useCallback, useEffect, useMemo, useState } from "react";
import { STORAGE_KEYS } from "@/lib/core/storage/keys";
import {
  criarRegistroDocumento,
  documentosDoContrato,
  type ContratoDocumento,
  type NovoContratoDocumentoInput,
  type StatusAssinaturaContrato,
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

function salvarTodos(documentos: ContratoDocumento[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEYS.contratoDocumentos, JSON.stringify(documentos));
}

export function useContratoDocumentos(contratoId: string | null) {
  const [todos, setTodos] = useState<ContratoDocumento[]>(() => lerTodos());

  useEffect(() => {
    setTodos(lerTodos());
  }, [contratoId]);

  const documentos = useMemo(
    () => (contratoId ? documentosDoContrato(todos, contratoId) : []),
    [todos, contratoId],
  );

  const persistir = useCallback((next: ContratoDocumento[]) => {
    setTodos(next);
    salvarTodos(next);
  }, []);

  const adicionarDocumento = useCallback(
    (input: NovoContratoDocumentoInput) => {
      const novo = criarRegistroDocumento(todos, input);
      persistir([...todos, novo]);
      return novo;
    },
    [persistir, todos],
  );

  const atualizarStatus = useCallback(
    (documentoId: string, statusAssinatura: StatusAssinaturaContrato) => {
      persistir(todos.map((d) => (d.id === documentoId ? { ...d, statusAssinatura } : d)));
    },
    [persistir, todos],
  );

  const removerDocumento = useCallback(
    (documentoId: string) => {
      persistir(todos.filter((d) => d.id !== documentoId));
    },
    [persistir, todos],
  );

  const atualizarValidade = useCallback(
    (documentoId: string, validoAte: string | undefined) => {
      persistir(
        todos.map((d) =>
          d.id === documentoId
            ? { ...d, validoAte: validoAte && validoAte.length > 0 ? validoAte : undefined }
            : d,
        ),
      );
    },
    [persistir, todos],
  );

  return { documentos, adicionarDocumento, atualizarStatus, atualizarValidade, removerDocumento };
}
