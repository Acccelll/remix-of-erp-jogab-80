import { useMemo, useState } from "react";
import { STORAGE_KEYS } from "@/lib/core/storage/keys";
import { normalizarRegrasAutomacaoDesativadas } from "@/lib/cards/automacoesQuadro";

function lerRegrasDesativadas(): string[] {
  if (typeof window === "undefined") return [];
  try {
    return normalizarRegrasAutomacaoDesativadas(
      JSON.parse(window.localStorage.getItem(STORAGE_KEYS.quadroAutomacoesDesativadas) ?? "[]"),
    );
  } catch {
    return [];
  }
}

function salvarRegrasDesativadas(ids: string[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(
    STORAGE_KEYS.quadroAutomacoesDesativadas,
    JSON.stringify(normalizarRegrasAutomacaoDesativadas(ids)),
  );
}

/** PRO-027.slice-02 — preferências locais para ativar/desativar regras nativas. */
export function useQuadroAutomacoesConfig() {
  const [desativadas, setDesativadas] = useState<string[]>(() => lerRegrasDesativadas());

  const regrasDesativadas = useMemo(() => new Set(desativadas), [desativadas]);

  function setRegraAtiva(regraId: string, ativa: boolean) {
    setDesativadas((prev) => {
      const next = new Set(prev);
      if (ativa) next.delete(regraId);
      else next.add(regraId);
      const normalized = normalizarRegrasAutomacaoDesativadas(Array.from(next));
      salvarRegrasDesativadas(normalized);
      return normalized;
    });
  }

  return {
    regrasDesativadas,
    setRegraAtiva,
  };
}