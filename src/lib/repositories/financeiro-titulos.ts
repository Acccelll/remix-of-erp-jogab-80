/** @module-kind io */
import { supabase } from "@/integrations/supabase/client";
import { withDeadline } from "@/lib/core/http/withDeadline";
import type { TituloManualInput } from "@/lib/financeiro-totvs/types";

/**
 * Cria título manual no núcleo canônico com rateio por linha
 * (Natureza × Centro de Custo; obra é resolvida no banco pelo CC).
 */
export async function criarTituloManualCanonico(input: TituloManualInput): Promise<string> {
  const { data, error } = await withDeadline(
    (supabase as any).rpc("fn_criar_titulo_manual_v2", {
      p_natureza_tipo: input.natureza_tipo,
      p_cnpj_cpf: input.cnpj_cpf,
      p_nome: input.nome,
      p_data_emissao: input.data_emissao,
      p_data_vencimento: input.data_vencimento,
      p_historico: input.historico,
      p_rateios: input.rateios,
    }),
    15_000,
    "financeiro.criarTituloManualCanonico",
  );

  if (error) throw new Error(error.message);
  return data as string;
}

export interface BaixaTituloInput {
  titulo_id: string;
  valor_principal: number;
  data_baixa: string;
  valor_desconto?: number;
  valor_juros?: number;
  valor_multa?: number;
  valor_acrescimos?: number;
  valor_retencoes?: number;
  observacao?: string | null;
  forma_pagamento?: string | null;
  referencia?: string | null;
  origem_tipo?: string;
  origem_ref?: string | null;
}

export interface BaixaTituloRow {
  id: string;
  titulo_id: string;
  data_baixa: string;
  valor_principal: number;
  valor_desconto: number;
  valor_juros: number;
  valor_multa: number;
  valor_acrescimos: number;
  valor_retencoes: number;
  forma_pagamento: string | null;
  referencia: string | null;
  observacao: string | null;
  origem_tipo: string;
  origem_ref: string | null;
  criado_em: string;
  criado_por: string | null;
}

/** Registra uma baixa parcial ou total no ledger canônico do título. */
export async function baixarTituloCanonico(input: BaixaTituloInput): Promise<string> {
  const { data, error } = await withDeadline(
    (supabase as any).rpc("fn_baixar_titulo", {
      p_titulo_id: input.titulo_id,
      p_valor_principal: input.valor_principal,
      p_data_baixa: input.data_baixa,
      p_valor_desconto: input.valor_desconto ?? 0,
      p_valor_juros: input.valor_juros ?? 0,
      p_valor_multa: input.valor_multa ?? 0,
      p_valor_acrescimos: input.valor_acrescimos ?? 0,
      p_valor_retencoes: input.valor_retencoes ?? 0,
      p_observacao: input.observacao ?? null,
      p_forma_pagamento: input.forma_pagamento ?? null,
      p_referencia: input.referencia ?? null,
      p_origem_tipo: input.origem_tipo ?? "manual",
      p_origem_ref: input.origem_ref ?? null,
    }),
    15_000,
    "financeiro.baixarTituloCanonico",
  );

  if (error) throw new Error(error.message);
  return data as string;
}

/** Histórico cronológico de baixas do título; base para ficha completa da Etapa 5. */
export async function listarBaixasTitulo(tituloId: string): Promise<BaixaTituloRow[]> {
  const { data, error } = await withDeadline(
    (supabase as any)
      .from("financeiro_titulo_baixas")
      .select(
        "id,titulo_id,data_baixa,valor_principal,valor_desconto,valor_juros,valor_multa,valor_acrescimos,valor_retencoes,forma_pagamento,referencia,observacao,origem_tipo,origem_ref,criado_em,criado_por",
      )
      .eq("titulo_id", tituloId)
      .order("data_baixa", { ascending: true })
      .order("criado_em", { ascending: true }),
    15_000,
    "financeiro.listarBaixasTitulo",
  );

  if (error) throw new Error(error.message);
  return (data ?? []) as BaixaTituloRow[];
}

/**
 * Read model operacional do Financeiro. Mantém o legado intacto e aplica
 * saldo/status do ledger somente às linhas do núcleo canônico.
 */
export async function listarFinanceiroOperacionalPaged(
  cols: string,
  obraId?: string,
  pageSize = 1000,
): Promise<any[]> {
  const rows: any[] = [];
  for (let from = 0; ; from += pageSize) {
    let q = (supabase as any)
      .from("vw_financeiro_obra_operacional")
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
}
