// @ts-nocheck
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type RdoRow = Database["public"]["Tables"]["rdo"]["Row"];
export type RdoInsert = Database["public"]["Tables"]["rdo"]["Insert"];
export type RdoUpdate = Database["public"]["Tables"]["rdo"]["Update"];

function unwrap<T>(res: { data: T | null; error: unknown }): T {
  if (res.error) throw res.error as Error;
  return (res.data as T) ?? ([] as unknown as T);
}

/** Acesso a RDOs / atividades / efetivo (Fase 1 #6). */
export const rdoRepo = {
  async listPorObra(obraId: string, cols: string = "id, data, status, clima, observacoes") {
    return unwrap<any[]>(
      await supabase
        .from("rdo")
        .select(cols)
        .eq("obra_id", obraId)
        .order("data", { ascending: false }),
    );
  },

  async getById(id: string) {
    return unwrap<any>(
      await supabase
        .from("rdo")
        .select(
          "id, obra_id, data, status, observacoes, origem, checklist_codigo, synced_at, clima_manha, clima_tarde, clima_noite, trabalhavel_manha, trabalhavel_tarde, trabalhavel_noite, owner_id, created_at, updated_at",
        )
        .eq("id", id)
        .single(),
    );
  },

  async create(payload: RdoInsert) {
    const { error } = await supabase.from("rdo").insert(payload);
    if (error) throw error;
  },

  async update(id: string, patch: RdoUpdate) {
    const { error } = await supabase.from("rdo").update(patch).eq("id", id);
    if (error) throw error;
  },

  async upsertFromChecklist(params: Record<string, unknown>) {
    return await (supabase as any).rpc("rdo_upsert_from_checklist", params);
  },

  async listAtividadesPorItem(cronogramaItemId: string): Promise<any[]> {
    const { data, error } = await supabase
      .from("rdo_atividades")
      .select("rdo_id, quantidade, rdo:rdo_id(data, obra_id)")
      .eq("cronograma_item_id", cronogramaItemId)
      .order("rdo_id", { ascending: false })
      .limit(50);
    if (error) throw error;
    return data ?? [];
  },

  async listEfetivoPorRdo(rdoId: string): Promise<any[]> {
    const { data, error } = await supabase
      .from("rdo_efetivo")
      .select("quantidade, presente")
      .eq("rdo_id", rdoId);
    if (error) throw error;
    return data ?? [];
  },
};
