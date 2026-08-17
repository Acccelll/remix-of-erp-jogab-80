// ARC-013 · Onda 6 — Cards sob leitura + mutações via TanStack Query (fonte única).
// Encapsula `cardsRepo` como camada interna; componentes/hooks devem consumir esta API.
import { supabase } from "@/integrations/supabase/client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { cardsRepo, type CardUpdate } from "@/lib/repositories/cards";
import {
  cardSetoresRepo,
  cardRecursosRepo,
  cardGruposNegociacaoRepo,
  cardsExtraRepo,
  cardLabelsRepo,
  cardLabelLinksRepo,
  cardMembrosRepo,
  cardChecklistItensRepo,
  cardAnexosRepo,
  cardComentariosRepo,
  cardAtividadesRepo,
  cardCustomFieldValoresRepo,
  cardBoardPosicaoRepo,
  cardSecoesVisiveisRepo,
  cardLocalRepo,
  cardCamposValoresRepo,
  profilesRepo,
} from "@/lib/repositories/cardsExtra";
import { notificacoesRepo } from "@/lib/repositories/notificacoes";
import { queryKey } from "@/lib/query-keys";
import { runOnMove } from "@/lib/quadros/automacoes";
import { boardAutomacoesKeys, toAutomacao } from "@/hooks/quadros/useBoardAutomacoes";
import type { BoardAutomacaoRow } from "@/lib/repositories/boardAutomacoes";

export const cardsKeys = {
  all: queryKey("cards"),
  detail: (cardId: string) => queryKey("card-generico", cardId),
  alertasPrazo: queryKey("alertas-prazo"),
  cascataPorObra: (obraId: string) => queryKey("cascata-por-item", obraId),
  daLinha: (itemId: string) => queryKey("cards-da-linha", itemId),
  kanban: queryKey("kanban-cards"),
  gruposNegociacaoCount: queryKey("grupos-negociacao-cnt"),
  labels: queryKey("card-labels"),
  membros: (cardId: string) => queryKey("card-membros", cardId),
  checklist: (cardId: string) => queryKey("card-checklist", cardId),
  anexos: (cardId: string) => queryKey("card-anexos", cardId),
  coverPaths: (cardIds: string[]) => queryKey("card-covers", ...cardIds),
  comentarios: (cardId: string) => queryKey("card-coments", cardId),
  atividades: (cardId: string) => queryKey("card-atividades", cardId),
  customFieldValores: (cardId: string) => queryKey("card-custom-field-valores", cardId),
  secoesVisiveis: (cardId: string) => queryKey("card-secoes-visiveis", cardId),
  local: (cardId: string) => queryKey("card-local", cardId),
  temLocal: (cardId: string) => queryKey("card-tem-local", cardId),
  camposValores: (cardId: string) => queryKey("card-campos-valores", cardId),
};

