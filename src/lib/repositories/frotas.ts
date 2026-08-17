// @ts-nocheck
import { supabase } from "@/integrations/supabase/client";

const ABAST_COLS =
  "id, veiculo_id, patrimonio_id, obra_id, data, litros, valor, odometro, horimetro, combustivel, posto, observacao, created_by, created_at, updated_at";

const MANUT_COLS =
  "id, veiculo_id, patrimonio_id, obra_id, tipo, data, valor, descricao, fornecedor, odometro, horimetro, proxima_preventiva_horimetro, proxima_preventiva_data, created_by, created_at, updated_at";

export const frotaAbastecimentosRepo = {
  async listByAtivo(idCol: "veiculo_id" | "patrimonio_id", ativoId: string, limit = 50) {
    const { data, error } = await supabase
      .from("frota_abastecimentos")
      .select(ABAST_COLS)
      .eq(idCol, ativoId)
      .order("data", { ascending: false })
      .limit(limit);
    if (error) throw error;
    return data ?? [];
  },

  async create(payload: Record<string, unknown>) {
    const { error } = await supabase.from("frota_abastecimentos").insert(payload);
    if (error) throw error;
  },
};

export const frotaManutencoesRepo = {
  async listByAtivo(idCol: "veiculo_id" | "patrimonio_id", ativoId: string, limit = 50) {
    const { data, error } = await supabase
      .from("frota_manutencoes")
      .select(MANUT_COLS)
      .eq(idCol, ativoId)
      .order("data", { ascending: false })
      .limit(limit);
    if (error) throw error;
    return data ?? [];
  },

  async create(payload: Record<string, unknown>) {
    const { error } = await supabase.from("frota_manutencoes").insert(payload);
    if (error) throw error;
  },
};
