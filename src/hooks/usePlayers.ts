// ARC-002/ARC-004 · Onda 6 — Players (usuarios) sob leitura + mutações TanStack Query.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { defaultPlayers, migratePlayers } from "@/contexts/app/helpers";
import { playerFromApi } from "@/contexts/app/mappers";
import { api, apiFetch } from "@/lib/api";
import { queryKey } from "@/lib/query-keys";
import type { Player } from "@/types";
import { logger } from "@/lib/core/logger";

export const playersKeys = {
  all: queryKey("players"),
};

async function fetchPlayers(): Promise<Player[]> {
  const data = await apiFetch<any[]>("usuarios");
  const dbPlayers = Array.isArray(data) ? data.map(playerFromApi) : [];
  return migratePlayers(dbPlayers.length > 0 ? dbPlayers : defaultPlayers);
}

export function usePlayers(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: playersKeys.all,
    queryFn: fetchPlayers,
    enabled: options?.enabled ?? true,
    staleTime: 30_000,
  });
}

const makeLocalId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : String(Date.now());

export const playerPayload = (d: Partial<Player>): Record<string, any> => {
  const payload: Record<string, any> = {};
  if (d.login !== undefined) payload.login = d.login;
  if (d.senha !== undefined) payload.senha = d.senha;
  if (d.email !== undefined) payload.email = d.email;
  if (d.isGM !== undefined) payload.is_gm = d.isGM;
  if (d.acessos !== undefined) {
    payload.acessos = d.acessos;
    payload.acesso_contratos = d.acessos?.contratos ?? "nenhum";
  }
  // PRO-031 · matriz fina + papéis especiais (persistidos como JSON no MySQL).
  if (d.matrizPermissoes !== undefined) payload.matrizPermissoes = d.matrizPermissoes;
  if (d.papeisPermissao !== undefined) payload.papeisPermissao = d.papeisPermissao;
  return payload;
};

/**
 * ARC-004.slice-08 · Mutations otimistas para `players` — padrão canônico
 * (`onMutate` snapshot → `onError` restore → `onSettled` invalidate).
 */
export function useAddPlayer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p: Omit<Player, "id" | "isGM">): Promise<Player> => {
      const result = await api.create("usuarios", {
        login: p.login,
        senha: p.senha,
        email: p.email || "",
        is_gm: false,
        acessos: p.acessos,
        acesso_contratos: p.acessos?.contratos ?? "nenhum",
      });
      return migratePlayers([
        {
          ...p,
          id: String(result.id ?? result.user_id ?? makeLocalId()),
          isGM: false,
          email: p.email || "",
        },
      ])[0];
    },
    onMutate: async (p) => {
      await qc.cancelQueries({ queryKey: playersKeys.all });
      const prev = qc.getQueryData<Player[]>(playersKeys.all);
      const optimistic = migratePlayers([
        { ...p, id: `tmp-${makeLocalId()}`, isGM: false, email: p.email || "" },
      ])[0];
      qc.setQueryData<Player[]>(playersKeys.all, (curr) => [...(curr ?? []), optimistic]);
      return { prev, tempId: optimistic.id };
    },
    onSuccess: (saved, _vars, ctx) => {
      qc.setQueryData<Player[]>(playersKeys.all, (curr) => {
        const list = curr ?? [];
        const replaced = ctx?.tempId
          ? list.map((p) => (p.id === ctx.tempId ? saved : p))
          : list;
        return replaced.some((p) => p.id === saved.id) ? replaced : [...replaced, saved];
      });
    },
    onError: (err, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(playersKeys.all, ctx.prev);
      logger.error("Error adding player:", err);
      toast.error("Erro ao salvar usuário. Alteração revertida.");
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: playersKeys.all });
    },
  });
}

export function useUpdatePlayer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Player> }) => {
      await api.update("usuarios", id, playerPayload(data));
      return { id, data };
    },
    onMutate: async ({ id, data }) => {
      await qc.cancelQueries({ queryKey: playersKeys.all });
      const prev = qc.getQueryData<Player[]>(playersKeys.all);
      qc.setQueryData<Player[]>(playersKeys.all, (curr) =>
        (curr ?? []).map((p) => (p.id === id ? { ...p, ...data } : p)),
      );
      return { prev };
    },
    onError: (err, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(playersKeys.all, ctx.prev);
      logger.error("Error updating player:", err);
      toast.error("Erro ao atualizar usuário. Alteração revertida.");
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: playersKeys.all });
    },
  });
}

export function useDeletePlayer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.remove("usuarios", id);
      return id;
    },
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: playersKeys.all });
      const prev = qc.getQueryData<Player[]>(playersKeys.all);
      qc.setQueryData<Player[]>(playersKeys.all, (curr) =>
        (curr ?? []).filter((p) => p.id !== id),
      );
      return { prev };
    },
    onError: (err, _id, ctx) => {
      if (ctx?.prev) qc.setQueryData(playersKeys.all, ctx.prev);
      logger.error("Error deleting player:", err);
      toast.error("Erro ao remover usuário. Exclusão revertida.");
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: playersKeys.all });
    },
  });
}
