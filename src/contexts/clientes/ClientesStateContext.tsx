import React, { useCallback, useMemo } from "react";
import { createRequiredContext, useRequiredContext } from "@/contexts/createRequiredContext";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { Cliente } from "@/types";
import { api, apiFetch } from "@/lib/api";
import { clienteFromApi } from "@/contexts/app/mappers";
import { queryKey } from "@/lib/query-keys";
import { useAuthState } from "@/contexts/auth/AuthContext";
import { logger } from "@/lib/core/logger";

/**
 * Provider real de `clientes` — trilho legado (api.php → MySQL
 * `jogabcom_gestao_obras`), fonte canônica do cadastro/CRM. IDs numéricos do
 * MySQL casam com `oportunidades.cliente_id` e `obras.cliente_id` do mesmo
 * trilho. A cópia Supabase de clientes permanece exclusiva do módulo
 * financeiro (`@/hooks/useClientes`).
 */
export interface ClientesStateContextType {
  clientes: Cliente[];
  addCliente: (c: Omit<Cliente, "id">) => Promise<Cliente | undefined>;
  updateCliente: (id: string, d: Partial<Cliente>) => void;
  deleteCliente: (id: string) => void;
  clientesLoaded: boolean;
}

const clientesLegadoKey = queryKey("clientes", "legado");

async function fetchClientes(): Promise<Cliente[]> {
  const data = await apiFetch<any[]>("clientes");
  // DELETE no api.php é soft (ativa = 0); inativos ficam fora da listagem.
  return Array.isArray(data) ? data.map(clienteFromApi).filter((c) => c.ativa !== false) : [];
}

const ClientesStateContext = createRequiredContext<ClientesStateContextType>({
  hook: "useClientesStateContext",
  provider: "ClientesStateProvider",
  file: "src/contexts/clientes/ClientesStateContext.tsx",
});

export const ClientesStateProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentPlayer } = useAuthState();
  const queryEnabled =
    !!currentPlayer ||
    (typeof window !== "undefined" && !!localStorage.getItem("go_token"));

  const qc = useQueryClient();
  const clientesQuery = useQuery({
    queryKey: clientesLegadoKey,
    queryFn: fetchClientes,
    enabled: queryEnabled,
    staleTime: 30_000,
  });

  const clientes = clientesQuery.data ?? [];
  const clientesLoaded = !queryEnabled || clientesQuery.isSuccess;

  const addMutation = useMutation({
    mutationFn: async (c: Omit<Cliente, "id">): Promise<Cliente> => {
      const result = await api.create("clientes", c);
      return { ...c, id: String(result.id) } as Cliente;
    },
    onSuccess: (novo) => {
      qc.setQueryData<Cliente[]>(clientesLegadoKey, (prev) => (prev ? [...prev, novo] : [novo]));
    },
    onError: (err) => {
      logger.error("Error adding cliente:", err);
      toast.error("Erro ao salvar cliente");
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: clientesLegadoKey });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<Cliente> }) =>
      api.update("clientes", id, patch),
    onMutate: async ({ id, patch }) => {
      await qc.cancelQueries({ queryKey: clientesLegadoKey });
      const prev = qc.getQueryData<Cliente[]>(clientesLegadoKey);
      qc.setQueryData<Cliente[]>(clientesLegadoKey, (curr) =>
        (curr ?? []).map((c) => (c.id === id ? { ...c, ...patch } : c)),
      );
      return { prev };
    },
    onError: (err, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(clientesLegadoKey, ctx.prev);
      logger.error("Error updating cliente:", err);
      toast.error("Erro ao atualizar cliente. Alteração revertida.");
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: clientesLegadoKey });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.remove("clientes", id),
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: clientesLegadoKey });
      const prev = qc.getQueryData<Cliente[]>(clientesLegadoKey);
      qc.setQueryData<Cliente[]>(clientesLegadoKey, (curr) =>
        (curr ?? []).filter((c) => c.id !== id),
      );
      return { prev };
    },
    onError: (err, _id, ctx) => {
      if (ctx?.prev) qc.setQueryData(clientesLegadoKey, ctx.prev);
      logger.error("Error deleting cliente:", err);
      toast.error("Erro ao remover cliente. Exclusão revertida.");
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: clientesLegadoKey });
    },
  });

  const addCliente = useCallback(
    async (c: Omit<Cliente, "id">) => {
      try {
        return await addMutation.mutateAsync(c);
      } catch {
        return undefined;
      }
    },
    [addMutation],
  );

  const updateCliente = useCallback(
    (id: string, d: Partial<Cliente>) => {
      updateMutation.mutate({ id, patch: d });
    },
    [updateMutation],
  );

  const deleteCliente = useCallback(
    (id: string) => {
      deleteMutation.mutate(id);
    },
    [deleteMutation],
  );

  const value = useMemo<ClientesStateContextType>(
    () => ({ clientes, addCliente, updateCliente, deleteCliente, clientesLoaded }),
    [clientes, addCliente, updateCliente, deleteCliente, clientesLoaded],
  );

  return <ClientesStateContext.Provider value={value}>{children}</ClientesStateContext.Provider>;
};

export const useClientesStateContext = (): ClientesStateContextType => {
  return useRequiredContext(ClientesStateContext);
};
