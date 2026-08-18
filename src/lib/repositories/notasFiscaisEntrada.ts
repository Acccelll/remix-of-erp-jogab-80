// @ts-nocheck
// Camada de acesso a `notas_fiscais_entrada` / `nota_fiscal_entrada_itens`
// (Fase 4 da evolução de Suprimentos). Tabelas novas, ainda não refletidas
// em src/integrations/supabase/types.ts — tipadas manualmente aqui.
import { supabase } from "@/integrations/supabase/client";
import { withDeadline } from "@/lib/core/http/withDeadline";
import { nfsStorage } from "@/lib/repositories/storage";

const RPC_DEADLINE_MS = 30_000;

export type StatusValidacaoNfe = "pendente" | "validada" | "divergente" | "rejeitada";

export type NotaFiscalEntradaRow = {
  id: string;
  ordem_compra_id: string;
  recebimento_id: string | null;
  fornecedor_id: string;
  chave_acesso: string | null;
  numero: string | null;
  serie: string | null;
  cnpj_emitente: string | null;
  valor_total: number;
  data_emissao: string | null;
  xml_path: string | null;
  status_validacao: StatusValidacaoNfe;
  lancamento_id: string | null;
  created_at: string;
};

export type NotaFiscalEntradaItemRow = {
  id: string;
  nota_fiscal_entrada_id: string;
  ordem_compra_item_id: string | null;
  descricao: string;
  quantidade: number;
  valor_unitario: number;
  valor_total: number;
};

function unwrap<T>(res: { data: T | null; error: unknown }): T {
  if (res.error) throw res.error as Error;
  return (res.data as T) ?? ([] as unknown as T);
}

export const notasFiscaisEntradaRepo = {
  async listPorOc(ordemCompraId: string): Promise<NotaFiscalEntradaRow[]> {
    return unwrap(
      await supabase
        .from("notas_fiscais_entrada")
        .select(
          "id, ordem_compra_id, recebimento_id, fornecedor_id, chave_acesso, numero, serie, cnpj_emitente, valor_total, data_emissao, xml_path, status_validacao, lancamento_id, created_at",
        )
        .eq("ordem_compra_id", ordemCompraId)
        .order("created_at", { ascending: false }),
    );
  },
  async listRecentes(limit = 200): Promise<NotaFiscalEntradaRow[]> {
    return unwrap(
      await supabase
        .from("notas_fiscais_entrada")
        .select(
          "id, ordem_compra_id, recebimento_id, fornecedor_id, chave_acesso, numero, serie, cnpj_emitente, valor_total, data_emissao, xml_path, status_validacao, lancamento_id, created_at",
        )
        .order("created_at", { ascending: false })
        .limit(limit),
    );
  },
  async listItens(notaFiscalEntradaId: string): Promise<NotaFiscalEntradaItemRow[]> {
    return unwrap(
      await supabase
        .from("nota_fiscal_entrada_itens")
        .select("id, nota_fiscal_entrada_id, ordem_compra_item_id, descricao, quantidade, valor_unitario, valor_total")
        .eq("nota_fiscal_entrada_id", notaFiscalEntradaId),
    );
  },
  async uploadXml(ordemCompraId: string, file: File): Promise<string> {
    const path = `entrada/${ordemCompraId}/${Date.now()}-${file.name}`;
    const { error } = await nfsStorage.upload(path, file, { contentType: "application/xml" });
    if (error) throw error;
    return path;
  },
  async criar(payload: {
    ordemCompraId: string;
    recebimentoId?: string | null;
    fornecedorId: string;
    chaveAcesso?: string | null;
    numero?: string | null;
    serie?: string | null;
    cnpjEmitente?: string | null;
    valorTotal: number;
    dataEmissao?: string | null;
    xmlPath?: string | null;
    itens: { ordemCompraItemId?: string | null; descricao: string; quantidade: number; valorUnitario: number }[];
  }): Promise<string> {
    const { data: nota, error: errNota } = await supabase
      .from("notas_fiscais_entrada")
      .insert({
        ordem_compra_id: payload.ordemCompraId,
        recebimento_id: payload.recebimentoId || null,
        fornecedor_id: payload.fornecedorId,
        chave_acesso: payload.chaveAcesso || null,
        numero: payload.numero || null,
        serie: payload.serie || null,
        cnpj_emitente: payload.cnpjEmitente || null,
        valor_total: payload.valorTotal,
        data_emissao: payload.dataEmissao || null,
        xml_path: payload.xmlPath || null,
        status_validacao: "pendente",
      })
      .select("id")
      .single();
    if (errNota) throw errNota;

    const itensPayload = payload.itens.map((i) => ({
      nota_fiscal_entrada_id: nota.id,
      ordem_compra_item_id: i.ordemCompraItemId || null,
      descricao: i.descricao,
      quantidade: i.quantidade,
      valor_unitario: i.valorUnitario,
    }));
    if (itensPayload.length > 0) {
      const { error: errItens } = await supabase.from("nota_fiscal_entrada_itens").insert(itensPayload);
      if (errItens) throw errItens;
    }

    return nota.id as string;
  },
  async gerarTitulo(notaFiscalEntradaId: string): Promise<string> {
    const { data, error } = await withDeadline(
      supabase.rpc("fn_lancamento_nota_fiscal_entrada", {
        p_nota_fiscal_entrada_id: notaFiscalEntradaId,
      }),
      RPC_DEADLINE_MS,
      "notasFiscaisEntrada.gerarTitulo",
    );
    if (error) throw error;
    return data as string;
  },
};
