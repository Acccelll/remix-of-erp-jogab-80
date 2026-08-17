// PRO-019 · slice-05 — Silenciar alerta de contrato por (contratoId, tipo)
// até uma data ISO. Persiste em localStorage e permite filtrar alertas ativos.
import { useCallback, useEffect, useState } from "react";
import { STORAGE_KEYS } from "@/lib/core/storage/keys";
import type { ContratoAlerta } from "@/hooks/contratos/useContratosVencendo";

export type SilenciadosMap = Record<string, string>; // `${contratoId}:${tipo}` -> ISO

function chave(contratoId: string, tipo: ContratoAlerta["tipo"]) {
  return `${contratoId}:${tipo}`;
}

function ler(): SilenciadosMap {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.contratosAlertaSilenciados);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as SilenciadosMap;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function gravar(m: SilenciadosMap) {
  try {
    localStorage.setItem(STORAGE_KEYS.contratosAlertaSilenciados, JSON.stringify(m));
  } catch {
    /* quota/privado — silencia */
  }
}

export function useContratoAlertaSilencio() {
  const [mapa, setMapa] = useState<SilenciadosMap>(() => ler());

  // Reage a mudanças em outras abas
  useEffect(() => {
    const h = (e: StorageEvent) => {
      if (e.key === STORAGE_KEYS.contratosAlertaSilenciados) setMapa(ler());
    };
    window.addEventListener("storage", h);
    return () => window.removeEventListener("storage", h);
  }, []);

  const silenciarAte = useCallback(
    (contratoId: string, tipo: ContratoAlerta["tipo"], ateISO: string) => {
      setMapa((prev) => {
        const next = { ...prev, [chave(contratoId, tipo)]: ateISO };
        gravar(next);
        return next;
      });
    },
    [],
  );

  const reativar = useCallback((contratoId: string, tipo: ContratoAlerta["tipo"]) => {
    setMapa((prev) => {
      const next = { ...prev };
      delete next[chave(contratoId, tipo)];
      gravar(next);
      return next;
    });
  }, []);

  const estaSilenciado = useCallback(
    (contratoId: string, tipo: ContratoAlerta["tipo"], hoje = new Date()) => {
      const ate = mapa[chave(contratoId, tipo)];
      if (!ate) return false;
      const dt = new Date(ate);
      if (Number.isNaN(dt.getTime())) return false;
      return dt.getTime() >= new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate()).getTime();
    },
    [mapa],
  );

  const filtrar = useCallback(
    (alertas: ContratoAlerta[], hoje = new Date()) =>
      alertas.filter((a) => !estaSilenciado(a.contrato.id, a.tipo, hoje)),
    [estaSilenciado],
  );

  return { mapa, silenciarAte, reativar, estaSilenciado, filtrar };
}
