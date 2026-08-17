// @ts-nocheck
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type RiscoRow = Database["public"]["Tables"]["riscos"]["Row"];
export type RiscoInsert = Database["public"]["Tables"]["riscos"]["Insert"];
export type RiscoUpdate = Database["public"]["Tables"]["riscos"]["Update"];

export type LicaoRow = Database["public"]["Tables"]["licoes_aprendidas"]["Row"];
export type LicaoInsert = Database["public"]["Tables"]["licoes_aprendidas"]["Insert"];
export type LicaoUpdate = Database["public"]["Tables"]["licoes_aprendidas"]["Update"];

function unwrap<T>(res: { data: T | null; error: unknown }): T {
  if (res.error) throw res.error as Error;
  return res.data as T;
}

export const riscosRepo = {
  async listDashboard() {
    return (
      unwrap(
        await supabase
          .from("riscos")
          .select("id, obra_id, probabilidade, impacto, status, descricao"),
      ) ?? []
    );
  },
  async listResumoDescricao() {
    return unwrap(await supabase.from("riscos").select("id, descricao, obra_id")) ?? [];
  },
  async listFull() {
    const { data, error } = await (supabase as any)
      .from("riscos")
      .select(
        "id, obra_id, codigo, descricao, categoria, tipo, probabilidade, impacto, impacto_financeiro, status, responsavel, resposta, plano_resposta, observacoes, data_revisao, created_at, updated_at, card_id, data_identificacao, owner_id",
      )
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data ?? [];
  },
  async upsert(id: string | null | undefined, payload: RiscoInsert | RiscoUpdate) {
    const { error } = id
      ? await supabase.from("riscos").update(payload).eq("id", id)
      : await supabase.from("riscos").insert(payload as RiscoInsert);
    if (error) throw error;
  },
  async remove(id: string) {
    const { error } = await supabase.from("riscos").delete().eq("id", id);
    if (error) throw error;
  },
  async listAtivosDoCard(cardId: string): Promise<any[]> {
    const { data, error } = await (supabase as any)
      .from("riscos")
      .select("id, descricao, probabilidade, impacto, status")
      .eq("card_id", cardId)
      .in("status", ["aberto", "em_andamento"]);
    if (error) throw error;
    return data ?? [];
  },
};

export const licoesAprendidasRepo = {
  async listCompleta() {
    const { data, error } = await (supabase as any)
      .from("licoes_aprendidas")
      .select(
        "id, obra_id, categoria, situacao, recomendacao, impacto, created_at, risco_id, card_id, responsavel, tags, data_registro, updated_at",
      )
      .order("data_registro", { ascending: false });
    if (error) throw error;
    return data ?? [];
  },
  async upsert(id: string | null | undefined, payload: LicaoInsert | LicaoUpdate) {
    const { error } = id
      ? await supabase.from("licoes_aprendidas").update(payload).eq("id", id)
      : await supabase.from("licoes_aprendidas").insert(payload as LicaoInsert);
    if (error) throw error;
  },
  async remove(id: string) {
    const { error } = await supabase.from("licoes_aprendidas").delete().eq("id", id);
    if (error) throw error;
  },
};

