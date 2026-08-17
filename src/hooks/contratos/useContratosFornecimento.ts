// ARC-004 · Onda 6 — Contratos de Fornecimento sob TanStack Query.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { contratoFornecedoresRepo, contratosFornecimentoRepo } from "@/lib/repositories/contratos";
import { queryKey } from "@/lib/query-keys";
import type { MedicaoContrato, AditivoContrato } from "@/lib/contratos/medicao";

export interface ContratoFornecimento {
  id: string;
  obra_id: string;
  fornecedor_id: string | null;
  numero: string;
  objeto: string;
  tipo: "material" | "servico" | "mao_obra";
  valor: number;
  data_inicio: string | null;
  data_fim: string | null;
  status: string;
}

export const contratosFornecimentoKeys = {
  list: queryKey("contratos_fornecimento"),
  medicoes: queryKey("contratos_fornecimento_medicoes"),
  aditivos: queryKey("contratos_fornecimento_aditivos"),
  fornecedores: queryKey("contrato_fornecedores"),
};

export function useContratosFornecimento() {
  return useQuery({
    queryKey: contratosFornecimentoKeys.list,
    queryFn: async () =>
      ((await contratosFornecimentoRepo.list()) || []) as ContratoFornecimento[],
    staleTime: 30_000,
  });
}

export function useContratoFornecedores() {
  return useQuery({
    queryKey: contratosFornecimentoKeys.fornecedores,
    queryFn: async () =>
      ((await contratoFornecedoresRepo.listMin()) || []) as Array<{ id: string; nome: string }>,
    staleTime: 60_000,
  });
}

export function useContratoMedicoes(ids: string[]) {
  const key = [...contratosFornecimentoKeys.medicoes, [...ids].sort().join(",")] as const;
  return useQuery({
    queryKey: key,
    queryFn: async () => {
      if (ids.length === 0) return {} as Record<string, MedicaoContrato[]>;
      const rows = ((await contratosFornecimentoRepo.listMedicoes(ids)) || []) as any[];
      const map: Record<string, MedicaoContrato[]> = {};
      rows.forEach((r) => {
        (map[r.contrato_id] ||= []).push(r);
      });
      return map;
    },
    staleTime: 30_000,
  });
}

export function useContratoAditivos(ids: string[]) {
  const key = [...contratosFornecimentoKeys.aditivos, [...ids].sort().join(",")] as const;
  return useQuery({
    queryKey: key,
    queryFn: async () => {
      if (ids.length === 0) return {} as Record<string, AditivoContrato[]>;
      const rows = ((await contratosFornecimentoRepo.listAditivos(ids)) || []) as any[];
      const map: Record<string, AditivoContrato[]> = {};
      rows.forEach((r) => {
        if (r.contrato_id) (map[r.contrato_id] ||= []).push(r);
      });
      return map;
    },
    staleTime: 30_000,
  });
}

export function useCreateContratoFornecimento() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: Parameters<typeof contratosFornecimentoRepo.insert>[0]) =>
      contratosFornecimentoRepo.insert(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: contratosFornecimentoKeys.list }),
  });
}

export function useCreateContratoMedicao() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: Parameters<typeof contratosFornecimentoRepo.insertMedicao>[0]) =>
      contratosFornecimentoRepo.insertMedicao(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: contratosFornecimentoKeys.medicoes }),
  });
}
