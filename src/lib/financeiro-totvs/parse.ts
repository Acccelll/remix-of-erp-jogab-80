/** @module-kind pure */
// Parsers puros para os relatórios TOTVS. Funções não tocam banco.
// Aceitam arrays de objetos já extraídos via `XLSX.utils.sheet_to_json(sheet, { defval: "" })`.

import { round2 } from "@/lib/core/money";
import {
  LancamentoParsed,
  MatrizRateioParsed,
  NaturezaTipo,
  RateioParsed,
  STATUS_TOTVS_LEGENDA,
} from "./types";

type RawRow = Record<string, unknown>;

/** Normaliza chave: minúsculas, sem acento, sem espaço/traço. */
function normKey(k: string): string {
  return k
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

/**
 * Valida cabeçalho contra whitelist mínima. Lança erro claro quando falta
 * coluna crítica — evita corromper a base com NULLs em massa quando o
 * TOTVS exporta um layout inesperado.
 */
export function validarHeaderLancamentos(rows: RawRow[]): void {
  if (!rows.length) return;
  const keys = new Set(Object.keys(rows[0]).map(normKey));
  const OBRIGATORIAS: { label: string; aliases: string[] }[] = [
    { label: "Ref. Lançamento", aliases: ["Ref. Lançamento", "Ref Lancamento", "REF_LANCAMENTO", "Imagem - Ref. Lançamento"] },
    { label: "Status", aliases: ["Imagem - Status", "Status", "STATUS"] },
    { label: "Valor líquido", aliases: ["Valor líquido", "Valor Liquido", "VALOR_LIQUIDO"] },
    { label: "Data de Vencimento", aliases: ["Data de Vencimento", "DATA_VENCIMENTO"] },
    { label: "Centro de Custo", aliases: ["Centro de Custo", "CENTRO_CUSTO"] },
  ];
  const faltando = OBRIGATORIAS.filter((c) => !c.aliases.some((a) => keys.has(normKey(a))));
  if (faltando.length) {
    throw new Error(
      `Cabeçalho do relatório TOTVS inválido. Colunas obrigatórias ausentes: ${faltando
        .map((f) => f.label)
        .join(", ")}. Verifique o layout de exportação.`,
    );
  }
}

export function validarHeaderMatriz(rows: RawRow[]): void {
  if (!rows.length) return;
  const keys = new Set(Object.keys(rows[0]).map(normKey));
  const OBRIGATORIAS: { label: string; aliases: string[] }[] = [
    { label: "IDLAN", aliases: ["IDLAN", "Id Lan", "ID_LAN"] },
    { label: "COD_NATUREZA", aliases: ["COD_NAT_ORC", "COD_NATUREZA", "Cod Natureza"] },
    { label: "COD_CCUSTO", aliases: ["COD_CCUSTO", "Cod Ccusto", "Centro de Custo"] },
    { label: "VALOR_RATEIO", aliases: ["VR_RATEIO", "VALOR_RATEIO", "Valor Rateio"] },
  ];
  const faltando = OBRIGATORIAS.filter((c) => !c.aliases.some((a) => keys.has(normKey(a))));
  if (faltando.length) {
    throw new Error(
      `Cabeçalho da Matriz inválido. Colunas obrigatórias ausentes: ${faltando
        .map((f) => f.label)
        .join(", ")}. Confirme o SQL de emissão da matriz.`,
    );
  }
}

/** Index map normalizado → valor da linha. */
function indexRow(row: RawRow): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const k of Object.keys(row)) out[normKey(k)] = row[k];
  return out;
}

/** Procura o primeiro alias que existir no row. */
function pick(row: Record<string, unknown>, aliases: string[]): unknown {
  for (const a of aliases) {
    const k = normKey(a);
    if (k in row && row[k] !== "" && row[k] !== null && row[k] !== undefined) return row[k];
  }
  return null;
}

function toStr(v: unknown): string | null {
  if (v === null || v === undefined || v === "") return null;
  return String(v).trim() || null;
}

