/** @module-kind pure */
// Parser de planilhas BMS (Boletim de Medição de Serviço) — Jogab e derivados.
//
// Padrão canônico esperado (identificado por RÓTULOS, não por posição fixa):
//
//   L1: título "BOLETIM DE MEDIÇÃO DE SERVIÇO - BMS"
//   L2: cliente/unidade (texto livre)
//   L3: Contratada: | Serviço/Obra: | Gerenciamento Aliada:
//   L4: Nome do Projeto: | Folha nº
//   L5: Contrato: | Boletim de Medição Nº: | Data:
//   L6: Valor Total Contrato(R$): | Período: | Cond. Pagto:
//   L7-L8: cabeçalho de colunas em duas linhas (mescladas)
//     Ítem | Descrição | Quant. | U.M. | Preço Unitário | VALOR TOTAL
//     | Acumulado até mês anterior (Quant./Valor)
//     | Executado no mês (Quant./Valor)
//     | Acumulado até a data (Quant./Valor)
//     | Saldo Atual (Quant./Valor)
//     | (opcional) Real(%)
//
// Corpo termina em "SUB TOTAL" e "Total Desta Medição".
//
// O parser tolera:
//  - colunas extras à direita (ex.: Real(%));
//  - ausência de acentos em rótulos;
//  - abas cujo "número" não é "BMS NN" (ex.: "ADIANTAMENTO");
//  - deslocamento horizontal de blocos (colunas detectadas dinamicamente).

import type { BmsLayoutPerfil } from "./layoutPerfis";

export type BmsItem = {
  codigo: string;
  descricao: string;
  quantidade: number;
  unidade: string;
  preco_unitario: number;
  valor_total: number;
  qtd_anterior: number;
  valor_anterior: number;
  qtd_mes: number;
  valor_mes: number;
  qtd_acumulado: number;
  valor_acumulado: number;
  saldo_qtd: number;
  saldo_valor: number;
  percentual_atual: number; // valor_acumulado / valor_total  (0-100)
  percentual_anterior: number; // valor_anterior / valor_total (0-100)
};

export type BmsDiagnostico = {
  headerRow: number;
  colunas: Record<string, number>;
  rotulosCabecalho: string[];
  rotulosSubcabecalho: string[];
};

export type BmsSheet = {
  sheetName: string;
  numero: string; // "BMS 01" | "ADIANTAMENTO"
  ordem: number; // ADIANTAMENTO=0, BMS NN=NN, outros=999+
  data?: string; // YYYY-MM-DD
  data_inicio?: string;
  data_fim?: string;
  periodo_raw?: string;
  valor_contrato?: number;
  total_medicao: number;
  itens: BmsItem[];
  // metadados de cabeçalho
  contratada?: string;
  servico_obra?: string;
  nome_projeto?: string;
  cliente_unidade?: string;
  contrato_numero?: string;
  cond_pagamento?: string;
  folha_numero?: string;
  /** PRO-018 · slice-01 — mapeamento reconhecido pelo parser. */
  diagnostico?: BmsDiagnostico;
  /** PRO-018 · slice-05 — perfil salvo usado como fallback de mapeamento. */
  perfil_layout_id?: string;
  perfil_layout_nome?: string;
};

export type BmsSheetIgnorada = {
  sheetName: string;
  motivo: string;
  /** PRO-018 · slice-01 — amostra das primeiras linhas para depuração. */
  amostraLinhas?: string[];
};

export type BmsWorkbook = {
  arquivoNome: string;
  sheets: BmsSheet[];
  ignoradas: BmsSheetIgnorada[];
};

// ---------- helpers ----------

