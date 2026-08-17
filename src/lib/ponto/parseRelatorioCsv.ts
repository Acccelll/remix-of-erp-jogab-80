/** @module-kind pure */
import Papa from "papaparse";
import { parseHHMM } from "./formatMinutes";

export interface ParsedPontoRow {
  nome: string;
  matricula?: string;
  cpf?: string;
  pis?: string;
  empresa?: string;
  departamento?: string;
  data: string | null; // null = relatório agregado do período
  horas_previstas_min: number;
  horas_trabalhadas_min: number;
  horas_falta_min: number;
  dias_falta_qtd: number;
  horas_extra_50_min: number;
  horas_extra_60_min: number;
  horas_extra_100_min: number;
  horas_compensadas_min: number;
  interjornada_min: number;
  banco_saldo_min: number;
  marcacao_invalida: boolean;
  falta: boolean;
  atestado: boolean;
  observacao?: string;
  /** Só na origem RHiD: id da pessoa na API, chave estável do vínculo. */
  rhid_id_person?: number;
  /** Só na origem RHiD: JSON do dia como o motor ACJEF devolveu. */
  payload?: string;
}

export interface ParseResult {
  rows: ParsedPontoRow[];
  totalLinhas: number;
  ignoradas: number;
  periodoInicio: string | null;
  periodoFim: string | null;
  colaboradoresUnicos: number;
  rawHeaders: string[];
  empresa?: string;
}

const ALIASES = {
  empresa: ["nome da empresa", "empresa"],
  nome: [
    "nome do funcionario",
    "nome do funcionário",
    "funcionario",
    "funcionário",
    "colaborador",
    "nome",
  ],
  pis: ["pis do funcionario", "pis do funcionário", "pis"],
  cpf: ["cpf do funcionario", "cpf do funcionário", "cpf"],
  matricula: ["matricula", "matrícula", "chapa"],
  departamento: [
    "nome do departamento",
    "departamento",
    "depto",
    "centro de custo",
    "centro_custo",
    "setor",
  ],
  data: ["data", "dia"],
  horas_previstas: ["horas previstas", "previstas", "carga horaria", "carga horária"],
  diurnas: ["diurnas normais", "diurnas", "normais diurnas"],
  noturnas: ["noturnas normais", "noturnas"],
  trabalhadas: ["horas trabalhadas", "trabalhadas", "realizadas"],
  dia_falta: ["dia falta", "dias falta", "qtd faltas"],
  falta_atraso: ["falta e atraso", "falta/atraso", "faltas e atrasos"],
  extra_0: ["extra 0%", "extra 0", "he 0", "hora extra 0"],
  extra_50: ["extra 50%", "extra 50", "he 50", "hora extra 50"],
  extra_60: ["extra 60%", "extra 60", "he 60", "hora extra 60"],
  extra_100: ["extra 100%", "extra 100", "he 100", "hora extra 100"],
  interjornada: ["interjornada", "interjornadas"],
  dsr_cons: ["dsr cons", "dsr consumido", "dsr cons."],
  dsr_deb: ["dsr deb", "dsr debitado", "dsr deb."],
  banco_total: ["banco total", "total banco"],
  banco_saldo: ["banco saldo", "saldo banco"],
  atestado_col: ["atestado", "atestados"],
  observacao: ["observacao", "observação", "obs", "justificativa", "motivo"],
};