function toInt(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : Number(String(v).replace(/\D+/g, ""));
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

/** Parse de valor monetário em formato BR (1.234,56) ou número direto. */
export function toMoney(v: unknown): number {
  if (v === null || v === undefined || v === "") return 0;
  if (typeof v === "number") return round2(v);
  const s = String(v).trim();
  if (!s) return 0;
  // Remove R$ e espaços; troca vírgula decimal por ponto se houver
  const cleaned = s
    .replace(/[R$\s]/g, "")
    .replace(/\.(?=\d{3}(?:\D|$))/g, "")
    .replace(",", ".");
  const n = Number(cleaned);
  return Number.isFinite(n) ? round2(n) : 0;
}

/** Converte Date | string → ISO date (YYYY-MM-DD). */
export function toIsoDate(v: unknown): string | null {
  if (v === null || v === undefined || v === "") return null;
  if (v instanceof Date) {
    if (Number.isNaN(v.getTime())) return null;
    return v.toISOString().slice(0, 10);
  }
  const s = String(v).trim();
  if (!s) return null;
  // dd/mm/yyyy
  const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  // yyyy-mm-dd já
  const m2 = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m2) return `${m2[1]}-${m2[2]}-${m2[3]}`;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

function parseNaturezaTipo(v: unknown): NaturezaTipo | null {
  const n = toInt(v);
  return n === 1 || n === 2 ? (n as NaturezaTipo) : null;
}

function statusLabel(cod: number | null): string | null {
  if (cod === null) return null;
  return STATUS_TOTVS_LEGENDA[cod] ?? null;
}

/** Parser do relatório de Lançamentos (aba "Sheet"). */
export function parseLancamentos(rows: RawRow[]): LancamentoParsed[] {
  const out: LancamentoParsed[] = [];
  for (const raw of rows) {
    const r = indexRow(raw);
    const ref = toInt(
      pick(r, ["Ref. Lançamento", "Ref Lancamento", "REF_LANCAMENTO", "Imagem - Ref. Lançamento"]),
    );
    if (ref === null) continue; // linha sem chave: descarta
    const status_cod = toInt(pick(r, ["Imagem - Status", "Status", "STATUS"]));
    out.push({
      ref_lancamento: ref,
      filial: toInt(pick(r, ["Filial", "FILIAL"])),
      natureza_tipo: parseNaturezaTipo(pick(r, ["Imagem - Natureza", "Natureza"])),
      status_cod,
      status_label: statusLabel(status_cod),
      tipo_documento: toStr(pick(r, ["Tipo de Documento", "TIPO_DOCUMENTO"])),
      numero_documento: toStr(
        pick(r, ["Número do Documento", "Numero do Documento", "NUMERO_DOCUMENTO"]),
      ),
      centro_custo: toStr(pick(r, ["Centro de Custo", "CENTRO_CUSTO"])),
      desc_centro_custo: toStr(
        pick(r, ["Descrição Centro de Custo", "Descricao Centro de Custo", "DESC_CENTRO_CUSTO"]),
      ),
      cnpj_cpf: toStr(pick(r, ["CNPJ/CPF", "CNPJ_CPF", "CNPJ"])),
      nome: toStr(pick(r, ["Nome", "NOME"])),
      nome_fantasia: toStr(pick(r, ["Nome Fantasia", "NOME_FANTASIA"])),
      cliente_fornecedor: toStr(pick(r, ["Cliente/Fornecedor", "CLIENTE_FORNECEDOR"])),
      valor_original: toMoney(pick(r, ["Valor Original", "VALOR_ORIGINAL"])),
      valor_desconto: toMoney(pick(r, ["Valor do Desconto", "Valor Desconto", "VALOR_DESCONTO"])),
      valor_liquido: toMoney(pick(r, ["Valor líquido", "Valor Liquido", "VALOR_LIQUIDO"])),
      valor_baixado: toMoney(pick(r, ["Valor Baixado", "VALOR_BAIXADO"])),
      data_emissao: toIsoDate(pick(r, ["Data de Emissão", "Data de Emissao", "DATA_EMISSAO"])),
      data_vencimento: toIsoDate(pick(r, ["Data de Vencimento", "DATA_VENCIMENTO"])),
      data_baixa: toIsoDate(pick(r, ["Data de Baixa", "DATA_BAIXA"])),
      data_pagamento: toIsoDate(pick(r, ["Data de Pagamento", "DATA_PAGAMENTO"])),
      dias_atraso: toInt(pick(r, ["Dias em Atraso", "Dias Atraso", "DIAS_ATRASO"])),
      mes_competencia: toIsoDate(
        pick(r, ["Mês de Competência", "Mes de Competencia", "MES_COMPETENCIA"]),
      ),
      historico: toStr(pick(r, ["Histórico", "Historico", "HISTORICO"])),
    });
  }
  return out;
}

/**
 * Parser do relatório de Rateios.
 *
 * IMPORTANTE: o relatório TOTVS de rateios **não possui coluna de valor
 * por natureza**. Cada linha (ref_lancamento × cod_natureza) repete o
 * `VALOR_LIQUIDO` total do título. Quando um título tem múltiplas
 * naturezas, a soma direta resultaria em duplicação. Por isso o fluxo
 * de importação SEMPRE deve passar pela função `reconciliarRateios`
 * em seguida, que reescala os valores para somar = valor_liquido do
 * título (efeito prático: split igual entre naturezas).
 */
export function parseRateios(rows: RawRow[]): RateioParsed[] {
  const out: RateioParsed[] = [];
  for (const raw of rows) {
    const r = indexRow(raw);
    const ref = toInt(pick(r, ["REF_LANCAMENTO", "Ref. Lançamento", "Ref Lancamento"]));
    if (ref === null) continue;
    out.push({
      ref_lancamento: ref,
      cod_natureza: toStr(pick(r, ["COD_NATUREZA", "Cod Natureza", "Código Natureza"])),
      desc_natureza: toStr(
        pick(r, ["DESC_NATUREZA_ORCAMENTARIA", "DESC_NATUREZA", "Descrição Natureza"]),
      ),
      status_lancamento: toStr(pick(r, ["STATUS_LANCAMENTO", "Status Lançamento"])),
      valor_rateio: toMoney(
        pick(r, ["VALOR_LIQUIDO", "Valor líquido", "Valor Liquido", "VALOR_ORIGINAL"]),
      ),
    });
  }
  return out;
}

/**
 * Reconcilia rateios com o valor_liquido do título correspondente:
 * - escala proporcionalmente para que Σ rateios = valor_liquido;
 * - resíduo de centavos cai no maior rateio (preserva soma exata).
 * Retorna novo array de rateios reconciliado.
 */
export function reconciliarRateios(
  lancamentos: LancamentoParsed[],
  rateios: RateioParsed[],
): RateioParsed[] {
  const valorPorRef = new Map<number, number>();
  for (const l of lancamentos) valorPorRef.set(l.ref_lancamento, l.valor_liquido);

  // agrupa por ref
  const grupos = new Map<number, RateioParsed[]>();
  for (const r of rateios) {
    if (!grupos.has(r.ref_lancamento)) grupos.set(r.ref_lancamento, []);
    grupos.get(r.ref_lancamento)!.push(r);
  }

  const out: RateioParsed[] = [];
  for (const [ref, grupo] of grupos) {
    const alvo = valorPorRef.get(ref);
    const somaAtual = round2(grupo.reduce((a, g) => a + g.valor_rateio, 0));

    if (alvo === undefined || alvo === 0 || somaAtual === 0 || Math.abs(somaAtual - alvo) < 0.005) {
      out.push(...grupo);
      continue;
    }

    // Escala proporcional
    const fator = alvo / somaAtual;
    const escalados = grupo.map((g) => ({ ...g, valor_rateio: round2(g.valor_rateio * fator) }));
    const somaEscalada = round2(escalados.reduce((a, g) => a + g.valor_rateio, 0));
    const residuo = round2(alvo - somaEscalada);
    if (Math.abs(residuo) >= 0.01) {
      // joga resíduo no maior rateio (preserva centavos)
      let idxMax = 0;
      for (let i = 1; i < escalados.length; i++) {
        if (Math.abs(escalados[i].valor_rateio) > Math.abs(escalados[idxMax].valor_rateio))
          idxMax = i;
      }
      escalados[idxMax].valor_rateio = round2(escalados[idxMax].valor_rateio + residuo);
    }
    out.push(...escalados);
  }
  return out;
}

/** Deriva grupo (1º segmento) e subgrupo (2 primeiros segmentos) do código de natureza. */
function deriveGrupoSubgrupo(cod: string | null): {
  grupo: string | null;
  subgrupo: string | null;
} {
  if (!cod) return { grupo: null, subgrupo: null };
  const parts = cod.split(".");
  const grupo = parts[0] ?? null;
  const subgrupo = parts.length >= 2 ? `${parts[0]}.${parts[1]}` : grupo;
  return { grupo, subgrupo };
}

/**
 * Parser da matriz EMISSAO. Uma linha por fatia de rateio (vários
 * registros por IDLAN). Retorna linhas prontas para
 * `financeiro_matriz_rateios`. Descarta linhas sem IDLAN.
 */
export function parseMatriz(rows: RawRow[]): MatrizRateioParsed[] {
  const out: MatrizRateioParsed[] = [];
  for (const raw of rows) {
    const r = indexRow(raw);
    const ref = toInt(pick(r, ["IDLAN", "Id Lan", "ID_LAN"]));
    if (ref === null) continue;
    const cod_natureza = toStr(pick(r, ["COD_NAT_ORC", "COD_NATUREZA", "Cod Natureza"]));
    const { grupo, subgrupo } = deriveGrupoSubgrupo(cod_natureza);
    const pagrec = toStr(pick(r, ["PAGREC", "Pag/Rec", "Pag_Rec"]));
    let natureza_tipo_matriz: NaturezaTipo | null = null;
    if (pagrec) {
      const up = pagrec.trim().toUpperCase();
      if (up === "CP") natureza_tipo_matriz = 2;
      else if (up === "CR") natureza_tipo_matriz = 1;
    }
    out.push({
      ref_lancamento: ref,
      cod_natureza,
      desc_natureza: toStr(
        pick(r, ["DESC_NAT_ORCAMENTARIA", "DESC_NATUREZA", "Descrição Natureza"]),
      ),
      grupo,
      subgrupo,
      cod_ccusto: toStr(pick(r, ["COD_CCUSTO", "Cod Ccusto", "Centro de Custo"])),
      desc_ccusto: toStr(pick(r, ["DESC_CCUSTO", "Desc Ccusto", "Descrição Centro de Custo"])),
      valor_rateio: toMoney(pick(r, ["VR_RATEIO", "VALOR_RATEIO", "Valor Rateio"])),
      valor_original: toMoney(
        pick(r, ["VR_ORIGINAL", "VALOR_ORIGINAL", "VALOR_BRUTO", "Valor Original", "Valor Bruto"]),
      ),
      situacao_presumida: toStr(pick(r, ["SITUACAO", "Situação", "Situacao"])),
      data_emissao: toIsoDate(pick(r, ["DATA_EMISSAO", "Data Emissão", "Data Emissao"])),
      data_vencimento: toIsoDate(pick(r, ["DATA_VENCIMENTO", "Data Vencimento"])),
      natureza_tipo_matriz,
      filial: toInt(pick(r, ["CODFILIAL", "FILIAL", "Cod Filial"])),
      tipo_documento: toStr(pick(r, ["TIPO_DOCUMENTO", "Tipo Documento"])),
      numero_documento: toStr(pick(r, ["DOCUMENTO", "NUMERO_DOCUMENTO", "Número Documento"])),
      cnpj_cpf: toStr(pick(r, ["CGCCFO", "CNPJ_CPF", "CNPJ/CPF"])),
      nome: toStr(pick(r, ["NOME", "Razão Social"])),
      nome_fantasia: toStr(pick(r, ["NOMEFANTASIA", "NOME_FANTASIA", "Nome Fantasia"])),
      historico: toStr(pick(r, ["HISTORICO", "Histórico"])),
      valor_liquido: toMoney(pick(r, ["VALOR_LIQUIDO", "Valor Líquido"])),
      valor_baixado: toMoney(pick(r, ["VALOR_BAIXADO", "Valor Baixado"])),
      data_baixa: toIsoDate(pick(r, ["DATA_BAIXA", "Data Baixa"])),
      status_cod_matriz: toInt(pick(r, ["STATUSLAN", "STATUS", "Status Lançamento"])),
    });
  }
  return out;
}
