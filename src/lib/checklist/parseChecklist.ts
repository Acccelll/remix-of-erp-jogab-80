/** @module-kind pure */
import * as XLSX from "xlsx";

export interface ChecklistAtividade {
  descricao: string;
  quantidade_dia: number | null;
  quantidade_acumulada: number | null;
}

export interface ChecklistEfetivo {
  tipo: "proprio" | "terceiro";
  nome_livre: string;
  funcao_livre: string | null;
  entrada: string | null;
  saida: string | null;
}

export interface ChecklistOcorrencia {
  tipo: string; // "ocorrencia" sempre, p/ schema
  descricao: string;
}

export interface ChecklistRdoRow {
  rowIndex: number; // 1-based linha original
  status: string;
  codigo: string;
  unidade: string; // ex: "214 - Barra Bonita"
  unidadeCodigo: string | null; // "214"
  unidadeNome: string | null; // "Barra Bonita"
  autor: string;
  data: string; // YYYY-MM-DD
  diaSemana: string;
  climaManha: string | null;
  climaTarde: string | null;
  climaNoite: string | null;
  trabalhavelManha: boolean;
  trabalhavelTarde: boolean;
  trabalhavelNoite: boolean;
  ocorrencias: ChecklistOcorrencia[];
  atividades: ChecklistAtividade[];
  efetivo: ChecklistEfetivo[];
  equipamentosTexto: string; // bloco textual p/ observacoes
  observacoes: string; // texto consolidado
}

export interface ParsedChecklist {
  totalLinhas: number;
  rows: ChecklistRdoRow[];
  errors: Array<{ rowIndex: number; motivo: string }>;
}

const NAO_TRABALHAVEL = /chovendo|chuva|temporal|paralis/i;

function isTrabalhavel(clima: string | null): boolean {
  if (!clima) return true;
  return !NAO_TRABALHAVEL.test(clima);
}

function parseDateBR(value: unknown): string | null {
  if (value == null || value === "") return null;
  // Excel pode entregar como número serial (data), string "dd/mm/yyyy", ou Date.
  if (value instanceof Date && !isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }
  if (typeof value === "number") {
    const d = XLSX.SSF?.parse_date_code?.(value);
    if (d && d.y) {
      const m = String(d.m).padStart(2, "0");
      const day = String(d.d).padStart(2, "0");
      return `${d.y}-${m}-${day}`;
    }
  }
  const s = String(value).trim();
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
  if (m) {
    const d = m[1].padStart(2, "0");
    const mo = m[2].padStart(2, "0");
    const y = m[3].length === 2 ? `20${m[3]}` : m[3];
    return `${y}-${mo}-${d}`;
  }
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  return null;
}

function asText(v: unknown): string {
  if (v == null) return "";
  return String(v).trim();
}

