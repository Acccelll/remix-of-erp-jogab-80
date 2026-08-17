// ARC-002/ARC-004 · Onda 6 — Tipos de documento sob leitura/mutação TanStack Query.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { docTipoFromApi } from "@/contexts/app/mappers";
import { apiFetch } from "@/lib/api";
import { queryKey } from "@/lib/query-keys";
import type { DocumentoTipo } from "@/types";

export const documentoTiposKeys = {
  all: queryKey("documento_tipos"),
};

async function fetchDocumentoTipos(): Promise<DocumentoTipo[]> {
  const data = await apiFetch<any[]>("documentoTipos");
  return Array.isArray(data) ? data.map(docTipoFromApi) : [];
}

export function useDocumentoTipos(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: documentoTiposKeys.all,
    queryFn: fetchDocumentoTipos,
    enabled: options?.enabled ?? true,
    staleTime: 30_000,
  });
}

export function useSaveDocumentoTipo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: {
      id?: string;
      payload: Omit<DocumentoTipo, "id"> | Partial<DocumentoTipo>;
    }) => {
      if (args.id) {
        return apiFetch("documentoTipos", {
          method: "PUT",
          params: { id: args.id },
          body: args.payload,
        });
      }
      return apiFetch("documentoTipos", { method: "POST", body: args.payload });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: documentoTiposKeys.all }),
    onError: () => toast.error("Erro ao salvar tipo de documento"),
  });
}

export function useDeleteDocumentoTipo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch("documentoTipos", { method: "DELETE", params: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: documentoTiposKeys.all }),
    onError: () => toast.error("Erro ao remover tipo de documento"),
  });
}