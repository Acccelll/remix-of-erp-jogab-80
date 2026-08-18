// Fase 4 — Nota fiscal de entrada + rastreio.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  notasFiscaisEntradaRepo,
  type NotaFiscalEntradaRow,
  type NotaFiscalEntradaItemRow,
} from "@/lib/repositories/notasFiscaisEntrada";
import { queryKey } from "@/lib/query-keys";

export const notasFiscaisEntradaKeys = {
  recentes: queryKey("notas_fiscais_entrada", "recentes"),
  porOc: (ocId: string) => queryKey("notas_fiscais_entrada", "por-oc", ocId),
  itens: (nfeId: string) => queryKey("nota_fiscal_entrada_itens", nfeId),
};

export function useNotasFiscaisEntradaRecentes(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: notasFiscaisEntradaKeys.recentes,
    queryFn: () => notasFiscaisEntradaRepo.listRecentes() as Promise<NotaFiscalEntradaRow[]>,
    enabled: options?.enabled ?? true,
    staleTime: 30_000,
  });
}

export function useNotaFiscalEntradaItens(nfeId: string) {
  return useQuery({
    queryKey: notasFiscaisEntradaKeys.itens(nfeId),
    queryFn: () => notasFiscaisEntradaRepo.listItens(nfeId) as Promise<NotaFiscalEntradaItemRow[]>,
    enabled: !!nfeId,
    staleTime: 30_000,
  });
}

function invalidateAll(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: notasFiscaisEntradaKeys.recentes });
}

export function useCriarNotaFiscalEntrada() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: Parameters<typeof notasFiscaisEntradaRepo.criar>[0]) =>
      notasFiscaisEntradaRepo.criar(payload),
    onError: (err: Error) => toast.error("Erro ao registrar nota fiscal: " + err.message),
    onSettled: () => invalidateAll(qc),
  });
}

export function useGerarTituloNotaFiscalEntrada() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (notaFiscalEntradaId: string) =>
      notasFiscaisEntradaRepo.gerarTitulo(notaFiscalEntradaId),
    onError: (err: Error) => toast.error("Erro ao gerar título: " + err.message),
    onSettled: () => invalidateAll(qc),
  });
}
