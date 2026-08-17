// ARC-012 · Onda 6 — Clientes sob leitura + mutações via TanStack Query (fonte única).
// Encapsula `clientesRepo` como camada interna; páginas devem consumir estes hooks.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { clientesRepo } from "@/lib/repositories/clientes";
import { queryKey } from "@/lib/query-keys";

export type ClienteRow = Awaited<ReturnType<typeof clientesRepo.list>>[number];
export type ClienteResumo = { id: string; nome: string };
export type ClienteInsert = Parameters<typeof clientesRepo.create>[0];
export type ClienteUpdate = Parameters<typeof clientesRepo.update>[1];

export const clientesKeys = {
  all: queryKey("clientes"),
  list: queryKey("clientes", "list"),
  resumo: queryKey("clientes", "resumo"),
  obrasVinculadas: (clienteId: string) =>
    queryKey("clientes", "obras-vinculadas", clienteId),
};

export function useClientes(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: clientesKeys.list,
    queryFn: () => clientesRepo.list() as Promise<ClienteRow[]>,
    enabled: options?.enabled ?? true,
    staleTime: 30_000,
  });
}

export function useClientesResumo(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: clientesKeys.resumo,
    queryFn: () => clientesRepo.listIdNome() as Promise<ClienteResumo[]>,
    enabled: options?.enabled ?? true,
    staleTime: 30_000,
  });
}

function invalidateAllClientes(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: clientesKeys.list });
  qc.invalidateQueries({ queryKey: clientesKeys.resumo });
}

export function useCreateCliente() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: ClienteInsert) => clientesRepo.create(payload),
    onError: (err: Error) => toast.error("Erro ao salvar cliente: " + err.message),
    onSettled: () => invalidateAllClientes(qc),
  });
}

export function useUpdateCliente() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: ClienteUpdate }) =>
      clientesRepo.update(id, patch),
    onError: (err: Error) => toast.error("Erro ao atualizar cliente: " + err.message),
    onSettled: () => invalidateAllClientes(qc),
  });
}

export function useDeleteCliente() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => clientesRepo.remove(id),
    onError: (err: Error) => toast.error("Erro ao remover cliente: " + err.message),
    onSettled: () => invalidateAllClientes(qc),
  });
}

export function useClienteObrasVinculadas(
  clienteId: string | null | undefined,
  options?: { enabled?: boolean },
) {
  return useQuery({
    queryKey: clientesKeys.obrasVinculadas(clienteId ?? ""),
    queryFn: () => clientesRepo.countObrasVinculadas(clienteId as string),
    enabled: !!clienteId && (options?.enabled ?? true),
    staleTime: 15_000,
  });
}

/** Contagem imperativa (fluxos como confirmação de delete). Usa cache TanStack. */
export function fetchClienteObrasVinculadas(
  qc: ReturnType<typeof useQueryClient>,
  clienteId: string,
) {
  return qc.fetchQuery({
    queryKey: clientesKeys.obrasVinculadas(clienteId),
    queryFn: () => clientesRepo.countObrasVinculadas(clienteId),
    staleTime: 0,
  });
}

