/** @module-kind pure */
// Converte a apuração diária da RHiD (motor ACJEF) em ParsedPontoRow,
// reaproveitando o mesmo pipeline de importação usado pelo CSV de ponto.
//
// A RHiD documenta nominalmente poucos campos (`pis`, `idPerson`, `name`, `date`,
// `totalHorasTrabalhadas`, `saldoBancoFinalDia`) e afirma existirem "dezenas de campos
// do motor ACJEF". Por isso o mapeamento é feito por ALIASES tolerantes — mesma técnica
// já usada em `parseRelatorioCsv.ts` para os cabeçalhos de CSV — e tudo que não casar
// fica exposto por `camposNaoMapeados()` para conferência na tela.

import { parseHHMM } from "@/lib/ponto/formatMinutes";
import type { ParsedPontoRow } from "@/lib/ponto/parseRelatorioCsv";

/** Um dia de apuração cru, como devolvido pela edge function. */
export type RhidDia = Record<string, unknown>;

export interface RhidPessoa {
  idPerson: number;
  name: string;
  cpf: string | null;
  pis: string | null;
  registration: string | null;
  departamento: string | null;
  /**
   * Opcionais: só chegam da edge function publicada com a Onda 1. Sem eles a
   * Conciliação de Cadastro apenas deixa as colunas correspondentes vazias.
   */
  status?: number | null;
  numberOfTemplates?: number | null;
  linkedDeviceIds?: number[];
}

