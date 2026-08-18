// Fase 2+3 — Solicitação de campo/planejada + triagem do almoxarifado.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  depositosRepo,
  solicitacoesAlmoxarifadoRepo,
  type DepositoRow,
  type SolicitacaoAlmoxarifadoRow,
  type SolicitacaoAlmoxarifadoItemRow,
} from "@/lib/repositories/almoxarifado";
import { queryKey } from "@/lib/query-keys";

export const almoxarifadoKeys = {
  depositos: queryKey("depositos"),
  depositosPorObra: (obraId: string) => queryKey("depositos", "por-obra", obraId),
  solicitacoesPendentes: queryKey("solicitacoes_almoxarifado", "pendentes"),
  itens: (solicitacaoIds: string[]) =>
    queryKey("solicitacao_almoxarifado_itens", solicitacaoIds.join(",")),
};

export function useDepositosAtivos() {
  return useQuery({
    queryKey: almoxarifadoKeys.depositos,
    queryFn: () => depositosRepo.listAtivos() as Promise<DepositoRow[]>,
    staleTime: 60_000,
  });
}

export function useDepositosPorObra(obraId: string) {
  return useQuery({
    queryKey: almoxarifadoKeys.depositosPorObra(obraId),
    queryFn: () => depositosRepo.porObra(obraId) as Promise<DepositoRow[]>,
    enabled: !!obraId,
    staleTime: 60_000,
  });
}

export function useSolicitacoesPendentes() {
  return useQuery({
    queryKey: almoxarifadoKeys.solicitacoesPendentes,
    queryFn: () =>
      solicitacoesAlmoxarifadoRepo.listPendentes() as Promise<SolicitacaoAlmoxarifadoRow[]>,
    staleTime: 15_000,
  });
}

export function useSolicitacaoItens(solicitacaoIds: string[]) {
  return useQuery({
    queryKey: almoxarifadoKeys.itens(solicitacaoIds),
    queryFn: () =>
      solicitacoesAlmoxarifadoRepo.listItens(solicitacaoIds) as Promise<
        SolicitacaoAlmoxarifadoItemRow[]
      >,
    enabled: solicitacaoIds.length > 0,
    staleTime: 15_000,
  });
}

function invalidateSolicitacoes(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: almoxarifadoKeys.solicitacoesPendentes });
  qc.invalidateQueries({ queryKey: queryKey("solicitacao_almoxarifado_itens") });
}

export function useCriarSolicitacaoCampo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: Parameters<typeof solicitacoesAlmoxarifadoRepo.criarSolicitacaoCampo>[0]) =>
      solicitacoesAlmoxarifadoRepo.criarSolicitacaoCampo(payload),
    onError: (err: Error) => toast.error("Erro ao criar solicitação: " + err.message),
    onSettled: () => invalidateSolicitacoes(qc),
  });
}

export function useAtenderDoEstoque() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ itemId, depositoId }: { itemId: string; depositoId: string }) =>
      solicitacoesAlmoxarifadoRepo.atenderDoEstoque(itemId, depositoId),
    onError: (err: Error) => toast.error("Erro ao atender do estoque: " + err.message),
    onSettled: () => invalidateSolicitacoes(qc),
  });
}

export function useEncaminharParaCompras() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (itemId: string) => solicitacoesAlmoxarifadoRepo.encaminharParaCompras(itemId),
    onError: (err: Error) => toast.error("Erro ao encaminhar para compras: " + err.message),
    onSettled: () => invalidateSolicitacoes(qc),
  });
}
