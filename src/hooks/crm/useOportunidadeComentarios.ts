// ARC-004 · Onda 6 — Comentários de Oportunidades (CRM) sob TanStack Query.
// Realtime "chat-like": quando o diálogo está aberto, a query refaz automaticamente
// a cada 3 s para trazer mensagens novas sem intervenção do usuário.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { queryKey } from "@/lib/query-keys";
import type { OportunidadeComentario } from "@/types";

export const oportunidadeComentariosKeys = {
  all: queryKey("oportunidade_comentarios"),
  porOportunidade: (id: string) => queryKey("oportunidade_comentarios", id),
};

export function useOportunidadeComentarios() {
  return useQuery({
    queryKey: oportunidadeComentariosKeys.all,
    queryFn: async () => {
      const rows = await api.getAll<OportunidadeComentario>("oportunidadeComentarios");
      return Array.isArray(rows) ? rows : [];
    },
    staleTime: 30_000,
  });
}

export function useOportunidadeComentariosCount() {
  const q = useOportunidadeComentarios();
  const map = new Map<string, number>();
  (q.data || []).forEach((c) => map.set(c.oportunidadeId, (map.get(c.oportunidadeId) || 0) + 1));
  return { ...q, countByOportunidade: map };
}

export function useComentariosDeOportunidade(oportunidadeId: string | null, enabled = true) {
  return useQuery({
    queryKey: oportunidadeComentariosKeys.porOportunidade(oportunidadeId || ""),
    queryFn: async () => {
      const rows = await api.getAll<OportunidadeComentario>("oportunidadeComentarios", {
        oportunidade_id: oportunidadeId as string,
      });
      return Array.isArray(rows) ? rows : [];
    },
    enabled: !!oportunidadeId && enabled,
    staleTime: 2_000,
    // Chat-like: enquanto o painel de comentários está aberto, refaz a cada 3 s.
    refetchInterval: !!oportunidadeId && enabled ? 3_000 : false,
    refetchIntervalInBackground: false,
  });
}

export function useCreateOportunidadeComentario() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: {
      oportunidadeId: string;
      texto: string;
      autor: string;
    }) => api.create<OportunidadeComentario>("oportunidadeComentarios", payload),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: oportunidadeComentariosKeys.all });
      qc.invalidateQueries({
        queryKey: oportunidadeComentariosKeys.porOportunidade(vars.oportunidadeId),
      });
    },
  });
}
