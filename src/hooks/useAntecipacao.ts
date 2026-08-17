// @ts-nocheck
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { antecipacaoRepo } from "@/lib/repositories/antecipacao";

export function useOperadoresCredito() {
  return useQuery({
    queryKey: ["antecipacao-operadores"],
    queryFn: () => antecipacaoRepo.listOperadores(),
    staleTime: 5 * 60_000,
  });
}

export function useAntecipacaoOperacoes(filtros?: { status?: string; operadorId?: string }) {
  return useQuery({
    queryKey: ["antecipacao-operacoes", filtros ?? {}],
    queryFn: () => antecipacaoRepo.listOperacoes(filtros),
  });
}

export function useAntecipacaoOperacao(id: string | undefined) {
  return useQuery({
    queryKey: ["antecipacao-operacao", id],
    queryFn: () => (id ? antecipacaoRepo.getOperacao(id) : null),
    enabled: !!id,
  });
}

export function useAntecipacaoTitulos(operacaoId: string | undefined) {
  return useQuery({
    queryKey: ["antecipacao-titulos", operacaoId],
    queryFn: () => (operacaoId ? antecipacaoRepo.listTitulos(operacaoId) : []),
    enabled: !!operacaoId,
  });
}

export function useAntecipacaoLiquidacoes(operacaoId: string | undefined) {
  return useQuery({
    queryKey: ["antecipacao-liquidacoes", operacaoId],
    queryFn: () => (operacaoId ? antecipacaoRepo.listLiquidacoes(operacaoId) : []),
    enabled: !!operacaoId,
  });
}

export function useAntecipacaoElegiveis() {
  return useQuery({
    queryKey: ["antecipacao-elegiveis"],
    queryFn: () => antecipacaoRepo.listElegiveis(),
  });
}

export function useCriarOperacaoAntecipacao() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: any) => antecipacaoRepo.criarOperacao(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["antecipacao-operacoes"] }),
  });
}

export function useAtualizarOperacaoAntecipacao() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: any }) =>
      antecipacaoRepo.atualizarOperacao(id, patch),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ["antecipacao-operacoes"] });
      qc.invalidateQueries({ queryKey: ["antecipacao-operacao", vars.id] });
    },
  });
}

export function useExcluirOperacaoAntecipacao() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => antecipacaoRepo.excluirOperacao(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["antecipacao-operacoes"] }),
  });
}

export function useAdicionarTitulosAntecipacao() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (rows: any[]) => antecipacaoRepo.adicionarTitulos(rows),
    onSuccess: (_d, rows) => {
      const opId = rows[0]?.operacao_id;
      qc.invalidateQueries({ queryKey: ["antecipacao-titulos", opId] });
      qc.invalidateQueries({ queryKey: ["antecipacao-operacoes"] });
      qc.invalidateQueries({ queryKey: ["antecipacao-operacao", opId] });
      qc.invalidateQueries({ queryKey: ["antecipacao-elegiveis"] });
    },
  });
}

export function useRemoverTituloAntecipacao(operacaoId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => antecipacaoRepo.removerTitulo(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["antecipacao-titulos", operacaoId] });
      qc.invalidateQueries({ queryKey: ["antecipacao-operacoes"] });
      qc.invalidateQueries({ queryKey: ["antecipacao-operacao", operacaoId] });
      qc.invalidateQueries({ queryKey: ["antecipacao-elegiveis"] });
    },
  });
}

export function useAtualizarTituloAntecipacao(operacaoId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: any }) =>
      antecipacaoRepo.atualizarTitulo(id, patch),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["antecipacao-titulos", operacaoId] });
      qc.invalidateQueries({ queryKey: ["antecipacao-operacoes"] });
      qc.invalidateQueries({ queryKey: ["antecipacao-operacao", operacaoId] });
    },
  });
}

export function useRegistrarLiquidacaoAntecipacao() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: any) => antecipacaoRepo.registrarLiquidacao(payload),
    onSuccess: (_d, payload: any) => {
      qc.invalidateQueries({ queryKey: ["antecipacao-liquidacoes", payload.operacao_id] });
      qc.invalidateQueries({ queryKey: ["antecipacao-operacao", payload.operacao_id] });
    },
  });
}