function normalize(h: string) {
  return h
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9% ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function findColumn(headers: string[], aliases: string[]): string | null {
  const normalized = headers.map(normalize);
  for (const alias of aliases) {
    const target = normalize(alias);
    let idx = normalized.findIndex((h) => h === target);
    if (idx >= 0) return headers[idx];
  }
  for (const alias of aliases) {
    const target = normalize(alias);
    if (target.length < 4) continue;
    const idx = normalized.findIndex((h) => h.includes(target));
    if (idx >= 0) return headers[idx];
  }
  return null;
}

function isoDate(
  year: string | number,
  month: string | number,
  day: string | number,
): string | null {
  const y = Number(year);
  const m = Number(month);
  const d = Number(day);
  if (!Number.isInteger(y) || !Number.isInteger(m) || !Number.isInteger(d)) return null;
  if (y < 1900 || y > 2100 || m < 1 || m > 12 || d < 1 || d > 31) return null;

  const date = new Date(Date.UTC(y, m - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d)
    return null;

  return `${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function parseDataISO(value: string): string | null {
  if (!value) return null;
  const s = value.trim();
  const br = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
  if (br) {
    let y = br[3];
    if (y.length === 2) y = "20" + y;
    return isoDate(y, br[2], br[1]);
  }
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return isoDate(iso[1], iso[2], iso[3]);
  return null;
}

function num(v: string | undefined): number {
  if (!v) return 0;
  const n = parseInt(String(v).replace(/\D/g, ""), 10);
  return isNaN(n) ? 0 : n;
}

export function parseRelatorioCsv(content: string): ParseResult {
  // Remove BOM
  const clean = content.replace(/^\uFEFF/, "");
  const firstLine = clean.split(/\r?\n/)[0] || "";
  const delimiter = firstLine.split(";").length > firstLine.split(",").length ? ";" : ",";

  const parsed = Papa.parse<Record<string, string>>(clean, {
    header: true,
    delimiter,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
  });

  const headers = parsed.meta.fields ?? [];
  const col = {
    empresa: findColumn(headers, ALIASES.empresa),
    nome: findColumn(headers, ALIASES.nome),
    pis: findColumn(headers, ALIASES.pis),
    cpf: findColumn(headers, ALIASES.cpf),
    matricula: findColumn(headers, ALIASES.matricula),
    departamento: findColumn(headers, ALIASES.departamento),
    data: findColumn(headers, ALIASES.data),
    horas_previstas: findColumn(headers, ALIASES.horas_previstas),
    diurnas: findColumn(headers, ALIASES.diurnas),
    noturnas: findColumn(headers, ALIASES.noturnas),
    trabalhadas: findColumn(headers, ALIASES.trabalhadas),
    dia_falta: findColumn(headers, ALIASES.dia_falta),
    falta_atraso: findColumn(headers, ALIASES.falta_atraso),
    extra_0: findColumn(headers, ALIASES.extra_0),
    extra_50: findColumn(headers, ALIASES.extra_50),
    extra_60: findColumn(headers, ALIASES.extra_60),
    extra_100: findColumn(headers, ALIASES.extra_100),
    interjornada: findColumn(headers, ALIASES.interjornada),
    banco_saldo: findColumn(headers, ALIASES.banco_saldo),
    atestado_col: findColumn(headers, ALIASES.atestado_col),
    observacao: findColumn(headers, ALIASES.observacao),
  };

  if (col.nome && col.empresa && col.nome === col.empresa) {
    col.nome =
      headers.find((h) => {
        const n = normalize(h);
        return n !== normalize(col.empresa!) && n.includes("funcion");
      }) ?? col.nome;
  }

  const rows: ParsedPontoRow[] = [];
  let ignoradas = 0;
  let minDate: string | null = null;
  let maxDate: string | null = null;
  const colabs = new Set<string>();
  let empresa: string | undefined;

  for (const r of parsed.data) {
    const nome = col.nome ? (r[col.nome] || "").trim() : "";
    if (!nome) {
      ignoradas++;
      continue;
    }

    if (col.empresa && !empresa) empresa = (r[col.empresa] || "").trim() || undefined;

    const dataRaw = col.data ? (r[col.data] || "").trim() : "";
    const data = parseDataISO(dataRaw);

    const diurnas = parseHHMM(col.diurnas ? r[col.diurnas] : "");
    const noturnas = parseHHMM(col.noturnas ? r[col.noturnas] : "");
    const trabExplicita = parseHHMM(col.trabalhadas ? r[col.trabalhadas] : "");
    const trab = trabExplicita || diurnas + noturnas;

    const prev = parseHHMM(col.horas_previstas ? r[col.horas_previstas] : "");
    const fa = parseHHMM(col.falta_atraso ? r[col.falta_atraso] : "");
    const diasFalta = num(col.dia_falta ? r[col.dia_falta] : "");

    const he0 = parseHHMM(col.extra_0 ? r[col.extra_0] : "");
    const he50 = parseHHMM(col.extra_50 ? r[col.extra_50] : "");
    const he60 = parseHHMM(col.extra_60 ? r[col.extra_60] : "");
    const he100 = parseHHMM(col.extra_100 ? r[col.extra_100] : "");
    const interjornada = parseHHMM(col.interjornada ? r[col.interjornada] : "");
    const bancoSaldo = parseHHMM(col.banco_saldo ? r[col.banco_saldo] : "");

    const obs = col.observacao ? (r[col.observacao!] || "").trim() : "";
    const atestadoCol = col.atestado_col ? (r[col.atestado_col!] || "").trim() : "";
    const isAtestado =
      obs.toLowerCase().includes("atestado") ||
      /^(s|sim|1|x|true)$/i.test(atestadoCol) ||
      parseHHMM(atestadoCol) > 0;
    // É falta se há dia(s) inteiro(s) de falta E nenhuma hora trabalhada
    const isFalta = diasFalta > 0 && trab === 0;
    const marcacaoInvalida =
      interjornada > 0 || obs.toLowerCase().includes("inv") || obs.toLowerCase().includes("impar");

    rows.push({
      nome,
      matricula: col.matricula ? (r[col.matricula] || "").trim() : undefined,
      cpf: col.cpf ? (r[col.cpf] || "").replace(/\D/g, "") : undefined,
      pis: col.pis ? (r[col.pis] || "").replace(/\D/g, "") : undefined,
      empresa,
      departamento: col.departamento ? (r[col.departamento] || "").trim() : undefined,
      data,
      horas_previstas_min: prev,
      horas_trabalhadas_min: trab,
      horas_falta_min: fa,
      dias_falta_qtd: diasFalta,
      // Extra 0% = horas compensadas em banco; NÃO é HE 50%.
      horas_extra_50_min: he50,
      horas_extra_60_min: he60,
      horas_extra_100_min: he100,
      horas_compensadas_min: he0,
      interjornada_min: interjornada,
      banco_saldo_min: bancoSaldo,
      marcacao_invalida: marcacaoInvalida,
      falta: isFalta,
      atestado: isAtestado,
      observacao: obs || undefined,
    });

    colabs.add(
      `${rows[rows.length - 1].matricula || ""}|${rows[rows.length - 1].cpf || ""}|${nome}`,
    );
    if (data) {
      if (!minDate || data < minDate) minDate = data;
      if (!maxDate || data > maxDate) maxDate = data;
    }
  }

  return {
    rows,
    totalLinhas: parsed.data.length,
    ignoradas,
    periodoInicio: minDate,
    periodoFim: maxDate,
    colaboradoresUnicos: colabs.size,
    rawHeaders: headers,
    empresa,
  };
}

/** Extrai AAAA-MM-DD de "relatorio_YYYYMMDD_HHMM" ou "relatorio_YYYYMDD" (mês 1 dígito). */
export function inferPeriodoDoNome(fileName: string): { inicio: string; fim: string } | null {
  const tokens = fileName.match(/\d+/g) ?? [];

  for (const token of tokens) {
    let fim: string | null = null;

    if (token.length === 8) {
      fim = isoDate(token.slice(0, 4), token.slice(4, 6), token.slice(6, 8));
    } else if (token.length === 7) {
      fim = isoDate(token.slice(0, 4), token.slice(4, 5), token.slice(5, 7));
    }

    if (fim) {
      const inicio = isoDate(fim.slice(0, 4), fim.slice(5, 7), 1);
      return inicio ? { inicio, fim } : null;
    }
  }

  return null;
}
