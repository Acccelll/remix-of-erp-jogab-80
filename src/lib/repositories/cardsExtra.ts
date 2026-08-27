// @ts-nocheck
import { supabase } from "@/integrations/supabase/client";

function unwrap<T>(res: { data: T | null; error: unknown }): T {
  if (res.error) throw res.error as Error;
  return res.data as T;
}

// ----- card_anexos -----
export const cardAnexosRepo = {
  async listByCard(cardId: string): Promise<any[]> {
    return unwrap<any[]>(
      await supabase
        .from("card_anexos")
        .select("id, nome, storage_path, tamanho, mime, enviado_por, created_at")
        .eq("card_id", cardId)
        .order("created_at", { ascending: false }),
    );
  },
  async insert(payload: any) {
    return await supabase.from("card_anexos").insert(payload);
  },
  async remove(id: string) {
    return await supabase.from("card_anexos").delete().eq("id", id);
  },
  async removeByCard(cardId: string) {
    return await supabase.from("card_anexos").delete().eq("card_id", cardId);
  },
  async insertMany(rows: any[]) {
    if (!rows.length) return { data: null, error: null };
    return await supabase.from("card_anexos").insert(rows);
  },
  async listCoverPathsByCards(
    cardIds: string[],
  ): Promise<{ card_id: string; storage_path: string }[]> {
    if (!cardIds.length) return [];
    const { data, error } = await supabase
      .from("card_anexos")
      .select("card_id, storage_path, mime, created_at")
      .in("card_id", cardIds)
      .like("mime", "image/%")
      .order("created_at", { ascending: true });
    if (error) throw error;
    return (data ?? []) as any;
  },
};

// Colunas explícitas — evita `select("*")` (PERF-002 / Onda 4).
const CARD_CHECKLIST_ITENS_COLS =
  "id, card_id, texto, concluido, ordem, created_at, updated_at, grupo, responsavel_id, prazo";
const CARD_SETORES_COLS = "card_id, setor, created_at";
const CARD_RECURSOS_COLS =
  "id, card_id, tipo_recurso, prazo_notif_compras, prazo_pedido, prazo_prod_iniciar, prazo_notif_producao, data_necessidade_obra, created_at, updated_at";
const CARDS_FULL_COLS =
  "id, numero, tipo, titulo, descricao, status, obra_id, responsavel_id, criado_por, data_inicio, prazo, lembrete, due_complete, arquivado, posicao, capa_cor, capa_url, cronograma_item_id, grupo_negociacao_id, origem_externa, origem_id, origem_url, created_at, updated_at";

// ----- card_checklist_itens -----
export const cardChecklistItensRepo = {
  async listByCard(cardId: string): Promise<any[]> {
    return unwrap<any[]>(
      await supabase
        .from("card_checklist_itens")
        .select(CARD_CHECKLIST_ITENS_COLS)
        .eq("card_id", cardId)
        .order("ordem"),
    );
  },
  async insert(payload: any) {
    return await supabase.from("card_checklist_itens").insert(payload);
  },
  async insertMany(rows: any[]) {
    if (!rows.length) return { data: null, error: null };
    return await supabase.from("card_checklist_itens").insert(rows);
  },
  async setConcluido(id: string, concluido: boolean) {
    return await supabase.from("card_checklist_itens").update({ concluido }).eq("id", id);
  },
  async update(id: string, patch: any) {
    return await supabase.from("card_checklist_itens").update(patch).eq("id", id);
  },
  async updateGrupo(cardId: string, de: string, para: string) {
    return await supabase
      .from("card_checklist_itens")
      .update({ grupo: para })
      .eq("card_id", cardId)
      .eq("grupo", de);
  },
  async remove(id: string) {
    return await supabase.from("card_checklist_itens").delete().eq("id", id);
  },
  async removeGrupo(cardId: string, grupo: string) {
    return await supabase
      .from("card_checklist_itens")
      .delete()
      .eq("card_id", cardId)
      .eq("grupo", grupo);
  },
  async removeByCard(cardId: string) {
    return await supabase.from("card_checklist_itens").delete().eq("card_id", cardId);
  },
};

