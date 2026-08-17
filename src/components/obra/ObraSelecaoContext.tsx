import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

export type ItemDrawerView = "resumo" | "recursos";

type Ctx = {
  selectedItemId: string | null;
  setSelectedItemId: (id: string | null) => void;
  drawerView: ItemDrawerView;
  setDrawerView: (v: ItemDrawerView) => void;
};

const ObraSelecaoContext = createContext<Ctx | null>(null);

export function ObraSelecaoProvider({ children }: { children: ReactNode }) {
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [drawerView, setDrawerView] = useState<ItemDrawerView>("resumo");
  const value = useMemo(
    () => ({ selectedItemId, setSelectedItemId, drawerView, setDrawerView }),
    [selectedItemId, drawerView],
  );
  return <ObraSelecaoContext.Provider value={value}>{children}</ObraSelecaoContext.Provider>;
}

export function useObraSelecao(): Ctx {
  const ctx = useContext(ObraSelecaoContext);
  if (!ctx)
    return {
      selectedItemId: null,
      setSelectedItemId: () => {},
      drawerView: "resumo",
      setDrawerView: () => {},
    };
  return ctx;
}