function normalize(s: unknown): string {
  return String(s ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function num(v: any): number {
  if (v == null || v === "") return 0;
  if (typeof v === "number") return isFinite(v) ? v : 0;
  const s = String(v)
    .replace(/\s/g, "")
    .replace(/\./g, "")
    .replace(",", ".")
    .replace(/[^\d.\-]/g, "");
  const n = Number(s);
  return isFinite(n) ? n : 0;
}

function isoDate(v: any, XLSX: any): string | undefined {
  if (!v) return undefined;
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === "number") {
    const d = XLSX.SSF.parse_date_code(v);
    if (!d) return undefined;
    return `${d.y}-${String(d.m).padStart(2, "0")}-${String(d.d).padStart(2, "0")}`;
  }
  const s = String(v).trim();
  const br = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (br) {
    const y = br[3].length === 2 ? `20${br[3]}` : br[3];
    return `${y}-${br[2].padStart(2, "0")}-${br[1].padStart(2, "0")}`;
  }
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return iso[0];
  return undefined;
}

function parsePeriodo(s: string, XLSX: any): { ini?: string; fim?: string } {
  if (!s) return {};
  const m = s.match(/(\d{1,2}\/\d{1,2}\/\d{2,4})\s*(?:a|à|-)\s*(\d{1,2}\/\d{1,2}\/\d{2,4})/i);
  if (m) return { ini: isoDate(m[1], XLSX), fim: isoDate(m[2], XLSX) };
  return {};
}

/** Busca em `row` a primeira célula cujo texto normalizado contém qualquer needle. */
function findLabel(row: any[], needles: string[]): number {
  for (let i = 0; i < row.length; i++) {
    const c = normalize(row[i]);
    if (!c) continue;
    if (needles.some((n) => c.includes(n))) return i;
  }
  return -1;
}

/** Primeira célula à direita de `col` com valor não vazio (até `maxOffset` colunas). */
function valueRightOf(row: any[], col: number, maxOffset = 6): any {
  for (let i = col + 1; i <= col + maxOffset && i < row.length; i++) {
    if (row[i] !== "" && row[i] != null) return row[i];
  }
  return undefined;
}

function deriveOrdem(numero: string): number {
  const n = normalize(numero);
  if (n.includes("adiantamento")) return 0;
  const m = n.match(/(\d+)/);
  return m ? Number(m[1]) : 999;
}

// ---------- detecção de colunas ----------

type ColMap = {
  item: number;
  desc: number;
  qtd: number;
  um: number;
  preco: number;
  total: number;
  qa: number;
  va: number; // acumulado anterior
  qm: number;
  vm: number; // executado no mês
  qac: number;
  vac: number; // acumulado até a data
  sq: number;
  sv: number; // saldo
};

/**
 * Detecta colunas casando os rótulos das linhas 7 (grupo) e 8 (Quant./Valor).
 * Percorre a linha 7 procurando os grupos e usa a linha 8 para achar Quant/Valor
 * dentro do span de cada grupo.
 */
function detectColunas(rows: any[][], headerRowGroup: number, headerRowSub: number): ColMap | null {
  const rowG = rows[headerRowGroup] ?? [];
  const rowS = rows[headerRowSub] ?? [];
  const maxCols = Math.max(rowG.length, rowS.length);

  const item = findLabel(rowG, ["item", "itens", "ítem"]);
  const desc = findLabel(rowG, ["descricao", "descrição"]);
  const qtd = findLabel(rowG, ["quant.", "quantidade", "quant"]);
  const um = findLabel(rowG, ["u.m.", " um", "unidade"]);
  const preco = findLabel(rowG, ["preco unitario", "preço unitário", "preco unit", "preço unit"]);
  const total = findLabel(rowG, ["valor total"]);

  const findGroup = (needles: string[]): number => findLabel(rowG, needles);

  const grpAnt = findGroup([
    "acumulado ate mes anterior",
    "acumulado até mês anterior",
    "acumulado mes anterior",
  ]);
  const grpMes = findGroup(["executado no mes", "executado no mês"]);
  const grpAcum = findGroup(["acumulado ate a data", "acumulado até a data"]);
  const grpSaldo = findGroup(["saldo atual", "saldo"]);

  // Dentro do "span" de cada grupo, achar as colunas com "quant" e "valor" na linha 8.
  const findQV = (start: number, endExclusive: number): { q: number; v: number } => {
    let q = -1,
      v = -1;
    for (let i = start; i < endExclusive && i < maxCols; i++) {
      const s = normalize(rowS[i]);
      if (q === -1 && s.startsWith("quant")) q = i;
      else if (v === -1 && s.startsWith("valor")) v = i;
    }
    // Fallback: primeiras duas colunas não vazias no span.
    if (q === -1 || v === -1) {
      const cols: number[] = [];
      for (let i = start; i < endExclusive && i < maxCols; i++) {
        if (rowS[i] != null && rowS[i] !== "") cols.push(i);
      }
      if (q === -1) q = cols[0] ?? start;
      if (v === -1) v = cols[1] ?? start + 1;
    }
    return { q, v };
  };

  const grupos = [grpAnt, grpMes, grpAcum, grpSaldo].filter((g) => g >= 0).sort((a, b) => a - b);
  const spanEnd = (g: number): number => {
    const next = grupos.find((x) => x > g);
    return next ?? maxCols;
  };

  if ([item, desc, qtd, um, preco, total, grpAnt, grpMes, grpAcum, grpSaldo].some((x) => x < 0)) {
    return null;
  }

  const ant = findQV(grpAnt, spanEnd(grpAnt));
  const mes = findQV(grpMes, spanEnd(grpMes));
  const acum = findQV(grpAcum, spanEnd(grpAcum));
  const sal = findQV(grpSaldo, spanEnd(grpSaldo));

  return {
    item,
    desc,
    qtd,
    um,
    preco,
    total,
    qa: ant.q,
    va: ant.v,
    qm: mes.q,
    vm: mes.v,
    qac: acum.q,
    vac: acum.v,
    sq: sal.q,
    sv: sal.v,
  };
}

// ---------- parsing ----------

type ParseResult = { sheet: BmsSheet } | { motivo: string; amostraLinhas?: string[] };

type ParseSheetOptions = {
  perfilLayout?: BmsLayoutPerfil;
};

/** Amostra até `limite` primeiras linhas normalizadas — apoio ao diagnóstico. */
function amostraDeLinhas(rows: any[][], limite = 12): string[] {
  const out: string[] = [];
  for (let r = 0; r < Math.min(limite, rows.length); r++) {
    const cells = (rows[r] ?? [])
      .map((v) => (v == null || v === "" ? "" : String(v).trim()))
      .join(" | ");
    out.push(`L${r + 1}: ${cells}`);
  }
  return out;
}

function headerRowDoPerfil(perfil?: BmsLayoutPerfil): number {
  if (!perfil) return -1;
  return Math.max(0, Math.trunc(perfil.headerRow) - 1);
}

function parseSheet(
  name: string,
  rows: any[][],
  XLSX: any,
  options: ParseSheetOptions = {},
): ParseResult {
  const perfilLayout = options.perfilLayout;
  // metadados de cabeçalho (primeiras 12 linhas)
  let numero = name;
  let dataIso: string | undefined;
  let periodoRaw: string | undefined;
  let valorContrato: number | undefined;
  let contratada: string | undefined;
  let servicoObra: string | undefined;
  let nomeProjeto: string | undefined;
  let clienteUnidade: string | undefined;
  let contratoNumero: string | undefined;
  let condPagamento: string | undefined;
  let folhaNumero: string | undefined;

  let headerGroupRow = -1;

  const headerScan = Math.min(14, rows.length);
  for (let r = 0; r < headerScan; r++) {
    const row = rows[r] ?? [];

    // L2: cliente/unidade — primeira linha após o título com única célula texto
    if (r === 1 && !clienteUnidade) {
      const first = row.find((v) => v != null && String(v).trim() !== "");
      if (first) clienteUnidade = String(first).trim();
    }

    const setFromLabel = (needles: string[], setter: (v: any) => void) => {
      const c = findLabel(row, needles);
      if (c >= 0) {
        const v = valueRightOf(row, c);
        if (v != null && v !== "") setter(v);
      }
    };

    setFromLabel(["contratada"], (v) => (contratada = String(v).trim()));
    setFromLabel(["servico/obra", "serviço/obra"], (v) => (servicoObra = String(v).trim()));
    setFromLabel(["nome do projeto"], (v) => (nomeProjeto = String(v).trim()));
    setFromLabel(
      ["boletim de medicao n", "boletim de medição n"],
      (v) => (numero = String(v).trim()),
    );
    setFromLabel(["contrato:"], (v) => (contratoNumero = String(v).trim()));
    setFromLabel(["data:"], (v) => {
      const d = isoDate(v, XLSX);
      if (d) dataIso = d;
    });
    setFromLabel(["periodo:", "período:"], (v) => (periodoRaw = String(v).trim()));
    setFromLabel(
      ["cond. pagto", "cond pagto", "condicao de pagamento"],
      (v) => (condPagamento = String(v).trim()),
    );
    setFromLabel(["folha n"], (v) => (folhaNumero = String(v).trim()));
    setFromLabel(["valor total contrato"], (v) => (valorContrato = num(v)));

    // Linha do header agrupador tem "item" E "descrição"
    const cItem = findLabel(row, ["ítem", "item"]);
    const cDesc = findLabel(row, ["descricao", "descrição"]);
    if (cItem >= 0 && cDesc >= 0) headerGroupRow = r;
  }

  const headerGroupRowEfetivo = perfilLayout ? headerRowDoPerfil(perfilLayout) : headerGroupRow;

  if (headerGroupRowEfetivo < 0)
    return { motivo: "cabeçalho de colunas não reconhecido", amostraLinhas: amostraDeLinhas(rows) };

  const cols = perfilLayout
    ? ({ ...perfilLayout.colunas } as ColMap)
    : detectColunas(rows, headerGroupRowEfetivo, headerGroupRowEfetivo + 1);
  if (!cols)
    return {
      motivo: "colunas do corpo não puderam ser mapeadas",
      amostraLinhas: amostraDeLinhas(rows),
    };

  const bodyStart = headerGroupRowEfetivo + 2;
  const itens: BmsItem[] = [];
  let totalMedicao = 0;

  for (let r = bodyStart; r < rows.length; r++) {
    const row = rows[r] ?? [];
    if (!row || row.length === 0) continue;

    const first = String(row[cols.item] ?? "").trim();
    const desc = String(row[cols.desc] ?? "").trim();
    const firstLower = normalize(first);

    if (firstLower === "sub total" || firstLower === "subtotal") continue;

    const cTot = findLabel(row, ["total desta medicao", "total desta medição"]);
    if (cTot >= 0) {
      const v = valueRightOf(row, cTot, 8);
      totalMedicao = num(v);
      continue;
    }

    if (firstLower.startsWith("observa") || firstLower.startsWith("historico")) break;
    // linha de assinatura / contratada repetida
    if (!desc && !first) continue;
    if (!desc) continue;

    const valor_total = num(row[cols.total]);
    const valor_acumulado = num(row[cols.vac]);
    const valor_anterior = num(row[cols.va]);
    const pctAtual = valor_total !== 0 ? valor_acumulado / valor_total : 0;
    const pctAnt = valor_total !== 0 ? valor_anterior / valor_total : 0;

    itens.push({
      codigo: first,
      descricao: desc,
      quantidade: num(row[cols.qtd]),
      unidade: String(row[cols.um] ?? "").trim(),
      preco_unitario: num(row[cols.preco]),
      valor_total,
      qtd_anterior: num(row[cols.qa]),
      valor_anterior,
      qtd_mes: num(row[cols.qm]),
      valor_mes: num(row[cols.vm]),
      qtd_acumulado: num(row[cols.qac]),
      valor_acumulado,
      saldo_qtd: num(row[cols.sq]),
      saldo_valor: num(row[cols.sv]),
      percentual_atual: pctAtual * 100,
      percentual_anterior: pctAnt * 100,
    });
  }

  if (itens.length === 0)
    return { motivo: "nenhum item reconhecido no corpo", amostraLinhas: amostraDeLinhas(rows) };

  if (!totalMedicao) totalMedicao = itens.reduce((a, i) => a + i.valor_mes, 0);

  const per = parsePeriodo(periodoRaw ?? "", XLSX);

  const rotulosCabecalho = (rows[headerGroupRowEfetivo] ?? []).map((v) =>
    v == null ? "" : String(v).trim(),
  );
  const rotulosSubcabecalho = (rows[headerGroupRowEfetivo + 1] ?? []).map((v) =>
    v == null ? "" : String(v).trim(),
  );

  return {
    sheet: {
      sheetName: name,
      numero,
      ordem: deriveOrdem(numero),
      data: dataIso,
      data_inicio: per.ini,
      data_fim: per.fim ?? dataIso,
      periodo_raw: periodoRaw,
      valor_contrato: valorContrato,
      total_medicao: totalMedicao,
      itens,
      contratada,
      servico_obra: servicoObra,
      nome_projeto: nomeProjeto,
      cliente_unidade: clienteUnidade,
      contrato_numero: contratoNumero,
      cond_pagamento: condPagamento,
      folha_numero: folhaNumero,
      perfil_layout_id: perfilLayout?.id,
      perfil_layout_nome: perfilLayout?.nome,
      diagnostico: {
        headerRow: headerGroupRowEfetivo + 1, // 1-based p/ UI
        colunas: cols as unknown as Record<string, number>,
        rotulosCabecalho,
        rotulosSubcabecalho,
      },
    },
  };
}

export type ParseBmsWorkbookOptions = {
  /** PRO-018 · slice-05 — perfis salvos usados como fallback em abas ignoradas. */
  perfisLayout?: BmsLayoutPerfil[];
};

export async function parseBmsWorkbook(
  file: File,
  options: ParseBmsWorkbookOptions = {},
): Promise<BmsWorkbook> {
  const XLSX = await import("xlsx");
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array", cellDates: true });
  const sheets: BmsSheet[] = [];
  const ignoradas: BmsSheetIgnorada[] = [];
  const perfisLayout = options.perfisLayout ?? [];
  for (const name of wb.SheetNames) {
    const ws = wb.Sheets[name];
    const rows = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1, defval: "" });
    const res = parseSheet(name, rows, XLSX);
    if ("sheet" in res) sheets.push(res.sheet);
    else {
      const reparsed = perfisLayout
        .map((perfilLayout) => parseSheet(name, rows, XLSX, { perfilLayout }))
        .find((tentativa) => "sheet" in tentativa);
      if (reparsed && "sheet" in reparsed) {
        sheets.push(reparsed.sheet);
        continue;
      }
      ignoradas.push({
        sheetName: name,
        motivo: res.motivo,
        amostraLinhas: res.amostraLinhas,
      });
    }
  }
  sheets.sort((a, b) => a.ordem - b.ordem || a.sheetName.localeCompare(b.sheetName));
  return { arquivoNome: file.name, sheets, ignoradas };
}
