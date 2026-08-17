// ARC-013 · slice-29 — Boards sob leitura + mutações via TanStack Query.
// Encapsula `boardCamposRepo` e `boardMembrosRepo` como camada interna; componentes
// devem consumir esta API em vez de importar os repositórios diretamente.
import { useMutation, useQueryClient } from "@tanstack/react-query";

import {
  boardCamposRepo,
  boardMembrosRepo,
  boardListasRepo,
  boardsRepo,
  boardAtividadesRepo,
  type BoardListaInsert,
} from "@/lib/repositories/boards";
import { boardFavoritosRepo } from "@/lib/repositories/boardAutomacoes";
import { queryKey } from "@/lib/query-keys";

export const boardsKeys = {
  campos: (boardId: string) => queryKey("board-campos", boardId),
  membros: (boardId: string) => queryKey("board-membros", boardId),
  camposValoresAll: queryKey("card-campos-valores"),
  detail: (boardId: string) => queryKey("board", boardId),
  config: (boardId: string) => queryKey("board", boardId, "config"),
  items: (boardId: string) => queryKey("board-items", boardId),
  atividades: (boardId: string) => queryKey("board-atividades", boardId),
  allRefs: queryKey("boards-all"),
  index: queryKey("boards-index"),
  ativosMin: queryKey("boards-para-mover"),
  favoritos: (userId: string) => queryKey("board-favoritos", userId),
  breadcrumbNome: (boardId: string) => queryKey("breadcrumb-board", boardId),
};

export const boardsQueryFns = {
  listCamposByBoard: (boardId: string) => boardCamposRepo.listByBoard(boardId),
  listMembrosByBoard: (boardId: string) => boardMembrosRepo.listByBoard(boardId),
  getBoardNome: (boardId: string) => boardsRepo.getNome(boardId),
  getBoardInfo: (boardId: string) => boardsRepo.getBoardInfo(boardId),
  getBoardConfig: (boardId: string) => boardsRepo.getConfig(boardId),
  listListasAtivas: (boardId: string) => boardsRepo.listListasAtivas(boardId),
  listAllRefs: () => boardsRepo.listAllRefs(),
  listAtivosMin: () => boardsRepo.listAtivosMin(),
  listIndex: () => boardsRepo.listIndex(),
  itemsResumo: (boardId: string) => boardsRepo.itemsResumo(boardId),
  listFavoritos: (userId: string) => boardFavoritosRepo.listMeus(userId),
  atividadesRecentes: (boardId: string, limit = 50) =>
    boardAtividadesRepo.recentes(boardId, limit),
  primeiraListaAtiva: (boardId: string) => boardListasRepo.primeiraAtiva(boardId),
  subscribeBoardChanges: (boardId: string, onPosicao: () => void, onListas: () => void) =>
    boardsRepo.subscribeBoardChanges(boardId, onPosicao, onListas),
};

/** ETAPA 1 · configuração do quadro (descrição, fundo, visibilidade). */
export function useUpdateBoardConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      patch,
    }: {
      id: string;
      patch: Parameters<typeof boardsRepo.updateConfig>[1];
    }) => boardsRepo.updateConfig(id, patch),
    onSettled: (_d, _e, vars) => {
      qc.invalidateQueries({ queryKey: boardsKeys.config(vars.id) });
      qc.invalidateQueries({ queryKey: boardsKeys.detail(vars.id) });
      qc.invalidateQueries({ queryKey: boardsKeys.index });
    },
  });
}

/** ETAPA 1 · estado operacional da lista (desacopla status do nome da coluna). */
export function useSetBoardListaEstado() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, estado }: { id: string; estado: string | null; boardId?: string }) =>
      boardListasRepo.setEstadoOperacional(id, estado),
    onSettled: (_d, _e, vars) => {
      if (vars?.boardId) qc.invalidateQueries({ queryKey: boardsKeys.detail(vars.boardId) });
    },
  });
}

/** ETAPA 1 · favoritar quadro (persistido por usuário). */
export function useToggleBoardFavorito(userId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ boardId, favorito }: { boardId: string; favorito: boolean }) => {
      if (!userId) throw new Error("Sessão não autenticada.");
      return favorito
        ? boardFavoritosRepo.favoritar(boardId, userId)
        : boardFavoritosRepo.desfavoritar(boardId, userId);
    },
    onSettled: () => {
      if (userId) qc.invalidateQueries({ queryKey: boardsKeys.favoritos(userId) });
    },
  });
}



function invalidateCampos(qc: ReturnType<typeof useQueryClient>, boardId?: string) {
  if (boardId) qc.invalidateQueries({ queryKey: boardsKeys.campos(boardId) });
}

