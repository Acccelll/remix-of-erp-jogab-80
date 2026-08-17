// ARC-002.slice-28 · Onda 6 — Domicílio real do `currentPlayer` fora do AppContext.
// AppProvider passa a ler/escrever o `currentPlayer` via este contexto (bridge),
// e `useAuth()` lê o estado diretamente daqui — sem mais depender de `useApp()`
// para o campo. `login`/`logout` continuam expostos pelo AppContext nesta fatia
// (dependem de `players`/`dataLoaded`) e serão migrados em fatia posterior.

import React, { useMemo, useState } from "react";
import { createRequiredContext, useRequiredContext } from "@/contexts/createRequiredContext";
import { loadLocal } from "@/contexts/app/helpers";
import { migratePlayers } from "@/contexts/app/helpers";
import type { Player } from "@/types";

export interface AuthStateContextValue {
  currentPlayer: Player | null;
  setCurrentPlayer: React.Dispatch<React.SetStateAction<Player | null>>;
  /**
   * "Visualizar como usuário" (GM): quando definido, o `usePermissions` resolve
   * as permissões contra este player em vez do `currentPlayer`, sem tocar na
   * identidade real (escrita/auth seguem via `useAuth()`). Estado efêmero —
   * não persistido, some no refresh.
   */
  previewPlayer: Player | null;
  setPreviewPlayer: React.Dispatch<React.SetStateAction<Player | null>>;
}

const AuthStateContext = createRequiredContext<AuthStateContextValue>({
  hook: "useAuthState",
  provider: "AuthProvider",
  file: "src/contexts/auth/AuthContext.tsx",
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentPlayer, setCurrentPlayer] = useState<Player | null>(() => {
    const p = loadLocal<Player | null>("go_player", null);
    return p ? migratePlayers([p])[0] : null;
  });
  const [previewPlayer, setPreviewPlayer] = useState<Player | null>(null);
  const value = useMemo(
    () => ({ currentPlayer, setCurrentPlayer, previewPlayer, setPreviewPlayer }),
    [currentPlayer, previewPlayer],
  );
  return <AuthStateContext.Provider value={value}>{children}</AuthStateContext.Provider>;
};

export function useAuthState(): AuthStateContextValue {
  return useRequiredContext(AuthStateContext);
}
