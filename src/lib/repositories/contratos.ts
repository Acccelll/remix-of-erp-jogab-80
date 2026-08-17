// @ts-nocheck
import { supabase } from "@/integrations/supabase/client";

export const contratosFornecimentoRepo = {
  async list() {
    const { data, error } = await supabase
      .from("contratos")
      .select("id, obra_id, fornecedor_id, numero, objeto, tipo, valor, data_inicio, data_fim, status")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data ?? [];
  },

  async listMedicoes(contratoIds: string[]) {
    if (contratoIds.length === 0) return [];
    const { data, error } = await supabase
      .from("contrato_medicoes")
      .select("id, contrato_id, data_corte, percentual, valor, status")
      .in("contrato_id", contratoIds);
    if (error) throw error;
    return data ?? [];
  },

  async listAditivos(contratoIds: string[]) {
    if (contratoIds.length === 0) return [];
    const { data, error } = await supabase
      .from("aditivos_contrato")
      .select("contrato_id,valor,status")
      .in("contrato_id", contratoIds);
    if (error) throw error;
    return data ?? [];
  },

  async insert(payload: Record<string, unknown>) {
    const { error } = await supabase.from("contratos").insert(payload);
    if (error) throw error;
  },

  async insertMedicao(payload: Record<string, unknown>) {
    const { error } = await supabase.from("contrato_medicoes").insert(payload);
    if (error) throw error;
  },
};

export const contratoFornecedoresRepo = {
  async listMin() {
    const { data, error } = await supabase.from("fornecedores").select("id,nome").order("nome");
    if (error) throw error;
    return data ?? [];
  },
};