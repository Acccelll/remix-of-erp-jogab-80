// @ts-nocheck
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { withDeadline } from "@/lib/core/http/withDeadline";
import {
  criticalFlowIds,
  noteCriticalFlowFail,
  noteCriticalFlowOk,
} from "@/lib/observability/critical-flows";
import { REPO_LIMITS } from "./_limits";

export type LancamentoRow = Database["public"]["Tables"]["financeiro_lancamentos"]["Row"];
export type SnapshotRow = Database["public"]["Tables"]["financeiro_snapshots"]["Row"];

function unwrap<T>(res: { data: T | null; error: unknown }): T {
  if (res.error) throw res.error as Error;
  return (res.data as T) ?? ([] as unknown as T);
}

/** Acesso central às tabelas financeiras (Fase 1 #6). */
export const financeiroRepo = {
  async rpcRecalcularPrevisaoNf(obraId: string, valorContrato: number): Promise<void> {
    const { error } = await (supabase as any).rpc("fn_recalcular_previsao_nf", {
      p_obra_id: obraId,
      p_valor_contrato: valorContrato,
    });
    if (error) throw new Error(error.message);
  },
  async rpcRecalcularAposFaturamento(
    obraId: string,
    nfId: string,
    valorContrato: number,
  ): Promise<any> {
    const { data, error } = await (supabase as any).rpc("fn_recalcular_apos_faturamento", {
      p_obra_id: obraId,
      p_nf_id: nfId,
      p_valor_contrato: valorContrato,
    });
    if (error) throw new Error(error.message);
    return data;
  },
  async rpcReverterFaturamentoBms(
    obraId: string,
    bmsId: string,
    valorContrato: number,
  ): Promise<void> {
    const { error } = await (supabase as any).rpc("fn_reverter_faturamento_bms", {
      p_obra_id: obraId,
      p_bms_id: bmsId,
      p_valor_contrato: valorContrato,
    });
    if (error) throw new Error(error.message);
  },

  async getLatestSnapshotMeta() {
    const { data, error } = await (supabase as any)
      .from("financeiro_snapshots")
      .select("id, importado_em, novos_sem_natureza, matriz_atualizada_em")
      .order("importado_em", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    return data as {
      id: string;
      importado_em: string;
      novos_sem_natureza: number | null;
      matriz_atualizada_em: string | null;
    } | null;
  },

  async listCentrosCustoTotvs(pageSize: number = 1000) {
    const out: Array<{ codigo: string; nome: string | null }> = [];
    let offset = 0;
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const { data, error } = await supabase
        .from("centros_custo_totvs")
        .select("codigo, descricao")
        .range(offset, offset + pageSize - 1);
      if (error) throw error;
      if (!data || data.length === 0) break;
      out.push(...data.map((c: any) => ({ codigo: c.codigo, nome: c.descricao ?? null })));
      if (data.length < pageSize) break;
      offset += pageSize;
    }
    return out;
  },

  async getMatrizInfo(): Promise<{ atualizado_em: string | null; total: number }> {
    const { data, error } = await (supabase as any)
      .from("financeiro_matriz_rateios")
      .select("atualizado_em, ref_lancamento")
      .order("atualizado_em", { ascending: false })
      .limit(1);
    if (error) throw error;
    const ultima = data?.[0]?.atualizado_em ?? null;
    const { count } = await (supabase as any)
      .from("financeiro_matriz_rateios")
      .select("*", { count: "exact", head: true });
    return { atualizado_em: ultima as string | null, total: count ?? 0 };
  },

  async listCentrosCadastradosCodigos(): Promise<{ codigo: string }[]> {
    const { data, error } = await supabase.from("centros_custo_totvs").select("codigo");
    if (error) throw error;
    return (data ?? []) as { codigo: string }[];
  },

  async rpcImportarMatriz(p_rateios: any, p_data_ref?: string | null) {
    const totalRateios = Array.isArray(p_rateios) ? p_rateios.length : undefined;
    try {
      // SEC-006.slice-02: import massivo pode travar em rede degradada.
      const { data, error } = await withDeadline(
        (supabase as any).rpc("fn_importar_matriz", { p_rateios, p_data_ref: p_data_ref ?? null }),
        90_000,
        "financeiro.rpcImportarMatriz",
      );
      if (error) throw error;
      noteCriticalFlowOk(criticalFlowIds.totvsImport, { dataRef: p_data_ref, totalRateios });
      return (data ?? {}) as Record<string, number>;
    } catch (err) {
      noteCriticalFlowFail(criticalFlowIds.totvsImport, err, {
        dataRef: p_data_ref,
        totalRateios,
      });
      throw err;
    }
  },

  /** Cria um título manual (a pagar/a receber) direto no financeiro, fora do TOTVS. */
  async rpcCriarTituloManual(input: {
    natureza_tipo: number;
    centro_custo: string;
    cnpj_cpf: string | null;
    nome: string | null;
    data_emissao: string | null;
    data_vencimento: string;
    historico: string | null;
    rateios: { cod_natureza: string; valor_rateio: number }[];
  }): Promise<string> {
    const { data, error } = await withDeadline(
      (supabase as any).rpc("fn_criar_titulo_manual", {
        p_natureza_tipo: input.natureza_tipo,
        p_centro_custo: input.centro_custo,
        p_cnpj_cpf: input.cnpj_cpf,
        p_nome: input.nome,
        p_data_emissao: input.data_emissao,
        p_data_vencimento: input.data_vencimento,
        p_historico: input.historico,
        p_rateios: input.rateios,
      }),
      15_000,
      "financeiro.rpcCriarTituloManual",
    );
    if (error) throw new Error(error.message);
    return data as string;
  },

  /** Edita um título manual existente (bloqueado se já baixado/cancelado). */
  async rpcEditarTituloManual(
    refLancamento: number,
    input: {
      natureza_tipo: number;
      centro_custo: string;
      cnpj_cpf: string | null;
      nome: string | null;
      data_emissao: string | null;
      data_vencimento: string;
      historico: string | null;
      rateios: { cod_natureza: string; valor_rateio: number }[];
    },
  ): Promise<void> {
    const { error } = await withDeadline(
      (supabase as any).rpc("fn_editar_titulo_manual", {
        p_ref_lancamento: refLancamento,
        p_natureza_tipo: input.natureza_tipo,
        p_centro_custo: input.centro_custo,
        p_cnpj_cpf: input.cnpj_cpf,
        p_nome: input.nome,
        p_data_emissao: input.data_emissao,
        p_data_vencimento: input.data_vencimento,
        p_historico: input.historico,
        p_rateios: input.rateios,
      }),
      15_000,
      "financeiro.rpcEditarTituloManual",
    );
    if (error) throw new Error(error.message);
  },

  /** Dá baixa (total ou parcial) num título manual. */
  async rpcBaixarTituloManual(
    refLancamento: number,
    valorBaixa: number,
    dataBaixa: string,
  ): Promise<void> {
    const { error } = await withDeadline(
      (supabase as any).rpc("fn_baixar_titulo_manual", {
        p_ref_lancamento: refLancamento,
        p_valor_baixa: valorBaixa,
        p_data_baixa: dataBaixa,
      }),
      15_000,
      "financeiro.rpcBaixarTituloManual",
    );
    if (error) throw new Error(error.message);
  },

  /** Cancela um título manual (bloqueado se já baixado integralmente). */
  async rpcCancelarTituloManual(refLancamento: number): Promise<void> {
    const { error } = await withDeadline(
      (supabase as any).rpc("fn_cancelar_titulo_manual", { p_ref_lancamento: refLancamento }),
      15_000,
      "financeiro.rpcCancelarTituloManual",
    );
    if (error) throw new Error(error.message);
  },

  /**
   * Histórico de importações do Relatório de Status para um título específico.
   * Ordenado da mais recente para a mais antiga.
   */
  async getHistoricoLancamento(refLancamento: number | string): Promise<
    Array<{
      id: string;
      ref_lancamento: number;
      status_cod: number | null;
      status_label: string | null;
      valor_baixado: number | null;
      data_baixa: string | null;
      data_pagamento: string | null;
      periodo_ref: string | null;
      nome_arquivo: string | null;
      importado_em: string;
    }>
  > {
    return unwrap<any[]>(
      await (supabase as any)
        .from("financeiro_relatorio_status_historico")
        .select(
          "id, ref_lancamento, status_cod, status_label, valor_baixado, data_baixa, data_pagamento, periodo_ref, nome_arquivo, importado_em",
        )
        .eq("ref_lancamento", refLancamento)
        .order("importado_em", { ascending: false })
        .limit(200),
    );
  },

  async listLancamentosPorObra(
    obraId: string,
    cols: string = "id, data_lancamento, valor, grupo, natureza_id, status_cod",
  ) {
    return unwrap<any[]>(
      await supabase
        .from("financeiro_lancamentos")
        .select(cols)
        .eq("obra_id", obraId)
        .order("data_lancamento", { ascending: false })
        .limit(REPO_LIMITS.financeiro),
    );
  },

  /**
   * Lança paginação sobre `financeiro_lancamentos` de um snapshot, opcionalmente
   * filtrando por obra e por status_cod excluído. Usa colunas explícitas.
   */
  async listLancamentosPorSnapshot(params: {
    snapshotId: string;
    obraId?: string | null;
    excludeStatusCod?: number;
    cols?: string;
    pageSize?: number;
  }) {
    const cols =
      params.cols ??
      "id, ref_lancamento, nome, centro_custo, desc_centro_custo, valor_liquido, valor_baixado, dias_atraso, status_cod, status_label, data_emissao, data_vencimento, pendente_natureza, obra_id";
    const pageSize = params.pageSize ?? 1000;
    const out: any[] = [];
    let offset = 0;
    // eslint-disable-next-line no-constant-condition
    while (true) {
      let q = supabase
        .from("financeiro_lancamentos")
        .select(cols)
        .eq("snapshot_id", params.snapshotId)
        .range(offset, offset + pageSize - 1);
      if (params.excludeStatusCod !== undefined) q = q.neq("status_cod", params.excludeStatusCod);
      if (params.obraId) q = q.eq("obra_id", params.obraId);
      const { data, error } = await q;
      if (error) throw error;
      if (!data || data.length === 0) break;
      out.push(...data);
      if (data.length < pageSize) break;
      offset += pageSize;
    }
    return out;
  },

  /** Pagina `financeiro_matriz_rateios` com colunas explícitas. */
  async listMatrizRateios(
    cols: string = "ref_lancamento, cod_natureza, desc_natureza, valor_rateio",
    pageSize: number = 1000,
  ) {
    const out: any[] = [];
    let offset = 0;
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const { data, error } = await supabase
        .from("financeiro_matriz_rateios")
        .select(cols)
        .range(offset, offset + pageSize - 1);
      if (error) throw error;
      if (!data || data.length === 0) break;
      out.push(...data);
      if (data.length < pageSize) break;
      offset += pageSize;
    }
    return out;
  },

  async listSnapshots(cols: string = "id, mes_competencia, criado_em, origem") {
    return unwrap<any[]>(
      await supabase
        .from("financeiro_snapshots")
        .select(cols)
        .order("mes_competencia", { ascending: false })
        .limit(REPO_LIMITS.financeiro),
    );
  },

  async vwObra(obraId: string) {
    return unwrap<any[]>(
      await supabase
        .from("vw_financeiro_obra")
        .select("obra_id, grupo, valor_rateio, mes_competencia, status_cod")
        .eq("obra_id", obraId)
        .limit(REPO_LIMITS.financeiro),
    );
  },

  async listSaudeByObraIds(obraIds: string[]) {
    if (!obraIds.length) return [];
    const rows = unwrap<any[]>(
      await supabase
        .from("vw_financeiro_obra")
        .select(
          "lancamento_id, obra_id, valor_liquido, valor_baixado, data_vencimento, data_pagamento, status_cod",
        )
        .in("obra_id", obraIds)
        .limit(REPO_LIMITS.financeiro),
    );
    const dedup = new Map<string, any>();
    for (const r of rows) {
      const id = String(r.lancamento_id ?? "");
      if (!id || dedup.has(id)) continue;
      dedup.set(id, { ...r, id });
    }
    return Array.from(dedup.values());
  },
  async vwDashboard() {
    return unwrap<any[]>(
      await supabase
        .from("vw_financeiro_obra")
        .select("obra_id, grupo, valor_rateio, mes_competencia, status_cod")
        .limit(REPO_LIMITS.financeiro),
    );
  },
  async vwCurvaPortfolio() {
    const { data, error } = await supabase
      .from("vw_financeiro_obra")
      .select("natureza_tipo, status_cod, grupo, valor_rateio, data_pagamento, data_vencimento")
      .limit(REPO_LIMITS.financeiro);
    if (error) throw error;
    return data ?? [];
  },
  async vwCurvaByObra(obraId: string) {
    const { data, error } = await supabase
      .from("vw_financeiro_obra")
      .select("natureza_tipo, status_cod, grupo, valor_rateio, data_pagamento, data_vencimento")
      .eq("obra_id", obraId)
      .limit(REPO_LIMITS.financeiro);
    if (error) throw error;
    return data ?? [];
  },

  async vwObraValores(obraId: string) {
    const { data, error } = await (supabase as any)
      .from("vw_obra_valores")
      .select(
        "obra_id, valor_contrato_original, valor_contrato_atual, valor_planejado_baseline, valor_executado, dias_aditivos, receita_baixada, receita_a_receber, despesa_paga, despesa_a_pagar",
      )
      .eq("obra_id", obraId)
      .maybeSingle();
    if (error) throw error;
    return data;
  },
  async listSnapshotsImportados(cols: string): Promise<any[]> {
    const { data, error } = await supabase
      .from("financeiro_snapshots")
      .select(cols)
      .order("importado_em", { ascending: false })
      .limit(REPO_LIMITS.financeiro);
    if (error) throw error;
    return data ?? [];
  },

  async listVwFinanceiroObra(
    cols: string,
    filtros?: { obraId?: string; origem?: string },
  ): Promise<any[]> {
    let q = supabase
      .from("vw_financeiro_obra")
      .select(cols)
      .order("data_emissao", { ascending: false })
      .limit(REPO_LIMITS.financeiro);
    if (filtros?.obraId) q = q.eq("obra_id", filtros.obraId);
    if (filtros?.origem) q = q.eq("origem", filtros.origem);
    const { data, error } = await q;
    if (error) throw error;
    return data ?? [];
  },

  async importarSnapshot(params: {
    p_periodo_ref: string;
    p_nome_titulos: string;
    p_nome_rateios: string;
    p_lancamentos: any;
    p_rateios: any;
  }) {
    const { data, error } = await (supabase as any).rpc("fn_importar_financeiro_snapshot", params);
    if (error) throw error;
    return data;
  },

  async getCentroCodigoObra(obraId: string): Promise<string | null> {
    const { data } = await supabase
      .from("centros_custo_totvs")
      .select("codigo")
      .eq("obra_id", obraId)
      .eq("tipo", "obra")
      .maybeSingle();
    return (data?.codigo as string | null) ?? null;
  },

  async listAcFolhaByCentro(codigo: string): Promise<any[]> {
    const { data, error } = await supabase
      .from("custo_colaborador_competencia")
      .select("centro_custo_id, competencia, custo_total")
      .eq("centro_custo_id", codigo);
    if (error) throw error;
    return data ?? [];
  },

  async listRecebimentosDashboard(): Promise<any[]> {
    const { data, error } = await supabase
      .from("recebimentos")
      .select(
        "id, obra_id, nota_fiscal_id, cronograma_item_id, data_prevista, data_recebimento, valor_previsto, valor_previsto_inicial, valor_recebido, status, congelado, origem",
      );
    if (error) throw error;
    return data ?? [];
  },

  async listNfsDashboard(): Promise<any[]> {
    const { data, error } = await supabase
      .from("notas_fiscais")
      .select(
        "id, obra_id, medicao_id, numero, data_emissao, data_vencimento, valor, valor_liquido, valor_servicos, status, competencia",
      );
    if (error) throw error;
    return data ?? [];
  },

  async listMedicoesDashboard(): Promise<any[]> {
    const { data, error } = await supabase
      .from("medicoes")
      .select("id, obra_id, numero, data_corte, data_aprovacao, status, valor");
    if (error) throw error;
    return data ?? [];
  },

  async listBmsPrevistasDashboard(): Promise<any[]> {
    const { data, error } = await supabase
      .from("bms_previstas")
      .select(
        "id, obra_id, numero, data_inicio_janela, data_corte, valor_previsto_inicial, valor_previsto_dinamico, valor_previsto_dinamico_pre_faturamento, data_emissao_nfs_prevista, data_pagamento_prevista, status, medicao_id, nota_fiscal_id, valor_realizado",
      );
    if (error) throw error;
    return data ?? [];
  },

  async listCronogramaItensDashboard(): Promise<any[]> {
    const { data, error } = await supabase
      .from("cronograma_itens")
      .select(
        "id, obra_id, custo, custo_baseline, percentual_previsto, percentual_realizado, data_inicio, data_fim, data_inicio_baseline, data_fim_baseline, ativo",
      );
    if (error) throw error;
    return data ?? [];
  },
};