function invalidateMembros(qc: ReturnType<typeof useQueryClient>, boardId?: string) {
  if (boardId) qc.invalidateQueries({ queryKey: boardsKeys.membros(boardId) });
}

export function useInsertBoardCampo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: {
      board_id: string;
      nome: string;
      tipo: string;
      opcoes: string[];
      ordem: number;
    }) => boardCamposRepo.insert(payload),
    onSettled: (_d, _e, vars) => invalidateCampos(qc, vars?.board_id),
  });
}

export function useRemoveBoardCampo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id }: { id: string; boardId: string }) => boardCamposRepo.remove(id),
    onSettled: (_d, _e, vars) => {
      invalidateCampos(qc, vars?.boardId);
      qc.invalidateQueries({ queryKey: boardsKeys.camposValoresAll });
    },
  });
}

export function useInsertBoardMembro() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: { board_id: string; user_id: string; papel: string }) =>
      boardMembrosRepo.insert(payload),
    onSettled: (_d, _e, vars) => invalidateMembros(qc, vars?.board_id),
  });
}

export function useUpdateBoardMembroPapel() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ boardId, userId, papel }: { boardId: string; userId: string; papel: string }) =>
      boardMembrosRepo.updatePapel(boardId, userId, papel),
    onSettled: (_d, _e, vars) => invalidateMembros(qc, vars?.boardId),
  });
}

export function useRemoveBoardMembro() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ boardId, userId }: { boardId: string; userId: string }) =>
      boardMembrosRepo.remove(boardId, userId),
    onSettled: (_d, _e, vars) => invalidateMembros(qc, vars?.boardId),
  });
}

// ----- boards -----
function invalidateBoardDetail(qc: ReturnType<typeof useQueryClient>, boardId?: string) {
  if (boardId) qc.invalidateQueries({ queryKey: boardsKeys.detail(boardId) });
}
function invalidateBoardItems(qc: ReturnType<typeof useQueryClient>, boardId?: string) {
  if (boardId) qc.invalidateQueries({ queryKey: boardsKeys.items(boardId) });
}

export function useSetBoardArquivado() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, arquivado }: { id: string; arquivado: boolean }) =>
      boardsRepo.setArquivado(id, arquivado),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: boardsKeys.index });
      qc.invalidateQueries({ queryKey: boardsKeys.allRefs });
      qc.invalidateQueries({ queryKey: boardsKeys.ativosMin });
    },
  });
}

export function useCreateCustomBoard() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ nome, ownerId }: { nome: string; ownerId: string | null }) =>
      boardsRepo.createCustomReturningId(nome, ownerId),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: boardsKeys.index });
      qc.invalidateQueries({ queryKey: boardsKeys.allRefs });
    },
  });
}

// ----- board_listas -----
export function useCreateBoardLista() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: BoardListaInsert) => boardListasRepo.create(payload),
    onSettled: (_d, _e, vars) => invalidateBoardDetail(qc, (vars as any)?.board_id),
  });
}

export function useInsertBoardListas() {
  return useMutation({
    mutationFn: (rows: BoardListaInsert[]) => boardListasRepo.insertMany(rows),
  });
}

export function useSetBoardListaNome() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, nome }: { id: string; nome: string; boardId?: string }) =>
      boardListasRepo.setNome(id, nome),
    onSettled: (_d, _e, vars) => invalidateBoardDetail(qc, vars?.boardId),
  });
}

export function useSetBoardListaWip() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, wip_limite }: { id: string; wip_limite: number | null; boardId?: string }) =>
      boardListasRepo.setWip(id, wip_limite),
    onSettled: (_d, _e, vars) => invalidateBoardDetail(qc, vars?.boardId),
  });
}

export function useSetBoardListaCor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, cor }: { id: string; cor: string | null; boardId?: string }) =>
      boardListasRepo.setCor(id, cor),
    onSettled: (_d, _e, vars) => invalidateBoardDetail(qc, vars?.boardId),
  });
}

export function useSetBoardListaArquivada() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, arquivada }: { id: string; arquivada: boolean; boardId?: string }) =>
      boardListasRepo.setArquivada(id, arquivada),
    onSettled: (_d, _e, vars) => {
      invalidateBoardDetail(qc, vars?.boardId);
      invalidateBoardItems(qc, vars?.boardId);
    },
  });
}

export function useUpdateBoardListaPosicao() {
  return useMutation({
    mutationFn: async ({ id, posicao }: { id: string; posicao: number }) =>
      await boardListasRepo.updatePosicao(id, posicao),
  });
}
