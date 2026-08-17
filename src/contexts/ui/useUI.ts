// ARC-002 · Onda 6 — Fachada estável para estado de UI global (sidebar).
// slice-27: passa a ler direto do `UIProvider` (estado domiciliado fora do AppContext).

import { useUIContext } from "@/contexts/ui/UIContext";

export interface UIState {
  sidebarOpen: boolean;
  setSidebarOpen: (v: boolean) => void;
}

export function useUI(): UIState {
  return useUIContext();
}