export const centrosCustoTotvsRepo = {
  async selectOrdered(select: string, orderCol: string = "codigo"): Promise<any[]> {
    const { data, error } = await supabase
      .from("centros_custo_totvs")
      .select(select)
      .order(orderCol);
    if (error) throw error;
    return data ?? [];
  },

  async listCodigoObraIdComObra(): Promise<{ codigo: string; obra_id: string }[]> {
    const { data, error } = await supabase
      .from("centros_custo_totvs")
      .select("codigo, obra_id")
      .not("obra_id", "is", null);
    if (error) throw error;
    return (data ?? []) as { codigo: string; obra_id: string }[];
  },

  async upsertByOwnerCodigo(payload: any): Promise<void> {
    const { error } = await supabase
      .from("centros_custo_totvs")
      .upsert(payload, { onConflict: "owner_id,codigo" });
    if (error) throw error;
  },

  async removeById(id: string): Promise<void> {
    const { error } = await supabase.from("centros_custo_totvs").delete().eq("id", id);
    if (error) throw error;
  },

  async listCodigosNoSnapshot(): Promise<
    { centro_custo: string; desc_centro_custo: string | null }[]
  > {
    const { data, error } = await supabase
      .from("vw_financeiro_obra")
      .select("centro_custo, desc_centro_custo")
      .not("centro_custo", "is", null);
    if (error) throw error;
    return (data ?? []) as { centro_custo: string; desc_centro_custo: string | null }[];
  },
};