// ----- card_membros -----
export const cardMembrosRepo = {
  async listUsers(cardId: string): Promise<any[]> {
    return unwrap<any[]>(
      await supabase.from("card_membros").select("user_id").eq("card_id", cardId),
    );
  },
  /** Ids dos cards em que o usuário é membro (dashboard home). */
  async listCardIdsByUser(userId: string): Promise<string[]> {
    return await this.listCardIdsByUsers([userId]);
  },
  async listCardIdsByUsers(userIds: string[]): Promise<string[]> {
    if (!userIds.length) return [];
    const rows = await unwrap<any[]>(
      await supabase.from("card_membros").select("card_id").in("user_id", userIds),
    );
    return Array.from(new Set(rows.map((r) => String(r.card_id))));
  },

  async insert(cardId: string, user_id: string) {
    return await supabase.from("card_membros").insert({ card_id: cardId, user_id });
  },
  async remove(cardId: string, user_id: string) {
    return await supabase
      .from("card_membros")
      .delete()
      .eq("card_id", cardId)
      .eq("user_id", user_id);
  },
  async removeByCard(cardId: string) {
    return await supabase.from("card_membros").delete().eq("card_id", cardId);
  },
};

// ----- card_setores -----
export const cardSetoresRepo = {
  async listByCard(cardId: string): Promise<any[]> {
    return unwrap<any[]>(
      await supabase.from("card_setores").select(CARD_SETORES_COLS).eq("card_id", cardId),
    );
  },
  async insert(payload: any) {
    return await supabase.from("card_setores").insert(payload);
  },
  async remove(cardId: string, setor: string) {
    return await supabase.from("card_setores").delete().eq("card_id", cardId).eq("setor", setor);
  },
  async insertMany(rows: any[]) {
    if (!rows.length) return { data: null, error: null };
    return await supabase.from("card_setores").insert(rows);
  },
  async updateStatus(cardId: string, setor: string, status_setor: string) {
    return await supabase
      .from("card_setores")
      .update({ status_setor })
      .eq("card_id", cardId)
      .eq("setor", setor);
  },
  async updateStatusComSubsetor(
    cardId: string,
    setor: string,
    subsetor: string | null,
    status_setor: string,
  ) {
    let q = supabase
      .from("card_setores")
      .update({ status_setor })
      .eq("card_id", cardId)
      .eq("setor", setor);
    if (subsetor) q = q.eq("subsetor", subsetor);
    return await q;
  },
  async listBySetor(setor: string, subsetor?: string) {
    let q = supabase
      .from("card_setores")
      .select("card_id,setor,status_setor,subsetor")
      .eq("setor", setor);
    if (subsetor) q = q.eq("subsetor", subsetor);
    return await q;
  },
  async listStatusPorCardsESetor(cardIds: string[], setor: string) {
    if (!cardIds.length) return { data: [] as any[], error: null };
    return await supabase
      .from("card_setores")
      .select("card_id,status_setor")
      .eq("setor", setor)
      .in("card_id", cardIds);
  },
};

// ----- card_recursos -----
export const cardRecursosRepo = {
  async getByCard(cardId: string): Promise<any> {
    return await supabase
      .from("card_recursos")
      .select(CARD_RECURSOS_COLS)
      .eq("card_id", cardId)
      .maybeSingle();
  },
  async insert(payload: any) {
    return await supabase.from("card_recursos").insert(payload);
  },
  async updateByCard(cardId: string, patch: any) {
    return await supabase.from("card_recursos").update(patch).eq("card_id", cardId);
  },
  async listAlertasPorCards(cardIds: string[]): Promise<any[]> {
    if (!cardIds.length) return [];
    const { data, error } = await supabase
      .from("card_recursos")
      .select("card_id,tipo_recurso,prazo_notif_compras,prazo_notif_producao")
      .in("card_id", cardIds);
    if (error) throw error;
    return data ?? [];
  },
  async listKanbanPorCards(cardIds: string[]) {
    if (!cardIds.length) return { data: [] as any[], error: null };
    return await supabase
      .from("card_recursos")
      .select("card_id,tipo_recurso,prazo_pedido,data_necessidade_obra,valor_estimado,valor_oc")
      .in("card_id", cardIds);
  },
};

