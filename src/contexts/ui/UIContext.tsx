// ARC-002.slice-27 · Onda 6 — Domicílio real do estado de UI (sidebar).
// Antes: `sidebarOpen`/`setSidebarOpen` viviam no God-context `AppContext` e
// eram apenas repassados por `useUI()`. Agora o estado é hospedado neste
// provider e `useUI()` lê diretamente daqui, sem depender de `useApp()`.

import React, { useMemo, useState } from "react";
import { createRequiredContext, useRequiredContext } from "@/contexts/createRequiredContext";

export interface UIContextValue {
  sidebarOpen: boolean;
  setSidebarOpen: (v: boolean) => void;
}

const UIContext = createRequiredContext<UIContextValue>({
  hook: "useUIContext",
  provider: "UIProvider",
  file: "src/contexts/ui/UIContext.tsx",
});

export const UIProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const value = useMemo(() => ({ sidebarOpen, setSidebarOpen }), [sidebarOpen]);
  return <UIContext.Provider value={value}>{children}</UIContext.Provider>;
};

export function useUIContext(): UIContextValue {
  return useRequiredContext(UIContext);
}
