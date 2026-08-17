// @ts-nocheck
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { diffRow, fromRow, toRow, type NCRow } from "@/lib/qualidade/nc-mapper";
import { transition, type NCEvent, type NCState } from "@/lib/qualidade/nc-workflow";

export type InspecaoRow = Database["public"]["Tables"]["inspecoes"]["Row"];
export type InspecaoInsert = Database["public"]["Tables"]["inspecoes"]["Insert"];
export type InspecaoUpdate = Database["public"]["Tables"]["inspecoes"]["Update"];

function unwrap<T>(res: { data: T | null; error: unknown }): T {
  if (res.error) throw res.error as Error;
  return (res.data as T) ?? ([] as unknown as T);
}

export const NC_WORKFLOW_SELECT =
  "id, status, responsavel_id, prazo, tratativa, reinspecao_resultado, reinspecionada_em, encerrada_em, aguardando_reinspecao, quem, quando_planejado, como, acao_corretiva, resolvida_em";

type NCLegacyWorkflowRow = Partial<NCRow> & {
  status?: string | null;
  quem?: string | null;
  quando_planejado?: string | null;
  como?: string | null;
  acao_corretiva?: string | null;
  resolvida_em?: string | null;
};

function dateToISO(date: string | null | undefined): string | null {
  if (!date) return null;
  const parsed = Date.parse(date);
  if (!Number.isFinite(parsed)) return null;
  return new Date(parsed).toISOString();
}

export function ncWorkflowFromRow(row: NCLegacyWorkflowRow): NCState {
  const legacyStatus = row.status === "aguardando_verificacao" ? "em_tratativa" : row.status;
  return fromRow({
    status: (legacyStatus ?? "aberta") as NCRow["status"],
    responsavel_id: row.responsavel_id ?? row.quem ?? null,
    prazo: row.prazo ?? dateToISO(row.quando_planejado),
    tratativa: row.tratativa ?? row.como ?? row.acao_corretiva ?? null,
    reinspecao_resultado: row.reinspecao_resultado ?? null,
    reinspecionada_em: row.reinspecionada_em ?? null,
    encerrada_em: row.encerrada_em ?? row.resolvida_em ?? null,
    aguardando_reinspecao:
      row.aguardando_reinspecao === true || row.status === "aguardando_verificacao",
  });
}

function mirrorWorkflowPatch(patch: Partial<NCRow>): Record<string, unknown> {
  const mirrored: Record<string, unknown> = { ...patch };
  if ("responsavel_id" in patch) mirrored.quem = patch.responsavel_id;
  if ("prazo" in patch) mirrored.quando_planejado = patch.prazo ? patch.prazo.slice(0, 10) : null;
  if ("tratativa" in patch) mirrored.como = patch.tratativa;
  if (patch.status === "resolvida" && "encerrada_em" in patch) mirrored.resolvida_em = patch.encerrada_em;
  return mirrored;
}

function enrichLegacyPatch(patch: Record<string, unknown>): Record<string, unknown> {
  const next: Record<string, unknown> = { ...patch };
  if (next.status === "aguardando_verificacao") {
    next.status = "em_tratativa";
    next.aguardando_reinspecao = true;
  }
  if ("quem" in next && !("responsavel_id" in next)) next.responsavel_id = next.quem;
  if ("quando_planejado" in next && !("prazo" in next)) {
    next.prazo = dateToISO(next.quando_planejado as string | null);
  }
  if ("como" in next && !("tratativa" in next)) next.tratativa = next.como;
  if ("acao_corretiva" in next && next.tratativa == null) next.tratativa = next.acao_corretiva;
  if ("resolvida_em" in next && !("encerrada_em" in next)) next.encerrada_em = next.resolvida_em;
  return next;
}

/** Inspeções / não-conformidades (Fase 1 #6). */
export const inspecoesRepo = {
  async list(cols: string = "id, obra_id, modelo_id, status, data_inspecao, responsavel_id") {
    return unwrap<any[]>(
      await supabase.from("inspecoes").select(cols).order("data_inspecao", { ascending: false }),
    );
  },

  async getById(id: string) {
    return unwrap<any>(
      await supabase
        .from("inspecoes")
        .select(
          "id, obra_id, modelo_id, status, data_inspecao, data_planejada, local, responsavel_id, score, aprovado, assinatura_path, observacao, card_id, cronograma_item_id, geo_lat, geo_lng, created_by, created_at, updated_at",
        )
        .eq("id", id)
        .single(),
    );
  },

  async create(payload: InspecaoInsert) {
    const { error } = await supabase.from("inspecoes").insert(payload);
    if (error) throw error;
  },

  async update(id: string, patch: InspecaoUpdate) {
    const { error } = await supabase.from("inspecoes").update(patch).eq("id", id);
    if (error) throw error;
  },

  async listRecentes(limit: number = 20) {
    const { data, error } = await supabase
      .from("inspecoes")
      .select("id, modelo_id, status, score, aprovado, local, data_inspecao, created_at")
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) throw error;
    return data ?? [];
  },

  async listNaoConformidades(
    cols: string = "id, obra_id, inspecao_id, severidade, status, descricao",
  ) {
    return unwrap<any[]>(
      await supabase
        .from("nao_conformidades")
        .select(cols)
        .order("created_at", { ascending: false }),
    );
  },
};

