// @ts-nocheck
// Camada de acesso a `contas_bancarias_empresa` / `cnab_remessas` /
// `cnab_remessa_itens` / `cnab_retornos` / `cnab_retorno_ocorrencias`
// (Fase 5 da evolução de Financeiro). Tabelas novas, ainda não refletidas em
// src/integrations/supabase/types.ts — tipadas manualmente aqui.
import { supabase } from "@/integrations/supabase/client";
import { withDeadline } from "@/lib/core/http/withDeadline";
import { cnabStorage } from "@/lib/repositories/storage";

const RPC_DEADLINE_MS = 30_000;

export type ContaBancariaEmpresa = {
  id: string;
  banco_codigo: string;
  banco_nome: string;
  agencia: string;
  agencia_dv: string | null;
  conta: string;
  conta_dv: string | null;
  convenio: string;
  carteira: string | null;
  cnpj: string;
  razao_social: string;
  proximo_numero_arquivo: number;
  ativo: boolean;
};

export type CnabRemessaRow = {
  id: string;
  conta_bancaria_id: string;
  carrinho_id: string;
  layout: string;
  numero_arquivo: number;
  arquivo_path: string | null;
  status: "rascunho" | "gerada" | "processada" | "erro";
  gerada_em: string;
  gerada_por: string | null;
};

export type CnabRemessaItemRow = {
  id: string;
  remessa_id: string;
  origem_tipo: "ref_lancamento" | "solicitacao";
  origem_id: string;
  favorecido_nome: string;
  favorecido_documento: string;
  favorecido_banco: string;
  favorecido_agencia: string;
  favorecido_agencia_dv: string | null;
  favorecido_conta: string;
  favorecido_conta_dv: string | null;
  valor: number;
  nosso_numero: string;
};

export type CnabItemEntrada = {
  origem_tipo: "ref_lancamento" | "solicitacao";
  origem_id: string;
  favorecido_nome: string;
  favorecido_documento: string;
  favorecido_banco: string;
  favorecido_agencia: string;
  favorecido_agencia_dv?: string | null;
  favorecido_conta: string;
  favorecido_conta_dv?: string | null;
  valor: number;
};

export type CnabRetornoRow = {
  id: string;
  arquivo_path: string;
  banco_codigo: string;
  status: "processado" | "com_erros";
  importado_em: string;
};

export type CnabOcorrenciaConciliada = {
  ocorrencia_id: string;
  matched: boolean;
  origem_tipo: "ref_lancamento" | "solicitacao" | null;
  origem_id: string | null;
};

function unwrap<T>(res: { data: T | null; error: unknown }): T {
  if (res.error) throw res.error as Error;
  return (res.data as T) ?? ([] as unknown as T);
}