/** Chave canônica: minúscula, sem acentos e sem separadores. */
function normalizaChave(chave: string): string {
  return chave
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

const ALIASES = {
  data: ["date", "data", "dia", "dataregistro", "datamarcacao"],
  horasPrevistas: [
    "totalhorasprevistas",
    "horasprevistas",
    "totalhorasjornada",
    "horasjornada",
    "cargahoraria",
    "jornadaprevista",
    "previsto",
  ],
  horasTrabalhadas: [
    "totalhorastrabalhadas",
    "horastrabalhadas",
    "totaltrabalhado",
    "totalhorastrabalhada",
    "trabalhadas",
  ],
  horasFalta: [
    "totalhorasfalta",
    "horasfalta",
    "faltaeatraso",
    "faltaseatrasos",
    "totalatrasos",
    "atrasos",
    "atraso",
    "horasfaltantes",
  ],
  diasFalta: ["diasfalta", "diafalta", "totaldiasfalta", "qtdfaltas", "quantidadefaltas"],
  extra50: ["horaextra50", "horasextras50", "totalextra50", "extra50", "he50"],
  extra60: ["horaextra60", "horasextras60", "totalextra60", "extra60", "he60"],
  extra100: ["horaextra100", "horasextras100", "totalextra100", "extra100", "he100"],
  compensadas: ["horascompensadas", "compensadas", "horacompensada", "horaextra0", "extra0", "he0"],
  interjornada: ["interjornada", "interjornadas", "intervalointerjornada", "horasinterjornada"],
  bancoSaldo: [
    "saldobancofinaldia",
    "saldobanco",
    "bancosaldo",
    "saldobancohoras",
    "saldofinaldia",
  ],
  observacao: ["observacao", "obs", "justificativa", "motivo", "descricaojustificativa"],
  atestado: ["atestado", "horasabonadas", "abonado", "abono", "totalhorasabonadas"],
  marcacaoInvalida: [
    "marcacaoinvalida",
    "inconsistencia",
    "marcacaoimpar",
    "marcacaoinconsistente",
  ],
  nome: ["name", "nome", "nomepessoa"],
  idPerson: ["idperson", "idpessoa"],
  pis: ["pis"],
} as const;

type CampoAlias = keyof typeof ALIASES;

/** Todos os aliases conhecidos, para detectar campos ainda não mapeados. */
const ALIASES_CONHECIDOS = new Set<string>(Object.values(ALIASES).flat() as string[]);

function buscar(dia: RhidDia, campo: CampoAlias): unknown {
  const alvos = ALIASES[campo] as readonly string[];
  for (const [chave, valor] of Object.entries(dia)) {
    if (alvos.includes(normalizaChave(chave))) return valor;
  }
  return undefined;
}

/**
 * Converte uma duração da RHiD em minutos.
 *
 * Regra de unidade (o motor ACJEF varia o formato conforme a configuração do cliente):
 * - `"HH:MM"`  → horas e minutos (ex.: `"08:30"` → 510);
 * - número inteiro → já está em minutos (ex.: `480` → 480);
 * - número fracionário → horas decimais (ex.: `7.5` → 450).
 *
 * `null`, vazio ou não numérico → 0, para nunca quebrar a importação.
 */
export function duracaoParaMinutos(valor: unknown): number {
  if (valor === null || valor === undefined || valor === "") return 0;

  if (typeof valor === "number") {
    if (!Number.isFinite(valor)) return 0;
    return Number.isInteger(valor) ? valor : Math.round(valor * 60);
  }

  const s = String(valor).trim();
  if (!s) return 0;
  if (s.includes(":")) return parseHHMM(s);

  // parseHHMM trata número solto como horas decimais; inteiro aqui significa minutos.
  const numerico = Number(s.replace(",", "."));
  if (!Number.isFinite(numerico)) return 0;
  return Number.isInteger(numerico) ? numerico : Math.round(numerico * 60);
}

function paraInteiro(valor: unknown): number {
  if (valor === null || valor === undefined || valor === "") return 0;
  const n = Number(String(valor).replace(",", "."));
  return Number.isFinite(n) ? Math.round(n) : 0;
}

function paraTexto(valor: unknown): string | undefined {
  if (valor === null || valor === undefined) return undefined;
  const s = String(valor).trim();
  return s || undefined;
}

/** Normaliza a data do dia apurado para AAAA-MM-DD. Aceita ISO, DD/MM/AAAA e ISO com hora. */
export function normalizaData(valor: unknown): string | null {
  const s = paraTexto(valor);
  if (!s) return null;

  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  const br = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);

  let ano: number, mes: number, dia: number;
  if (iso) {
    [ano, mes, dia] = [Number(iso[1]), Number(iso[2]), Number(iso[3])];
  } else if (br) {
    [ano, mes, dia] = [Number(br[3]), Number(br[2]), Number(br[1])];
  } else {
    return null;
  }

  const d = new Date(Date.UTC(ano, mes - 1, dia));
  if (d.getUTCFullYear() !== ano || d.getUTCMonth() !== mes - 1 || d.getUTCDate() !== dia) {
    return null;
  }
  return `${String(ano).padStart(4, "0")}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
}

function ehVerdadeiro(valor: unknown): boolean {
  if (valor === null || valor === undefined) return false;
  if (typeof valor === "boolean") return valor;
  if (typeof valor === "number") return valor > 0;
  const s = String(valor).trim();
  if (!s) return false;
  if (/^(s|sim|1|x|true)$/i.test(s)) return true;
  return duracaoParaMinutos(s) > 0;
}

/**
 * Converte os dias de apuração em linhas do pipeline de ponto.
 * `pessoasPorId` traz CPF/matrícula/departamento do cadastro RHiD (`GET /person`),
 * que a apuração não devolve mas o ERP precisa para casar colaborador e obra.
 */
export function mapApuracaoToRows(
  dias: RhidDia[],
  pessoasPorId: Map<number, RhidPessoa>,
): ParsedPontoRow[] {
  const rows: ParsedPontoRow[] = [];

  for (const dia of dias) {
    const idPerson = paraInteiro(buscar(dia, "idPerson"));
    const pessoa = pessoasPorId.get(idPerson);

    const nome = pessoa?.name ?? paraTexto(buscar(dia, "nome"));
    // Sem nome não há como casar o colaborador — a linha seria lixo no banco.
    if (!nome) continue;

    const trabalhadas = duracaoParaMinutos(buscar(dia, "horasTrabalhadas"));
    const diasFalta = paraInteiro(buscar(dia, "diasFalta"));
    const interjornada = duracaoParaMinutos(buscar(dia, "interjornada"));
    const observacao = paraTexto(buscar(dia, "observacao"));
    const obsLower = (observacao ?? "").toLowerCase();

    // Mesmas regras derivadas do importador de CSV (parseRelatorioCsv.ts).
    const atestado = obsLower.includes("atestado") || ehVerdadeiro(buscar(dia, "atestado"));
    const falta = diasFalta > 0 && trabalhadas === 0;
    const marcacaoInvalida =
      interjornada > 0 ||
      ehVerdadeiro(buscar(dia, "marcacaoInvalida")) ||
      obsLower.includes("inv") ||
      obsLower.includes("impar");

    rows.push({
      nome,
      matricula: pessoa?.registration ?? undefined,
      cpf: pessoa?.cpf ?? undefined,
      pis: pessoa?.pis ?? paraTexto(buscar(dia, "pis")),
      departamento: pessoa?.departamento ?? undefined,
      data: normalizaData(buscar(dia, "data")),
      horas_previstas_min: duracaoParaMinutos(buscar(dia, "horasPrevistas")),
      horas_trabalhadas_min: trabalhadas,
      horas_falta_min: duracaoParaMinutos(buscar(dia, "horasFalta")),
      dias_falta_qtd: diasFalta,
      horas_extra_50_min: duracaoParaMinutos(buscar(dia, "extra50")),
      horas_extra_60_min: duracaoParaMinutos(buscar(dia, "extra60")),
      horas_extra_100_min: duracaoParaMinutos(buscar(dia, "extra100")),
      horas_compensadas_min: duracaoParaMinutos(buscar(dia, "compensadas")),
      interjornada_min: interjornada,
      banco_saldo_min: duracaoParaMinutos(buscar(dia, "bancoSaldo")),
      marcacao_invalida: marcacaoInvalida,
      falta,
      atestado,
      observacao,
      // Origem preservada: é o que permite o espelho explicar o dia e refazer o
      // mapeamento de um campo novo sem consultar a API de novo (que é por
      // pessoa, em janelas de 90 dias).
      rhid_id_person: idPerson > 0 ? idPerson : undefined,
      payload: JSON.stringify(dia),
    });
  }

  return rows;
}

/**
 * Campos presentes no retorno da RHiD que nenhum alias reconheceu.
 * Alimenta o painel de Diagnóstico: é por aqui que se fecha o mapeamento
 * na primeira execução contra a API real.
 */
export function camposNaoMapeados(dia: RhidDia | null | undefined): string[] {
  if (!dia) return [];
  return Object.keys(dia)
    .filter((chave) => !ALIASES_CONHECIDOS.has(normalizaChave(chave)))
    .sort();
}

/** Como cada campo reconhecido foi interpretado — para conferir a unidade na tela. */
export function explicarMapeamento(
  dia: RhidDia | null | undefined,
): Array<{ campo: string; origem: string; bruto: string; minutos: number }> {
  if (!dia) return [];

  const duracoes: Array<[CampoAlias, string]> = [
    ["horasPrevistas", "horas_previstas_min"],
    ["horasTrabalhadas", "horas_trabalhadas_min"],
    ["horasFalta", "horas_falta_min"],
    ["extra50", "horas_extra_50_min"],
    ["extra60", "horas_extra_60_min"],
    ["extra100", "horas_extra_100_min"],
    ["compensadas", "horas_compensadas_min"],
    ["interjornada", "interjornada_min"],
    ["bancoSaldo", "banco_saldo_min"],
  ];

  const linhas: Array<{ campo: string; origem: string; bruto: string; minutos: number }> = [];
  for (const [alias, campo] of duracoes) {
    const alvos = ALIASES[alias] as readonly string[];
    const origem = Object.keys(dia).find((k) => alvos.includes(normalizaChave(k)));
    const bruto = origem === undefined ? undefined : dia[origem];
    linhas.push({
      campo,
      origem: origem ?? "—",
      bruto: origem === undefined ? "—" : JSON.stringify(bruto),
      minutos: duracaoParaMinutos(bruto),
    });
  }
  return linhas;
}
