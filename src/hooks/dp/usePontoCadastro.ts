// Conciliação de cadastro: vínculos RHiD ↔ ERP e de-para departamento → obra.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { pontoRepo } from "@/lib/repositories/ponto";
import { queryKey } from "@/lib/query-keys";
import { isRecursoIndisponivel } from "@/lib/ponto/disponibilidade";

const retryExcetoIndisponivel = (falhas: number, erro: unknown) =>
  !isRecursoIndisponivel(erro) && falhas < 1;

export const cadastroKeys = {
  vinculos: queryKey("ponto_rhid_vinculos"),
  dePara: queryKey("ponto_departamento_obra"),
};

export function useRhidVinculos() {
  return useQuery({
    queryKey: cadastroKeys.vinculos,
    queryFn: () => pontoRepo.listRhidVinculos(),
    retry: retryExcetoIndisponivel,
    staleTime: 60_000,
  });
}

export function useSalvarRhidVinculo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (row: Parameters<typeof pontoRepo.salvarRhidVinculo>[0]) =>
      pontoRepo.salvarRhidVinculo(row),
    onSettled: () => qc.invalidateQueries({ queryKey: cadastroKeys.vinculos }),
  });
}

export function useDepartamentoObra() {
  return useQuery({
    queryKey: cadastroKeys.dePara,
    queryFn: () => pontoRepo.listDepartamentoObra(),
    retry: retryExcetoIndisponivel,
    staleTime: 60_000,
  });
}

export function useSalvarDepartamentoObra() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (row: Parameters<typeof pontoRepo.salvarDepartamentoObra>[0]) =>
      pontoRepo.salvarDepartamentoObra(row),
    onSettled: () => qc.invalidateQueries({ queryKey: cadastroKeys.dePara }),
  });
}