export const cardsQueryFns = {
  listAbertosMin: () => cardsRepo.listAbertosMin(),
  listComRecursosPorObra: (obraId: string) => cardsRepo.listComRecursosPorObra(obraId),
  listByCronogramaItem: (itemId: string) => cardsRepo.listByCronogramaItem(itemId),
  getCronogramaItemId: (cardId: string) => cardsRepo.getCronogramaItemId(cardId),
  getParaClonar: (cardId: string) => cardsRepo.getParaClonar(cardId),
  listKanbanByIds: (ids: string[], obraId?: string) => cardsRepo.listKanbanByIds(ids, obraId),
  listSetoresByCard: (cardId: string) => cardSetoresRepo.listByCard(cardId),
  listSetoresBySetor: (setor: string, subsetor?: string) =>
    cardSetoresRepo.listBySetor(setor, subsetor),
  listStatusSetoresPorCardsESetor: (cardIds: string[], setor: string) =>
    cardSetoresRepo.listStatusPorCardsESetor(cardIds, setor),
  listAlertasRecursosPorCards: (cardIds: string[]) => cardRecursosRepo.listAlertasPorCards(cardIds),
  listKanbanRecursosPorCards: (cardIds: string[]) => cardRecursosRepo.listKanbanPorCards(cardIds),
  getRecursoByCard: (cardId: string) => cardRecursosRepo.getByCard(cardId),
  listGruposNegociacao: () => cardGruposNegociacaoRepo.listResumo(),
  listGruposNegociacaoOrdenados: () => cardGruposNegociacaoRepo.listOrdenados(),
  getCardGenericoDialog: (cardId: string) => cardsExtraRepo.getGenericoDialog(cardId),
  getCardFull: (cardId: string) => cardsExtraRepo.getFull(cardId),
  listCardLabels: () => cardLabelsRepo.listResumo(),
  listCardLabelLinksByCard: (cardId: string) => cardLabelLinksRepo.listByCard(cardId),
  listCardMembroUserIds: async (cardId: string) => {
    const data = await cardMembrosRepo.listUsers(cardId);
    return (data ?? []).map((r: any) => r.user_id as string);
  },
  listChecklistByCard: (cardId: string) => cardChecklistItensRepo.listByCard(cardId),
  listAnexosByCard: (cardId: string) => cardAnexosRepo.listByCard(cardId),
  listCoverPathsByCards: (cardIds: string[]) => cardAnexosRepo.listCoverPathsByCards(cardIds),
  listComentariosByCard: (cardId: string) => cardComentariosRepo.listByCard(cardId),
  listComentariosByCardFull: (cardId: string) => cardComentariosRepo.listByCardFull(cardId),
  listAtividadesByCard: (cardId: string) => cardAtividadesRepo.listByCard(cardId),
  listSecoesVisiveisByCard: async (cardId: string) => {
    const data = await cardSecoesVisiveisRepo.listSecoesByCard(cardId);
    return (data ?? []).map((r: any) => r.secao as string);
  },
  maxPosBoardPosicaoNaLista: (listaId: string) => cardBoardPosicaoRepo.maxPosNaLista(listaId),
  getLocalByCard: (cardId: string) => cardLocalRepo.getByCard(cardId),
  existsLocalByCard: (cardId: string) => cardLocalRepo.existsByCard(cardId),
  listCamposValoresByCard: (cardId: string) => cardCamposValoresRepo.listByCard(cardId),
  listProfilesMin: () => profilesRepo.listMin(),
  searchProfiles: (term: string) => profilesRepo.search(term),
};

export function useInsertNotificacao() {
  return useMutation({
    mutationFn: (payload: { user_id: string; tipo: string; card_id: string; texto: string }) =>
      notificacoesRepo.insertCard(payload),
  });
}

export function useInsertNotificacoes() {
  return useMutation({
    mutationFn: (rows: Array<{ user_id: string; tipo: string; card_id: string; texto: string }>) =>
      notificacoesRepo.insertManyCard(rows),
  });
}

function invalidateCamposValores(qc: ReturnType<typeof useQueryClient>, cardId?: string) {
  invalidateAllCards(qc, cardId);
  if (cardId) qc.invalidateQueries({ queryKey: cardsKeys.camposValores(cardId) });
}

export function useUpsertCardCampoValor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ cardId, campoId, valor }: { cardId: string; campoId: string; valor: unknown }) =>
      cardCamposValoresRepo.upsertOne(cardId, campoId, valor),
    onSettled: (_d, _e, vars) => invalidateCamposValores(qc, vars?.cardId),
  });
}

function invalidateBoardItems(qc: ReturnType<typeof useQueryClient>, boardId?: string | null) {
  if (boardId) qc.invalidateQueries({ queryKey: ["board-items", boardId] });
}

export function useInsertCardBoardPosicao() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: any) => cardBoardPosicaoRepo.insert(payload),
    onSettled: (_d, _e, vars) => invalidateBoardItems(qc, vars?.board_id),
  });
}

export function useUpdateCardBoardPosicaoPosicao() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      cardId,
      boardId,
      posicao,
    }: {
      cardId: string;
      boardId: string;
      posicao: number;
    }) => await cardBoardPosicaoRepo.updatePosicao(cardId, boardId, posicao),
    onSettled: (_d, _e, vars) => invalidateBoardItems(qc, vars?.boardId),
  });
}

