// ARC-011 · Onda 6 — Fornecedores sob leitura + mutações via TanStack Query (fonte única).
// Substitui chamadas imperativas de `fornecedoresRepo.*` em páginas.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  fornecedoresRepo,
  type FornecedorRow,
  type FornecedorInsert,
  type FornecedorUpdate,
} from "@/lib/repositories/fornecedores";
import { queryKey } from "@/lib/query-keys";
import { validarFornecedor } from "@/lib/schemas/fornecedor";
import { assertValid, isValidationError } from "@/lib/schemas/validation";

export type FornecedorResumo = Pick<FornecedorRow, "id" | "razao_social">;
export type FornecedorResumoAtivo = Pick<FornecedorRow, "id" | "razao_social" | "ativo">;
export type FornecedorContato = Pick<
  FornecedorRow,
  "id" | "razao_social" | "nome_fantasia" | "contato" | "email" | "telefone" | "ativo"
>;

export const fornecedoresKeys = {
  all: queryKey("fornecedores"),
  completo: queryKey("fornecedores", "completo"),
  resumo: queryKey("fornecedores", "resumo"),
  resumoAtivos: queryKey("fornecedores", "resumo-ativos"),
  contatos: queryKey("fornecedores", "contatos"),
};

export function useFornecedoresCompleto(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: fornecedoresKeys.completo,
    queryFn: () => fornecedoresRepo.listCompleto() as Promise<FornecedorRow[]>,
    enabled: options?.enabled ?? true,
    staleTime: 30_000,
  });
}

export function useFornecedoresResumo(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: fornecedoresKeys.resumo,
    queryFn: () => fornecedoresRepo.listResumo() as Promise<FornecedorResumo[]>,
    enabled: options?.enabled ?? true,
    staleTime: 30_000,
  });
}

export function useFornecedoresResumoAtivos(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: fornecedoresKeys.resumoAtivos,
    queryFn: () => fornecedoresRepo.listResumoAtivos() as Promise<FornecedorResumoAtivo[]>,
    enabled: options?.enabled ?? true,
    staleTime: 30_000,
  });
}

export function useFornecedoresContatos(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: fornecedoresKeys.contatos,
    queryFn: () => fornecedoresRepo.listContatos() as Promise<FornecedorContato[]>,
    enabled: options?.enabled ?? true,
    staleTime: 30_000,
  });
}

function invalidateAllFornecedores(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: fornecedoresKeys.completo });
  qc.invalidateQueries({ queryKey: fornecedoresKeys.resumo });
  qc.invalidateQueries({ queryKey: fornecedoresKeys.resumoAtivos });
  qc.invalidateQueries({ queryKey: fornecedoresKeys.contatos });
}

export function useCreateFornecedor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: FornecedorInsert) => {
      assertValid(validarFornecedor(payload));
      return fornecedoresRepo.create(payload);
    },
    onError: (err: Error) => {
      if (isValidationError(err)) toast.error(err.message);
      else toast.error("Erro ao salvar fornecedor: " + err.message);
    },
    onSettled: () => invalidateAllFornecedores(qc),
  });
}

export function useUpdateFornecedor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: FornecedorUpdate }) => {
      assertValid(validarFornecedor(patch));
      return fornecedoresRepo.update(id, patch);
    },
    onError: (err: Error) => {
      if (isValidationError(err)) toast.error(err.message);
      else toast.error("Erro ao atualizar fornecedor: " + err.message);
    },
    onSettled: () => invalidateAllFornecedores(qc),
  });
}
