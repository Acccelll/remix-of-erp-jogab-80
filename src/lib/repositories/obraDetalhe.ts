// @ts-nocheck
import { supabase } from "@/integrations/supabase/client";

function unwrap<T>(res: { data: T | null; error: unknown }): T {
  if (res.error) throw res.error as Error;
  return res.data as T;
}

export const ocorrenciasRepo = {
  async upsert(id: string | null | undefined, payload: any) {
    const { error } = id
      ? await supabase.from("ocorrencias").update(payload).eq("id", id)
      : await supabase.from("ocorrencias").insert(payload);
    if (error) throw error;
  },
  async remove(id: string) {
    const { error } = await supabase.from("ocorrencias").delete().eq("id", id);
    if (error) throw error;
  },
};

export const obraLocalizacoesRepo = {
  async remove(id: string) {
    const { error } = await supabase.from("obra_localizacoes").delete().eq("id", id);
    if (error) throw error;
  },
  async rename(id: string, nome: string) {
    const { error } = await supabase.from("obra_localizacoes").update({ nome }).eq("id", id);
    if (error) throw error;
  },
  async reorder(id: string, ordem: number) {
    const { error } = await supabase.from("obra_localizacoes").update({ ordem }).eq("id", id);
    if (error) throw error;
  },
};

// Colunas explícitas — evita `select("*")` (PERF-002 / Onda 4).
const ADITIVOS_CONTRATO_COLS =
  "id, obra_id, numero, tipo, valor_financeiro, dias_prazo, data_aprovacao, documento_url, observacoes, status, baseline_id, versao_otimista, created_at, updated_at";

export const aditivosContratoRepo = {
  async listPorObra(obraId: string) {
    return (
      unwrap<any[]>(
        await supabase
          .from("aditivos_contrato")
          .select(ADITIVOS_CONTRATO_COLS)
          .eq("obra_id", obraId)
          .order("numero"),
      ) ?? []
    );
  },
  async insert(payload: any) {
    const { error } = await supabase.from("aditivos_contrato").insert(payload);
    if (error) throw error;
  },
};

export const bmsPrevistasRepo = {
  async listDashboard() {
    return (
      unwrap<any[]>(
        await supabase
          .from("bms_previstas")
          .select(
            "id, obra_id, numero, data_inicio_janela, data_corte, valor_previsto_inicial, valor_previsto_dinamico, valor_previsto_dinamico_pre_faturamento, data_emissao_nfs_prevista, data_pagamento_prevista, status, medicao_id, nota_fiscal_id, valor_realizado",
          ),
      ) ?? []
    );
  },
  async listByObra(obraId: string) {
    return (
      unwrap<any[]>(
        await supabase
          .from("bms_previstas")
          .select(
            "id, obra_id, numero, data_inicio_janela, data_corte, valor_previsto_inicial, valor_previsto_dinamico, valor_previsto_dinamico_pre_faturamento, data_emissao_nfs_prevista, data_pagamento_prevista, status, medicao_id, nota_fiscal_id, observacoes, origem, editado_em, valor_realizado",
          )
          .eq("obra_id", obraId)
          .order("numero"),
      ) ?? []
    );
  },
  async listComObras() {
    return (
      unwrap<any[]>(
        await supabase
          .from("bms_previstas")
          .select(
            "id, obra_id, numero, data_inicio_janela, data_corte, valor_previsto_inicial, valor_previsto_dinamico, valor_previsto_dinamico_pre_faturamento, data_emissao_nfs_prevista, data_pagamento_prevista, status, medicao_id, nota_fiscal_id, observacoes, versao_otimista, created_at, updated_at, origem, editado_em, valor_realizado, obras(id,codigo,nome,cliente_id)",
          ),
      ) ?? []
    );
  },
  async insertManual(payload: any) {
    const { error } = await supabase.from("bms_previstas").insert(payload);
    if (error) throw error;
  },
  async deletePrevistasPorObra(obraId: string) {
    await supabase
      .from("bms_previstas")
      .delete()
      .eq("obra_id", obraId)
      .eq("status", "prevista");
  },
  async upsertPorObraNumero(rows: any[]) {
    return await supabase
      .from("bms_previstas")
      .upsert(rows, { onConflict: "obra_id,numero", ignoreDuplicates: true });
  },
  async update(id: string, patch: Record<string, unknown>) {
    const { error } = await supabase.from("bms_previstas").update(patch).eq("id", id);
    if (error) throw error;
  },
  async listCurvaPortfolio() {
    const { data, error } = await supabase
      .from("bms_previstas")
      .select("status, data_emissao_nfs_prevista, valor_previsto_dinamico");
    if (error) throw error;
    return data ?? [];
  },
  async listCurvaByObra(obraId: string) {
    const { data, error } = await supabase
      .from("bms_previstas")
      .select("status, data_emissao_nfs_prevista, valor_previsto_dinamico")
      .eq("obra_id", obraId);
    if (error) throw error;
    return data ?? [];
  },
};

export const bmsRedistribuicaoRepo = {
  async listByObra(obraId: string) {
    return (
      unwrap<any[]>(
        await supabase
          .from("bms_redistribuicao")
          .select(
            "id,obra_id,bms_origem_numero,bms_destino_numero,cronograma_item_id,descricao_item,valor_atrasado,valor_absorvido,motivo,created_at",
          )
          .eq("obra_id", obraId),
      ) ?? []
    );
  },
};

// Colunas explícitas — evita `select("*")` (PERF-002 / Onda 4).
const CRONOGRAMA_MARCOS_COLS =
  "id, obra_id, nome, data_prevista, data_baseline, data_realizado, tipo, critico, observacoes, ordem, created_at, updated_at";

export const cronogramaMarcosRepo = {
  async listPorObra(obraId: string) {
    return (
      (
        await supabase
          .from("cronograma_marcos")
          .select(CRONOGRAMA_MARCOS_COLS)
          .eq("obra_id", obraId)
          .order("ordem")
      ).data ?? []
    );
  },
  async upsert(id: string | null | undefined, payload: any) {
    const { error } = id
      ? await supabase.from("cronograma_marcos").update(payload).eq("id", id)
      : await supabase.from("cronograma_marcos").insert(payload);
    if (error) throw error;
  },
  async remove(id: string) {
    const { error } = await supabase.from("cronograma_marcos").delete().eq("id", id);
    if (error) throw error;
  },
  async updateRealizado(id: string, data_realizado: string | null) {
    const { error } = await supabase
      .from("cronograma_marcos")
      .update({ data_realizado })
      .eq("id", id);
    if (error) throw error;
  },
};

export const rdoEfetivoRepo = {
  async listPorRdos(ids: string[]) {
    if (!ids.length) return [] as any[];
    return (
      unwrap<any[]>(
        await supabase
          .from("rdo_efetivo")
          .select("rdo_id, quantidade, presente")
          .in("rdo_id", ids),
      ) ?? []
    );
  },
};

export const rdoOcorrenciasRepo = {
  async listPorRdos(ids: string[]) {
    if (!ids.length) return [] as any[];
    return (
      unwrap<any[]>(
        await supabase
          .from("rdo_ocorrencias")
          .select("rdo_id, tipo, descricao")
          .in("rdo_id", ids),
      ) ?? []
    );
  },
};

export const importValidationRunsRepo = {
  async insert(payload: any) {
    return await supabase.from("import_validation_runs").insert(payload);
  },
};
