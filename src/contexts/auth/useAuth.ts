// ARC-002 · Onda 6 — Fachada estável de autenticação.
// slice-28: `currentPlayer` lido direto do `AuthProvider`.
// slice-29: `login`/`logout` lidos direto do `AuthMethodsProvider`.
// `useApp()` não é mais necessário aqui.

import { useCallback, useMemo } from "react";
import { useAuthState } from "@/contexts/auth/AuthContext";
import { useAuthMethods } from "@/contexts/auth/AuthMethodsContext";
import type { Player } from "@/types";

export interface AuthState {
  currentPlayer: Player | null;
  isAuthenticated: boolean;
  isGM: boolean;
  login: (loginName: string, senha: string) => Promise<boolean>;
  logout: () => void;
  /** "Visualizar como usuário" (GM): player previewado, ou null. */
  previewPlayer: Player | null;
  isPreviewing: boolean;
  /** Inicia o preview (só se o usuário real for GM). */
  startPreview: (player: Player) => void;
  /** Encerra o preview e volta à visão real. */
  stopPreview: () => void;
}

export function useAuth(): AuthState {
  const { currentPlayer, previewPlayer, setPreviewPlayer } = useAuthState();
  const { login, logout } = useAuthMethods();
  const realIsGM = !!currentPlayer?.isGM;

  const startPreview = useCallback(
    (player: Player) => {
      // Somente o GM real pode visualizar como outro usuário.
      if (!realIsGM) return;
      setPreviewPlayer(player);
    },
    [realIsGM, setPreviewPlayer],
  );
  const stopPreview = useCallback(() => setPreviewPlayer(null), [setPreviewPlayer]);

  return useMemo(
    () => ({
      currentPlayer,
      isAuthenticated: !!currentPlayer,
      isGM: realIsGM,
      login,
      logout,
      previewPlayer,
      isPreviewing: !!previewPlayer,
      startPreview,
      stopPreview,
    }),
    [currentPlayer, realIsGM, login, logout, previewPlayer, startPreview, stopPreview],
  );
}
