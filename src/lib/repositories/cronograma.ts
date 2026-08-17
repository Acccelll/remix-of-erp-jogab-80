// @ts-nocheck
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { logger } from "@/lib/core/logger";

export type CronogramaItemRow = Database["public"]["Tables"]["cronograma_itens"]["Row"];
export type CronogramaItemInsert = Database["public"]["Tables"]["cronograma_itens"]["Insert"];
export type CronogramaItemUpdate = Database["public"]["Tables"]["cronograma_itens"]["Update"];

function unwrap<T>(res: { data: T | null; error: unknown }): T {
  if (res.error) throw res.error as Error;
  return res.data as T;
}

/** Colunas usadas em dashboards financeiro/planejamento. */
export const CRONOGRAMA_COLUNAS_DASHBOARD =
  "id, obra_id, descricao, custo, custo_baseline, percentual_previsto, percentual_realizado, data_inicio, data_fim, data_inicio_baseline, data_fim_baseline, ativo" as const;

export const CRONOGRAMA_ITENS_COLUNAS =
  "id, obra_id, descricao, data_inicio, data_fim, percentual_previsto, percentual_realizado, custo, ordem, ativo, critico, caminho_critico, uid_mpp, calendario_uid_mpp, data_inicio_baseline, data_fim_baseline, data_inicio_reprog, data_fim_reprog, data_inicio_real, data_fim_real, duracao_horas, constraint_tipo, constraint_data, deadline, notas, prioridade, marco, custo_baseline, folga_dias, folga_total, folga_livre_dias, fanout_sucessoras, importancia_classe, importancia_score, localizacao_id, recursos_count, recursos_status, servico_lob, versao_otimista, created_at, updated_at" as const;