export function useUpdateCardBoardPosicaoListaEPosicao() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      cardId,
      boardId,
      listaId,
      posicao,
    }: {
      cardId: string;
      boardId: string;
      listaId: string;
      posicao: number;
    }) => await cardBoardPosicaoRepo.updateListaEPosicao(cardId, boardId, listaId, posicao),
    onSuccess: (_d, vars) => {
      // ETAPA 1 · automações vêm de `board_automacoes` (cache do React Query).
      try {
        const regras = (
          (qc.getQueryData(boardAutomacoesKeys.byBoard(vars.boardId)) as
            BoardAutomacaoRow[] | undefined) ?? []
        ).map(toAutomacao);
        const acoes = runOnMove(regras, {
          boardId: vars.boardId,
          cardId: vars.cardId,
          listaDestinoId: vars.listaId,
        });
        for (const a of acoes) {
          if (a.tipo === "notificar") {
            toast.message(a.mensagem);
          } else if (a.tipo === "adicionar_label") {
            // best-effort; erro de FK/duplicidade é silencioso (regra idempotente)
            cardLabelLinksRepo
              .insert(vars.cardId, a.labelId)
              .then(() => toast.message(`Etiqueta aplicada: ${a.labelNome ?? a.labelId}`))
              .catch((err) => {
                // Silently ignore FK/duplicate errors — idempotent operation
                console.debug("Label insert failed (expected if duplicate):", err);
              });
          }
        }
      } catch {
        /* automações são best-effort, não devem quebrar o move */
      }
    },
    onSettled: (_d, _e, vars) => invalidateBoardItems(qc, vars?.boardId),
  });
}

export function useReordenarCardsNaLista() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      boardId,
      listaId,
      cardIds,
    }: {
      boardId: string;
      listaId: string;
      cardIds: string[];
    }) => {
      const { error } = await supabase.rpc("board_reordenar", {
        p_board_id: boardId,
        p_lista_id: listaId,
        p_card_ids: cardIds,
      });
      if (error) throw error;
    },
    onMutate: async ({ boardId, listaId, cardIds }) => {
      await qc.cancelQueries({ queryKey: ["board-items", boardId] });
      const previousItems = qc.getQueryData(["board-items", boardId]) as any[];

      if (previousItems) {
        const newItems = previousItems.map((item) => {
          if (item.lista_id === listaId) {
            const newIndex = cardIds.indexOf(item.card_id);
            if (newIndex !== -1) {
              return { ...item, posicao: (newIndex + 1) * 10 };
            }
          }
          return item;
        });
        qc.setQueryData(["board-items", boardId], newItems);
      }

      return { previousItems };
    },
    onError: (_err, vars, context) => {
      if (context?.previousItems) {
        qc.setQueryData(["board-items", vars.boardId], context.previousItems);
      }
      toast.error("Erro ao reordenar cards. Tente novamente.");
    },
    onSettled: (_d, _e, vars) => invalidateBoardItems(qc, vars?.boardId),
  });
}

export function useMoverCardBoardPosicaoParaBoard() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      cardId,
      deBoardId,
      paraBoardId,
      listaId,
      posicao,
    }: {
      cardId: string;
      deBoardId: string;
      paraBoardId: string;
      listaId: string;
      posicao: number;
    }) => cardBoardPosicaoRepo.moverParaBoard(cardId, deBoardId, paraBoardId, listaId, posicao),
    onSettled: (_d, _e, vars) => {
      invalidateBoardItems(qc, vars?.deBoardId);
      invalidateBoardItems(qc, vars?.paraBoardId);
    },
  });
}

export function useCriarCardBoardAtomico() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: {
      p_board_id: string;
      p_lista_id: string;
      p_titulo: string;
      p_criado_por: string;
    }) => cardBoardPosicaoRepo.criarCardAtomico(payload),
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["board-items", vars.p_board_id] });
      qc.invalidateQueries({ queryKey: ["board", vars.p_board_id] });
    },
  });
}

function invalidateSecoesVisiveis(qc: ReturnType<typeof useQueryClient>, cardId?: string) {
  invalidateAllCards(qc, cardId);
  if (cardId) qc.invalidateQueries({ queryKey: cardsKeys.secoesVisiveis(cardId) });
}

export function useUpsertCardSecaoVisivel() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ cardId, secao }: { cardId: string; secao: string }) =>
      cardSecoesVisiveisRepo.upsert(cardId, secao),
    onSettled: (_d, _e, vars) => invalidateSecoesVisiveis(qc, vars?.cardId),
  });
}

export function useRemoveCardSecaoVisivel() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ cardId, secao }: { cardId: string; secao: string }) =>
      cardSecoesVisiveisRepo.remove(cardId, secao),
    onSettled: (_d, _e, vars) => invalidateSecoesVisiveis(qc, vars?.cardId),
  });
}

