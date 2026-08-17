import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type BoardListaRow = Database["public"]["Tables"]["board_listas"]["Row"];
export type BoardListaInsert = Database["public"]["Tables"]["board_listas"]["Insert"];
export type BoardListaUpdate = Database["public"]["Tables"]["board_listas"]["Update"];

export const boardListasRepo = {
  async create(payload: BoardListaInsert): Promise<void> {
    const { error } = await supabase.from("board_listas").insert(payload);
    if (error) throw error;
  },

  async insertMany(rows: BoardListaInsert[]): Promise<void> {
    if (!rows.length) return;
    const { error } = await supabase.from("board_listas").insert(rows);
    if (error) throw error;
  },

  async update(id: string, patch: BoardListaUpdate): Promise<void> {
    const { error } = await supabase.from("board_listas").update(patch).eq("id", id);
    if (error) throw error;
  },
  /** ETAPA 1 · desacopla o status do card do nome da coluna. */
  async setEstadoOperacional(id: string, estado: string | null): Promise<void> {
    const { error } = await supabase
      .from("board_listas")
      .update({ estado_operacional: estado })
      .eq("id", id);
    if (error) throw error;
  },
  updatePosicao(id: string, posicao: number) {
    return supabase.from("board_listas").update({ posicao }).eq("id", id);
  },
  async setNome(id: string, nome: string): Promise<void> {
    const { error } = await supabase.from("board_listas").update({ nome }).eq("id", id);
    if (error) throw error;
  },
  async setWip(id: string, wip_limite: number | null): Promise<void> {
    const { error } = await supabase.from("board_listas").update({ wip_limite }).eq("id", id);
    if (error) throw error;
  },
  async setCor(id: string, cor: string | null): Promise<void> {
    const { error } = await supabase.from("board_listas").update({ cor }).eq("id", id);
    if (error) throw error;
  },
  async setArquivada(id: string, arquivada: boolean): Promise<void> {
    const { error } = await supabase.from("board_listas").update({ arquivada }).eq("id", id);
    if (error) throw error;
  },
  async primeiraAtiva(boardId: string): Promise<string | null> {
    const { data } = await supabase
      .from("board_listas")
      .select("id,posicao,arquivada")
      .eq("board_id", boardId)
      .eq("arquivada", false)
      .order("posicao")
      .limit(1)
      .maybeSingle();
    return (data?.id as string | null) ?? null;
  },
};

export const boardCamposRepo = {
  async listByBoard(boardId: string): Promise<any[]> {
    const { data, error } = await supabase
      .from("board_campos")
      .select("id,nome,tipo,opcoes,ordem")
      .eq("board_id", boardId)
      .order("ordem");
    if (error) throw error;
    return data ?? [];
  },
  async insert(payload: any) {
    return await supabase.from("board_campos").insert(payload);
  },
  async remove(id: string) {
    return await supabase.from("board_campos").delete().eq("id", id);
  },
};

export const boardMembrosRepo = {
  async insert(payload: any) {
    // Idempotente: evita 409 quando o membro já existe no quadro.
    return await supabase
      .from("board_membros")
      .upsert(payload, { onConflict: "board_id,user_id" });
  },
  async listByBoard(boardId: string) {
    return await supabase
      .from("board_membros")
      .select("user_id,papel,profile:user_id(login,nome)")
      .eq("board_id", boardId);
  },
  async updatePapel(boardId: string, userId: string, papel: string) {
    return await supabase
      .from("board_membros")
      .update({ papel })
      .eq("board_id", boardId)
      .eq("user_id", userId);
  },
  async remove(boardId: string, userId: string) {
    return await supabase
      .from("board_membros")
      .delete()
      .eq("board_id", boardId)
      .eq("user_id", userId);
  },
};


