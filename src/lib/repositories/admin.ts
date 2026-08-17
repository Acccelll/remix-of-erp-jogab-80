// @ts-nocheck
import { supabase } from "@/integrations/supabase/client";

export const empresasRepo = {
  async list() {
    const { data, error } = await supabase
      .from("empresas")
      .select("id, razao_social, nome_fantasia, cnpj, ativa, cor, created_at, updated_at")
      .order("razao_social");
    if (error) throw error;
    return data ?? [];
  },
  async update(id: string, patch: Record<string, unknown>) {
    const { error } = await supabase.from("empresas").update(patch).eq("id", id);
    if (error) throw error;
  },
  async insert(payload: Record<string, unknown>) {
    const { error } = await supabase.from("empresas").insert(payload);
    if (error) throw error;
  },
  async remove(id: string) {
    const { error } = await supabase.from("empresas").delete().eq("id", id);
    if (error) throw error;
  },
};

export const userEmpresasRepo = {
  async list(empresaId?: string | null) {
    let q = supabase.from("user_empresas").select("user_id, empresa_id, papel, created_at");
    if (empresaId) q = q.eq("empresa_id", empresaId);
    const { data, error } = await q;
    if (error) throw error;
    return data ?? [];
  },
  async upsert(payload: { user_id: string; empresa_id: string; papel: string }) {
    const { error } = await supabase.from("user_empresas").upsert(payload);
    if (error) throw error;
  },
  async remove(user_id: string, empresa_id: string) {
    const { error } = await supabase
      .from("user_empresas")
      .delete()
      .eq("user_id", user_id)
      .eq("empresa_id", empresa_id);
    if (error) throw error;
  },
  async updatePapel(user_id: string, empresa_id: string, papel: string) {
    const { error } = await supabase
      .from("user_empresas")
      .update({ papel })
      .eq("user_id", user_id)
      .eq("empresa_id", empresa_id);
    if (error) throw error;
  },
};

export const profilesRepo = {
  async listAdmin() {
    const { data } = await (supabase as any)
      .from("profiles")
      .select("id, login, email, is_gm")
      .order("login");
    return data ?? [];
  },
  async listMin() {
    const { data } = await (supabase as any)
      .from("profiles")
      .select("id, login, email");
    return data ?? [];
  },
};
