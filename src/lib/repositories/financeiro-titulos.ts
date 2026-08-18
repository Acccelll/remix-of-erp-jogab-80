/** @module-kind io */
import { supabase } from "@/integrations/supabase/client";
import { withDeadline } from "@/lib/core/http/withDeadline";
import type { TituloManualInput } from "@/lib/financeiro-totvs/types";

export const financeiroTitulosKeys = {
  all: ["financeiro", "titulos-canonicos"] as const,
  list: () => [...financeiroTitulosKeys.all, "list"] as const,
  detail: (tituloId: string) => [...financeiroTitulosKeys.all, "detail", tituloId] as const,
  rateios: (tituloId: string) => [...financeiroTitulosKeys.detail(tituloId), "rateios"] as const,
  baixas: (tituloId: string) => [...financeiroTitulosKeys.detail(tituloId), "baixas"] as const,
  eventos: (tituloId: string) => [...financeiroTitulosKeys.detail(tituloId), "eventos"] as const,
};

export interface TituloCanonicoRow {
  id: string;
  tipo: "pagar" | "receber";
  empresa_id: string | null;
  filial: number | null;
  contraparte_id: string | null;
  cnpj_cpf: string | null;
  nome: string | null;
  nome_fantasia: string | null;
  tipo_documento: string | null;
  numero_documento: string | null;
  serie_documento: string | null;
  parcela_numero: number | null;
  parcela_total: number | null;
  data_emissao: string;
  data_competencia: string | null;
  data_vencimento: string;
  data_previsao_baixa: string | null;
  valor_original: number;
  valor_desconto: number;
  valor_juros: number;
  valor_multa: number;
  valor_acrescimos: number;
  valor_retencoes: number;
  valor_liquido: number;
  centro_custo: string | null;
  obra_id: string | null;
  historico: string | null;
  observacao: string | null;
  origem_tipo: string;
  origem_ref: string | null;
  status: "aberto" | "parcial" | "baixado" | "cancelado";
  criado_em: string;
  criado_por: string | null;
  atualizado_em: string;
  atualizado_por: string | null;
  cancelado_em: string | null;
  cancelado_por: string | null;
}

export interface TituloSaldoRow {
  titulo_id: string;
  valor_liquido: number;
  valor_baixado: number;
  saldo_aberto: number;
  valor_movimentado: number;
  qtd_baixas: number;
  data_primeira_baixa: string | null;
  data_ultima_baixa: string | null;
  status_calculado: "aberto" | "parcial" | "baixado" | "cancelado";
}

export interface TituloCanonicoResumo extends TituloCanonicoRow {
  valor_baixado: number;
  saldo_aberto: number;
  valor_movimentado: number;
  qtd_baixas: number;
  data_primeira_baixa: string | null;
  data_ultima_baixa: string | null;
  status_calculado: "aberto" | "parcial" | "baixado" | "cancelado";
}

export interface RateioTituloRow {
  id: string;
  titulo_id: string;
  cod_natureza: string;
  desc_natureza: string | null;
  centro_custo: string;
  desc_centro_custo: string | null;
  obra_id: string | null;
  obra_codigo: string | null;
  obra_nome: string | null;
  valor: number | null;
  percentual: number | null;
  criado_em: string;
  criado_por: string | null;
}

export interface EventoTituloRow {
  id: string;
  titulo_id: string;
  baixa_id: string | null;
  entidade: string;
  entidade_id: string;
  evento: string;
  ator_id: string | null;
  ator_login: string | null;
  origem: string;
  dados_antes: Record<string, unknown> | null;
  dados_depois: Record<string, unknown> | null;
  metadata: Record<string, unknown>;
  criado_em: string;
}

const TITULO_COLS =
  "id,tipo,empresa_id,filial,contraparte_id,cnpj_cpf,nome,nome_fantasia,tipo_documento,numero_documento,serie_documento,parcela_numero,parcela_total,data_emissao,data_competencia,data_vencimento,data_previsao_baixa,valor_original,valor_desconto,valor_juros,valor_multa,valor_acrescimos,valor_retencoes,valor_liquido,centro_custo,obra_id,historico,observacao,origem_tipo,origem_ref,status,criado_em,criado_por,atualizado_em,atualizado_por,cancelado_em,cancelado_por";