export const faturamentoNfseRepo = {
  async listByNumeros(numeros: string[]): Promise<any[]> {
    const { data, error } = await supabase
      .from("faturamento_nfse")
      .select("id, numero_nfse, codigo_verificacao, origem")
      .in("numero_nfse", numeros);
    if (error) throw error;
    return data ?? [];
  },
  async insert(row: any): Promise<void> {
    const { error } = await supabase.from("faturamento_nfse").insert(row);
    if (error) throw error;
  },
  async updateById(id: string, patch: any): Promise<void> {
    const { error } = await supabase.from("faturamento_nfse").update(patch).eq("id", id);
    if (error) throw error;
  },
  async importarLote(rows: any[]): Promise<{
    novas: number;
    atualizadas: number;
    inalteradas: number;
    vinculadas_obra: number;
    total: number;
  }> {
    const { data, error } = await (supabase as any).rpc("fn_importar_faturamento_lote", {
      p_faturas: rows,
    });
    if (error) throw error;
    return (
      data ?? {
        novas: 0,
        atualizadas: 0,
        inalteradas: 0,
        vinculadas_obra: 0,
        total: rows.length,
      }
    );
  },
};

export const planoContasRepo = {
  async list() {
    return unwrap<any[]>(
      await supabase
        .from("plano_contas")
        .select("cod_natureza,descricao,nivel,cod_pai,grupo,subgrupo,ativo")
        .order("cod_natureza"),
    );
  },
  async setAtivo(codNatureza: string, ativo: boolean): Promise<void> {
    const { error } = await supabase
      .from("plano_contas")
      .update({ ativo })
      .eq("cod_natureza", codNatureza);
    if (error) throw error;
  },
  async updateDescricao(codNatureza: string, descricao: string): Promise<void> {
    const { error } = await supabase
      .from("plano_contas")
      .update({ descricao })
      .eq("cod_natureza", codNatureza);
    if (error) throw error;
  },
  async create(payload: Record<string, unknown>): Promise<void> {
    const { error } = await supabase.from("plano_contas").insert(payload);
    if (error) throw error;
  },
  async remove(codNatureza: string): Promise<void> {
    const { error } = await supabase.from("plano_contas").delete().eq("cod_natureza", codNatureza);
    if (error) throw error;
  },
};