function asNum(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = Number(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

/**
 * Parseia o XLSX exportado pelo Checklist Fácil ("Relatório Diário de Obra").
 * Linha 1 = grupo; Linha 2 = nome do campo; Linhas 3..N = dados.
 */
export function parseChecklistXlsx(buf: ArrayBuffer): ParsedChecklist {
  const wb = XLSX.read(buf, { type: "array", cellDates: true });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const matrix = XLSX.utils.sheet_to_json<unknown[]>(ws, {
    header: 1,
    raw: true,
    defval: null,
  });
  if (matrix.length < 3) {
    return { totalLinhas: 0, rows: [], errors: [{ rowIndex: 0, motivo: "Planilha sem dados" }] };
  }
  const groupsRow = matrix[0] as (string | null)[];
  const fieldsRow = matrix[1] as (string | null)[];
  const numCols = Math.max(groupsRow.length, fieldsRow.length);

  // Propaga grupo para a direita (cabeçalho mesclado)
  const groups: string[] = [];
  let lastGroup = "";
  for (let i = 0; i < numCols; i++) {
    const g = groupsRow[i] ? String(groupsRow[i]).trim() : "";
    if (g) lastGroup = g;
    groups.push(lastGroup);
  }
  const fields = fieldsRow.map((f) => (f == null ? "" : String(f).trim()));

  // Index helpers
  const findCol = (group: string, field: string): number =>
    groups.findIndex(
      (g, i) => g === group && fields[i].toLowerCase().startsWith(field.toLowerCase()),
    );
  const findColBase = (field: string): number =>
    fields.findIndex((f) => f.toLowerCase().startsWith(field.toLowerCase()));

  const colStatus = findColBase("status");
  const colCodigo = findColBase("código");
  const colAutor = findColBase("autor");
  const colUnidade = findColBase("unidade");
  const colData = findCol("Data e Tempo", "relatório referente");
  const colDiaSemana = findCol("Data e Tempo", "dia da semana");
  const colManha = findCol("Data e Tempo", "período da manhã");
  const colTarde = findCol("Data e Tempo", "período da tarde");
  const colNoite = findCol("Data e Tempo", "período da noite");

  const rows: ChecklistRdoRow[] = [];
  const errors: Array<{ rowIndex: number; motivo: string }> = [];

  for (let r = 2; r < matrix.length; r++) {
    const raw = matrix[r] as unknown[];
    if (!raw || raw.every((c) => c == null || c === "")) continue;
    const rowIndex = r + 1;
    const data = parseDateBR(raw[colData]);
    if (!data) {
      errors.push({ rowIndex, motivo: "Data do relatório ausente/ inválida" });
      continue;
    }
    const unidade = asText(raw[colUnidade]);
    const m = unidade.match(/^(\S+)\s*-\s*(.+)$/);
    const climaManha = asText(raw[colManha]) || null;
    const climaTarde = asText(raw[colTarde]) || null;
    const climaNoite = asText(raw[colNoite]) || null;

    // Ocorrências 1..3
    const ocorrencias: ChecklistOcorrencia[] = [];
    for (const grp of ["Ocorrência 1", "Ocorrência 2", "Ocorrência 3"]) {
      const cDesc = findCol(grp, "descreva");
      const cCons = findCol(grp, "quais foram as consequ");
      const cSol = findCol(grp, "qual foi a solução");
      if (cDesc < 0) continue;
      const desc = asText(raw[cDesc]);
      if (!desc) continue;
      const partes = [desc];
      const cons = cCons >= 0 ? asText(raw[cCons]) : "";
      const sol = cSol >= 0 ? asText(raw[cSol]) : "";
      if (cons) partes.push(`Consequência: ${cons}`);
      if (sol) partes.push(`Solução: ${sol}`);
      ocorrencias.push({ tipo: "ocorrencia", descricao: partes.join(" — ") });
    }

    // Serviços 1..6
    const atividades: ChecklistAtividade[] = [];
    for (let s = 1; s <= 6; s++) {
      const grp = `Serviço ${s}`;
      const cDesc = findCol(grp, "descrição do serviço");
      const cQtd = findCol(grp, "qual foi a quantidade executada");
      const cAcum = findCol(grp, "qual a quantidade acumulada");
      if (cDesc < 0) continue;
      const hierarquia: string[] = [];
      for (const fase of [
        "Fase/Serviço",
        "Fase/Serviço 2",
        "Fase/Serviço 2.5",
        "Fase/Serviço 3",
        "Fase/Serviço 4",
        "Fase/Serviço 4.5",
        "Fase/Serviço 5",
      ]) {
        const cf = groups.findIndex((g, i) => g === grp && fields[i] === fase);
        if (cf < 0) continue;
        const v = asText(raw[cf]);
        if (v) hierarquia.push(v);
      }
      const desc = asText(raw[cDesc]);
      if (!hierarquia.length && !desc) continue;
      const descricao = [hierarquia.join(" › "), desc].filter(Boolean).join(" — ");
      atividades.push({
        descricao,
        quantidade_dia: asNum(raw[cQtd]),
        quantidade_acumulada: asNum(raw[cAcum]),
      });
    }

    // Efetivo Jogab (1..25)
    const colMesmoExp = findCol("Colaboradores Jogab", "todos os colaboradores fizeram o mesmo");
    const colEntradaGlob = findCol("Colaboradores Jogab", "entrada");
    const colSaidaGlob = findCol("Colaboradores Jogab", "saída");
    const mesmoExp = colMesmoExp >= 0 && /sim/i.test(asText(raw[colMesmoExp]));
    const entradaGlob = colEntradaGlob >= 0 ? asText(raw[colEntradaGlob]) : "";
    const saidaGlob = colSaidaGlob >= 0 ? asText(raw[colSaidaGlob]) : "";

    const efetivo: ChecklistEfetivo[] = [];
    for (let i = 1; i <= 25; i++) {
      const grp = `Colaborador ${i}`;
      const cNome = findCol(grp, "nome");
      if (cNome < 0) continue;
      const nome = asText(raw[cNome]);
      if (!nome) continue;
      const cEnt = findCol(grp, "entrada");
      const cSai = findCol(grp, "saída");
      const ent = cEnt >= 0 ? asText(raw[cEnt]) : "";
      const sai = cSai >= 0 ? asText(raw[cSai]) : "";
      efetivo.push({
        tipo: "proprio",
        nome_livre: nome,
        funcao_livre: null,
        entrada: ent || (mesmoExp ? entradaGlob : null) || null,
        saida: sai || (mesmoExp ? saidaGlob : null) || null,
      });
    }
    for (let i = 1; i <= 10; i++) {
      const grp = `Terceiros ${i}`;
      const cNome = findCol(grp, "nome");
      if (cNome < 0) continue;
      const nome = asText(raw[cNome]);
      if (!nome) continue;
      const cFunc = findCol(grp, "função");
      const cEnt = findCol(grp, "entrada");
      const cSai = findCol(grp, "saída");
      efetivo.push({
        tipo: "terceiro",
        nome_livre: nome,
        funcao_livre: cFunc >= 0 ? asText(raw[cFunc]) || null : null,
        entrada: cEnt >= 0 ? asText(raw[cEnt]) || null : null,
        saida: cSai >= 0 ? asText(raw[cSai]) || null : null,
      });
    }

    // Equipamentos -> texto (preservar até existir tabela própria)
    const eqLinhas: string[] = [];
    for (let i = 1; i <= 10; i++) {
      const grp = `Equipamento ${i}`;
      const cNome = findCol(grp, "nome do equipamento");
      if (cNome < 0) continue;
      const nome = asText(raw[cNome]);
      if (!nome) continue;
      const cQtd = findCol(grp, "quantidade");
      const cFase = findCol(grp, "fase em que o equipamento");
      const cIni = findCol(grp, "expediente - início");
      const cFim = findCol(grp, "expediente - fim");
      const partes = [`• ${nome}`];
      if (cQtd >= 0) {
        const q = asText(raw[cQtd]);
        if (q) partes.push(`x${q}`);
      }
      if (cFase >= 0) {
        const f = asText(raw[cFase]);
        if (f) partes.push(`Fase: ${f}`);
      }
      if (cIni >= 0 || cFim >= 0) {
        const ini = cIni >= 0 ? asText(raw[cIni]) : "";
        const fim = cFim >= 0 ? asText(raw[cFim]) : "";
        if (ini || fim) partes.push(`${ini || "—"} a ${fim || "—"}`);
      }
      eqLinhas.push(partes.join(" "));
    }
    const equipamentosTexto = eqLinhas.length ? `Equipamentos:\n${eqLinhas.join("\n")}` : "";

    const obsParts = [
      `Origem: Checklist Fácil #${asText(raw[colCodigo])}`,
      `Autor: ${asText(raw[colAutor])}`,
      equipamentosTexto,
    ].filter(Boolean);

    rows.push({
      rowIndex,
      status: asText(raw[colStatus]),
      codigo: asText(raw[colCodigo]),
      unidade,
      unidadeCodigo: m ? m[1] : null,
      unidadeNome: m ? m[2] : unidade || null,
      autor: asText(raw[colAutor]),
      data,
      diaSemana: asText(raw[colDiaSemana]),
      climaManha,
      climaTarde,
      climaNoite,
      trabalhavelManha: isTrabalhavel(climaManha),
      trabalhavelTarde: isTrabalhavel(climaTarde),
      trabalhavelNoite: isTrabalhavel(climaNoite),
      ocorrencias,
      atividades,
      efetivo,
      equipamentosTexto,
      observacoes: obsParts.join("\n"),
    });
  }

  return { totalLinhas: rows.length, rows, errors };
}