const SALDO_COLS =
  "titulo_id,valor_liquido,valor_baixado,saldo_aberto,valor_movimentado,qtd_baixas,data_primeira_baixa,data_ultima_baixa,status_calculado";

function numeric(value: unknown): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

async function listarTitulosRows(pageSize = 1000): Promise<TituloCanonicoRow[]> {
  const rows: TituloCanonicoRow[] = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await (supabase as any)
      .from("financeiro_titulos")
      .select(TITULO_COLS)
      .order("data_vencimento", { ascending: true })
      .order("criado_em", { ascending: false })
      .range(from, from + pageSize - 1);
    if (error) throw new Error(error.message);
    const page = (data ?? []) as Array<Record<string, unknown>>;
    rows.push(
      ...page.map(
        (row) =>
          ({
            ...row,
            valor_original: numeric(row.valor_original),
            valor_desconto: numeric(row.valor_desconto),
            valor_juros: numeric(row.valor_juros),
            valor_multa: numeric(row.valor_multa),
            valor_acrescimos: numeric(row.valor_acrescimos),
            valor_retencoes: numeric(row.valor_retencoes),
            valor_liquido: numeric(row.valor_liquido),
          }) as TituloCanonicoRow,
      ),
    );
    if (page.length < pageSize) break;
  }
  return rows;
}

async function listarSaldosRows(pageSize = 1000): Promise<TituloSaldoRow[]> {
  const rows: TituloSaldoRow[] = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await (supabase as any)
      .from("vw_financeiro_titulo_saldos")
      .select(SALDO_COLS)
      .range(from, from + pageSize - 1);
    if (error) throw new Error(error.message);
    const page = (data ?? []) as Array<Record<string, unknown>>;
    rows.push(
      ...page.map(
        (row) =>
          ({
            ...row,
            valor_liquido: numeric(row.valor_liquido),
            valor_baixado: numeric(row.valor_baixado),
            saldo_aberto: numeric(row.saldo_aberto),
            valor_movimentado: numeric(row.valor_movimentado),
            qtd_baixas: numeric(row.qtd_baixas),
          }) as TituloSaldoRow,
      ),
    );
    if (page.length < pageSize) break;
  }
  return rows;
}

/**
 * Lista os títulos do núcleo canônico com saldo agregado do ledger de baixas.
 * As duas fontes são lidas em paralelo e unidas em memória, evitando N+1.
 */
export async function listarTitulosCanonicos(): Promise<TituloCanonicoResumo[]> {
  const [titulos, saldos] = await Promise.all([listarTitulosRows(), listarSaldosRows()]);
  const saldoPorTitulo = new Map(saldos.map((saldo) => [saldo.titulo_id, saldo]));

  return titulos.map((titulo) => {
    const saldo = saldoPorTitulo.get(titulo.id);
    return {
      ...titulo,
      valor_baixado: saldo?.valor_baixado ?? 0,
      saldo_aberto: saldo?.saldo_aberto ?? titulo.valor_liquido,
      valor_movimentado: saldo?.valor_movimentado ?? 0,
      qtd_baixas: saldo?.qtd_baixas ?? 0,
      data_primeira_baixa: saldo?.data_primeira_baixa ?? null,
      data_ultima_baixa: saldo?.data_ultima_baixa ?? null,
      status_calculado: saldo?.status_calculado ?? titulo.status,
    };
  });
}

/**
 * Rateios do título enriquecidos em lote com Natureza, Centro de Custo e Obra.
 * Nenhuma consulta é feita por linha.
 */