export const inspecaoAgendasRepo = {
  async list() {
    const { data, error } = await supabase
      .from("inspecao_agendas")
      .select(
        "id, modelo_id, obra_id, titulo, local, responsavel_id, frequencia, dias_semana, dia_mes, hora_alvo, data_inicio, data_fim, ativa, proxima_data, ultima_geracao_em, created_by, created_at, updated_at",
      )
      .order("ativa", { ascending: false })
      .order("proxima_data", { ascending: true, nullsFirst: false });
    if (error) throw error;
    return data ?? [];
  },
  async update(id: string, patch: Record<string, unknown>) {
    const { error } = await supabase.from("inspecao_agendas").update(patch).eq("id", id);
    if (error) throw error;
  },
  async insert(payload: Record<string, unknown>) {
    const { error } = await supabase.from("inspecao_agendas").insert(payload);
    if (error) throw error;
  },
  async remove(id: string) {
    const { error } = await supabase.from("inspecao_agendas").delete().eq("id", id);
    if (error) throw error;
  },
  async materializarPendentes(params: Record<string, unknown>) {
    const { data, error } = await (supabase as any).rpc(
      "fn_inspecao_materializar_pendentes",
      params,
    );
    if (error) throw error;
    return data;
  },
};

export const inspecaoModelosRepo = {
  async listMin() {
    const { data, error } = await supabase
      .from("inspecao_modelos")
      .select("id, codigo, nome")
      .order("codigo");
    if (error) throw error;
    return data ?? [];
  },
  async listAtivos() {
    const { data, error } = await supabase
      .from("inspecao_modelos")
      .select("id, codigo, nome, descricao, categoria, setor, score_minimo")
      .eq("ativo", true)
      .order("codigo");
    if (error) throw error;
    return data ?? [];
  },
  async getById(id: string) {
    const { data } = await supabase
      .from("inspecao_modelos")
      .select("id, codigo, nome, descricao, categoria, setor, score_minimo")
      .eq("id", id)
      .maybeSingle();
    return data;
  },
  async getNome(id: string): Promise<string | null> {
    const { data } = await supabase
      .from("inspecao_modelos")
      .select("nome")
      .eq("id", id)
      .maybeSingle();
    return (data?.nome as string | null) ?? null;
  },
};

export const inspecaoPerguntasRepo = {
  async listPorModelo(modeloId: string) {
    const { data } = await supabase
      .from("inspecao_perguntas")
      .select(
        "id, modelo_id, ordem, grupo, texto, tipo, obrigatoria, peso, config, depende_de, depende_valor, gera_nc_se",
      )
      .eq("modelo_id", modeloId)
      .order("ordem");
    return data ?? [];
  },
};

export const inspecaoQrAlvosRepo = {
  async list() {
    const { data, error } = await supabase
      .from("inspecao_qr_alvos")
      .select("id, obra_id, tipo, codigo, nome, local, modelo_id, ativa")
      .order("codigo");
    if (error) throw error;
    return data ?? [];
  },
  async update(id: string, patch: Record<string, unknown>) {
    const { error } = await supabase.from("inspecao_qr_alvos").update(patch).eq("id", id);
    if (error) throw error;
  },
  async insert(payload: Record<string, unknown>) {
    const { error } = await supabase.from("inspecao_qr_alvos").insert(payload);
    if (error) throw error;
  },
  async remove(id: string) {
    const { error } = await supabase.from("inspecao_qr_alvos").delete().eq("id", id);
    if (error) throw error;
  },
  async getNome(id: string): Promise<string | null> {
    const { data } = await supabase
      .from("inspecao_qr_alvos")
      .select("nome")
      .eq("id", id)
      .maybeSingle();
    return (data?.nome as string | null) ?? null;
  },
};

export const naoConformidadesRepo = {
  async update(id: string, patch: Record<string, unknown>) {
    const { error } = await supabase.from("nao_conformidades").update(enrichLegacyPatch(patch)).eq("id", id);
    if (error) throw error;
  },
  async getWorkflowState(id: string): Promise<NCState> {
    const { data, error } = await supabase
      .from("nao_conformidades")
      .select(NC_WORKFLOW_SELECT)
      .eq("id", id)
      .single();
    if (error) throw error;
    return ncWorkflowFromRow(data ?? {});
  },
  async setWorkflowState(id: string, state: NCState) {
    const { error } = await supabase
      .from("nao_conformidades")
      .update(mirrorWorkflowPatch(toRow(state)))
      .eq("id", id);
    if (error) throw error;
  },
  async updateWorkflowState(id: string, before: NCState, after: NCState) {
    const patch = diffRow(before, after);
    if (!Object.keys(patch).length) return patch;
    const { error } = await supabase
      .from("nao_conformidades")
      .update(mirrorWorkflowPatch(patch))
      .eq("id", id);
    if (error) throw error;
    return patch;
  },
  async applyTransition(id: string, event: NCEvent) {
    const before = await this.getWorkflowState(id);
    const result = transition(before, event);
    if (!result.ok) return result;
    await this.updateWorkflowState(id, before, result.state);
    return result;
  },
  async notificarPrazos() {
    const { data, error } = await (supabase as any).rpc("fn_nc_notificar_prazos");
    if (error) throw error;
    return data;
  },
};
