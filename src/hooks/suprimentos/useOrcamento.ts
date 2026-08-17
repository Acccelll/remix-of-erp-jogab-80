// ARC-004 · Onda 6 — Orçamento (Suprimentos) sob TanStack Query.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { suprimentosRepo } from "@/lib/repositories/suprimentos";
import { queryKey } from "@/lib/query-keys";
export { useInsumosPrecos } from "@/hooks/suprimentos/useInsumos";

export type Atividade = {
  id: string;
  obra_id: string;
  descricao: string | null;
  ordem: number;
  custo: number | null;
  custo_baseline: number | null;
};

export type OrcItem = {
  id: string;
  cronograma_item_id: string | null;
  composicao_id: string | null;
  descricao: string;
  unidade: string;
  quantidade: number;
  preco_unitario: number;
  valor_total: number | null;
  ordem: number;
};

export type Composicao = { id: string; descricao: string; unidade: string; ativo: boolean };
export type CompItem = { composicao_id: string; insumo_id: string; coeficiente: number };
export type Insumo = { id: string; preco_unitario: number };
export type DemandaMaoObraOrcamento = { obra_id: string; funcao: string; quantidade: number };

export const orcamentoKeys = {
  composicoes: queryKey("suprimentos_composicoes"),
  composicaoItens: queryKey("suprimentos_composicao_itens"),
  atividades: (obraId: string) => queryKey("orcamento_atividades", obraId),
  itens: (obraId: string) => queryKey("orcamento_itens", obraId),
  demandaMaoObraBoard: queryKey("orcamento_itens", "demanda-mao-obra-board"),
};

export function useComposicoes() {
  return useQuery({
    queryKey: orcamentoKeys.composicoes,
    queryFn: async () => ((await suprimentosRepo.listComposicoesAtivas()) || []) as Composicao[],
    staleTime: 60_000,
  });
}

export function useComposicaoItens() {
  return useQuery({
    queryKey: orcamentoKeys.composicaoItens,
    queryFn: async () => ((await suprimentosRepo.listComposicaoItens()) || []) as CompItem[],
    staleTime: 60_000,
  });
}


export function useAtividadesObra(obraId: string) {
  return useQuery({
    queryKey: orcamentoKeys.atividades(obraId),
    queryFn: async () =>
      ((await suprimentosRepo.listCronogramaItensParaOrcamento(obraId)) || []) as Atividade[],
    enabled: !!obraId,
    staleTime: 30_000,
  });
}

export function useOrcamentoItensObra(obraId: string) {
  return useQuery({
    queryKey: orcamentoKeys.itens(obraId),
    queryFn: async () =>
      ((await suprimentosRepo.listOrcamentoItensPorObra(obraId)) || []) as OrcItem[],
    enabled: !!obraId,
    staleTime: 30_000,
  });
}

export function useDemandaMaoObraBoard(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: orcamentoKeys.demandaMaoObraBoard,
    queryFn: async () =>
      ((await suprimentosRepo.listDemandaMaoObraPorOrcamento()) || []) as DemandaMaoObraOrcamento[],
    enabled: options?.enabled ?? true,
    staleTime: 60_000,
  });
}

export function useCreateOrcamentoItem(obraId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: Parameters<typeof suprimentosRepo.createOrcamentoItem>[0]) =>
      suprimentosRepo.createOrcamentoItem(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: orcamentoKeys.itens(obraId) });
      qc.invalidateQueries({ queryKey: orcamentoKeys.atividades(obraId) });
    },
  });
}

export function useDeleteOrcamentoItem(obraId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => suprimentosRepo.deleteOrcamentoItem(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: orcamentoKeys.itens(obraId) });
      qc.invalidateQueries({ queryKey: orcamentoKeys.atividades(obraId) });
    },
  });
}

export function useAprovarOrcamentoBaseline(obraId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => suprimentosRepo.aprovarOrcamentoObra(obraId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: orcamentoKeys.itens(obraId) });
      qc.invalidateQueries({ queryKey: orcamentoKeys.atividades(obraId) });
    },
  });
}
