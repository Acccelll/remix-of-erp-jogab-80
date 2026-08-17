// @ts-nocheck
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { REPO_LIMITS } from "./_limits";

export type RequisicaoRow = Database["public"]["Tables"]["requisicoes"]["Row"];
export type RequisicaoInsert = Database["public"]["Tables"]["requisicoes"]["Insert"];
export type RequisicaoUpdate = Database["public"]["Tables"]["requisicoes"]["Update"];

export const requisicoesRepo = {
  async listAll(
    cols: string = "id, obra_id, card_recurso_id, orcamento_item_id, insumo_id, quantidade, status, observacao, created_at, updated_at",
  ): Promise<RequisicaoRow[]> {
    const { data, error } = await supabase
      .from("requisicoes")
      .select(cols)
      .order("created_at", { ascending: false })
      .limit(REPO_LIMITS.requisicoes);
    if (error) throw error;
    return (data ?? []) as unknown as RequisicaoRow[];
  },
  async listResumoObra(
    limit = 500,
  ): Promise<Pick<RequisicaoRow, "id" | "obra_id" | "observacao">[]> {
    const { data, error } = await supabase
      .from("requisicoes")
      .select("id, obra_id, observacao")
      .limit(limit);
    if (error) throw error;
    return (data ?? []) as Pick<RequisicaoRow, "id" | "obra_id" | "observacao">[];
  },
  async create(payload: RequisicaoInsert): Promise<void> {
    const { error } = await supabase.from("requisicoes").insert(payload);
    if (error) throw error;
  },
  async updateStatus(id: string, status: string): Promise<void> {
    const { error } = await supabase.from("requisicoes").update({ status }).eq("id", id);
    if (error) throw error;
  },
  async update(id: string, patch: RequisicaoUpdate): Promise<void> {
    const { error } = await supabase.from("requisicoes").update(patch).eq("id", id);
    if (error) throw error;
  },
};
