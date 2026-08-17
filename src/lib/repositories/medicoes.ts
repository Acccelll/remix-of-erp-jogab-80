// @ts-nocheck
import { supabase } from "@/integrations/supabase/client";
import { withDeadline } from "@/lib/core/http/withDeadline";

/** SEC-006 slice-03: teto p/ RPCs atômicos (multi-DML). */
const RPC_DEADLINE_MS = 30_000;

function unwrap<T>(res: { data: T | null; error: unknown }): T {
  if (res.error) throw res.error as Error;
  return res.data as T;
}

export const medicoesRepo = {
  async listDashboard() {
    return (
      unwrap<any[]>(
        await supabase
          .from("medicoes")
          .select("id, obra_id, numero, data_corte, data_aprovacao, status, valor"),
      ) ?? []
    );
  },
  async listByObra(obraId: string) {
    return (
      unwrap<any[]>(
        await supabase
          .from("medicoes")
          .select(
            "id, obra_id, numero, data_corte, data_aprovacao, valor, percentual, status, observacoes, arquivo_origem, sheet_origem, data_inicio, baseline_id, aprovada_por, aprovada_em, enviada_por, enviada_em, rejeitada_por, rejeitada_em, rejeicao_motivo",
          )
          .eq("obra_id", obraId)
          .order("data_corte"),
      ) ?? []
    );
  },
  async listNumerosByObra(obraId: string): Promise<Set<string>> {
    const rows =
      unwrap<{ numero: string }[]>(
        await supabase.from("medicoes").select("numero").eq("obra_id", obraId),
      ) ?? [];
    return new Set(rows.map((m) => m.numero));
  },

  async getIdByObraNumero(obraId: string, numero: string): Promise<string | undefined> {
    const { data, error } = await supabase
      .from("medicoes")
      .select("id")
      .eq("obra_id", obraId)
      .eq("numero", numero)
      .maybeSingle();
    if (error) throw error;
    return data?.id;
  },

  async createReturningId(payload: Record<string, unknown>): Promise<string> {
    const { data, error } = await supabase.from("medicoes").insert(payload).select("id").single();
    if (error) throw error;
    return data.id;
  },

  async update(id: string, patch: Record<string, unknown>): Promise<void> {
    const { error } = await supabase.from("medicoes").update(patch).eq("id", id);
    if (error) throw error;
  },

  // PRO-016 — workflow de aprovação de medição.
  async canAprovar(obraId: string): Promise<boolean> {
    const { data, error } = await supabase.rpc("user_pode_aprovar_medicao", { p_obra: obraId });
    if (error) throw error;
    return data === true;
  },
  async enviarParaAprovacao(id: string, login: string): Promise<void> {
    const { error } = await supabase
      .from("medicoes")
      .update({ status: "enviada", enviada_por: login, enviada_em: new Date().toISOString() })
      .eq("id", id);
    if (error) throw error;
  },
  async aprovar(id: string, login: string): Promise<void> {
    const agora = new Date();
    const { error } = await supabase
      .from("medicoes")
      .update({
        status: "aprovada",
        aprovada_por: login,
        aprovada_em: agora.toISOString(),
        data_aprovacao: agora.toISOString().slice(0, 10),
      })
      .eq("id", id);
    if (error) throw error;
  },
  async rejeitar(id: string, login: string, motivo?: string): Promise<void> {
    const { error } = await supabase
      .from("medicoes")
      .update({
        status: "rejeitada",
        rejeitada_por: login,
        rejeitada_em: new Date().toISOString(),
        rejeicao_motivo: motivo ?? null,
      })
      .eq("id", id);
    if (error) throw error;
  },

  async listIdsByObra(obraId: string): Promise<string[]> {
    const { data, error } = await supabase.from("medicoes").select("id").eq("obra_id", obraId);
    if (error) throw error;
    return (data ?? []).map((m: any) => m.id);
  },

  async removeMany(ids: string[]): Promise<void> {
    if (!ids.length) return;
    const { error } = await supabase.from("medicoes").delete().in("id", ids);
    if (error) throw error;
  },
};

