// ARC-004 · Onda 6 — Solicitações Financeiras (aprovação) sob TanStack Query.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { queryKey } from "@/lib/query-keys";
import type { StatusSolicitacao } from "@/types";

export interface SolicitacaoFinanceira {
  id: string;
  setor: string;
  valor: number;
  data_pagamento: string | null;
  prazo_estimado: string | null;
  forma_pagamento_id: string | null;
  nivel_prioridade: string;
  condicao_pagamento: string | null;
  centro_custo_id: string | null;
  solicitante: string;
  fornecedor: string | null;
  referencia: string | null;
  observacao: string | null;
  status: StatusSolicitacao;
  comentario_aprovacao: string | null;
  criado_por: string;
  created_at: string;
  updated_at: string;
  pagamento_pendente?: boolean;
  /** Valor ainda provisório — destaca a linha em âmbar na fila de aprovação. */
  previsao?: boolean;
}

export interface SolicitacaoComentario {
  id: string;
  solicitacao_id: string;
  campo: string;
  texto: string;
  autor: string;
  created_at: string;
}

const toArray = <T,>(data: any): T[] => {
  if (Array.isArray(data)) return data as T[];
  if (data && typeof data === "object" && !("error" in data)) return [data as T];
  return [];
};

export const solicitacoesFinanceirasKeys = {
  all: queryKey("solicitacoes_financeiras"),
};

export const solicitacaoComentariosKeys = {
  all: queryKey("solicitacao_comentarios"),
};

export function useSolicitacoesFinanceiras() {
  return useQuery({
    queryKey: solicitacoesFinanceirasKeys.all,
    queryFn: async () => toArray<SolicitacaoFinanceira>(await api.getAll("solicitacoesFinanceiras")),
    staleTime: 30_000,
  });
}

export function useSolicitacaoComentarios(opts: { realtime?: boolean } = { realtime: true }) {
  return useQuery({
    queryKey: solicitacaoComentariosKeys.all,
    queryFn: async () => toArray<SolicitacaoComentario>(await api.getAll("solicitacaoComentarios")),
    // Chat-like: quando `realtime` está ativo (painel aberto), refaz a cada 3 s.
    staleTime: opts.realtime ? 2_000 : 30_000,
    refetchInterval: opts.realtime ? 3_000 : false,
    refetchIntervalInBackground: false,
  });
}

export function useInvalidateSolicitacoes() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: solicitacoesFinanceirasKeys.all });
}

export function useSaveSolicitacao() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { id?: string; payload: Record<string, unknown> }) => {
      if (args.id) return api.update("solicitacoesFinanceiras", args.id, args.payload);
      return api.create("solicitacoesFinanceiras", args.payload);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: solicitacoesFinanceirasKeys.all }),
  });
}

export function useUpdateSolicitacaoStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (args: { id: string; payload: Record<string, unknown> }) =>
      api.update("solicitacoesFinanceiras", args.id, args.payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: solicitacoesFinanceirasKeys.all }),
  });
}

export function useCreateSolicitacaoComentario() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: Record<string, unknown>) => api.create("solicitacaoComentarios", payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: solicitacaoComentariosKeys.all }),
  });
}
