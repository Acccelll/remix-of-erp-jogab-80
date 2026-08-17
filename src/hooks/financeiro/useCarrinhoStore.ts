import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { STORAGE_KEYS } from "@/lib/core/storage/keys";

/**
 * Migração silenciosa: o carrinho vivia em `sessionStorage` sob
 * "carrinho-financeiro". Quem estiver com a aba aberta não perde os itens —
 * copiamos uma única vez para o `localStorage` canônico.
 */
function migrarDaSessao() {
  try {
    const antigo = sessionStorage.getItem("carrinho-financeiro");
    if (antigo && !localStorage.getItem(STORAGE_KEYS.finCarrinho)) {
      localStorage.setItem(STORAGE_KEYS.finCarrinho, antigo);
    }
    if (antigo) sessionStorage.removeItem("carrinho-financeiro");
  } catch {
    /* noop */
  }
}
migrarDaSessao();

export interface CarrinhoItem {
  id: string;
  tipo: "titulo_pagar" | "titulo_receber";
  numero: string;
  valor: number;
  vencimento: string;
  descricao: string;
  fornecedor_cliente?: string;
  obra_id?: string;
}

interface CarrinhoStore {
  itens: CarrinhoItem[];
  addItem: (item: CarrinhoItem) => void;
  removeItem: (id: string) => void;
  clear: () => void;
  isInCarrinho: (id: string) => boolean;
}

export const useCarrinhoStore = create<CarrinhoStore>()(
  persist(
    (set, get) => ({
      itens: [],
      addItem: (item) => {
        const { itens } = get();
        if (!itens.find((i) => i.id === item.id)) {
          set({ itens: [...itens, item] });
        }
      },
      removeItem: (id) => {
        set({ itens: get().itens.filter((i) => i.id !== id) });
      },
      clear: () => set({ itens: [] }),
      isInCarrinho: (id) => get().itens.some((i) => i.id === id),
    }),
    {
      name: STORAGE_KEYS.finCarrinho,
      storage: createJSONStorage(() => localStorage),
    },
  ),
);
