/** @module-kind io */
import { supabase } from "@/integrations/supabase/client";
import { withDeadline } from "@/lib/core/http/withDeadline";
import type { RateioManualInput } from "@/lib/financeiro-totvs/types";

export interface EditarTituloCanonicoInput {
  titulo_id: string;
  natureza_tipo: 1 | 2;
  cnpj_cpf: string | null;
  nome: string | null;
  data_emissao: string | null;
  data_vencimento: string;
  historico: string | null;
  rateios: RateioManualInput[];
}

export interface EstornarBaixaInput {
  baixa_id: string;
  data_estorno: string;
  observacao?: string | null;
}

export interface MovimentoTituloRow {
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
  tipo_movimento: "baixa" | "estorno";
  baixa_origem_id: string | null;
  criado_em: string;
  criado_por: string | null;
}

function numeric(value: unknown): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

/** Edita um título manual canônico. O banco bloqueia edição com baixa líquida ativa. */
export async function editarTituloCanonico(input: EditarTituloCanonicoInput): Promise<void> {
  const { error } = await withDeadline(
    (supabase as any).rpc("fn_editar_titulo_manual_v2", {
      p_titulo_id: input.titulo_id,
      p_natureza_tipo: input.natureza_tipo,
      p_cnpj_cpf: input.cnpj_cpf,
      p_nome: input.nome,
      p_data_emissao: input.data_emissao,
      p_data_vencimento: input.data_vencimento,
      p_historico: input.historico,
      p_rateios: input.rateios,
    }),
    15_000,
    "financeiro.editarTituloCanonico",
  );
  if (error) throw new Error(error.message);
}

/** Cancela título manual sem baixa líquida ativa. */
export async function cancelarTituloCanonico(tituloId: string): Promise<void> {
  const { error } = await withDeadline(
    (supabase as any).rpc("fn_cancelar_titulo", { p_titulo_id: tituloId }),
    15_000,
    "financeiro.cancelarTituloCanonico",
  );
  if (error) throw new Error(error.message);
}

/** Reabre título manual previamente cancelado. */
export async function reabrirTituloCanonico(tituloId: string): Promise<void> {
  const { error } = await withDeadline(
    (supabase as any).rpc("fn_reabrir_titulo", { p_titulo_id: tituloId }),
    15_000,
    "financeiro.reabrirTituloCanonico",
  );
  if (error) throw new Error(error.message);
}

/** Registra estorno como novo movimento; a baixa original permanece imutável. */
export async function estornarBaixaCanonica(input: EstornarBaixaInput): Promise<string> {
  const { data, error } = await withDeadline(
    (supabase as any).rpc("fn_estornar_baixa", {
      p_baixa_id: input.baixa_id,
      p_data_estorno: input.data_estorno,
      p_observacao: input.observacao ?? null,
    }),
    15_000,
    "financeiro.estornarBaixaCanonica",
  );
  if (error) throw new Error(error.message);
  return data as string;
}

/** Ledger completo do título, incluindo estornos e vínculo com o movimento original. */
export async function listarMovimentosTitulo(tituloId: string): Promise<MovimentoTituloRow[]> {
  const { data, error } = await withDeadline(
    (supabase as any)
      .from("financeiro_titulo_baixas")
      .select(
        "id,titulo_id,data_baixa,valor_principal,valor_desconto,valor_juros,valor_multa,valor_acrescimos,valor_retencoes,forma_pagamento,referencia,observacao,origem_tipo,origem_ref,tipo_movimento,baixa_origem_id,criado_em,criado_por",
      )
      .eq("titulo_id", tituloId)
      .order("data_baixa", { ascending: true })
      .order("criado_em", { ascending: true }),
    15_000,
    "financeiro.listarMovimentosTitulo",
  );
  if (error) throw new Error(error.message);

  return (data ?? []).map((row: any) => ({
    ...row,
    valor_principal: numeric(row.valor_principal),
    valor_desconto: numeric(row.valor_desconto),
    valor_juros: numeric(row.valor_juros),
    valor_multa: numeric(row.valor_multa),
    valor_acrescimos: numeric(row.valor_acrescimos),
    valor_retencoes: numeric(row.valor_retencoes),
  })) as MovimentoTituloRow[];
}

export function idsBaixasEstornadas(movimentos: MovimentoTituloRow[]): Set<string> {
  return new Set(
    movimentos
      .filter((movimento) => movimento.tipo_movimento === "estorno" && movimento.baixa_origem_id)
      .map((movimento) => movimento.baixa_origem_id as string),
  );
}
