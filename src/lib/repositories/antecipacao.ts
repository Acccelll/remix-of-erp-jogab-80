// @ts-nocheck
import { supabase } from "@/integrations/supabase/client";

function unwrap<T>(res: { data: T | null; error: unknown }): T {
  if (res.error) throw res.error as Error;
  return res.data as T;
}

const OP_COLS =
  "id, numero_interno, operador_id, tipo, data_operacao, data_vencimento_repasse, valor_face_total, valor_liquido_recebido, desagio_total, iof, tarifas, com_coobrigacao, status, solicitacao_id, criado_por, aprovado_por, aprovado_em, observacoes, created_at, updated_at";

const TIT_COLS =
  "id, operacao_id, faturamento_nfse_id, nota_fiscal_id, obra_id, valor_face, valor_antecipado, desagio_rateado, iof_rateado, data_vencimento_original, dias_exposicao, created_at, updated_at";

export const antecipacaoRepo = {
  async listOperadores() {
    return (
      unwrap<any[]>(
        await supabase
          .from("operadores_credito")
          .select("id, nome, apelido, cnpj, tipo, ativo, taxa_referencia_am, contato, observacoes")
          .eq("ativo", true)
          .order("nome"),
      ) ?? []
    );
  },

  async listOperacoes(filtros?: { status?: string; operadorId?: string }) {
    let q = supabase
      .from("antecipacao_operacoes")
      .select(`${OP_COLS}, operador:operadores_credito(id,nome,apelido,tipo,taxa_referencia_am)`)
      .order("data_operacao", { ascending: false });
    if (filtros?.status) q = q.eq("status", filtros.status);
    if (filtros?.operadorId) q = q.eq("operador_id", filtros.operadorId);
    return unwrap<any[]>(await q) ?? [];
  },

  async getOperacao(id: string) {
    return unwrap<any>(
      await supabase
        .from("antecipacao_operacoes")
        .select(`${OP_COLS}, operador:operadores_credito(id,nome,apelido,tipo,taxa_referencia_am)`)
        .eq("id", id)
        .maybeSingle(),
    );
  },

  async listTitulos(operacaoId: string) {
    return (
      unwrap<any[]>(
        await supabase
          .from("antecipacao_titulos")
          .select(
            `${TIT_COLS}, faturamento:faturamento_nfse(id, numero_nfse, data_emissao, data_vencimento, valor_liquido, tomador_razao), obra:obras(id, nome)`,
          )
          .eq("operacao_id", operacaoId)
          .order("data_vencimento_original"),
      ) ?? []
    );
  },

  async listLiquidacoes(operacaoId: string) {
    return (
      unwrap<any[]>(
        await supabase
          .from("antecipacao_liquidacoes")
          .select("id, operacao_id, data, tipo, valor, observacoes")
          .eq("operacao_id", operacaoId)
          .order("data"),
      ) ?? []
    );
  },

  async listElegiveis() {
    const nfs =
      unwrap<any[]>(
        await supabase
          .from("faturamento_nfse")
          .select(
            "id, numero_nfse, data_emissao, data_vencimento, vencimento_origem, valor_liquido, valor_servicos, tomador_razao, obra_id, status, obra:obras(id, nome)",
          )
          .not("data_vencimento", "is", null)
          .order("data_vencimento"),
      ) ?? [];

    const vinculados =
      unwrap<any[]>(
        await supabase
          .from("antecipacao_titulos")
          .select("faturamento_nfse_id"),
      ) ?? [];
    const idsVinculados = new Set(vinculados.map((row) => row.faturamento_nfse_id));
    return nfs.filter((nf) => nf.status !== "cancelada" && !idsVinculados.has(nf.id));
  },

  async criarOperacao(payload: any) {
    return unwrap<any>(
      await supabase.from("antecipacao_operacoes").insert(payload).select(OP_COLS).single(),
    );
  },

  async atualizarOperacao(id: string, patch: any) {
    return unwrap<any>(
      await supabase
        .from("antecipacao_operacoes")
        .update(patch)
        .eq("id", id)
        .select(OP_COLS)
        .single(),
    );
  },

  async excluirOperacao(id: string) {
    const res = await supabase.from("antecipacao_operacoes").delete().eq("id", id);
    if (res.error) throw res.error;
  },

  async adicionarTitulos(rows: any[]) {
    if (!rows.length) return [];
    return unwrap<any[]>(
      await supabase.from("antecipacao_titulos").insert(rows).select(TIT_COLS),
    );
  },

  async removerTitulo(id: string) {
    const res = await supabase.from("antecipacao_titulos").delete().eq("id", id);
    if (res.error) throw res.error;
  },

  async atualizarTitulo(id: string, patch: any) {
    return unwrap<any>(
      await supabase
        .from("antecipacao_titulos")
        .update(patch)
        .eq("id", id)
        .select(TIT_COLS)
        .single(),
    );
  },

  async registrarLiquidacao(payload: any) {
    return unwrap<any>(
      await supabase.from("antecipacao_liquidacoes").insert(payload).select().single(),
    );
  },
};
