// @ts-nocheck
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { REPO_LIMITS } from "./_limits";
import { withDeadline } from "@/lib/core/http/withDeadline";

/** SEC-006 slice-03: teto p/ RPCs atômicos (multi-DML). 30s é bem acima do p99 esperado. */
const RPC_DEADLINE_MS = 30_000;

export type OcRow = Database["public"]["Tables"]["ordens_compra"]["Row"];
export type RecebimentoRow = Database["public"]["Tables"]["recebimentos"]["Row"];

function unwrap<T>(res: { data: T | null; error: unknown }): T {
  if (res.error) throw res.error as Error;
  return (res.data as T) ?? ([] as unknown as T);
}

/** Suprimentos: OCs, recebimentos, estoque (Fase 1 #6). */
export const suprimentosRepo = {
  async listOcs(
    cols: string = "id, numero, obra_id, fornecedor_id, status, valor_total, data_emissao",
  ) {
    return unwrap<any[]>(
      await supabase
        .from("ordens_compra")
        .select(cols)
        .order("data_emissao", { ascending: false })
        .limit(REPO_LIMITS.ordens_compra),
    );
  },
  async listOrdensCompraDetalhadas() {
    return unwrap<any[]>(
      await supabase
        .from("ordens_compra")
        .select(
          "id,obra_id,fornecedor_id,numero,status,status_aprovacao,valor_total,emitida_em,observacao,created_at",
        )
        .order("created_at", { ascending: false })
        .limit(REPO_LIMITS.ordens_compra),
    );
  },
  async createOcReturningId(payload: Record<string, unknown>): Promise<string> {
    const { data, error } = await supabase.from("ordens_compra").insert(payload).select("id").single();
    if (error) throw error;
    return (data as { id: string }).id;
  },
  async updateOcValorTotal(id: string, valorTotal: number): Promise<void> {
    const { error } = await supabase.from("ordens_compra").update({ valor_total: valorTotal }).eq("id", id);
    if (error) throw error;
  },
  async setOcStatusAprovacao(id: string, statusAprovacao: string): Promise<void> {
    const { error } = await supabase
      .from("ordens_compra")
      .update({ status_aprovacao: statusAprovacao })
      .eq("id", id);
    if (error) throw error;
  },
  async setOcStatus(id: string, status: string): Promise<void> {
    const { error } = await supabase.from("ordens_compra").update({ status }).eq("id", id);
    if (error) throw error;
  },

  async listRecebimentoMateriais() {
    return unwrap<any[]>(
      await supabase
        .from("recebimento_materiais")
        .select("id,ordem_compra_id,nota_fiscal,data_recebimento,observacao,created_at")
        .order("created_at", { ascending: false })
        .limit(REPO_LIMITS.ordens_compra),
    );
  },
  async listRecebimentoItens() {
    return unwrap<any[]>(
      await supabase
        .from("recebimento_itens")
        .select("id,recebimento_id,ordem_compra_item_id,quantidade_recebida")
        .limit(REPO_LIMITS.ordens_compra),
    );
  },
  async listOcsRecebiveis() {
    return unwrap<any[]>(
      await supabase
        .from("ordens_compra")
        .select("id,obra_id,fornecedor_id,numero,status,valor_total")
        .in("status", ["emitida", "recebida_parcial", "recebida"])
        .limit(REPO_LIMITS.ordens_compra),
    );
  },
  async listOcItens() {
    return unwrap<any[]>(
      await supabase
        .from("ordem_compra_itens")
        .select("id,ordem_compra_id,insumo_id,descricao,quantidade,preco_unitario")
        .limit(REPO_LIMITS.ordens_compra),
    );
  },

  async listRecebimentos(cols: string = "id, oc_id, data_recebimento, status, nota_fiscal") {
    return unwrap<any[]>(
      await supabase
        .from("recebimentos")
        .select(cols)
        .order("data_recebimento", { ascending: false })
        .limit(REPO_LIMITS.ordens_compra),
    );
  },

  async ocById(id: string) {
    return unwrap<any>(
      await supabase
        .from("ordens_compra")
        .select(
          "id, numero, obra_id, fornecedor_id, status, status_aprovacao, valor_total, observacao, aprovacoes, aprovado_em, aprovado_por, emitida_em, owner_id, created_at, updated_at",
        )
        .eq("id", id)
        .single(),
    );
  },

  // --- cotacoes ---
  async listCotacoes(cols = "id,requisicao_id,status") {
    return unwrap<any[]>(await supabase.from("cotacoes").select(cols));
  },
  async createCotacao(payload: { id?: string; requisicao_id: string }): Promise<void> {
    const { error } = await supabase.from("cotacoes").insert(payload);
    if (error) throw error;
  },
  async fecharCotacao(id: string): Promise<void> {
    const { error } = await supabase.from("cotacoes").update({ status: "fechada" }).eq("id", id);
    if (error) throw error;
  },

  /**
   * PRO-009 · slice-01 — Gera OC (rascunho) a partir de uma cotação fechada
   * com proposta escolhida. Retorna o id da OC criada.
   */
  async gerarOcDeCotacao(cotacaoId: string): Promise<string> {
    // cotação
    const cot = unwrap<any>(
      await supabase
        .from("cotacoes")
        .select("id, requisicao_id, status")
        .eq("id", cotacaoId)
        .single(),
    );
    if (!cot) throw new Error("Cotação não encontrada.");
    if (cot.status !== "fechada") throw new Error("Cotação precisa estar fechada.");

    // requisição
    const req = unwrap<any>(
      await supabase
        .from("requisicoes")
        .select("id, obra_id, orcamento_item_id, insumo_id, quantidade, observacao, status")
        .eq("id", cot.requisicao_id)
        .single(),
    );
    if (!req) throw new Error("Requisição da cotação não encontrada.");

    // proposta escolhida
    const escolhida = unwrap<any>(
      await supabase
        .from("cotacao_propostas")
        .select("id, fornecedor_id, preco_unitario")
        .eq("cotacao_id", cotacaoId)
        .eq("escolhida", true)
        .maybeSingle(),
    );
    if (!escolhida) throw new Error("Nenhuma proposta escolhida nesta cotação.");

    // descrição do item
    let descricao: string = req.observacao ?? "Item";
    if (req.orcamento_item_id) {
      const orc = unwrap<any>(
        await supabase
          .from("orcamento_itens")
          .select("descricao")
          .eq("id", req.orcamento_item_id)
          .maybeSingle(),
      );
      if (orc?.descricao) descricao = orc.descricao;
    }

    // cria OC (rascunho / pendente aprovação)
    const ocId = await this.createOcReturningId({
      obra_id: req.obra_id,
      fornecedor_id: escolhida.fornecedor_id,
      status: "rascunho",
      status_aprovacao: "pendente",
      valor_total: 0,
    });

    // item da OC
    const ins = await this.createOcItem({
      ordem_compra_id: ocId,
      requisicao_id: req.id,
      insumo_id: req.insumo_id ?? null,
      descricao,
      quantidade: req.quantidade,
      preco_unitario: escolhida.preco_unitario,
    });
    if ((ins as any)?.error) throw (ins as any).error;

    // valor total
    const total = Math.round((req.quantidade || 0) * escolhida.preco_unitario * 100) / 100;
    await this.updateOcValorTotal(ocId, total);

    // requisição -> atendida
    await supabase.from("requisicoes").update({ status: "atendida" }).eq("id", req.id);

    return ocId;
  },

  /**
   * PRO-009 · slice-02 — Cancela OC em rascunho e reverte requisições
   * vinculadas (status `atendida` → `cotando`), para reabrir cotação.
   * Não afeta OCs já emitidas.
   */
  async cancelarOcRascunho(ocId: string): Promise<{ revertidas: number }> {
    const oc = unwrap<any>(
      await supabase
        .from("ordens_compra")
        .select("id, status, emitida_em")
        .eq("id", ocId)
        .single(),
    );
    if (!oc) throw new Error("OC não encontrada.");
    if (oc.status !== "rascunho")
      throw new Error("Somente OC em rascunho pode ser revertida.");
    if (oc.emitida_em) throw new Error("OC já emitida — cancelamento indisponível.");

    const itens = unwrap<any[]>(
      await supabase
        .from("ordem_compra_itens")
        .select("requisicao_id")
        .eq("ordem_compra_id", ocId),
    );
    const reqIds = Array.from(
      new Set((itens ?? []).map((i: any) => i.requisicao_id).filter(Boolean)),
    );
    let revertidas = 0;
    for (const rid of reqIds) {
      const { error, data } = await supabase
        .from("requisicoes")
        .update({ status: "cotando" })
        .eq("id", rid)
        .eq("status", "atendida")
        .select("id");
      if (!error && Array.isArray(data) && data.length > 0) revertidas += 1;
    }
    await this.setOcStatus(ocId, "cancelada");
    return { revertidas };
  },

  // --- cotacao_propostas ---
  async createProposta(payload: Record<string, unknown>): Promise<void> {
    const { error } = await supabase.from("cotacao_propostas").insert(payload);
    if (error) throw error;
  },
  async setPropostaEscolhida(cotacaoId: string, propostaId: string): Promise<void> {
    const r1 = await supabase
      .from("cotacao_propostas")
      .update({ escolhida: false })
      .eq("cotacao_id", cotacaoId);
    if (r1.error) throw r1.error;
    const r2 = await supabase
      .from("cotacao_propostas")
      .update({ escolhida: true })
      .eq("id", propostaId);
    if (r2.error) throw r2.error;
  },
  async deleteProposta(id: string): Promise<void> {
    const { error } = await supabase.from("cotacao_propostas").delete().eq("id", id);
    if (error) throw error;
  },
  async listPropostas(cols = "id,cotacao_id,fornecedor_id,preco_unitario,escolhida") {
    return unwrap<any[]>(await supabase.from("cotacao_propostas").select(cols));
  },


  // --- ordem_compra_itens ---
  async listOrdemCompraItensDetalhados() {
    return unwrap<any[]>(
      await supabase
        .from("ordem_compra_itens")
        .select("id,ordem_compra_id,requisicao_id,insumo_id,descricao,quantidade,preco_unitario,valor_total"),
    );
  },
  async createOcItem(payload: Record<string, unknown>) {
    return await supabase.from("ordem_compra_itens").insert(payload);
  },
  async deleteOcItem(id: string): Promise<void> {
    const { error } = await supabase.from("ordem_compra_itens").delete().eq("id", id);
    if (error) throw error;
  },

  // --- orcamento_itens ---
  async listOrcamentoItens(cols = "id,descricao,unidade") {
    return unwrap<any[]>(await supabase.from("orcamento_itens").select(cols));
  },
  async createOrcamentoItem(payload: Record<string, unknown>): Promise<void> {
    const { error } = await supabase.from("orcamento_itens").insert(payload);
    if (error) throw error;
  },
  async deleteOrcamentoItem(id: string): Promise<void> {
    const { error } = await supabase.from("orcamento_itens").delete().eq("id", id);
    if (error) throw error;
  },

  // --- composicoes / composicao_itens ---
  async listComposicoesAtivas() {
    return unwrap<any[]>(
      await supabase.from("composicoes").select("id,descricao,unidade,ativo").eq("ativo", true),
    );
  },
  async listComposicoesTodas(cols = "id,descricao,unidade,ativo") {
    return unwrap<any[]>(
      await supabase.from("composicoes").select(cols).order("descricao", { ascending: true }),
    );
  },
  async createComposicaoReturningId(head: Record<string, unknown>): Promise<string> {
    const { data, error } = await supabase.from("composicoes").insert(head).select("id").single();
    if (error) throw error;
    return (data as { id: string }).id;
  },
  async deleteComposicaoItensByComposicao(compId: string): Promise<void> {
    const { error } = await supabase
      .from("composicao_itens")
      .delete()
      .eq("composicao_id", compId);
    if (error) throw error;
  },
  async updateComposicao(id: string, patch: Record<string, unknown>): Promise<void> {
    const { error } = await supabase.from("composicoes").update(patch).eq("id", id);
    if (error) throw error;
  },
  async toggleComposicaoAtiva(id: string, ativo: boolean): Promise<void> {
    const { error } = await supabase.from("composicoes").update({ ativo }).eq("id", id);
    if (error) throw error;
  },
  async listComposicaoItens(cols = "composicao_id,insumo_id,coeficiente") {
    return unwrap<any[]>(await supabase.from("composicao_itens").select(cols));
  },
  async insertComposicaoItens(rows: Record<string, unknown>[]) {
    return await supabase.from("composicao_itens").insert(rows);
  },

  // --- estoque_saldos ---
  async listEstoqueSaldos(cols = "id,local,insumo_id,saldo,minimo") {
    return unwrap<any[]>(await supabase.from("estoque_saldos").select(cols));
  },
  async transferirEstoque(payload: {
    insumo: string;
    origem: string;
    destino: string;
    quantidade: number;
    observacao?: string;
  }): Promise<void> {
    const { error } = await withDeadline<any>(
      supabase.rpc("fn_estoque_transferir", {
        p_insumo: payload.insumo,
        p_origem: payload.origem,
        p_destino: payload.destino,
        p_quantidade: payload.quantidade,
        p_observacao: payload.observacao || undefined,
      }) as unknown as Promise<any>,
      RPC_DEADLINE_MS,
      "suprimentos.transferirEstoque",
    );
    if (error) throw error;
  },

  // --- RPCs de OC / recebimento / orçamento ---
  async aprovarOc(id: string): Promise<{ aprovada?: boolean }> {
    const { data, error } = await withDeadline<any>(
      supabase.rpc("fn_oc_aprovar", { p_oc_id: id }) as unknown as Promise<any>,
      RPC_DEADLINE_MS,
      "suprimentos.aprovarOc",
    );
    if (error) throw error;
    return (data ?? {}) as { aprovada?: boolean };
  },
  async emitirOc(id: string): Promise<void> {
    const { error } = await withDeadline<any>(
      supabase.rpc("emitir_oc_atomico" as any, { p_oc_id: id }) as unknown as Promise<any>,
      RPC_DEADLINE_MS,
      "suprimentos.emitirOc",
    );
    if (error) throw error;
  },
  async aprovarOrcamentoObra(obraId: string): Promise<void> {
    const { error } = await withDeadline<any>(
      supabase.rpc("aprovar_orcamento_obra", { p_obra: obraId }) as unknown as Promise<any>,
      RPC_DEADLINE_MS,
      "suprimentos.aprovarOrcamentoObra",
    );
    if (error) throw error;
  },
  async registrarRecebimento(payload: {
    ocId: string;
    notaFiscal: string | null;
    data: string;
    observacao: string | null;
    itens: { ordem_compra_item_id: string; quantidade: number }[];
    ownerId: string;
  }): Promise<void> {
    const { error } = await withDeadline<any>(
      supabase.rpc("registrar_recebimento_atomico" as any, {
        p_oc_id: payload.ocId,
        p_nota_fiscal: payload.notaFiscal,
        p_data: payload.data,
        p_observacao: payload.observacao,
        p_itens: payload.itens,
        p_owner_id: payload.ownerId,
      }) as unknown as Promise<any>,
      RPC_DEADLINE_MS,
      "suprimentos.registrarRecebimento",
    );
    if (error) throw error;
  },



  // --- alcadas_aprovacao ---
  async listAlcadas() {
    return unwrap<any[]>(
      await supabase
        .from("alcadas_aprovacao")
        .select("id, valor_min, valor_max, papel_aprovador, ordem, created_at, updated_at")
        .order("valor_min", { ascending: true })
        .order("ordem", { ascending: true }),
    );
  },
  async createAlcada(payload: Record<string, unknown>): Promise<void> {
    const { error } = await supabase.from("alcadas_aprovacao").insert(payload);
    if (error) throw error;
  },
  async deleteAlcada(id: string): Promise<void> {
    const { error } = await supabase.from("alcadas_aprovacao").delete().eq("id", id);
    if (error) throw error;
  },

  // --- card_grupos_negociacao ---
  async listGruposNegociacao() {
    return unwrap<any[]>(
      await supabase.from("card_grupos_negociacao").select("id,rotulo").order("rotulo"),
    );
  },
  async createGrupoNegociacao(rotulo: string): Promise<void> {
    const { error } = await supabase.from("card_grupos_negociacao").insert({ rotulo });
    if (error) throw error;
  },
  async renameGrupoNegociacao(id: string, rotulo: string): Promise<void> {
    const { error } = await supabase
      .from("card_grupos_negociacao")
      .update({ rotulo })
      .eq("id", id);
    if (error) throw error;
  },
  async deleteGrupoNegociacao(id: string): Promise<void> {
    const { error } = await supabase.from("card_grupos_negociacao").delete().eq("id", id);
    if (error) throw error;
  },
  async listCardsGrupoNegociacao(): Promise<{ grupo_negociacao_id: string | null }[]> {
    return unwrap<any[]>(
      await supabase.from("cards").select("grupo_negociacao_id").eq("arquivado", false),
    );
  },

  // --- cotações / propostas / requisições (visualização detalhada) ---
  async listCotacoesDetalhadas() {
    return unwrap<any[]>(
      await supabase
        .from("cotacoes")
        .select("id, requisicao_id, status, created_at, updated_at")
        .order("created_at", { ascending: false }),
    );
  },
  async listPropostasDetalhadas() {
    return unwrap<any[]>(
      await supabase
        .from("cotacao_propostas")
        .select(
          "id, cotacao_id, fornecedor_id, preco_unitario, prazo_entrega_dias, condicao_pagamento, observacao, escolhida, created_at",
        ),
    );
  },
  async listRequisicoesDetalhadas() {
    return unwrap<any[]>(
      await supabase
        .from("requisicoes")
        .select(
          "id, obra_id, orcamento_item_id, insumo_id, quantidade, status, observacao, card_recurso_id, created_at, updated_at",
        ),
    );
  },
  async listOrcamentoItensDetalhado(
    cols: string = "id,obra_id,descricao,unidade,quantidade",
  ) {
    return unwrap<any[]>(await supabase.from("orcamento_itens").select(cols).order("ordem"));
  },
  async listOrcamentoItensPorObra(
    obraId: string,
    cols: string = "id, obra_id, cronograma_item_id, composicao_id, descricao, unidade, quantidade, preco_unitario, valor_total, ordem, created_at, updated_at",
  ) {
    return unwrap<any[]>(
      await supabase.from("orcamento_itens").select(cols).eq("obra_id", obraId).order("ordem"),
    );
  },
  async listDemandaMaoObraPorOrcamento(): Promise<
    Array<{ obra_id: string; funcao: string; quantidade: number }>
  > {
    const [orcamento, composicaoItens, insumos] = await Promise.all([
      supabase
        .from("orcamento_itens")
        .select("id, obra_id, composicao_id, quantidade")
        .not("composicao_id", "is", null),
      supabase.from("composicao_itens").select("composicao_id, insumo_id, coeficiente"),
      supabase.from("insumos").select("id, descricao, tipo").eq("tipo", "mao_obra").eq("ativo", true),
    ]);
    if (orcamento.error) throw orcamento.error;
    if (composicaoItens.error) throw composicaoItens.error;
    if (insumos.error) throw insumos.error;

    const maoObraByInsumo = new Map(
      (insumos.data ?? []).map((i: any) => [i.id, String(i.descricao || "Mão de obra")]),
    );
    const itensByComposicao = new Map<string, Array<{ insumo_id: string; coeficiente: number }>>();
    for (const item of composicaoItens.data ?? []) {
      if (!maoObraByInsumo.has((item as any).insumo_id)) continue;
      const compId = String((item as any).composicao_id);
      const list = itensByComposicao.get(compId) ?? [];
      list.push({
        insumo_id: String((item as any).insumo_id),
        coeficiente: Number((item as any).coeficiente ?? 0),
      });
      itensByComposicao.set(compId, list);
    }

    const agregado = new Map<string, { obra_id: string; funcao: string; quantidade: number }>();
    for (const linha of orcamento.data ?? []) {
      const compId = (linha as any).composicao_id ? String((linha as any).composicao_id) : "";
      const itens = itensByComposicao.get(compId) ?? [];
      const qtdBase = Number((linha as any).quantidade ?? 0);
      if (!itens.length || !Number.isFinite(qtdBase) || qtdBase <= 0) continue;
      for (const item of itens) {
        const funcao = maoObraByInsumo.get(item.insumo_id) ?? "Mão de obra";
        const quantidade = qtdBase * item.coeficiente;
        if (!Number.isFinite(quantidade) || quantidade <= 0) continue;
        const key = `${(linha as any).obra_id}::${funcao}`;
        const cur = agregado.get(key) ?? { obra_id: String((linha as any).obra_id), funcao, quantidade: 0 };
        cur.quantidade += quantidade;
        agregado.set(key, cur);
      }
    }
    return Array.from(agregado.values());
  },
  async listCronogramaItensParaOrcamento(obraId: string) {
    return unwrap<any[]>(
      await supabase
        .from("cronograma_itens")
        .select("id,obra_id,descricao,ordem,custo,custo_baseline")
        .eq("obra_id", obraId)
        .eq("ativo", true)
        .order("ordem"),
    );
  },
  async listMovimentacoesRecentes(limit = 500) {
    return unwrap<any[]>(
      await supabase
        .from("estoque_movimentacoes")
        .select("id,local,insumo_id,tipo,quantidade,origem,observacao,created_at")
        .order("created_at", { ascending: false })
        .limit(limit),
    );
  },
};
