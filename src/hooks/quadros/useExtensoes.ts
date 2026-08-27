/**
 * ETAPA 2 · Hooks da camada de extensões e vínculos.
 *
 * Regra de performance: no quadro carregamos apenas resumos agregados; no card
 * carregamos vínculos sob demanda. Uma extensão com falha não invalida o card.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  cardTiposRepo,
  cardVinculosRepo,
  kanbanExtensoesRepo,
} from "@/lib/repositories/kanbanExtensoes";
import { getAdapter } from "@/lib/quadros/extensoes/adapters";
import { queryKey } from "@/lib/query-keys";
import { useAuth } from "@/contexts/auth/useAuth";
import type { BoardExtensao, CardTipo, CardVinculo } from "@/lib/quadros/extensoes/tipos";

export const extensoesKeys = {
  catalogo: queryKey("kanban-extensoes"),
  doBoard: (boardId: string) => queryKey("board-extensoes", boardId),
  vinculos: (cardId: string) => queryKey("card-vinculos", cardId),
  logCard: (cardId: string) => queryKey("kanban-extensao-log", cardId),
  tipos: queryKey("card-tipos"),
  porEntidade: (t: string, id: string) => queryKey("cards-por-entidade", t, id),
  busca: (t: string, termo: string) => queryKey("entidade-busca", t, termo),
};

export function useCatalogoExtensoes() {
  return useQuery({
    queryKey: extensoesKeys.catalogo,
    staleTime: 300_000,
    queryFn: () => kanbanExtensoesRepo.listCatalogo(),
  });
}

export function useBoardExtensoes(boardId: string | null | undefined) {
  return useQuery({
    queryKey: extensoesKeys.doBoard(boardId ?? "none"),
    enabled: !!boardId,
    staleTime: 60_000,
    queryFn: async (): Promise<BoardExtensao[]> => kanbanExtensoesRepo.listByBoard(boardId!),
  });
}

export function useAtivarExtensao(boardId: string) {
  const qc = useQueryClient();
  const { currentPlayer } = useAuth();
  return useMutation({
    mutationFn: ({ codigo, ativo }: { codigo: string; ativo: boolean }) =>
      kanbanExtensoesRepo.ativar(boardId, codigo, ativo, currentPlayer?.id ?? null),
    onSettled: () => qc.invalidateQueries({ queryKey: extensoesKeys.doBoard(boardId) }),
  });
}

export function useConfigurarExtensao(boardId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      codigo,
      patch,
    }: {
      codigo: string;
      patch: { mostrar_resumo?: boolean; ordem?: number; config?: Record<string, unknown> };
    }) => kanbanExtensoesRepo.configurar(boardId, codigo, patch),
    onSettled: () => qc.invalidateQueries({ queryKey: extensoesKeys.doBoard(boardId) }),
  });
}

export function useCardTipos() {
  return useQuery({
    queryKey: extensoesKeys.tipos,
    staleTime: 300_000,
    queryFn: async (): Promise<CardTipo[]> => cardTiposRepo.list(),
  });
}

export function useCriarCardTipo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: Parameters<typeof cardTiposRepo.criar>[0]) =>
      cardTiposRepo.criar(payload),
    onSettled: () => qc.invalidateQueries({ queryKey: extensoesKeys.tipos }),
  });
}

export function useAplicarCardTipo(cardId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (tipoId: string | null) => cardTiposRepo.aplicarAoCard(cardId, tipoId),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: queryKey("card-detail", cardId) });
      qc.invalidateQueries({ queryKey: extensoesKeys.vinculos(cardId) });
    },
  });
}

export function useCardVinculos(cardId: string | null | undefined) {
  return useQuery({
    queryKey: extensoesKeys.vinculos(cardId ?? "none"),
    enabled: !!cardId,
    staleTime: 15_000,
    retry: 1,
    queryFn: async (): Promise<CardVinculo[]> => cardVinculosRepo.listByCard(cardId!),
  });
}

export function useCriarVinculo(cardId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      extensao: string;
      entityType: string;
      entityId: string;
      relationship?: string;
      isPrimary?: boolean;
      nomeExibicao?: string;
    }) => cardVinculosRepo.criar({ cardId, ...input }),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: extensoesKeys.vinculos(cardId) });
      qc.invalidateQueries({ queryKey: extensoesKeys.logCard(cardId) });
    },
  });
}

export function useRemoverVinculo(cardId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ linkId, arquivar = true }: { linkId: string; arquivar?: boolean }) =>
      cardVinculosRepo.remover(linkId, arquivar),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: extensoesKeys.vinculos(cardId) });
      qc.invalidateQueries({ queryKey: extensoesKeys.logCard(cardId) });
    },
  });
}

export function useDefinirVinculoPrincipal(cardId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (linkId: string) => cardVinculosRepo.definirPrincipal(linkId),
    onSettled: () => qc.invalidateQueries({ queryKey: extensoesKeys.vinculos(cardId) }),
  });
}

export function useReordenarVinculo(cardId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ linkId, ordem }: { linkId: string; ordem: number }) =>
      cardVinculosRepo.reordenar(linkId, ordem),
    onSettled: () => qc.invalidateQueries({ queryKey: extensoesKeys.vinculos(cardId) }),
  });
}

export function useExecutarAcaoExtensao(cardId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ extensao, acao }: { extensao: string; acao: string }) =>
      cardVinculosRepo.registrarAcao(cardId, extensao, acao),
    onSettled: () => qc.invalidateQueries({ queryKey: extensoesKeys.logCard(cardId) }),
  });
}

export function useExtensaoLog(cardId: string | null | undefined) {
  return useQuery({
    queryKey: extensoesKeys.logCard(cardId ?? "none"),
    enabled: !!cardId,
    staleTime: 30_000,
    queryFn: () => cardVinculosRepo.logByCard(cardId!),
  });
}

/** Navegação inversa: cards vinculados a uma entidade do ERP. */
export function useCardsPorEntidade(entityType: string, entityId: string | null | undefined) {
  return useQuery({
    queryKey: extensoesKeys.porEntidade(entityType, entityId ?? "none"),
    enabled: !!entityId,
    staleTime: 30_000,
    queryFn: () => cardVinculosRepo.cardsPorEntidade(entityType, entityId!),
  });
}

/** Busca de entidades via adaptador (respeita RLS do módulo de origem). */
export function useBuscaEntidades(entityType: string, termo: string, habilitado = true) {
  return useQuery({
    queryKey: extensoesKeys.busca(entityType, termo),
    enabled: habilitado && !!entityType,
    staleTime: 30_000,
    queryFn: async () => {
      const adapter = getAdapter(entityType);
      if (!adapter) return [];
      return adapter.searchEntities(termo, 20);
    },
  });
}
