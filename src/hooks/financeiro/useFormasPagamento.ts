// ARC-004 · Onda 6 — Formas de Pagamento sob máquina única de estado servidor (TanStack Query).
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { queryKey } from "@/lib/query-keys";
import { swallow } from "@/lib/core/errors";

export type TipoPagamento = "cartao_credito" | "pix" | "boleto" | "pix_cartao_credito";

export interface FormaPag {
  id: string;
  nome: string;
  tipo: TipoPagamento;
  nome_cartao: string | null;
  ativo: boolean;
}

export const formasPagamentoKeys = {
  all: queryKey("formas_pagamento"),
};

function normalize(raw: any): FormaPag {
  let nomeCartao: string | null = raw.nome_cartao || null;
  if (!nomeCartao && raw.detalhes) {
    try {
      const det = typeof raw.detalhes === "string" ? JSON.parse(raw.detalhes) : raw.detalhes;
      nomeCartao = det?.nome_cartao || null;
    } catch (err) {
      swallow("formas-pagamento.detalhes.parse", err, "detalhes malformados");
    }
  }
  const ativo =
    raw.ativo == null ? true : raw.ativo === true || raw.ativo === 1 || raw.ativo === "1";
  return { ...raw, nome_cartao: nomeCartao, ativo };
}

async function fetchFormas(): Promise<FormaPag[]> {
  const data = await api.getAll("formasPagamento");
  return Array.isArray(data) ? (data as any[]).map(normalize) : [];
}

export function useFormasPagamento() {
  return useQuery({
    queryKey: formasPagamentoKeys.all,
    queryFn: fetchFormas,
    staleTime: 30_000,
  });
}

export function useSaveFormaPagamento() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { id?: string; payload: Record<string, unknown> }) => {
      if (args.id) return api.update("formasPagamento", args.id, args.payload);
      return api.create("formasPagamento", args.payload);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: formasPagamentoKeys.all }),
  });
}

export function useToggleFormaPagamentoAtivo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (f: FormaPag) =>
      api.update("formasPagamento", f.id, {
        nome: f.nome,
        tipo: f.tipo,
        detalhes:
          f.tipo === "cartao_credito"
            ? JSON.stringify({ nome_cartao: f.nome_cartao || "" })
            : null,
        ativo: !f.ativo,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: formasPagamentoKeys.all }),
  });
}
