import { useCallback, useRef } from "react";

/**
 * ARC-002/ARC-004 · Onda 6 — plumbing de refs isolado do AppProvider.
 * Mantém uma ref sempre sincronizada com o valor mais recente e devolve um getter estável
 * (identidade preservada entre renders), ideal para consumidores como useMobilizacoes que
 * precisam de leitura síncrona sem invalidar dependências.
 */
export function useStableGetter<T>(value: T): () => T {
  const ref = useRef<T>(value);
  ref.current = value;
  return useCallback(() => ref.current, []);
}