export const cronogramaRepo = {
  async countByObra(obraId: string): Promise<number> {
    const { count, error } = await supabase
      .from("cronograma_itens")
      .select("*", { count: "exact", head: true })
      .eq("obra_id", obraId);
    if (error) throw error;
    return count ?? 0;
  },

  async listByObra(obraId: string): Promise<CronogramaItemRow[]> {
    return (
      unwrap(
        await supabase
          .from("cronograma_itens")
          .select(CRONOGRAMA_ITENS_COLUNAS)
          .eq("obra_id", obraId)
          .order("data_inicio"),
      ) ?? []
    );
  },

  /**
   * Itens ativos de cronograma para o Dashboard Home.
   * Pagina em blocos de 1.000 porque o PostgREST corta a resposta nesse
   * limite — sem isso, obras a partir da ~3ª ficavam sem itens.
   */
  async listDashboard() {
    const PAGE = 1000;
    const todos: any[] = [];
    for (let from = 0; ; from += PAGE) {
      const pagina =
        unwrap(
          await supabase
            .from("cronograma_itens")
            .select(CRONOGRAMA_COLUNAS_DASHBOARD)
            .neq("ativo", false)
            .order("obra_id")
            .order("id")
            .range(from, from + PAGE - 1),
        ) ?? [];
      todos.push(...pagina);
      if (pagina.length < PAGE) break;
    }
    return todos;
  },


  async listResumoPacotes() {
    return unwrap(await supabase.from("cronograma_itens").select("id, descricao, obra_id")) ?? [];
  },

  async listIdsPorObra(obraId: string) {
    return (
      (await supabase.from("cronograma_itens").select("id").eq("obra_id", obraId)).data ?? []
    );
  },

  async listAtivosProgressoByObra(obraId: string) {
    return (
      unwrap(
        await supabase
          .from("cronograma_itens")
          .select("id, uid_mpp, descricao, percentual_realizado, data_inicio, data_fim")
          .eq("obra_id", obraId)
          .eq("ativo", true),
      ) ?? []
    );
  },

  async listAtivosParaVinculoByObra(obraId: string) {
    return (
      unwrap(
        await supabase
          .from("cronograma_itens")
          .select("id, descricao, data_inicio, data_fim, ordem")
          .eq("obra_id", obraId)
          .eq("ativo", true)
          .order("ordem", { ascending: true })
          .limit(500),
      ) ?? []
    );
  },

  async listSnapshotSourceByObra(obraId: string) {
    return (
      unwrap(
        await supabase
          .from("cronograma_itens")
          .select(
            "id, uid_mpp, descricao, custo_baseline, custo, data_inicio_baseline, data_inicio, data_fim_baseline, data_fim, percentual_previsto",
          )
          .eq("obra_id", obraId)
          .eq("ativo", true),
      ) ?? []
    );
  },

  async listCpmByObra(obraId: string) {
    const { data, error } = await supabase
      .from("cronograma_itens")
      .select(
        "id, uid_mpp, data_inicio, data_fim, data_fim_baseline, custo, ativo, calendario_uid_mpp",
      )
      .eq("obra_id", obraId);
    if (error) throw error;
    return data ?? [];
  },

  async rpcAtualizarCpm(obraId: string, resultados: any[]): Promise<void> {
    const { error } = await (supabase as any).rpc("fn_atualizar_cpm", {
      p_obra_id: obraId,
      p_resultados: resultados,
    });
    if (error) {
      if (/function .* does not exist|not found/i.test(error.message ?? "")) {
        logger.warn("cronograma.cpm.rpc_ausente", { obraId, error: error.message });
        return;
      }
      throw error;
    }
  },

  async create(payload: CronogramaItemInsert): Promise<void> {
    const { error } = await supabase.from("cronograma_itens").insert(payload);
    if (error) throw error;
  },

  async insertMany(rows: CronogramaItemInsert[]): Promise<void> {
    if (!rows.length) return;
    const { error } = await supabase.from("cronograma_itens").insert(rows);
    if (error) throw error;
  },

  async insertManyReturningResumo(rows: CronogramaItemInsert[]) {
    if (!rows.length) return [];
    const { data, error } = await supabase
      .from("cronograma_itens")
      .insert(rows)
      .select("id, descricao, custo, data_inicio, data_fim, uid_mpp");
    if (error) throw error;
    return data ?? [];
  },

  async insertManyReturningItens(rows: CronogramaItemInsert[]) {
    if (!rows.length) return [];
    const { data, error } = await supabase
      .from("cronograma_itens")
      .insert(rows)
      .select("id, descricao, data_inicio, data_fim, custo, percentual_realizado");
    if (error) throw error;
    return data ?? [];
  },

  async listIdsByUidsMpp(obraId: string, uids: string[]) {
    if (!uids.length) return [];
    const { data, error } = await supabase
      .from("cronograma_itens")
      .select("id, uid_mpp")
      .eq("obra_id", obraId)
      .in("uid_mpp", uids);
    if (error) throw error;
    return data ?? [];
  },

  async listCustosByObra(obraId: string) {
    const { data, error } = await supabase
      .from("cronograma_itens")
      .select("id, custo, custo_baseline, percentual_previsto")
      .eq("obra_id", obraId)
      .eq("ativo", true);
    if (error) throw error;
    return data ?? [];
  },

  async updatePercentualPrevistoBulk(items: { id: string; percentual: number }[]) {
    await Promise.all(
      items.map((i) =>
        supabase
          .from("cronograma_itens")
          .update({ percentual_previsto: i.percentual })
          .eq("id", i.id),
      ),
    );
  },

  async update(id: string, patch: CronogramaItemUpdate): Promise<void> {
    const { error } = await supabase.from("cronograma_itens").update(patch).eq("id", id);
    if (error) throw error;
  },

  /**
   * Atualiza datas com controle de versão otimista.
   * Se `prevVersao` for null, não aplica o filtro de versão.
   * Retorna `ok: false` quando o update não afetou linhas ou houve erro.
   */
  async updateDatasOtimista(
    id: string,
    prevVersao: number | null,
    datas: { data_inicio: string; data_fim: string },
  ): Promise<{ ok: boolean; error?: string }> {
    const q = supabase
      .from("cronograma_itens")
      .update({ data_inicio: datas.data_inicio, data_fim: datas.data_fim })
      .eq("id", id);
    const { error, data } =
      prevVersao != null
        ? await q.eq("versao_otimista", prevVersao).select("id")
        : await q.select("id");
    if (error) return { ok: false, error: error.message };
    if (!data || data.length === 0) return { ok: false };
    return { ok: true };
  },

  async remove(id: string): Promise<void> {
    const { error } = await supabase.from("cronograma_itens").delete().eq("id", id);
    if (error) throw error;
  },

  async removeByObra(obraId: string): Promise<void> {
    const { error } = await supabase.from("cronograma_itens").delete().eq("obra_id", obraId);
    if (error) throw error;
  },

  async removeMany(ids: string[]): Promise<void> {
    if (!ids.length) return;
    const { error } = await supabase.from("cronograma_itens").delete().in("id", ids);
    if (error) throw error;
  },
};

