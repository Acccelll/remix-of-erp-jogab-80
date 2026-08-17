// @ts-nocheck
import { supabase } from "@/integrations/supabase/client";

export const gmSaudeRepo = {
  async listSystemEvents(limit = 100) {
    const { data, error } = await supabase
      .from("system_events")
      .select("id, kind, severity, source, message, context, created_at")
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) throw error;
    return data ?? [];
  },

  async listTotvsRuns(limit = 10) {
    const { data, error } = await supabase
      .from("totvs_import_runs")
      .select(
        "id, arquivo_nome, status, total_recebidas, total_processadas, total_rejeitadas, created_at",
      )
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) throw error;
    return data ?? [];
  },

  async listCutoverStatus() {
    const { data, error } = await supabase
      .from("vw_cutover_legacy_status" as never)
      .select("obra_id, obra_nome, ativa, legados_desligados, legados_total, todos_desligados");
    if (error) throw error;
    return data ?? [];
  },

  async listObrasDashboard() {
    const { data, error } = await supabase
      .from("vw_mv_obra_dashboard")
      .select(
        "obra_id, status, financeiro_saldo, progresso_fisico, requisicoes_pendentes, ordens_compra_abertas, atualizado_em",
      );
    if (error) throw error;
    return data ?? [];
  },

  async queryPerformance(limit = 10) {
    const { data, error } = await (supabase as any).rpc("gm_query_performance", {
      p_limit: limit,
    });
    if (error) throw error;
    return data ?? [];
  },
};
