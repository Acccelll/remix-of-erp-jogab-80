/**
 * Lembra o último recorte de filtros de uma página no `localStorage`.
 *
 * Regras:
 *  - A URL tem prioridade: se o link já traz qualquer uma das chaves observadas,
 *    nada é restaurado (o link compartilhado manda).
 *  - Sem nenhuma dessas chaves na URL, o último recorte salvo é reaplicado
 *    (com `replace`, para não poluir o histórico).
 *  - Toda mudança dos params observados regrava o recorte.
 */
import { useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";

export function useFiltrosPersistidos(storageKey: string, chaves: readonly string[]) {
  const [params, setParams] = useSearchParams();
  const restaurado = useRef(false);
  const setParamsRef = useRef(setParams);
  setParamsRef.current = setParams;

  // Restauração — só no primeiro render da página.
  useEffect(() => {
    if (restaurado.current) return;
    restaurado.current = true;
    const temNaUrl = chaves.some((k) => params.get(k) !== null);
    if (temNaUrl) return;
    let salvo: Record<string, string> | null = null;
    try {
      const raw = localStorage.getItem(storageKey);
      salvo = raw ? (JSON.parse(raw) as Record<string, string>) : null;
    } catch {
      salvo = null;
    }
    if (!salvo || Object.keys(salvo).length === 0) return;
    const np = new URLSearchParams(params);
    for (const k of chaves) {
      const v = salvo[k];
      if (v) np.set(k, v);
    }
    if (np.toString() !== params.toString()) setParamsRef.current(np, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Gravação — sempre que os params observados mudarem.
  useEffect(() => {
    if (!restaurado.current) return;
    const atual: Record<string, string> = {};
    for (const k of chaves) {
      const v = params.get(k);
      if (v) atual[k] = v;
    }
    try {
      if (Object.keys(atual).length === 0) localStorage.removeItem(storageKey);
      else localStorage.setItem(storageKey, JSON.stringify(atual));
    } catch {
      /* quota/modo privado — filtro persistido é conveniência, não requisito */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params, storageKey]);
}

/** Apaga o recorte salvo — usar junto do botão "Limpar filtros". */
export function limparFiltrosPersistidos(storageKey: string) {
  try {
    localStorage.removeItem(storageKey);
  } catch {
    /* noop */
  }
}