function invalidateCustomFieldValores(qc: ReturnType<typeof useQueryClient>, cardId?: string) {
  invalidateAllCards(qc, cardId);
  if (cardId) qc.invalidateQueries({ queryKey: cardsKeys.customFieldValores(cardId) });
}

export function useRemoveCardCustomFieldValoresByCard() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (cardId: string) => cardCustomFieldValoresRepo.removeByCard(cardId),
    onSettled: (_d, _e, cardId) => invalidateCustomFieldValores(qc, cardId),
  });
}

function invalidateLocal(qc: ReturnType<typeof useQueryClient>, cardId?: string) {
  invalidateAllCards(qc, cardId);
  if (cardId) {
    qc.invalidateQueries({ queryKey: cardsKeys.local(cardId) });
    qc.invalidateQueries({ queryKey: cardsKeys.temLocal(cardId) });
  }
}

export function useUpsertCardLocal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: {
      card_id: string;
      endereco: string | null;
      lat: number | null;
      lng: number | null;
    }) => cardLocalRepo.upsertByCard(payload),
    onSettled: (_d, _e, vars) => invalidateLocal(qc, vars?.card_id),
  });
}

export function useRemoveCardLocalByCard() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (cardId: string) => cardLocalRepo.removeByCard(cardId),
    onSettled: (_d, _e, cardId) => invalidateLocal(qc, cardId),
  });
}

function invalidateAtividades(qc: ReturnType<typeof useQueryClient>, cardId?: string) {
  invalidateAllCards(qc, cardId);
  if (cardId) qc.invalidateQueries({ queryKey: cardsKeys.atividades(cardId) });
}

export function useInsertCardAtividade() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ cardId, payload }: { cardId: string; payload: any }) =>
      cardAtividadesRepo.insert(payload),
    onSettled: (_d, _e, vars) => invalidateAtividades(qc, vars?.cardId),
  });
}

function invalidateComentarios(qc: ReturnType<typeof useQueryClient>, cardId?: string) {
  invalidateAllCards(qc, cardId);
  if (cardId) qc.invalidateQueries({ queryKey: cardsKeys.comentarios(cardId) });
}

export function useInsertCardComentario() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ cardId, payload }: { cardId: string; payload: any }) =>
      cardComentariosRepo.insert(payload),
    onSettled: (_d, _e, vars) => invalidateComentarios(qc, vars?.cardId),
  });
}

function invalidateAnexos(qc: ReturnType<typeof useQueryClient>, cardId?: string) {
  invalidateAllCards(qc, cardId);
  if (cardId) qc.invalidateQueries({ queryKey: cardsKeys.anexos(cardId) });
}

export function useInsertCardAnexo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ cardId, payload }: { cardId: string; payload: any }) =>
      cardAnexosRepo.insert(payload),
    onSettled: (_d, _e, vars) => invalidateAnexos(qc, vars?.cardId),
  });
}

export function useRemoveCardAnexo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id }: { id: string; cardId?: string }) => cardAnexosRepo.remove(id),
    onSettled: (_d, _e, vars) => invalidateAnexos(qc, vars?.cardId),
  });
}

export function useRemoveCardAnexosByCard() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (cardId: string) => cardAnexosRepo.removeByCard(cardId),
    onSettled: (_d, _e, cardId) => invalidateAnexos(qc, cardId),
  });
}

function invalidateChecklist(qc: ReturnType<typeof useQueryClient>, cardId?: string) {
  invalidateAllCards(qc, cardId);
  if (cardId) qc.invalidateQueries({ queryKey: cardsKeys.checklist(cardId) });
}

export function useInsertChecklistItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ cardId, payload }: { cardId: string; payload: any }) =>
      cardChecklistItensRepo.insert(payload),
    onSettled: (_d, _e, vars) => invalidateChecklist(qc, vars?.cardId),
  });
}

export function useInsertChecklistItems() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ cardId, rows }: { cardId: string; rows: any[] }) =>
      cardChecklistItensRepo.insertMany(rows),
    onSettled: (_d, _e, vars) => invalidateChecklist(qc, vars?.cardId),
  });
}

export function useSetChecklistItemConcluido() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, concluido }: { id: string; concluido: boolean; cardId?: string }) =>
      cardChecklistItensRepo.setConcluido(id, concluido),
    onSettled: (_d, _e, vars) => invalidateChecklist(qc, vars?.cardId),
  });
}