export const leadTimeTemplatesRepo = {
  async listPorObraOuGlobal(obraId: string) {
    const { data, error } = await supabase
      .from("lead_time_templates")
      .select(
        "tipo_recurso, obra_id, dias_necessidade, dias_pedido, dias_notif_compras, dias_prod_iniciar, dias_notif_producao",
      )
      .or(`obra_id.eq.${obraId},obra_id.is.null`);
    if (error) throw error;
    return data ?? [];
  },
};

// ----- card_labels -----
export const cardLabelsRepo = {
  async listResumo(): Promise<any[]> {
    return unwrap<any[]>(await supabase.from("card_labels").select("id, nome, cor").order("nome"));
  },
};

// ----- card_label_links -----
export const cardLabelLinksRepo = {
  async insert(cardId: string, labelId: string) {
    return await supabase.from("card_label_links").insert({ card_id: cardId, label_id: labelId });
  },
  async insertMany(rows: any[]) {
    if (!rows.length) return { data: null, error: null };
    return await supabase.from("card_label_links").insert(rows);
  },
  async remove(cardId: string, labelId: string) {
    return await supabase
      .from("card_label_links")
      .delete()
      .eq("card_id", cardId)
      .eq("label_id", labelId);
  },
  async removeByCard(cardId: string) {
    return await supabase.from("card_label_links").delete().eq("card_id", cardId);
  },
  async listByCard(cardId: string) {
    return await supabase.from("card_label_links").select("label_id").eq("card_id", cardId);
  },
};

// ----- card_comentarios -----
export const cardComentariosRepo = {
  async listByCard(cardId: string): Promise<any[]> {
    return unwrap<any[]>(
      await supabase
        .from("card_comentarios")
        .select("id, autor, texto, created_at, reply_to")
        .eq("card_id", cardId)
        .order("created_at", { ascending: true }),
    );
  },
  async listByCardFull(cardId: string): Promise<any[]> {
    return unwrap<any[]>(
      await supabase
        .from("card_comentarios")
        .select(
          "id, card_id, texto, autor_id, autor_nome, parent_id, created_at, updated_at, autor, reply_to",
        )
        .eq("card_id", cardId)
        .order("created_at", { ascending: false }),
    );
  },
  async insert(payload: any) {
    return await supabase.from("card_comentarios").insert(payload);
  },
  async insertMany(rows: any[]) {
    if (!rows.length) return { data: null, error: null };
    return await supabase.from("card_comentarios").insert(rows);
  },
};

// ----- card_atividades -----
export const cardAtividadesRepo = {
  async listByCard(cardId: string): Promise<any[]> {
    return unwrap<any[]>(
      await supabase
        .from("card_atividades")
        .select("id, evento, detalhe, ator_nome, created_at")
        .eq("card_id", cardId)
        .order("created_at", { ascending: false }),
    );
  },
  async insert(payload: any) {
    return await supabase.from("card_atividades").insert(payload);
  },
  async insertMany(rows: any[]) {
    if (!rows.length) return { data: null, error: null };
    return await supabase.from("card_atividades").insert(rows);
  },
};

