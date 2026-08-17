// ARC-002.slice-29 · Onda 6 — `login`/`logout` domiciliados fora do AppContext.
//
// `useAuthSession` continua sendo a implementação canônica de login/logout
// (mantém acoplamento com `players`/`dataLoaded` do AppContext), mas agora é
// hospedado aqui, dentro de um `AuthMethodsProvider` que fica montado
// imediatamente abaixo do `AppProvider`. O `AppProvider` deixa de expor
// `login`/`logout` no seu value; `useAuth()` consome os métodos daqui.

import React, { useMemo } from "react";
import { createRequiredContext, useRequiredContext } from "@/contexts/createRequiredContext";
import { useApp } from "@/contexts/AppContext";
import { useAuthState } from "@/contexts/auth/AuthContext";
import { useAuthSession } from "@/contexts/app/useAuthSession";

export interface AuthMethodsContextValue {
  login: (loginName: string, senha: string) => Promise<boolean>;
  logout: () => void;
}

const AuthMethodsContext = createRequiredContext<AuthMethodsContextValue>({
  hook: "useAuthMethods",
  provider: "AuthMethodsProvider",
  file: "src/contexts/auth/AuthMethodsContext.tsx",
});

export const AuthMethodsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentPlayer, setCurrentPlayer } = useAuthState();
  const { players, dataLoaded } = useApp();
  const { login, logout } = useAuthSession({
    currentPlayer,
    setCurrentPlayer,
    players,
    dataLoaded,
  });
  const value = useMemo<AuthMethodsContextValue>(() => ({ login, logout }), [login, logout]);
  return <AuthMethodsContext.Provider value={value}>{children}</AuthMethodsContext.Provider>;
};

export function useAuthMethods(): AuthMethodsContextValue {
  return useRequiredContext(AuthMethodsContext);
}