export const boardAtividadesRepo = {
  async recentes(boardId: string, limit = 50) {
    const { data } = await supabase.rpc("board_atividades_recentes" as never, {
      p_board_id: boardId,
      p_limit: limit,
    } as never);
    return data ?? [];
  },
};

export const boardsRepo = {
  async getNome(boardId: string): Promise<string | null> {
    const { data } = await supabase
      .from("boards")
      .select("nome")
      .eq("id", boardId)
      .maybeSingle();
    return (data?.nome as string | null) ?? null;
  },
  async setNome(id: string, nome: string): Promise<void> {
    const { error } = await supabase.from("boards").update({ nome }).eq("id", id);
    if (error) throw error;
  },
  /** ETAPA 1 · configuração do quadro (aparência + visibilidade). */
  async getConfig(boardId: string) {
    const { data, error } = await supabase
      .from("boards")
      .select("id,nome,descricao,fundo_cor,fundo_url,visibilidade,is_template,tipo")
      .eq("id", boardId)
      .single();
    if (error) throw error;
    return data;
  },
  async updateConfig(
    id: string,
    patch: {
      nome?: string;
      descricao?: string | null;
      fundo_cor?: string | null;
      fundo_url?: string | null;
      visibilidade?: string;
      is_template?: boolean;
    },
  ): Promise<void> {
    const { error } = await supabase.from("boards").update(patch).eq("id", id);
    if (error) throw error;
  },
  async getBoardInfo(boardId: string) {
    const { data, error } = await supabase
      .from("boards")
      .select("id,nome,tipo,setor,obra_id,descricao,fundo_cor,fundo_url,visibilidade")
      .eq("id", boardId)
      .single();
    if (error) throw error;
    return data;
  },

  async listListasAtivas(boardId: string) {
    const { data, error } = await supabase
      .from("board_listas")
      .select("id,nome,posicao,wip_limite,arquivada,cor,estado_operacional,ordenacao")
      .eq("board_id", boardId)
      .eq("arquivada", false)
      .order("posicao");
    if (error) throw error;
    return data ?? [];
  },
  async listAllRefs() {
    const { data, error } = await supabase
      .from("boards")
      .select("id,nome,tipo,setor,obra_id,arquivado")
      .order("arquivado", { ascending: true })
      .order("tipo")
      .order("nome");
    if (error) throw error;
    return data ?? [];
  },
  async listAtivosMin() {
    const { data, error } = await supabase
      .from("boards")
      .select("id,nome,tipo,arquivado")
      .eq("arquivado", false)
      .order("nome");
    if (error) throw error;
    return data ?? [];
  },
  async listIndex() {
    const { data, error } = await supabase
      .from("boards")
      .select("id,nome,tipo,setor,obra_id,arquivado,owner_id")
      .order("arquivado", { ascending: true })
      .order("tipo")
      .order("nome");
    if (error) throw error;
    return data ?? [];
  },
  async createCustomReturningId(nome: string, ownerId: string | null): Promise<string> {
    const { data, error } = await supabase
      .from("boards")
      .insert({ nome, tipo: "custom", owner_id: ownerId })
      .select("id")
      .single();
    if (error) throw error;
    return (data as { id: string }).id;
  },
  async itemsResumo(boardId: string) {
    const { data, error } = await supabase.rpc(
      "board_items_resumo" as never,
      { p_board_id: boardId } as never,
    );
    if (error) throw error;
    return (data ?? []) as any[];
  },
  async setArquivado(id: string, arquivado: boolean): Promise<void> {
    const { error } = await supabase.from("boards").update({ arquivado }).eq("id", id);
    if (error) throw error;
  },
  subscribeBoardChanges(
    boardId: string,
    onPosicao: () => void,
    onListas: () => void,
  ) {
    const ch = supabase
      .channel(`board:${boardId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "card_board_posicao",
          filter: `board_id=eq.${boardId}`,
        },
        onPosicao,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "board_listas", filter: `board_id=eq.${boardId}` },
        onListas,
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  },
};