// ----- card_local -----
export const cardLocalRepo = {
  async existsByCard(cardId: string): Promise<boolean> {
    const { data, error } = await supabase
      .from("card_local")
      .select("card_id")
      .eq("card_id", cardId)
      .maybeSingle();
    if (error) throw error;
    return !!data;
  },
  async getByCard(cardId: string): Promise<any | null> {
    const { data, error } = await supabase
      .from("card_local")
      .select("card_id,endereco,lat,lng")
      .eq("card_id", cardId)
      .maybeSingle();
    if (error) throw error;
    return data ?? null;
  },
  async upsertByCard(payload: any) {
    return await supabase.from("card_local").upsert(payload, { onConflict: "card_id" });
  },
  async removeByCard(cardId: string) {
    return await supabase.from("card_local").delete().eq("card_id", cardId);
  },
};

// ----- card_campos_valores (Kanban) -----
export const cardCamposValoresRepo = {
  async listByCard(cardId: string): Promise<{ campo_id: string; valor: unknown }[]> {
    const { data, error } = await supabase
      .from("card_campos_valores")
      .select("campo_id,valor")
      .eq("card_id", cardId);
    if (error) throw error;
    return (data ?? []) as any;
  },
  async upsertOne(cardId: string, campoId: string, valor: unknown) {
    return await supabase
      .from("card_campos_valores")
      .upsert(
        { card_id: cardId, campo_id: campoId, valor: valor as never },
        { onConflict: "card_id,campo_id" },
      );
  },
};

// ----- card_custom_field_valores -----
export const cardCustomFieldValoresRepo = {
  async removeByCard(cardId: string) {
    return await supabase.from("card_custom_field_valores").delete().eq("card_id", cardId);
  },
};

// ----- card_board_posicao -----
export const cardBoardPosicaoRepo = {
  async insert(payload: any) {
    return await supabase.from("card_board_posicao").insert(payload);
  },
  async upsertMany(rows: any[], onConflict: string) {
    return await supabase.from("card_board_posicao").upsert(rows, { onConflict });
  },
  async maxPosNaLista(listaId: string): Promise<number> {
    const { data } = await supabase
      .from("card_board_posicao")
      .select("posicao")
      .eq("lista_id", listaId)
      .order("posicao", { ascending: false })
      .limit(1)
      .maybeSingle();
    return ((data?.posicao as number | null) ?? -1) + 1;
  },
  async moverParaBoard(
    cardId: string,
    deBoardId: string,
    paraBoardId: string,
    listaId: string,
    posicao: number,
  ) {
    return await supabase
      .from("card_board_posicao")
      .update({ board_id: paraBoardId, lista_id: listaId, posicao })
      .eq("card_id", cardId)
      .eq("board_id", deBoardId);
  },
  // Lançam em erro de propósito: o chamador usa Promise.allSettled e um retorno
  // `{ error }` silencioso fazia a movimentação falhar sem feedback.
  async updatePosicao(cardId: string, boardId: string, posicao: number) {
    const { error } = await supabase
      .from("card_board_posicao")
      .update({ posicao })
      .eq("card_id", cardId)
      .eq("board_id", boardId);
    if (error) throw error;
  },
  async updateListaEPosicao(cardId: string, boardId: string, listaId: string, posicao: number) {
    const { error } = await supabase
      .from("card_board_posicao")
      .update({ lista_id: listaId, posicao })
      .eq("card_id", cardId)
      .eq("board_id", boardId);
    if (error) throw error;
  },

  async reordenar(boardId: string, listaId: string, cardIds: string[]) {
    const { data, error } = await supabase.rpc("board_reordenar", {
      p_board_id: boardId,
      p_lista_id: listaId,
      p_card_ids: cardIds,
    });
    if (error) throw error;
    return data;
  },
  async criarCardAtomico(payload: {
    p_board_id: string;
    p_lista_id: string;
    p_titulo: string;
    p_criado_por: string;
  }) {
    const { data, error } = await supabase.rpc("criar_card_board_atomico", payload);
    if (error) throw error;
    // O RPC retorna SETOF TABLE(card_id uuid, numero bigint), que chega como array de objetos
    const rows = data as any[];
    return { data: rows?.[0] || null, error: null };
  },
};