export async function listarRateiosTitulo(tituloId: string): Promise<RateioTituloRow[]> {
  const { data, error } = await withDeadline(
    (supabase as any)
      .from("financeiro_titulo_rateios")
      .select("id,titulo_id,cod_natureza,centro_custo,obra_id,valor,percentual,criado_em,criado_por")
      .eq("titulo_id", tituloId)
      .order("criado_em", { ascending: true }),
    15_000,
    "financeiro.listarRateiosTitulo",
  );
  if (error) throw new Error(error.message);

  const rows = (data ?? []) as Array<Record<string, unknown>>;
  if (!rows.length) return [];

  const naturezas = [...new Set(rows.map((row) => String(row.cod_natureza ?? "")).filter(Boolean))];
  const centros = [...new Set(rows.map((row) => String(row.centro_custo ?? "")).filter(Boolean))];
  const obras = [...new Set(rows.map((row) => String(row.obra_id ?? "")).filter(Boolean))];

  const [naturezasRes, centrosRes, obrasRes] = await Promise.all([
    naturezas.length
      ? (supabase as any).from("plano_contas").select("cod_natureza,descricao").in("cod_natureza", naturezas)
      : Promise.resolve({ data: [], error: null }),
    centros.length
      ? (supabase as any).from("centros_custo_totvs").select("codigo,descricao").in("codigo", centros)
      : Promise.resolve({ data: [], error: null }),
    obras.length
      ? (supabase as any).from("obras").select("id,codigo,nome").in("id", obras)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (naturezasRes.error) throw new Error(naturezasRes.error.message);
  if (centrosRes.error) throw new Error(centrosRes.error.message);
  if (obrasRes.error) throw new Error(obrasRes.error.message);

  const naturezaMap = new Map(
    (naturezasRes.data ?? []).map((row: any) => [String(row.cod_natureza), row.descricao ?? null]),
  );
  const centroMap = new Map(
    (centrosRes.data ?? []).map((row: any) => [String(row.codigo), row.descricao ?? null]),
  );
  const obraMap = new Map(
    (obrasRes.data ?? []).map((row: any) => [String(row.id), row]),
  );

  return rows.map((row) => {
    const codNatureza = String(row.cod_natureza);
    const centroCusto = String(row.centro_custo);
    const obraId = row.obra_id ? String(row.obra_id) : null;
    const obra = obraId ? obraMap.get(obraId) : null;
    return {
      id: String(row.id),
      titulo_id: String(row.titulo_id),
      cod_natureza: codNatureza,
      desc_natureza: naturezaMap.get(codNatureza) ?? null,
      centro_custo: centroCusto,
      desc_centro_custo: centroMap.get(centroCusto) ?? null,
      obra_id: obraId,
      obra_codigo: obra?.codigo ?? null,
      obra_nome: obra?.nome ?? null,
      valor: row.valor == null ? null : numeric(row.valor),
      percentual: row.percentual == null ? null : numeric(row.percentual),
      criado_em: String(row.criado_em),
      criado_por: row.criado_por ? String(row.criado_por) : null,
    };
  });
}

/** Cria título manual no núcleo canônico com rateio por linha. */
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

/** Histórico cronológico de baixas do título. */
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
  return (data ?? []).map((row: any) => ({
    ...row,
    valor_principal: numeric(row.valor_principal),
    valor_desconto: numeric(row.valor_desconto),
    valor_juros: numeric(row.valor_juros),
    valor_multa: numeric(row.valor_multa),
    valor_acrescimos: numeric(row.valor_acrescimos),
    valor_retencoes: numeric(row.valor_retencoes),
  })) as BaixaTituloRow[];
}

/** Timeline imutável de auditoria do título, mais recente primeiro. */
export async function listarEventosTitulo(tituloId: string): Promise<EventoTituloRow[]> {
  const { data, error } = await withDeadline(
    (supabase as any)
      .from("financeiro_titulo_eventos")
      .select(
        "id,titulo_id,baixa_id,entidade,entidade_id,evento,ator_id,ator_login,origem,dados_antes,dados_depois,metadata,criado_em",
      )
      .eq("titulo_id", tituloId)
      .order("criado_em", { ascending: false }),
    15_000,
    "financeiro.listarEventosTitulo",
  );
  if (error) throw new Error(error.message);
  return (data ?? []) as EventoTituloRow[];
}

/**
 * Read model operacional consolidado. Mantido para consumidores analíticos que
 * precisam enxergar legado + canônico no mesmo conjunto.
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
