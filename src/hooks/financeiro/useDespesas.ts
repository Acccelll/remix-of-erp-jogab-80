// ARC-004 · Onda 6 — Despesas sob máquina única de estado servidor (TanStack Query).
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { queryKey } from "@/lib/query-keys";

export interface Despesa {
  id: string;
  descricao: string;
  valor: number;
  data: string | null;
  categoria: string | null;
  forma_pagamento_id: string | null;
  obra_id: string | null;
  colaborador_id: string | null;
  veiculo_id: string | null;
  patrimonio_id: string | null;
  status: "pendente" | "pago" | "cancelado";
  observacao: string | null;
  referencia: string | null;
  responsavel: string | null;
  fornecedor: string | null;
  comprovante_url: string | null;
  created_at: string;
  updated_at: string;
}

export const despesasKeys = {
  all: queryKey("despesas"),
};

function normalizeDespesa(d: any): Despesa {
  return {
    id: String(d.id),
    descricao: d.descricao || "",
    valor: Number(d.valor || 0),
    data: d.data,
    categoria: d.categoria,
    forma_pagamento_id: d.forma_pagamento_id,
    obra_id: d.obra_id,
    colaborador_id: d.colaborador_id,
    veiculo_id: d.veiculo_id,
    patrimonio_id: d.patrimonio_id,
    status: d.status || "pendente",
    observacao: d.observacao || "",
    referencia: d.referencia || "",
    responsavel: d.responsavel || "",
    fornecedor: d.fornecedor || "",
    comprovante_url: d.comprovante_url,
    created_at: d.created_at,
    updated_at: d.updated_at,
  };
}

async function fetchDespesas(): Promise<Despesa[]> {
  const data = await api.getAll("despesas");
  return Array.isArray(data) ? (data as any[]).map(normalizeDespesa) : [];
}

export function useDespesas() {
  return useQuery({
    queryKey: despesasKeys.all,
    queryFn: fetchDespesas,
    staleTime: 30_000,
  });
}

export function useSaveDespesa() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { id?: string; payload: Record<string, unknown> }) => {
      if (args.id) return api.update("despesas", args.id, args.payload);
      return api.create("despesas", args.payload);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: despesasKeys.all }),
  });
}