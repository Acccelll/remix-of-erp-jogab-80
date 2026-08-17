// @ts-nocheck
// Repositório dedicado ao importador de Trello — centraliza todos os
// acessos diretos ao banco usados por src/lib/cards/trello-import.ts.
import { supabase } from "@/integrations/supabase/client";

const sb = supabase as any;

export const trelloImportRepo = {
  // Auth
  async getCurrentUserId(): Promise<string | null> {
    const { data } = await sb.auth.getUser();
    return data?.user?.id ?? null;
  },

  // Labels
  async listLabelsByNomes(nomes: string[]) {
    const { data, error } = await sb.from("card_labels").select("id, nome, cor").in("nome", nomes);
    if (error) throw error;
    return data ?? [];
  },
  async insertLabels(rows: any[]) {
    const { data, error } = await sb.from("card_labels").insert(rows).select("id, nome, cor");
    if (error) throw error;
    return data ?? [];
  },

  // Listas de board
  async listBoardListas(boardId: string) {
    const { data, error } = await sb
      .from("board_listas")
      .select("id,nome,posicao,origem_externa,origem_id")
      .eq("board_id", boardId)
      .eq("arquivada", false)
      .order("posicao");
    if (error) throw error;
    return data ?? [];
  },
  async listPosicoesAtivas(boardId: string) {
    const { data } = await sb
      .from("card_board_posicao")
      .select("lista_id")
      .eq("board_id", boardId)
      .eq("arquivada", false);
    return data ?? [];
  },
  async getPosicaoMaxLista(boardId: string) {
    const { data } = await sb
      .from("board_listas")
      .select("posicao")
      .eq("board_id", boardId)
      .order("posicao", { ascending: false })
      .limit(1);
    return (data?.[0]?.posicao ?? 0) as number;
  },
  async marcarListaOrigemTrello(id: string, origemId: string) {
    await sb
      .from("board_listas")
      .update({ origem_externa: "trello", origem_id: origemId })
      .eq("id", id)
      .is("origem_id", null);
  },
  async insertBoardListas(rows: any[]) {
    return await sb.from("board_listas").insert(rows).select("id");
  },
  async getBoardListasPorOrigem(boardId: string, origens: string[]) {
    return await sb
      .from("board_listas")
      .select("id,origem_id")
      .eq("board_id", boardId)
      .eq("origem_externa", "trello")
      .in("origem_id", origens);
  },

  // Custom fields
  async listCustomFields(externalIds: string[]) {
    const { data } = await sb
      .from("card_custom_fields")
      .select("id, external_id")
      .eq("fonte", "trello")
      .in("external_id", externalIds);
    return data ?? [];
  },
  async insertCustomFields(rows: any[]) {
    return await sb.from("card_custom_fields").insert(rows).select("id, external_id");
  },

  // Profiles / members
  async listAllProfiles() {
    const { data, error } = await sb.from("profiles").select("id, login, nome");
    if (error) throw error;
    return data ?? [];
  },
  async upsertBoardMembros(rows: any[]) {
    return await sb
      .from("board_membros")
      .upsert(rows, { onConflict: "board_id,user_id", ignoreDuplicates: true });
  },

  // Cards
  async listCardsExistentes(origemIds: string[]) {
    const { data } = await sb
      .from("cards")
      .select("id, origem_id, created_at")
      .eq("origem_externa", "trello")
      .in("origem_id", origemIds)
      .order("created_at", { ascending: false });
    return data ?? [];
  },
  async updateCard(id: string, payload: any) {
    return await sb.from("cards").update(payload).eq("id", id);
  },
  async insertCardReturningId(payload: any) {
    return await sb.from("cards").insert(payload).select("id").single();
  },
  async clearCardVolatile(cardId: string) {
    await Promise.all([
      sb.from("card_label_links").delete().eq("card_id", cardId),
      sb.from("card_checklist_itens").delete().eq("card_id", cardId),
      sb.from("card_membros_externos").delete().eq("card_id", cardId).eq("fonte", "trello"),
      sb.from("card_custom_field_valores").delete().eq("card_id", cardId),
    ]);
  },
  async upsertCardSetor(cardId: string, setor: string) {
    return await sb
      .from("card_setores")
      .upsert({ card_id: cardId, setor }, { onConflict: "card_id,setor", ignoreDuplicates: true });
  },
  async upsertCardBoardPosicao(row: any) {
    return await sb.from("card_board_posicao").upsert(row, { onConflict: "card_id,board_id" });
  },
  async insertLabelLinks(rows: any[]) {
    return await sb.from("card_label_links").insert(rows);
  },
  async insertChecklistItens(rows: any[]) {
    return await sb.from("card_checklist_itens").insert(rows);
  },
  async insertComentarios(rows: any[]) {
    return await sb.from("card_comentarios").insert(rows);
  },
  async insertAnexos(rows: any[]) {
    return await sb.from("card_anexos").insert(rows);
  },
  async insertMembrosExternos(rows: any[]) {
    return await sb.from("card_membros_externos").insert(rows);
  },
  async insertCustomFieldValores(rows: any[]) {
    return await sb.from("card_custom_field_valores").insert(rows);
  },
  async insertAtividades(rows: any[]) {
    return await sb.from("card_atividades").insert(rows);
  },
};