export function useUpdateChecklistItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: any; cardId?: string }) =>
      cardChecklistItensRepo.update(id, patch),
    onSettled: (_d, _e, vars) => invalidateChecklist(qc, vars?.cardId),
  });
}

export function useUpdateChecklistGrupo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ cardId, de, para }: { cardId: string; de: string; para: string }) =>
      cardChecklistItensRepo.updateGrupo(cardId, de, para),
    onSettled: (_d, _e, vars) => invalidateChecklist(qc, vars?.cardId),
  });
}

export function useRemoveChecklistItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id }: { id: string; cardId?: string }) => cardChecklistItensRepo.remove(id),
    onSettled: (_d, _e, vars) => invalidateChecklist(qc, vars?.cardId),
  });
}

export function useRemoveChecklistGrupo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ cardId, grupo }: { cardId: string; grupo: string }) =>
      cardChecklistItensRepo.removeGrupo(cardId, grupo),
    onSettled: (_d, _e, vars) => invalidateChecklist(qc, vars?.cardId),
  });
}

export function useRemoveChecklistByCard() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (cardId: string) => cardChecklistItensRepo.removeByCard(cardId),
    onSettled: (_d, _e, cardId) => invalidateChecklist(qc, cardId),
  });
}

export function useInsertCardMembro() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ cardId, userId }: { cardId: string; userId: string }) =>
      cardMembrosRepo.insert(cardId, userId),
    onSettled: (_data, _error, vars) => {
      invalidateAllCards(qc, vars?.cardId);
      if (vars?.cardId) qc.invalidateQueries({ queryKey: cardsKeys.membros(vars.cardId) });
    },
  });
}

export function useRemoveCardMembro() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ cardId, userId }: { cardId: string; userId: string }) =>
      cardMembrosRepo.remove(cardId, userId),
    onSettled: (_data, _error, vars) => {
      invalidateAllCards(qc, vars?.cardId);
      if (vars?.cardId) qc.invalidateQueries({ queryKey: cardsKeys.membros(vars.cardId) });
    },
  });
}

export function useRemoveCardMembrosByCard() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (cardId: string) => cardMembrosRepo.removeByCard(cardId),
    onSettled: (_data, _error, cardId) => {
      invalidateAllCards(qc, cardId);
      if (cardId) qc.invalidateQueries({ queryKey: cardsKeys.membros(cardId) });
    },
  });
}

export function useInsertCardLabelLink() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ cardId, labelId }: { cardId: string; labelId: string }) =>
      cardLabelLinksRepo.insert(cardId, labelId),
    onSettled: (_data, _error, vars) => invalidateAllCards(qc, vars?.cardId),
  });
}

export function useInsertCardLabelLinks() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (rows: any[]) => cardLabelLinksRepo.insertMany(rows),
    onSettled: (_data, _error, vars) => {
      invalidateAllCards(qc);
      for (const row of vars ?? []) {
        if (row?.card_id) qc.invalidateQueries({ queryKey: cardsKeys.detail(row.card_id) });
      }
    },
  });
}

export function useRemoveCardLabelLink() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ cardId, labelId }: { cardId: string; labelId: string }) =>
      cardLabelLinksRepo.remove(cardId, labelId),
    onSettled: (_data, _error, vars) => invalidateAllCards(qc, vars?.cardId),
  });
}

export function useRemoveCardLabelsByCard() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (cardId: string) => cardLabelLinksRepo.removeByCard(cardId),
    onSettled: (_data, _error, cardId) => invalidateAllCards(qc, cardId),
  });
}

export function useUpdateCardById() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ cardId, patch }: { cardId: string; patch: any }) =>
      cardsExtraRepo.updateById(cardId, patch),
    onSettled: (_data, _error, vars) => invalidateAllCards(qc, vars?.cardId),
  });
}

export const gruposNegociacaoKeys = {
  all: queryKey("grupos-negociacao"),
};

export function useCreateGrupoNegociacao() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (rotulo: string) => cardGruposNegociacaoRepo.createReturning(rotulo),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: gruposNegociacaoKeys.all });
      qc.invalidateQueries({ queryKey: cardsKeys.gruposNegociacaoCount });
    },
  });
}