export const pacotesTrabalhoRepo = {
  async listDescricao() {
    return unwrap(await supabase.from("pacotes_trabalho").select("id, descricao")) ?? [];
  },
  async listResumoObra() {
    return (
      unwrap(
        await supabase
          .from("pacotes_trabalho")
          .select("id, descricao, obra_id, semana_inicio"),
      ) ?? []
    );
  },
  async listObra() {
    return unwrap(await supabase.from("pacotes_trabalho").select("id, obra_id")) ?? [];
  },
  async listCompleto() {
    return (
      unwrap(
        await supabase
          .from("pacotes_trabalho")
          .select(
            "id, obra_id, cronograma_item_id, descricao, responsavel_id, semana_inicio, semana_fim, status, tamanho_estimado, unidade, criterio_conclusao, owner_id, created_at, updated_at",
          )
          .order("semana_inicio", { ascending: false }),
      ) ?? []
    );
  },
  async upsert(id: string | null | undefined, payload: any) {
    const { error } = id
      ? await supabase.from("pacotes_trabalho").update(payload).eq("id", id)
      : await supabase.from("pacotes_trabalho").insert(payload);
    if (error) throw error;
  },
  async updateStatus(id: string, status: string) {
    return await supabase.from("pacotes_trabalho").update({ status }).eq("id", id);
  },
  async listJanela(inicio: string, fim: string) {
    const { data, error } = await supabase
      .from("pacotes_trabalho")
      .select("id, obra_id, descricao, semana_inicio, semana_fim, status")
      .gte("semana_fim", inicio)
      .lte("semana_inicio", fim)
      .order("semana_inicio");
    return { data: data ?? [], error };
  },
  async updateSemana(id: string, semana_inicio: string, semana_fim: string) {
    const { error } = await supabase
      .from("pacotes_trabalho")
      .update({ semana_inicio, semana_fim })
      .eq("id", id);
    if (error) throw error;
  },
  async listParaReplicar(ids: string[]) {
    const { data, error } = await supabase
      .from("pacotes_trabalho")
      .select(
        "obra_id, cronograma_item_id, descricao, responsavel_id, semana_inicio, semana_fim, tamanho_estimado, unidade, criterio_conclusao",
      )
      .in("id", ids);
    if (error) throw error;
    return data ?? [];
  },
  async insertMany(payload: any[]) {
    const { error } = await supabase.from("pacotes_trabalho").insert(payload);
    if (error) throw error;
  },
};

export const restricoesRepo = {
  async listResumo() {
    return (
      unwrap(
        await supabase.from("restricoes").select("id, tipo, status, prazo, descricao"),
      ) ?? []
    );
  },
  async listCompleto() {
    return (
      unwrap(
        await supabase
          .from("restricoes")
          .select(
            "id, obra_id, tipo, descricao, responsavel_id, prazo, status, resolvida_em, card_id, requisicao_id, observacao, owner_id, created_at, updated_at",
          )
          .order("created_at", { ascending: false }),
      ) ?? []
    );
  },
  async listDashboard() {
    return (
      unwrap(await supabase.from("restricoes").select("id, obra_id, tipo, status, prazo")) ?? []
    );
  },
  async listCurto() {
    return unwrap(await supabase.from("restricoes").select("id, tipo, status, prazo")) ?? [];
  },
  async upsert(id: string | null | undefined, payload: any) {
    return id
      ? await supabase.from("restricoes").update(payload).eq("id", id)
      : await supabase.from("restricoes").insert(payload);
  },
  async updateStatus(id: string, status: string) {
    return await supabase.from("restricoes").update({ status }).eq("id", id);
  },

  async listAbertasDoCard(cardId: string): Promise<any[]> {
    const { data, error } = await supabase
      .from("restricoes")
      .select("id, descricao, tipo, status, prazo")
      .eq("card_id", cardId)
      .eq("status", "aberta");
    if (error) throw error;
    return data ?? [];
  },
};

export const pacoteRestricoesRepo = {
  async listComData() {
    return (
      unwrap(
        await supabase
          .from("pacote_restricoes")
          .select("pacote_id, restricao_id, created_at"),
      ) ?? []
    );
  },
  async listDashboard() {
    return (
      unwrap(await supabase.from("pacote_restricoes").select("pacote_id, restricao_id")) ?? []
    );
  },
  async vincular(restricao_id: string, pacote_ids: string[]) {
    return await supabase
      .from("pacote_restricoes")
      .insert(pacote_ids.map((pid) => ({ pacote_id: pid, restricao_id })));
  },
  async desvincular(restricao_id: string, pacote_ids: string[]) {
    return await supabase
      .from("pacote_restricoes")
      .delete()
      .eq("restricao_id", restricao_id)
      .in("pacote_id", pacote_ids);
  },
};

export const compromissosSemanaisRepo = {
  async insertRaw(payload: any) {
    return await supabase.from("compromissos_semanais").insert(payload);
  },
};

export const causasNaoConclusaoRepo = {
  async listChaveLabel() {
    return unwrap(await supabase.from("causas_nao_conclusao").select("chave, label")) ?? [];
  },
};