export const cnabRepo = {
  async listContasBancarias(): Promise<ContaBancariaEmpresa[]> {
    return unwrap(
      await supabase
        .from("contas_bancarias_empresa")
        .select(
          "id, banco_codigo, banco_nome, agencia, agencia_dv, conta, conta_dv, convenio, carteira, cnpj, razao_social, proximo_numero_arquivo, ativo",
        )
        .order("banco_nome"),
    );
  },
  async criarContaBancaria(payload: Omit<ContaBancariaEmpresa, "id" | "proximo_numero_arquivo">): Promise<void> {
    const { error } = await supabase.from("contas_bancarias_empresa").insert(payload);
    if (error) throw error;
  },
  async atualizarContaBancaria(id: string, patch: Partial<ContaBancariaEmpresa>): Promise<void> {
    const { error } = await supabase.from("contas_bancarias_empresa").update(patch).eq("id", id);
    if (error) throw error;
  },

  async listRemessas(limit = 100): Promise<CnabRemessaRow[]> {
    return unwrap(
      await supabase
        .from("cnab_remessas")
        .select(
          "id, conta_bancaria_id, carrinho_id, layout, numero_arquivo, arquivo_path, status, gerada_em, gerada_por",
        )
        .order("gerada_em", { ascending: false })
        .limit(limit),
    );
  },
  async listRemessaItens(remessaId: string): Promise<CnabRemessaItemRow[]> {
    return unwrap(
      await supabase
        .from("cnab_remessa_itens")
        .select(
          "id, remessa_id, origem_tipo, origem_id, favorecido_nome, favorecido_documento, favorecido_banco, favorecido_agencia, favorecido_agencia_dv, favorecido_conta, favorecido_conta_dv, valor, nosso_numero",
        )
        .eq("remessa_id", remessaId),
    );
  },

  /** Cria a remessa (cabeçalho + itens) atomicamente e reserva o nosso número de cada item. */
  async criarRemessa(
    carrinhoId: string,
    contaBancariaId: string,
    itens: CnabItemEntrada[],
  ): Promise<{ remessaId: string; numeroArquivo: number; itens: CnabRemessaItemRow[] }> {
    const { data, error } = await withDeadline(
      supabase.rpc("fn_cnab_criar_remessa_atomico", {
        p_carrinho_id: carrinhoId,
        p_conta_bancaria_id: contaBancariaId,
        p_itens: itens,
      }),
      RPC_DEADLINE_MS,
      "cnab.criarRemessa",
    );
    if (error) throw error;
    const result = data as { remessa_id: string; numero_arquivo: number; itens: any[] };
    return {
      remessaId: result.remessa_id,
      numeroArquivo: result.numero_arquivo,
      itens: result.itens.map((it) => ({ ...it, remessa_id: result.remessa_id })),
    };
  },

  async uploadArquivoRemessa(remessaId: string, conteudo: string): Promise<string> {
    const path = `remessa/${remessaId}/${Date.now()}.rem`;
    const blob = new Blob([conteudo], { type: "text/plain" });
    const { error } = await cnabStorage.upload(path, blob, { contentType: "text/plain" });
    if (error) throw error;
    return path;
  },

  async marcarRemessaGerada(remessaId: string, arquivoPath: string): Promise<void> {
    const { error } = await withDeadline(
      supabase.rpc("fn_cnab_marcar_remessa_gerada", {
        p_remessa_id: remessaId,
        p_arquivo_path: arquivoPath,
      }),
      RPC_DEADLINE_MS,
      "cnab.marcarRemessaGerada",
    );
    if (error) throw error;
  },

  async baixarArquivoRemessa(path: string): Promise<Blob> {
    const { data, error } = await cnabStorage.download(path);
    if (error) throw error;
    return data as Blob;
  },

  async listRetornos(limit = 100): Promise<CnabRetornoRow[]> {
    return unwrap(
      await supabase
        .from("cnab_retornos")
        .select("id, arquivo_path, banco_codigo, status, importado_em")
        .order("importado_em", { ascending: false })
        .limit(limit),
    );
  },

  async uploadArquivoRetorno(file: File): Promise<string> {
    const path = `retorno/${Date.now()}-${file.name}`;
    const { error } = await cnabStorage.upload(path, file, { contentType: "text/plain" });
    if (error) throw error;
    return path;
  },

  async criarRetorno(arquivoPath: string, bancoCodigo: string): Promise<string> {
    const { data, error } = await supabase
      .from("cnab_retornos")
      .insert({ arquivo_path: arquivoPath, banco_codigo: bancoCodigo })
      .select("id")
      .single();
    if (error) throw error;
    return data.id as string;
  },

  async marcarRetornoStatus(retornoId: string, status: "processado" | "com_erros"): Promise<void> {
    const { error } = await supabase.from("cnab_retornos").update({ status }).eq("id", retornoId);
    if (error) throw error;
  },

  /** Concilia uma ocorrência do retorno com o item de remessa (por nosso número). */
  async conciliarOcorrencia(
    retornoId: string,
    ocorrencia: {
      nossoNumero: string;
      codigoOcorrencia: string;
      descricaoOcorrencia?: string | null;
      dataOcorrencia: string;
      valorPago: number;
    },
  ): Promise<CnabOcorrenciaConciliada> {
    const { data, error } = await withDeadline(
      supabase.rpc("fn_cnab_conciliar_ocorrencia", {
        p_retorno_id: retornoId,
        p_nosso_numero: ocorrencia.nossoNumero,
        p_codigo_ocorrencia: ocorrencia.codigoOcorrencia,
        p_descricao_ocorrencia: ocorrencia.descricaoOcorrencia ?? null,
        p_data_ocorrencia: ocorrencia.dataOcorrencia,
        p_valor_pago: ocorrencia.valorPago,
      }),
      RPC_DEADLINE_MS,
      "cnab.conciliarOcorrencia",
    );
    if (error) throw error;
    const row = Array.isArray(data) ? data[0] : data;
    return {
      ocorrencia_id: row.ocorrencia_id,
      matched: row.matched,
      origem_tipo: row.origem_tipo,
      origem_id: row.origem_id,
    };
  },

  async listOcorrenciasRetorno(retornoId: string): Promise<
    Array<{
      id: string;
      nosso_numero: string;
      codigo_ocorrencia: string | null;
      valor_pago: number;
      data_ocorrencia: string | null;
      conciliado: boolean;
    }>
  > {
    return unwrap(
      await supabase
        .from("cnab_retorno_ocorrencias")
        .select("id, nosso_numero, codigo_ocorrencia, valor_pago, data_ocorrencia, conciliado")
        .eq("retorno_id", retornoId),
    );
  },
};
