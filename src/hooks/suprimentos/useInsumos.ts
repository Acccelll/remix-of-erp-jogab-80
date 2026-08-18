// ARC-012 · Onda 6 — Insumos sob leitura + mutações via TanStack Query (fonte única).
// Encapsula `insumosRepo` como camada interna; páginas devem consumir estes hooks.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  insumosRepo,
  type InsumoRow,
  type InsumoInsert,
  type InsumoUpdate,
  type InsumoCustoReferenciaRow,
} from "@/lib/repositories/insumos";
import { queryKey } from "@/lib/query-keys";
import { validarInsumo } from "@/lib/schemas/insumo";
import { assertValid, isValidationError } from "@/lib/schemas/validation";

export type InsumoAtivoBasico = Pick<InsumoRow, "id" | "codigo" | "descricao" | "unidade">;
export type InsumoAtivo = Pick<
  InsumoRow,
  "id" | "descricao" | "unidade" | "preco_unitario" | "ativo"
>;
export type InsumoPreco = Pick<InsumoRow, "id" | "preco_unitario">;
export type InsumoResumoPreco = Pick<
  InsumoRow,
  "id" | "descricao" | "unidade" | "preco_unitario"
>;

export const insumosKeys = {
  all: queryKey("insumos"),
  completo: queryKey("insumos", "completo"),
  ativosBasico: queryKey("insumos", "ativos-basico"),
  ativos: queryKey("insumos", "ativos"),
  precos: queryKey("insumos", "precos"),
  resumoPrecos: queryKey("insumos", "resumo-precos"),
  custoReferencia: queryKey("insumos", "custo-referencia"),
};

export function useInsumosCompleto(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: insumosKeys.completo,
    queryFn: () => insumosRepo.listCompleto() as Promise<InsumoRow[]>,
    enabled: options?.enabled ?? true,
    staleTime: 30_000,
  });
}

export function useInsumosAtivosBasico(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: insumosKeys.ativosBasico,
    queryFn: () => insumosRepo.listAtivosBasico() as Promise<InsumoAtivoBasico[]>,
    enabled: options?.enabled ?? true,
    staleTime: 30_000,
  });
}

export function useInsumosAtivos(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: insumosKeys.ativos,
    queryFn: () => insumosRepo.listAtivos() as Promise<InsumoAtivo[]>,
    enabled: options?.enabled ?? true,
    staleTime: 30_000,
  });
}

export function useInsumosPrecos(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: insumosKeys.precos,
    queryFn: () => insumosRepo.listPrecos() as Promise<InsumoPreco[]>,
    enabled: options?.enabled ?? true,
    staleTime: 30_000,
  });
}

export function useInsumosResumoPrecos(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: insumosKeys.resumoPrecos,
    queryFn: () => insumosRepo.listResumoPrecos() as Promise<InsumoResumoPreco[]>,
    enabled: options?.enabled ?? true,
    staleTime: 30_000,
  });
}

export function useInsumosCustoReferencia(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: insumosKeys.custoReferencia,
    queryFn: () => insumosRepo.listCustoReferencia() as Promise<InsumoCustoReferenciaRow[]>,
    enabled: options?.enabled ?? true,
    staleTime: 60_000,
  });
}

function invalidateAllInsumos(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: insumosKeys.completo });
  qc.invalidateQueries({ queryKey: insumosKeys.ativosBasico });
  qc.invalidateQueries({ queryKey: insumosKeys.ativos });
  qc.invalidateQueries({ queryKey: insumosKeys.precos });
  qc.invalidateQueries({ queryKey: insumosKeys.resumoPrecos });
}

export function useCreateInsumo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: InsumoInsert) => {
      assertValid(validarInsumo(payload));
      return insumosRepo.create(payload);
    },
    onError: (err: Error) => {
      if (isValidationError(err)) toast.error(err.message);
      else toast.error("Erro ao salvar insumo: " + err.message);
    },
    onSettled: () => invalidateAllInsumos(qc),
  });
}

export function useUpdateInsumo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: InsumoUpdate }) => {
      assertValid(validarInsumo(patch));
      return insumosRepo.update(id, patch);
    },
    onError: (err: Error) => {
      if (isValidationError(err)) toast.error(err.message);
      else toast.error("Erro ao atualizar insumo: " + err.message);
    },
    onSettled: () => invalidateAllInsumos(qc),
  });
}

export function useToggleInsumoAtivo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ativo }: { id: string; ativo: boolean }) =>
      insumosRepo.toggleAtivo(id, ativo),
    onError: (err: Error) => toast.error("Erro ao alterar status do insumo: " + err.message),
    onSettled: () => invalidateAllInsumos(qc),
  });
}
