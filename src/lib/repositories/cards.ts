import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { REPO_LIMITS } from "./_limits";

export type CardRow = Database["public"]["Tables"]["cards"]["Row"];
export type CardUpdate = Database["public"]["Tables"]["cards"]["Update"];

function unwrap<T>(res: { data: T | null; error: unknown }): T {
  if (res.error) throw res.error as Error;
  return res.data as T;
}

export const cardsRepo = {
  async getById(id: string): Promise<CardRow> {
    return unwrap(
      await supabase
        .from("cards")
        .select(
          "id, numero, tipo, titulo, descricao, status, obra_id, responsavel_id, criado_por, data_inicio, prazo, lembrete, due_complete, arquivado, posicao, capa_cor, capa_url, cover_color, cover_url, cronograma_item_id, grupo_negociacao_id, origem_externa, origem_id, origem_url, created_at, updated_at",
        )
        .eq("id", id)
        .single(),
    );
  },

  async update(id: string, patch: CardUpdate): Promise<void> {
    const { error } = await supabase.from("cards").update(patch).eq("id", id);
    if (error) throw error;
  },

  async updateReturningId(id: string, patch: CardUpdate): Promise<boolean> {
    const { data, error } = await supabase
      .from("cards")
      .update(patch)
      .eq("id", id)
      .select("id")
      .maybeSingle();
    if (error) throw error;
    return !!data;
  },

  async updateGrupoNegociacao(ids: string[], grupoId: string | null): Promise<void> {
    if (ids.length === 0) return;
    const { error } = await supabase
      .from("cards")
      .update({ grupo_negociacao_id: grupoId })
      .in("id", ids);
    if (error) throw error;
  },

  async listAbertosMin(): Promise<any[]> {
    const { data, error } = await supabase
      .from("cards")
      .select("id,numero,titulo,obra_id,status")
      .eq("arquivado", false)
      .neq("status", "concluido")
      .limit(REPO_LIMITS.cards);
    if (error) throw error;
    return data ?? [];
  },

  async listComRecursosPorObra(obraId: string): Promise<any[]> {
    const { data, error } = await supabase
      .from("cards")
      .select(
        "id, numero, titulo, status, arquivado, cronograma_item_id, card_recursos(tipo_recurso, prazo_notif_compras, prazo_pedido, prazo_prod_iniciar, prazo_notif_producao, data_necessidade_obra)",
      )
      .eq("obra_id", obraId)
      .eq("arquivado", false)
      .neq("status", "concluido")
      .not("cronograma_item_id", "is", null)
      .limit(REPO_LIMITS.cards);
    if (error) throw error;
    return data ?? [];
  },

  async getCronogramaItemId(cardId: string): Promise<string | null> {
    const { data, error } = await supabase
      .from("cards")
      .select("cronograma_item_id")
      .eq("id", cardId)
      .maybeSingle();
    if (error) throw error;
    return (data?.cronograma_item_id as string | null) ?? null;
  },

  async listByCronogramaItem(itemId: string): Promise<any[]> {
    const { data, error } = await supabase
      .from("cards")
      .select(
        "id, numero, titulo, status, card_recursos(tipo_recurso, prazo_notif_compras, prazo_pedido, data_necessidade_obra, valor_oc)",
      )
      .eq("cronograma_item_id", itemId)
      .eq("arquivado", false)
      .order("numero")
      .limit(REPO_LIMITS.cards);
    if (error) throw error;
    return data ?? [];
  },

  async getParaClonar(id: string) {
    return await supabase
      .from("cards")
      .select(
        "titulo,descricao,obra_id,prazo,data_inicio,capa_cor,capa_url,tipo,status,responsavel_id",
      )
      .eq("id", id)
      .single();
  },

  async insertReturningId(payload: any) {
    return await supabase.from("cards").insert(payload).select("id").single();
  },

  /** Cards mínimos onde o usuário é responsável (dashboard home). */
  async listMinByResponsavel(userId: string): Promise<any[]> {
    return this.listMinByResponsavelIn([userId]);
  },

  /** Cards mínimos onde qualquer um dos ids do usuário é responsável. */
  async listMinByResponsavelIn(userIds: string[]): Promise<any[]> {
    if (!userIds.length) return [];
    const { data, error } = await supabase
      .from("cards")
      .select("id,numero,titulo,status,prazo,obra_id")
      .in("responsavel_id", userIds)
      .eq("arquivado", false)
      .limit(REPO_LIMITS.cards);
    if (error) throw error;
    return data ?? [];
  },


  /** Cards mínimos por ids (dashboard home — complementa membros). */
  async listMinByIds(ids: string[]): Promise<any[]> {
    if (!ids.length) return [];
    const { data, error } = await supabase
      .from("cards")
      .select("id,numero,titulo,status,prazo,obra_id")
      .in("id", ids)
      .eq("arquivado", false)
      .limit(REPO_LIMITS.cards);
    if (error) throw error;
    return data ?? [];
  },

  async listKanbanByIds(ids: string[], obraId?: string) {
    if (!ids.length) return { data: [] as any[], error: null };
    let q = supabase
      .from("cards")
      .select("id,numero,titulo,obra_id,grupo_negociacao_id,obras:obra_id(nome)")
      .in("id", ids)
      .limit(REPO_LIMITS.cards);
    if (obraId) q = q.eq("obra_id", obraId);
    return await q;
  },

  async updateGrupoNegociacaoIn(ids: string[], grupoId: string | null) {
    if (!ids.length) return { error: null };
    return await supabase
      .from("cards")
      .update({ grupo_negociacao_id: grupoId })
      .in("id", ids);
  },
};