export const medicaoHistoricoRepo = {
  async listByObra(obraId: string) {
    const { data, error } = await supabase
      .from("historico_medicao")
      .select(
        "id, medicao_id, obra_id, status_anterior, status_novo, acao, responsavel_login, motivo, created_at",
      )
      .eq("obra_id", obraId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data ?? [];
  },
};

export const itensMedicaoRepo = {
  async removeByMedicao(medicaoId: string): Promise<void> {
    const { error } = await supabase.from("itens_medicao").delete().eq("medicao_id", medicaoId);
    if (error) throw error;
  },

  async removeByMedicaoIds(medicaoIds: string[]): Promise<void> {
    if (!medicaoIds.length) return;
    const { error } = await supabase.from("itens_medicao").delete().in("medicao_id", medicaoIds);
    if (error) throw error;
  },

  async existsByItemIds(itemIds: string[]): Promise<boolean> {
    if (!itemIds.length) return false;
    const { data, error } = await supabase
      .from("itens_medicao")
      .select("cronograma_item_id")
      .in("cronograma_item_id", itemIds)
      .limit(1);
    if (error) throw error;
    return (data?.length ?? 0) > 0;
  },

  async insertMany(rows: Record<string, unknown>[]): Promise<void> {
    if (!rows.length) return;
    const { error } = await supabase.from("itens_medicao").insert(rows);
    if (error) throw error;
  },
  async listByMedicaoIds(medicaoIds: string[]) {
    if (!medicaoIds.length) return [];
    return (
      unwrap<any[]>(
        await supabase
          .from("itens_medicao")
          .select("*, cronograma_itens(id, descricao, custo, percentual_previsto, ordem)")
          .in("medicao_id", medicaoIds),
      ) ?? []
    );
  },
};

export const notasFiscaisRepo = {
  async listDashboard() {
    return (
      unwrap<any[]>(
        await supabase
          .from("notas_fiscais")
          .select(
            "id, obra_id, medicao_id, numero, data_emissao, data_vencimento, valor, valor_liquido, valor_servicos, status, competencia",
          ),
      ) ?? []
    );
  },
  async listByObra(obraId: string) {
    return (
      unwrap<any[]>(
        await supabase
          .from("notas_fiscais")
          .select(
            "id, obra_id, medicao_id, numero, data_emissao, valor, valor_liquido, valor_servicos, data_vencimento, status, pdf_url, observacoes, percentual_material, valor_material, inss_retido, iss_retido, outras_retencoes, retencao_cbs, retencao_ibs, codigo_cno, codigo_art, competencia, codigo_verificacao",
          )
          .eq("obra_id", obraId)
          .order("data_emissao", { ascending: true, nullsFirst: false }),
      ) ?? []
    );
  },
  async listComObras() {
    const { data, error } = await supabase
      .from("notas_fiscais")
      .select("*, obras(id,codigo,nome,cliente_id)");
    if (error) throw error;
    return data ?? [];
  },
  async listFaturamentoNfse(
    cols: string = "id,numero_nfse,data_emissao,competencia,tomador_razao,tomador_uf,obra_id,numero_bms,pedido,valor_servicos,valor_iss,valor_inss,valor_liquido,status,origem,discriminacao,data_vencimento,vencimento_origem",
    limit = 5000,
  ) {
    const { data, error } = await supabase
      .from("faturamento_nfse")
      .select(cols)
      .order("data_emissao", { ascending: false, nullsFirst: false })
      .limit(limit);
    if (error) throw error;
    return data ?? [];
  },
  async setFaturamentoNfseObra(id: string, obraId: string | null): Promise<void> {
    const { error } = await supabase
      .from("faturamento_nfse")
      .update({ obra_id: obraId })
      .eq("id", id);
    if (error) throw error;
  },
  async setFaturamentoNfseVencimento(
    id: string,
    dataVencimento: string | null,
    origem: "calculado" | "manual" | "importado",
  ): Promise<void> {
    const { error } = await supabase
      .from("faturamento_nfse")
      .update({ data_vencimento: dataVencimento, vencimento_origem: origem })
      .eq("id", id);
    if (error) throw error;
  },
  async removeByObra(obraId: string): Promise<void> {
    const { error } = await supabase.from("notas_fiscais").delete().eq("obra_id", obraId);
    if (error) throw error;
  },

  async listResumoByObraIds(obraIds: string[]) {
    if (!obraIds.length) return [];
    const { data, error } = await supabase
      .from("notas_fiscais")
      .select("id, obra_id, valor, status")
      .in("obra_id", obraIds);
    if (error) throw error;
    return data ?? [];
  },

  async listCurvaPortfolio() {
    const { data, error } = await supabase
      .from("notas_fiscais")
      .select("data_emissao, valor, status");
    if (error) throw error;
    return data ?? [];
  },

  async listCurvaByObra(obraId: string) {
    const { data, error } = await supabase
      .from("notas_fiscais")
      .select("data_emissao, valor, status")
      .eq("obra_id", obraId);
    if (error) throw error;
    return data ?? [];
  },

  /** Edição direta de um lançamento de NFS-e importado/manual. */
  async updateFaturamentoNfse(id: string, patch: Record<string, unknown>): Promise<void> {
    const { error } = await supabase.from("faturamento_nfse").update(patch).eq("id", id);
    if (error) throw error;
  },
  /**
   * NFS-e importadas no módulo Faturamento pertencentes à obra.
   * Além do vínculo forte (`obra_id`), aceita os códigos da obra
   * (`codigo`/`codigo_totvs`) porque muitas notas importadas só trazem a
   * coluna "Obra" textual — sem esse fallback a aba aparece vazia.
   */
  async listFaturamentoImportadasByObra(obraId: string, codigos: string[] = []) {
    const cols =
      "id,numero_nfse,data_emissao,competencia,valor_servicos,valor_liquido,valor_iss,origem,data_vencimento,vencimento_origem,numero_bms,tomador_razao,obra_id,codigo_obra,codigo_obra_interno";
    const variantes = Array.from(
      new Set(
        codigos
          .map((c) => String(c ?? "").trim())
          .filter(Boolean)
          .flatMap((c) => [c, c.replace(/^0+/, ""), c.padStart(3, "0")]),
      ),
    );
    const ors = [`obra_id.eq.${obraId}`];
    if (variantes.length) {
      const lista = variantes.map((v) => `"${v}"`).join(",");
      ors.push(`codigo_obra.in.(${lista})`);
      ors.push(`codigo_obra_interno.in.(${lista})`);
    }
    const { data, error } = await supabase
      .from("faturamento_nfse")
      .select(cols)
      .or(ors.join(","))
      .order("data_emissao", { ascending: false, nullsFirst: false });
    if (error) throw error;
    return data ?? [];
  },
};

export const recebimentosRepo = {
  async listDashboard() {
    return (
      unwrap<any[]>(
        await supabase
          .from("recebimentos")
          .select(
            "id, obra_id, nota_fiscal_id, cronograma_item_id, data_prevista, data_recebimento, valor_previsto, valor_previsto_inicial, valor_recebido, status, congelado, origem",
          ),
      ) ?? []
    );
  },
  async listByObra(obraId: string) {
    return (
      unwrap<any[]>(
        await supabase
          .from("recebimentos")
          .select(
            "id, obra_id, nota_fiscal_id, cronograma_item_id, data_prevista, data_recebimento, valor_previsto, valor_previsto_inicial, valor_recebido, status, congelado, origem, observacoes",
          )
          .eq("obra_id", obraId)
          .order("data_prevista"),
      ) ?? []
    );
  },
  async listComObras() {
    const { data, error } = await supabase
      .from("recebimentos")
      .select("*, obras(id,codigo,nome,cliente_id)");
    if (error) throw error;
    return data ?? [];
  },
  async marcarPago(id: string, dataRecebimento: string, valorRecebido: number): Promise<void> {
    const { error } = await supabase
      .from("recebimentos")
      .update({
        data_recebimento: dataRecebimento,
        valor_recebido: valorRecebido,
        status: "pago",
      })
      .eq("id", id);
    if (error) throw error;
  },

  async removeByObra(obraId: string): Promise<void> {
    const { error } = await supabase.from("recebimentos").delete().eq("obra_id", obraId);
    if (error) throw error;
  },

  async removePrevistasByObra(obraId: string): Promise<void> {
    const { error } = await supabase
      .from("recebimentos")
      .delete()
      .eq("obra_id", obraId)
      .is("data_recebimento", null);
    if (error) throw error;
  },
};

/**
 * RPCs atômicas de faturamento/medição.
 */
export const faturamentoRpc = {
  async criarMedicaoAtomica(params: {
    p_obra_id: string;
    p_numero: string;
    p_data_inicio: string | null;
    p_data_corte: string;
    p_observacoes: string | null;
    p_valor_total: number;
    p_itens: any;
    p_bms_id: string | null;
  }) {
    return await withDeadline<any>(
      supabase.rpc("criar_medicao_atomica" as never, params as never) as unknown as Promise<any>,
      RPC_DEADLINE_MS,
      "medicoes.criarMedicaoAtomica",
    );
  },
  async salvarNfAtomica(params: {
    p_nf_id: string | null;
    p_payload: any;
    p_data_prevista: string;
    p_valor_liquido: number;
    p_bms_prevista_id: string | null;
    p_medicao_id_fallback: string | null;
    p_valor_contrato: number;
  }) {
    return await withDeadline<any>(
      supabase.rpc("salvar_nf_atomica" as never, params as never) as unknown as Promise<any>,
      RPC_DEADLINE_MS,
      "medicoes.salvarNfAtomica",
    );
  },
  async excluirNfAtomica(params: { p_nf_id: string; p_valor_contrato: number }) {
    return await withDeadline<any>(
      supabase.rpc("excluir_nf_atomica" as never, params as never) as unknown as Promise<any>,
      RPC_DEADLINE_MS,
      "medicoes.excluirNfAtomica",
    );
  },
  async fecharBmsAtomica(params: {
    p_bms_id: string;
    p_valor_realizado: number;
    p_futuras: any;
    p_registros: any;
  }) {
    return await withDeadline<any>(
      supabase.rpc("fechar_bms_atomica" as never, params as never) as unknown as Promise<any>,
      RPC_DEADLINE_MS,
      "medicoes.fecharBmsAtomica",
    );
  },
};
