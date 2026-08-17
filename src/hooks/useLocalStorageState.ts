/**
 * `useState` que sobrevive ao recarregamento — para filtros que não vivem na URL.
 * Falhas de storage (modo privado, quota) degradam para estado em memória.
 */
import { useCallback, useEffect, useRef, useState } from "react";

export function useLocalStorageState<T>(key: string, inicial: T) {
  const [valor, setValor] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key);
      return raw ? (JSON.parse(raw) as T) : inicial;
    } catch {
      return inicial;
    }
  });

  const keyRef = useRef(key);
  keyRef.current = key;

  useEffect(() => {
    try {
      localStorage.setItem(keyRef.current, JSON.stringify(valor));
    } catch {
      /* noop */
    }
  }, [valor]);

  const limpar = useCallback(() => {
    try {
      localStorage.removeItem(keyRef.current);
    } catch {
      /* noop */
    }
    setValor(inicial);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return [valor, setValor, limpar] as const;
}