export const cronogramaItemRevisoesRepo = {
  async insertMany(rows: any[]) {
    if (!rows.length) return;
    const { error } = await supabase.from("cronograma_item_revisoes").insert(rows);
    if (error) throw error;
  },
  async removeByRevisao(revisaoId: string) {
    const { error } = await supabase
      .from("cronograma_item_revisoes")
      .delete()
      .eq("revisao_id", revisaoId);
    if (error) throw error;
  },
  async removeByRevisaoIds(revisaoIds: string[]) {
    if (!revisaoIds.length) return;
    await supabase.from("cronograma_item_revisoes").delete().in("revisao_id", revisaoIds);
  },
  async listSnapshotsByRevisao(revisaoId: string) {
    const { data, error } = await supabase
      .from("cronograma_item_revisoes")
      .select(
        "id, cronograma_item_id, tipo_mudanca, data_inicio_anterior, data_fim_anterior, percentual_realizado_anterior, custo_anterior",
      )
      .eq("revisao_id", revisaoId);
    if (error) throw error;
    return data ?? [];
  },
};

export const cronogramaBaselinesRepo = {
  async listResumoByObra(obraId: string): Promise<{ id: string; versao: number }[]> {
    return (
      unwrap(
        await supabase
          .from("cronograma_baselines")
          .select("id, versao")
          .eq("obra_id", obraId)
          .order("versao", { ascending: false }),
      ) ?? []
    );
  },

  async listByObraFull(obraId: string) {
    const { data, error } = await supabase
      .from("cronograma_baselines")
      .select("id, versao, motivo, created_at")
      .eq("obra_id", obraId)
      .order("versao", { ascending: false });
    if (error) throw error;
    return data ?? [];
  },

  async listIdsByObra(obraId: string): Promise<string[]> {
    const { data, error } = await supabase
      .from("cronograma_baselines")
      .select("id")
      .eq("obra_id", obraId);
    if (error) throw error;
    return (data ?? []).map((b: any) => b.id);
  },

  async removeMany(ids: string[]) {
    if (!ids.length) return;
    const { error } = await supabase.from("cronograma_baselines").delete().in("id", ids);
    if (error) throw error;
  },


  async getUltimaVersao(obraId: string): Promise<number> {
    const { data, error } = await supabase
      .from("cronograma_baselines")
      .select("versao")
      .eq("obra_id", obraId)
      .order("versao", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    return data?.versao ?? 0;
  },

  async getUltimaId(obraId: string): Promise<string | null> {
    const { data, error } = await supabase
      .from("cronograma_baselines")
      .select("id")
      .eq("obra_id", obraId)
      .order("versao", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    return data?.id ?? null;
  },

  async createReturningId(payload: Record<string, unknown>): Promise<{ id: string }> {
    const { data, error } = await supabase
      .from("cronograma_baselines")
      .insert(payload)
      .select("id")
      .single();
    if (error) throw error;
    return data as { id: string };
  },

  async createReturningIdVersao(payload: Record<string, unknown>): Promise<{ id: string; versao: number }> {
    const { data, error } = await supabase
      .from("cronograma_baselines")
      .insert(payload)
      .select("id, versao")
      .single();
    if (error) throw error;
    return data as { id: string; versao: number };
  },
};

export const cronogramaRevisoesRepo = {
  async getUltimoNumero(obraId: string): Promise<number> {
    const { data, error } = await supabase
      .from("cronograma_revisoes")
      .select("numero")
      .eq("obra_id", obraId)
      .order("numero", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    return data?.numero ?? 0;
  },

  async createReturningId(payload: Record<string, unknown>): Promise<{ id: string }> {
    const { data, error } = await supabase
      .from("cronograma_revisoes")
      .insert(payload)
      .select("id")
      .single();
    if (error) throw error;
    return data as { id: string };
  },

  async listIdsByObra(obraId: string): Promise<string[]> {
    const { data, error } = await supabase
      .from("cronograma_revisoes")
      .select("id")
      .eq("obra_id", obraId);
    if (error) throw error;
    return (data ?? []).map((r: any) => r.id);
  },

  async removeMany(ids: string[]) {
    if (!ids.length) return;
    const { error } = await supabase.from("cronograma_revisoes").delete().in("id", ids);
    if (error) throw error;
  },

  async remove(id: string) {
    const { error } = await supabase.from("cronograma_revisoes").delete().eq("id", id);
    if (error) throw error;
  },

  async listByObra(obraId: string) {
    const { data, error } = await supabase
      .from("cronograma_revisoes")
      .select(
        "id,obra_id,numero,data_corte,arquivo_nome,observacoes,totais,created_at,baseline_id",
      )
      .eq("obra_id", obraId)
      .order("numero", { ascending: false });
    if (error) throw error;
    return data ?? [];
  },
};


export const cronogramaBaselineItensRepo = {
  async insertMany(rows: any[]) {
    if (!rows.length) return;
    const { error } = await supabase.from("cronograma_item_baseline").insert(rows);
    if (error) throw error;
  },
  async removeByBaselineIds(ids: string[]) {
    if (!ids.length) return;
    const { error } = await supabase
      .from("cronograma_item_baseline")
      .delete()
      .in("baseline_id", ids);
    if (error) throw error;
  },
};

export const cronogramaDependenciasRepo = {
  async insertMany(rows: any[]) {
    if (!rows.length) return;
    const { error } = await supabase.from("cronograma_dependencias").insert(rows);
    if (error) throw error;
  },
  async insertOne(row: any): Promise<{ error?: string }> {
    const { error } = await (supabase as any).from("cronograma_dependencias").insert(row);
    return error ? { error: error.message } : {};
  },
  async updateByKey(
    obraId: string,
    predecessorId: string,
    itemId: string,
    patch: Record<string, unknown>,
  ): Promise<{ error?: string }> {
    const { error } = await (supabase as any)
      .from("cronograma_dependencias")
      .update(patch)
      .eq("obra_id", obraId)
      .eq("predecessor_item_id", predecessorId)
      .eq("item_id", itemId);
    return error ? { error: error.message } : {};
  },
  async deleteByKey(
    obraId: string,
    predecessorId: string,
    itemId: string,
  ): Promise<{ error?: string }> {
    const { error } = await (supabase as any)
      .from("cronograma_dependencias")
      .delete()
      .eq("obra_id", obraId)
      .eq("predecessor_item_id", predecessorId)
      .eq("item_id", itemId);
    return error ? { error: error.message } : {};
  },
  async removeByObra(obraId: string) {
    const { error } = await supabase
      .from("cronograma_dependencias")
      .delete()
      .eq("obra_id", obraId);
    if (error) throw error;
  },
  async removeByItemIds(itemIds: string[]) {
    if (!itemIds.length) return;
    const { error } = await supabase
      .from("cronograma_dependencias")
      .delete()
      .in("item_id", itemIds);
    if (error) throw error;
  },
  async listByObra(obraId: string) {
    const { data, error } = await supabase
      .from("cronograma_dependencias")
      .select("item_id, predecessor_uid_mpp, predecessor_item_id, tipo, lag_dias, lag_minutos")
      .eq("obra_id", obraId);
    if (error) throw error;
    return data ?? [];
  },
};

export const cronogramaCenariosRepo = {
  async remove(id: string) {
    const { error } = await supabase.from("cronograma_cenarios").delete().eq("id", id);
    if (error) throw error;
  },
};

export const cronogramaCenarioItensRepo = {
  async insertMany(rows: any[]) {
    if (!rows.length) return;
    const { error } = await supabase.from("cronograma_cenario_itens").insert(rows);
    if (error) throw error;
  },
};

export const cronogramaCalendariosRepo = {
  async deleteByObra(obraId: string): Promise<void> {
    const { error } = await supabase
      .from("cronograma_calendarios")
      .delete()
      .eq("obra_id", obraId);
    if (error) throw error;
  },
  async insertReturningIds(
    payload: any[],
  ): Promise<{ id: string; uid_mpp: string }[]> {
    const { data, error } = await supabase
      .from("cronograma_calendarios")
      .insert(payload)
      .select("id, uid_mpp");
    if (error) throw error;
    return (data ?? []) as { id: string; uid_mpp: string }[];
  },
  async listByObra(obraId: string) {
    const { data, error } = await supabase
      .from("cronograma_calendarios")
      .select("id, uid_mpp, dias_uteis, horas_por_dia, is_padrao")
      .eq("obra_id", obraId);
    if (error) throw error;
    return data ?? [];
  },
};

export const cronogramaCalendarioExcecoesRepo = {
  async insertMany(rows: any[]): Promise<void> {
    if (!rows.length) return;
    const { error } = await supabase
      .from("cronograma_calendario_excecoes")
      .insert(rows);
    if (error) throw error;
  },
  async listByCalendarioIds(ids: string[]) {
    if (!ids.length) return [];
    const { data, error } = await supabase
      .from("cronograma_calendario_excecoes")
      .select("calendario_id, data_inicio, data_fim, trabalha, horas_disponiveis, confirmada")
      .in("calendario_id", ids);
    if (error) throw error;
    return data ?? [];
  },
};