export function useInsertCardRecurso() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: any) => cardRecursosRepo.insert(payload),
    onSettled: (_data, _error, vars) => invalidateAllCards(qc, vars?.card_id),
  });
}

export function useUpdateCardRecursoByCard() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ cardId, patch }: { cardId: string; patch: any }) =>
      cardRecursosRepo.updateByCard(cardId, patch),
    onSettled: (_data, _error, vars) => invalidateAllCards(qc, vars?.cardId),
  });
}

export function useCardsComRecursosPorObra(obraId: string | undefined) {
  return useQuery({
    queryKey: cardsKeys.cascataPorObra(obraId ?? ""),
    enabled: !!obraId,
    staleTime: 30_000,
    queryFn: () => cardsQueryFns.listComRecursosPorObra(obraId!),
  });
}

export function useCardsDaLinha(itemId: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: cardsKeys.daLinha(itemId),
    enabled: options?.enabled ?? !!itemId,
    staleTime: 30_000,
    queryFn: () => cardsQueryFns.listByCronogramaItem(itemId),
  });
}

function invalidateAllCards(qc: ReturnType<typeof useQueryClient>, cardId?: string) {
  qc.invalidateQueries({ queryKey: cardsKeys.all });
  qc.invalidateQueries({ queryKey: cardsKeys.alertasPrazo });
  qc.invalidateQueries({ queryKey: cardsKeys.kanban });
  if (cardId) qc.invalidateQueries({ queryKey: cardsKeys.detail(cardId) });
}

export function useUpdateCard() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: CardUpdate }) => cardsRepo.update(id, patch),
    onError: (err: Error) => toast.error("Erro ao atualizar card: " + err.message),
    onSettled: (_data, _error, vars) => invalidateAllCards(qc, vars?.id),
  });
}

export function useUpdateGrupoNegociacaoCards() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ ids, grupoId }: { ids: string[]; grupoId: string | null }) =>
      cardsRepo.updateGrupoNegociacao(ids, grupoId),
    onError: (err: Error) => toast.error("Erro ao atribuir grupo: " + err.message),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: cardsKeys.alertasPrazo });
      qc.invalidateQueries({ queryKey: cardsKeys.kanban });
      qc.invalidateQueries({ queryKey: cardsKeys.gruposNegociacaoCount });
    },
  });
}

export function useUpdateCardReturningId() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: CardUpdate }) =>
      cardsRepo.updateReturningId(id, patch),
    onError: (err: Error) => toast.error("Erro ao atualizar card: " + err.message),
    onSettled: (_data, _error, vars) => invalidateAllCards(qc, vars?.id),
  });
}

export function useInsertCard() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: any) => cardsRepo.insertReturningId(payload),
    onSettled: () => invalidateAllCards(qc),
  });
}

export function useInsertCardSetor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: any) => cardSetoresRepo.insert(payload),
    onSettled: (_data, _error, vars) => invalidateAllCards(qc, vars?.card_id),
  });
}

export function useInsertCardSetores() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (rows: any[]) => cardSetoresRepo.insertMany(rows),
    onSettled: (_data, _error, vars) => {
      invalidateAllCards(qc);
      for (const row of vars ?? []) {
        if (row?.card_id) qc.invalidateQueries({ queryKey: cardsKeys.detail(row.card_id) });
      }
    },
  });
}

export function useRemoveCardSetor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ cardId, setor }: { cardId: string; setor: string }) =>
      cardSetoresRepo.remove(cardId, setor),
    onSettled: (_data, _error, vars) => invalidateAllCards(qc, vars?.cardId),
  });
}

export function useUpdateCardSetorStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      cardId,
      setor,
      statusSetor,
    }: {
      cardId: string;
      setor: string;
      statusSetor: string;
    }) => cardSetoresRepo.updateStatus(cardId, setor, statusSetor),
    onSettled: (_data, _error, vars) => invalidateAllCards(qc, vars?.cardId),
  });
}

export function useUpdateCardSetorStatusComSubsetor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      cardId,
      setor,
      subsetor,
      statusSetor,
    }: {
      cardId: string;
      setor: string;
      subsetor: string | null;
      statusSetor: string;
    }) => cardSetoresRepo.updateStatusComSubsetor(cardId, setor, subsetor, statusSetor),
    onSettled: (_data, _error, vars) => invalidateAllCards(qc, vars?.cardId),
  });
}