// ARC-003 — queries do módulo Financeiro TOTVS (leitura).
export const financeiroTotvsRepo = {
  async listVwFinanceiroObraPaged(cols: string, obraId?: string, pageSize = 1000): Promise<any[]> {
    const rows: any[] = [];
    for (let from = 0; ; from += pageSize) {
      let q = supabase
        .from("vw_financeiro_obra")
        .select(cols)
        .order("lancamento_id", { ascending: true })
        .order("cod_natureza", { ascending: true, nullsFirst: true })
        .range(from, from + pageSize - 1);
      if (obraId) q = q.eq("obra_id", obraId);
      const { data, error } = await q;
      if (error) throw error;
      rows.push(...(data ?? []));
      if (!data || data.length < pageSize) break;
    }
    return rows;
  },

  async listSnapshotsIdImportadoEm(): Promise<
    { id: string; importado_em: string; data_ref: string | null }[]
  > {
    const { data, error } = await supabase
      .from("financeiro_snapshots")
      .select("id, importado_em, data_ref")
      .order("importado_em", { ascending: false });
    if (error) throw error;
    return (data ?? []) as any;
  },

  async listEvolucaoRollup(
    snapshotIds: string[],
    obraId?: string | null,
    pageSize = 1000,
  ): Promise<any[]> {
    // PostgREST caps single responses at ~1000 rows. O rollup pode ter
    // dezenas de milhares de linhas (snapshots × obra × natureza × status),
    // então precisamos paginar — sem isso os KPIs "Vencido/A vencer/Total"
    // ficam truncados no último snapshot.
    const rows: any[] = [];
    for (let from = 0; ; from += pageSize) {
      let q = supabase
        .from("financeiro_evolucao_rollup")
        .select(
          "snapshot_id, data_snapshot, obra_id, status_cod, status_label, grupo, cod_natureza, desc_natureza, valor_aberto, valor_pago, qtd_titulos",
        )
        .in("snapshot_id", snapshotIds)
        .order("data_snapshot", { ascending: true })
        .order("snapshot_id", { ascending: true })
        .range(from, from + pageSize - 1);
      if (obraId) q = q.eq("obra_id", obraId);
      const { data, error } = await q;
      if (error) throw error;
      rows.push(...(data ?? []));
      if (!data || data.length < pageSize) break;
    }
    return rows;
  },

  async getSnapshotAtivo() {
    const { data, error } = await supabase
      .from("financeiro_snapshots")
      .select("id, importado_em, periodo_ref, total_titulos")
      .order("importado_em", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;

    return data;
  },

  async listObrasComVinculo() {
    const { data, error } = await supabase
      .from("obras")
      .select("id, codigo, nome, centro_custo_totvs, valor_contrato, data_inicio, data_fim")
      .order("codigo");
    if (error) throw error;
    return data ?? [];
  },

  async listBmsPrevistas(obraId: string) {
    const { data, error } = await supabase
      .from("bms_previstas")
      .select(
        "id, numero, data_corte, data_inicio_janela, valor_previsto_dinamico, valor_previsto_inicial, status, nota_fiscal_id",
      )
      .eq("obra_id", obraId)
      .order("numero");
    if (error) throw error;
    return data ?? [];
  },

  async listRecebimentos(obraId: string) {
    const { data, error } = await supabase
      .from("recebimentos")
      .select(
        "id, data_prevista, data_recebimento, valor_previsto, valor_recebido, status, nota_fiscal_id",
      )
      .eq("obra_id", obraId)
      .order("data_prevista");
    if (error) throw error;
    return data ?? [];
  },

  async listNotasFiscais(obraId: string) {
    const { data, error } = await supabase
      .from("notas_fiscais")
      .select("id, numero, competencia, data_emissao, valor, valor_liquido, status")
      .eq("obra_id", obraId)
      .order("data_emissao", { ascending: false });
    if (error) throw error;
    return data ?? [];
  },

  async listPlanoContasLabels(): Promise<{ cod_natureza: string; descricao: string }[]> {
    const { data, error } = await supabase
      .from("plano_contas")
      .select("cod_natureza, descricao")
      .order("cod_natureza");
    if (error) throw error;
    return (data ?? []) as any;
  },

  async listDivergenciasMatriz(limit = 500): Promise<any[]> {
    const { data, error } = await supabase
      .from("financeiro_divergencias_matriz")
      .select("id, ref_lancamento, campo, valor_matriz, valor_relatorio, detectado_em")
      .order("detectado_em", { ascending: false })
      .limit(limit);
    if (error) throw error;
    return data ?? [];
  },

  // ==== Simulação / Previsão de pagamento (Prompt 6) ====

  /**
   * O RLS de `financeiro_previsao_carrinho` compara `usuario_id` com
   * `auth.uid()`. O id do player (API legada) não é o uid do Supabase, então
   * gravar/consultar com ele viola a policy. Resolvemos sempre pelo uid da
   * sessão Supabase.
   */
  async _authUid(): Promise<string> {
    const { data } = await supabase.auth.getUser();
    const uid = data?.user?.id;
    if (!uid) {
      throw new Error(
        "Sessão do banco expirada. Saia e entre novamente para usar a simulação de pagamento.",
      );
    }
    return uid;
  },

  async getOrCreateCarrinhoAberto(
    _usuarioId?: string,
  ): Promise<{ id: string; titulo: string; status: string; criado_em: string }> {
    const uid = await this._authUid();
    const { data: existing, error: e1 } = await (supabase as any)
      .from("financeiro_previsao_carrinho")
      .select("id, titulo, status, criado_em")
      .eq("usuario_id", uid)
      .eq("status", "aberto")
      .order("criado_em", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (e1) throw e1;
    if (existing) return existing;
    const dt = new Date().toLocaleDateString("pt-BR");
    const { data: created, error: e2 } = await (supabase as any)
      .from("financeiro_previsao_carrinho")
      .insert({ usuario_id: uid, titulo: `Simulação ${dt}`, status: "aberto" })
      .select("id, titulo, status, criado_em")
      .single();
    if (e2) throw e2;
    return created;
  },

  /**
   * Itens do carrinho: títulos do TOTVS (`ref_lancamento`) e/ou títulos vindos
   * da aprovação financeira (`solicitacao_id`). Aceita números soltos por
   * compatibilidade com chamadas antigas.
   */
  async adicionarItensAoCarrinho(
    carrinhoId: string,
    entradas: Array<
      number | string | { ref_lancamento?: number | null; solicitacao_id?: string | null }
    >,
  ): Promise<{
    solicitados: number;
    adicionados: number;
    duplicados: number;
    refsDuplicadas: number[];
  }> {
    const refs = new Set<number>();
    const sols = new Set<string>();
    for (const e of entradas) {
      if (e == null) continue;
      if (typeof e === "object") {
        if (e.solicitacao_id) {
          sols.add(String(e.solicitacao_id));
          continue;
        }
        const r = Number(e.ref_lancamento);
        if (e.ref_lancamento != null && Number.isFinite(r) && r > 0) refs.add(r);
        continue;
      }
      const r = Number(e);
      if (Number.isFinite(r) && r > 0) refs.add(r);
    }
    const solicitados = refs.size + sols.size;
    if (!solicitados) return { solicitados: 0, adicionados: 0, duplicados: 0, refsDuplicadas: [] };

    // Descobre os que já existem no carrinho para reportar duplicidade.
    const { data: existentes, error: eSel } = await (supabase as any)
      .from("financeiro_previsao_carrinho_itens")
      .select("ref_lancamento, solicitacao_id")
      .eq("carrinho_id", carrinhoId);
    if (eSel) throw eSel;
    const refsExist = new Set<number>(
      (existentes ?? [])
        .filter((r: any) => r.ref_lancamento != null)
        .map((r: any) => Number(r.ref_lancamento)),
    );
    const solsExist = new Set<string>(
      (existentes ?? [])
        .filter((r: any) => r.solicitacao_id)
        .map((r: any) => String(r.solicitacao_id)),
    );

    const novosRefs = Array.from(refs).filter((r) => !refsExist.has(r));
    const novasSols = Array.from(sols).filter((s) => !solsExist.has(s));
    const duplicados =
      Array.from(refs).filter((r) => refsExist.has(r)).length +
      Array.from(sols).filter((s) => solsExist.has(s)).length;

    const rows = [
      ...novosRefs.map((ref) => ({ carrinho_id: carrinhoId, ref_lancamento: ref })),
      ...novasSols.map((id) => ({ carrinho_id: carrinhoId, solicitacao_id: id })),
    ];
    if (rows.length) {
      const { error } = await (supabase as any)
        .from("financeiro_previsao_carrinho_itens")
        .insert(rows);
      if (error) throw error;
    }
    return {
      solicitados,
      adicionados: rows.length,
      duplicados,
      refsDuplicadas: Array.from(refs).filter((r) => refsExist.has(r)),
    };
  },

  /** Chaves já no carrinho aberto — usado para marcar "No carrinho" nas listas. */
  async listCarrinhoAbertoChaves(
    _usuarioId?: string,
  ): Promise<{ refs: number[]; solicitacoes: string[] }> {
    const uid = await this._authUid();
    const { data: cart, error: e1 } = await (supabase as any)
      .from("financeiro_previsao_carrinho")
      .select("id")
      .eq("usuario_id", uid)

      .eq("status", "aberto")
      .order("criado_em", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (e1) throw e1;
    if (!cart) return { refs: [], solicitacoes: [] };
    const { data, error } = await (supabase as any)
      .from("financeiro_previsao_carrinho_itens")
      .select("ref_lancamento, solicitacao_id")
      .eq("carrinho_id", cart.id);
    if (error) throw error;
    return {
      refs: (data ?? [])
        .filter((r: any) => r.ref_lancamento != null)
        .map((r: any) => Number(r.ref_lancamento)),
      solicitacoes: (data ?? [])
        .filter((r: any) => r.solicitacao_id)
        .map((r: any) => String(r.solicitacao_id)),
    };
  },

  async listCarrinhoAbertoRefs(_usuarioId?: string): Promise<number[]> {
    const { refs } = await this.listCarrinhoAbertoChaves();

    return refs;
  },

  async listCarrinhoItens(
    carrinhoId: string,
  ): Promise<
    Array<{
      id: string;
      ref_lancamento: number | null;
      solicitacao_id: string | null;
      adicionado_em: string;
    }>
  > {
    const { data, error } = await (supabase as any)
      .from("financeiro_previsao_carrinho_itens")
      .select("id, ref_lancamento, solicitacao_id, adicionado_em")
      .eq("carrinho_id", carrinhoId)
      .order("adicionado_em", { ascending: false });
    if (error) throw error;
    return data ?? [];
  },

  async listCarrinhoTitulosAoVivo(refLancamentos: number[]): Promise<any[]> {
    if (!refLancamentos.length) return [];
    const { data, error } = await (supabase as any)
      .from("vw_financeiro_obra")
      .select("*")
      .in("ref_lancamento", refLancamentos);
    if (error) throw error;
    return data ?? [];
  },

  /** Solicitações de aprovação financeira que estão no carrinho, com valor atual. */
  async listCarrinhoSolicitacoesAoVivo(ids: string[]): Promise<any[]> {
    // As solicitações do módulo de aprovação podem vir da API legada (ids
    // numéricos). A coluna `id` no Postgres é UUID — enviar "73" provoca
    // `invalid input syntax for type uuid` e quebra a tela inteira.
    const uuids = ids.filter((id) =>
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(id)),
    );
    if (!uuids.length) return [];
    const { data, error } = await (supabase as any)
      .from("solicitacoes_financeiras")
      .select(
        "id, valor, fornecedor, solicitante, centro_custo_id, status, data_pagamento, prazo_estimado, pagamento_pendente",
      )
      .in("id", uuids);
    if (error) throw error;
    return data ?? [];
  },

  async removerItemCarrinho(itemId: string): Promise<void> {
    const { error } = await (supabase as any)
      .from("financeiro_previsao_carrinho_itens")
      .delete()
      .eq("id", itemId);
    if (error) throw error;
  },

  async fecharCarrinho(
    carrinhoId: string,
    _usuarioId: string | undefined,
    itens: Array<{
      ref_lancamento?: number | null;
      solicitacao_id?: string | null;

      nome?: string | null;
      centro_custo?: string | null;
      centro_nome?: string | null;
      natureza_cod?: string | null;
      natureza_desc?: string | null;
      status_label?: string | null;
      valor_congelado: number;
      previsto?: boolean;
    }>,
  ): Promise<{ novoCarrinhoId: string }> {
    const uid = await this._authUid();
    if (itens.length) {
      const rows = itens.map((it) => ({
        ...it,
        carrinho_id: carrinhoId,
        previsto: it.previsto ?? false,
      }));
      const { error: e1 } = await (supabase as any)
        .from("financeiro_previsao_carrinho_fechado_itens")
        .insert(rows);
      if (e1) throw e1;
    }
    const { error: e2 } = await (supabase as any)
      .from("financeiro_previsao_carrinho")
      .update({ status: "fechado", fechado_em: new Date().toISOString() })
      .eq("id", carrinhoId);
    if (e2) throw e2;
    const dt = new Date().toLocaleDateString("pt-BR");
    const { data: novo, error: e3 } = await (supabase as any)
      .from("financeiro_previsao_carrinho")
      .insert({ usuario_id: uid, titulo: `Simulação ${dt}`, status: "aberto" })

      .select("id")
      .single();
    if (e3) throw e3;
    return { novoCarrinhoId: novo.id };
  },

  async listCarrinhosFechados(
    _usuarioId?: string,
  ): Promise<
    Array<{
      id: string;
      titulo: string;
      fechado_em: string | null;
      criado_em: string;
      total: number;
      qtd: number;
    }>
  > {
    const uid = await this._authUid();
    const { data: carrinhos, error } = await (supabase as any)
      .from("financeiro_previsao_carrinho")
      .select("id, titulo, fechado_em, criado_em")
      .eq("usuario_id", uid)

      .eq("status", "fechado")
      .order("fechado_em", { ascending: false })
      .limit(200);
    if (error) throw error;
    const ids = (carrinhos ?? []).map((c: any) => c.id);
    if (!ids.length) return [];
    const { data: itens, error: e2 } = await (supabase as any)
      .from("financeiro_previsao_carrinho_fechado_itens")
      .select("carrinho_id, valor_congelado")
      .in("carrinho_id", ids);
    if (e2) throw e2;
    const map = new Map<string, { total: number; qtd: number }>();
    for (const it of itens ?? []) {
      const cur = map.get(it.carrinho_id) ?? { total: 0, qtd: 0 };
      cur.total += Number(it.valor_congelado ?? 0);
      cur.qtd += 1;
      map.set(it.carrinho_id, cur);
    }
    return (carrinhos ?? []).map((c: any) => ({
      ...c,
      total: map.get(c.id)?.total ?? 0,
      qtd: map.get(c.id)?.qtd ?? 0,
    }));
  },

  async listCarrinhoFechadoItens(carrinhoId: string): Promise<any[]> {
    const { data, error } = await (supabase as any)
      .from("financeiro_previsao_carrinho_fechado_itens")
      .select("*")
      .eq("carrinho_id", carrinhoId)
      .order("ref_lancamento");
    if (error) throw error;
    return data ?? [];
  },
};
