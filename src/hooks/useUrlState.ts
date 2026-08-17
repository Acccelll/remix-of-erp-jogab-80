import { useCallback } from "react";
import { useSearchParams } from "react-router-dom";

/**
 * Sincroniza um estado simples (string) com a URL via `useSearchParams`.
 * - Lê o valor inicial dos params (ou usa o default).
 * - Ao setar, atualiza a URL preservando os outros params.
 * - Se o novo valor for igual ao default, remove o param da URL.
 */
export function useUrlState(key: string, defaultValue: string): [string, (next: string) => void] {
  const [params, setParams] = useSearchParams();
  const value = params.get(key) ?? defaultValue;
  const setValue = useCallback(
    (next: string) => {
      setParams(
        (prev) => {
          const np = new URLSearchParams(prev);
          if (!next || next === defaultValue) np.delete(key);
          else np.set(key, next);
          return np;
        },
        { replace: true },
      );
    },
    [key, defaultValue, setParams],
  );
  return [value, setValue];
}