// ----- card_grupos_negociacao -----
export const cardGruposNegociacaoRepo = {
  async listResumo() {
    return await supabase.from("card_grupos_negociacao").select("id,rotulo");
  },
  async listOrdenados(): Promise<any[]> {
    return unwrap<any[]>(
      await supabase.from("card_grupos_negociacao").select("id,rotulo").order("rotulo"),
    );
  },
  async createReturning(rotulo: string): Promise<any> {
    return unwrap<any>(
      await supabase.from("card_grupos_negociacao").insert({ rotulo }).select().single(),
    );
  },
};

// ----- card_views_salvas -----
export const cardViewsSalvasRepo = {
  async listOrdenadas(): Promise<any[]> {
    return unwrap<any[]>(
      await (supabase as any)
        .from("card_views_salvas")
        .select("id, nome, setor, filtros")
        .order("nome", { ascending: true }),
    );
  },
  async create(payload: any) {
    return await (supabase as any).from("card_views_salvas").insert(payload);
  },
  async remove(id: string) {
    return await supabase.from("card_views_salvas").delete().eq("id", id);
  },
};

// ----- card_secoes_visiveis -----
export const cardSecoesVisiveisRepo = {
  async listSecoesByCard(cardId: string): Promise<any[]> {
    return unwrap<any[]>(
      await supabase.from("card_secoes_visiveis").select("secao").eq("card_id", cardId),
    );
  },
  /**
   * Registra a seção como visível no card.
   *
   * Assinatura explícita (e não um `payload` livre) de propósito: a tabela só
   * tem `card_id`/`secao` graváveis — `created_at` e `criado_por` são
   * preenchidos pelo banco. Um payload livre já causou
   * `PGRST204 · Could not find the 'criado_por' column ... in the schema cache`
   * quando a UI mandava a coluna de auditoria por conta própria.
   */
  async upsert(cardId: string, secao: string) {
    return await supabase.from("card_secoes_visiveis").upsert(
      { card_id: cardId, secao },
      {
        onConflict: "card_id,secao",
      },
    );
  },
  async remove(cardId: string, secao: string) {
    return await supabase
      .from("card_secoes_visiveis")
      .delete()
      .eq("card_id", cardId)
      .eq("secao", secao);
  },
};

// notificacoes: consolidado em `@/lib/repositories/notificacoes` (ARC-013.slice-28).

// ----- profiles -----
export const profilesRepo = {
  async listMin(): Promise<any[]> {
    return unwrap<any[]>(await supabase.from("profiles").select("id, login, nome").order("login"));
  },
  async search(term: string): Promise<any[]> {
    const { data } = await supabase
      .from("profiles")
      .select("id,login,nome")
      .or(`login.ilike.%${term}%,nome.ilike.%${term}%`)
      .limit(10);
    return data ?? [];
  },
};

// ----- cards (extensões) -----
export const cardsExtraRepo = {
  async getGenericoDialog(id: string): Promise<any> {
    const { data, error } = await supabase
      .from("cards")
      .select(
        `
        id, numero, titulo, descricao, status, prazo, responsavel_id, obra_id, created_at,
        lembrete,
        capa_cor, capa_url,
        card_setores ( setor ),
        card_label_links ( card_labels ( id, nome, cor ) ),
        responsavel:responsavel_id ( id, login, nome )
      `,
      )
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    return data;
  },
  async getFull(id: string): Promise<any> {
    // Projeção explícita (sem `*`): mantém a disciplina de colunas do
    // repository e acrescenta os embeds de responsável/obra.
    const { data, error } = await supabase
      .from("cards")
      .select(
        `${CARDS_FULL_COLS},
        responsavel:responsavel_id(id, login, nome),
        obra:obra_id(id, nome)`,
      )
      .eq("id", id)
      .single();
    if (error) throw error;
    return data;
  },
  async setStatus(id: string, status: string) {
    return await supabase.from("cards").update({ status }).eq("id", id);
  },
  async updateById(id: string, patch: any) {
    return await supabase.from("cards").update(patch).eq("id", id);
  },
};
