/** @module-kind pure */
// Justificativas da RHiD: normalização, casamento com a fila de tratativas e
// consumo contra os limites do tipo.
//
// Sem isto, o DP justifica a falta na RHiD e a mesma exceção continua pendente
// no ERP — a fila nunca esvazia. O casamento aqui é o que fecha o ciclo.
//
// Como em `mapApuracao.ts`, o retorno da API é lido por ALIASES tolerantes: a
// RHiD documenta pouco e varia a grafia dos campos entre instalações.

import type { StatusOcorrencia, TipoOcorrencia } from "./ocorrencias";

/** Registro cru de justificativa, como a edge function devolve. */
export type JustificativaBruta = Record<string, unknown>;

export interface Justificativa {
  id: string;
  idPerson: number | null;
  /** Nome como a RHiD grafa — usado quando não há vínculo com o cadastro. */
  nome: string | null;
  cpf: string | null;
  dataInicio: string;
  dataFim: string;
  idTipo: string | null;
  tipoNome: string | null;
  /** Código de aprovação da RHiD, normalizado. */
  status: StatusAprovacao;
  motivo: string | null;
}

export type StatusAprovacao = "pendente" | "aprovada" | "reprovada" | "desconhecido";

export const ROTULO_APROVACAO: Record<StatusAprovacao, string> = {
  pendente: "Pendente",
  aprovada: "Aprovada",
  reprovada: "Reprovada",
  desconhecido: "Sem status",
};

export interface TipoJustificativa {
  id: string;
  nome: string;
  abreviacao: string | null;
  /** Abona o dia de falta — some do absenteísmo e da folha. */
  abonarDiaFalta: boolean;
  /** Desconta o DSR da semana — impacto direto no pagamento. */
  descontaDsr: boolean;
  exigeCid: boolean;
  qtdMensal: number | null;
  qtdTrimestral: number | null;
  qtdSemestral: number | null;
  qtdAnual: number | null;
}

function normalizaChave(chave: string): string {
  return chave
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

const ALIASES = {
  id: ["id", "idjustification", "idjustificativa"],
  idPerson: ["idperson", "idpessoa", "personid"],
  nome: ["name", "nome", "personname", "nomepessoa"],
  cpf: ["cpf"],
  dataInicio: ["ini", "datainicio", "startdate", "datainicial", "data", "inicio"],
  dataFim: ["fim", "datafim", "enddate", "datafinal", "termino"],
  idTipo: ["idjustificationtype", "idtipo", "justificationtypeid", "idtipojustificativa"],
  tipoNome: ["justificationtype", "tiponome", "typename", "tipo", "descricaotipo"],
  status: ["approvalstatus", "statusaprovacao", "status", "situacao"],
  motivo: ["reason", "motivo", "observacao", "descricao", "justificativa"],
} as const;

const ALIASES_TIPO = {
  id: ["id", "idtipo"],
  nome: ["name", "nome", "descricao"],
  abreviacao: ["abbreviation", "abreviation", "abreviacao", "sigla"],
  abonarDiaFalta: ["abonardiafalta", "abonafalta", "abonadiafalta"],
  descontaDsr: ["descontadsr", "descontodsr"],
  exigeCid: ["informarcid", "exigecid", "cid"],
  qtdMensal: ["qtdmensal", "quantidademensal", "limitemensal"],
  qtdTrimestral: ["qtdtrimestral", "quantidadetrimestral"],
  qtdSemestral: ["qtdsemestral", "quantidadesemestral"],
  qtdAnual: ["qtdanual", "quantidadeanual", "limiteanual"],
} as const;

function buscar(obj: Record<string, unknown>, alvos: readonly string[]): unknown {
  for (const [chave, valor] of Object.entries(obj)) {
    if (alvos.includes(normalizaChave(chave))) return valor;
  }
  return undefined;
}

function texto(valor: unknown): string | null {
  if (valor === null || valor === undefined) return null;
  const s = String(valor).trim();
  return s || null;
}

function inteiroOuNulo(valor: unknown): number | null {
  if (valor === null || valor === undefined || valor === "") return null;
  const n = Number(valor);
  return Number.isFinite(n) ? Math.round(n) : null;
}

function booleano(valor: unknown): boolean {
  if (typeof valor === "boolean") return valor;
  if (typeof valor === "number") return valor > 0;
  const s = texto(valor);
  return !!s && /^(s|sim|1|true|t|y)$/i.test(s);
}

/** Data em AAAA-MM-DD. Aceita ISO (com ou sem hora) e DD/MM/AAAA. */
export function normalizaDataJust(valor: unknown): string | null {
  const s = texto(valor);
  if (!s) return null;
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const br = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (br) {
    return `${br[3]}-${br[2].padStart(2, "0")}-${br[1].padStart(2, "0")}`;
  }
  return null;
}

/**
 * Status de aprovação. A RHiD manda ora número (o `approvalStatus` do filtro),
 * ora texto; só `aprovada` libera o fechamento automático da ocorrência, então
 * o que não for reconhecido cai em `desconhecido` — nunca em `aprovada`.
 */
export function normalizaAprovacao(valor: unknown): StatusAprovacao {
  if (valor === null || valor === undefined || valor === "") return "desconhecido";
  if (typeof valor === "number" || /^\d+$/.test(String(valor).trim())) {
    switch (Number(valor)) {
      case 0:
        return "pendente";
      case 1:
        return "aprovada";
      case 2:
        return "reprovada";
      default:
        return "desconhecido";
    }
  }
  const s = String(valor)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  if (s.includes("aprov") && !s.includes("nao") && !s.includes("reprov")) return "aprovada";
  if (s.includes("reprov") || s.includes("negad") || s.includes("recus")) return "reprovada";
  if (s.includes("pend") || s.includes("aguard") || s.includes("analis")) return "pendente";
  return "desconhecido";
}

/** Converte o retorno cru em justificativas utilizáveis, descartando o inservível. */
export function normalizarJustificativas(brutas: readonly JustificativaBruta[]): Justificativa[] {
  const out: Justificativa[] = [];
  for (const j of brutas) {
    const inicio = normalizaDataJust(buscar(j, ALIASES.dataInicio));
    // Sem data não há como casar com um dia da apuração — a linha seria inútil.
    if (!inicio) continue;
    const fim = normalizaDataJust(buscar(j, ALIASES.dataFim)) ?? inicio;
    out.push({
      id: texto(buscar(j, ALIASES.id)) ?? `${inicio}|${texto(buscar(j, ALIASES.idPerson)) ?? ""}`,
      idPerson: inteiroOuNulo(buscar(j, ALIASES.idPerson)),
      nome: texto(buscar(j, ALIASES.nome)),
      cpf: (() => {
        const cpf = texto(buscar(j, ALIASES.cpf));
        const digitos = cpf ? cpf.replace(/\D/g, "") : "";
        return digitos && Number(digitos) !== 0 ? digitos : null;
      })(),
      dataInicio: inicio,
      // Intervalo invertido na origem viraria janela vazia: normaliza a ordem.
      dataFim: fim < inicio ? inicio : fim,
      idTipo: texto(buscar(j, ALIASES.idTipo)),
      tipoNome: texto(buscar(j, ALIASES.tipoNome)),
      status: normalizaAprovacao(buscar(j, ALIASES.status)),
      motivo: texto(buscar(j, ALIASES.motivo)),
    });
  }
  return out;
}

export function normalizarTipos(brutos: readonly Record<string, unknown>[]): TipoJustificativa[] {
  const out: TipoJustificativa[] = [];
  for (const t of brutos) {
    const id = texto(buscar(t, ALIASES_TIPO.id));
    const nome = texto(buscar(t, ALIASES_TIPO.nome));
    if (!id || !nome) continue;
    out.push({
      id,
      nome,
      abreviacao: texto(buscar(t, ALIASES_TIPO.abreviacao)),
      abonarDiaFalta: booleano(buscar(t, ALIASES_TIPO.abonarDiaFalta)),
      descontaDsr: booleano(buscar(t, ALIASES_TIPO.descontaDsr)),
      exigeCid: booleano(buscar(t, ALIASES_TIPO.exigeCid)),
      qtdMensal: inteiroOuNulo(buscar(t, ALIASES_TIPO.qtdMensal)),
      qtdTrimestral: inteiroOuNulo(buscar(t, ALIASES_TIPO.qtdTrimestral)),
      qtdSemestral: inteiroOuNulo(buscar(t, ALIASES_TIPO.qtdSemestral)),
      qtdAnual: inteiroOuNulo(buscar(t, ALIASES_TIPO.qtdAnual)),
    });
  }
  return out;
}

/** `true` quando o dia cai dentro do intervalo coberto pela justificativa. */
export function cobreDia(j: Justificativa, data: string): boolean {
  return data >= j.dataInicio && data <= j.dataFim;
}

/** Ocorrência da fila, na forma mínima que o casamento precisa. */
export interface OcorrenciaParaCasar {
  id: string;
  chave_pessoa: string;
  colaborador_id: string | null;
  nome: string;
  data: string;
  tipo: string;
  status: string;
}

export interface OcorrenciaCasada {
  ocorrencia: OcorrenciaParaCasar;
  justificativa: Justificativa;
}

/**
 * Tipos de ocorrência que uma justificativa resolve. Marcação ímpar e HE
 * excedida não são ausência — nenhuma justificativa de falta as explica, e
 * fechá-las por tabela esconderia problema de coleta e risco trabalhista.
 */
const TIPOS_JUSTIFICAVEIS: ReadonlySet<TipoOcorrencia> = new Set<TipoOcorrencia>([
  "falta",
  "sem_marcacao",
]);

/** Status já resolvidos — não faz sentido "rejustificar". */
const STATUS_ABERTOS: ReadonlySet<StatusOcorrencia> = new Set<StatusOcorrencia>([
  "pendente",
  "em_tratativa",
]);

/**
 * Casa ocorrências abertas com justificativas **aprovadas** que cobrem o dia.
 * O vínculo é por pessoa: `colaborador_id` quando o ERP conhece a pessoa da
 * RHiD (mapa `colaboradorPorIdPerson`), com o CPF como segunda tentativa.
 */
export function casarComOcorrencias(
  ocorrencias: readonly OcorrenciaParaCasar[],
  justificativas: readonly Justificativa[],
  vinculo: {
    colaboradorPorIdPerson?: ReadonlyMap<number, string>;
    colaboradorPorCpf?: ReadonlyMap<string, string>;
  } = {},
): OcorrenciaCasada[] {
  const aprovadas = justificativas.filter((j) => j.status === "aprovada");
  if (aprovadas.length === 0) return [];

  /** Chaves da fila que a justificativa pode alcançar (id do cadastro e nome). */
  const chavesDe = (j: Justificativa): string[] => {
    const chaves: string[] = [];
    const porId = j.idPerson === null ? undefined : vinculo.colaboradorPorIdPerson?.get(j.idPerson);
    if (porId) chaves.push(porId);
    const porCpf = j.cpf ? vinculo.colaboradorPorCpf?.get(j.cpf) : undefined;
    if (porCpf && porCpf !== porId) chaves.push(porCpf);
    // Sem vínculo, a fila guarda o nome lido da origem como chave.
    if (j.nome) chaves.push(j.nome);
    return chaves;
  };

  const casadas: OcorrenciaCasada[] = [];
  for (const o of ocorrencias) {
    if (!STATUS_ABERTOS.has(o.status as StatusOcorrencia)) continue;
    if (!TIPOS_JUSTIFICAVEIS.has(o.tipo as TipoOcorrencia)) continue;

    const alvo = o.colaborador_id ?? o.chave_pessoa;
    const achada = aprovadas.find(
      (j) => cobreDia(j, o.data) && chavesDe(j).some((c) => c === alvo || c === o.nome),
    );
    if (achada) casadas.push({ ocorrencia: o, justificativa: achada });
  }
  return casadas;
}

export interface ConsumoLimite {
  chave: string;
  nome: string;
  idTipo: string;
  tipoNome: string;
  usadas: number;
  limite: number;
  periodo: "mensal" | "trimestral" | "semestral" | "anual";
  excedido: boolean;
}

/**
 * Consumo por colaborador/tipo contra o menor limite declarado no tipo.
 * A API entrega os tetos (`qtdMensal` e afins) e ninguém confere — é aqui que
 * o abono que já estourou a cota aparece.
 *
 * Compara sempre contra o menor teto preenchido: se o mensal já foi violado,
 * o anual é ruído.
 */
export function usoVsLimite(
  justificativas: readonly Justificativa[],
  tipos: readonly TipoJustificativa[],
): ConsumoLimite[] {
  const tipoPorId = new Map(tipos.map((t) => [t.id, t]));
  const contagem = new Map<string, { nome: string; idTipo: string; usadas: number }>();

  for (const j of justificativas) {
    if (j.status === "reprovada" || !j.idTipo) continue;
    const chavePessoa = j.idPerson !== null ? String(j.idPerson) : (j.nome ?? "");
    if (!chavePessoa) continue;
    const chave = `${chavePessoa}|${j.idTipo}`;
    const atual = contagem.get(chave) ?? {
      nome: j.nome ?? chavePessoa,
      idTipo: j.idTipo,
      usadas: 0,
    };
    atual.usadas += 1;
    contagem.set(chave, atual);
  }

  const out: ConsumoLimite[] = [];
  for (const [chave, v] of contagem) {
    const tipo = tipoPorId.get(v.idTipo);
    if (!tipo) continue;
    const candidatos: Array<[ConsumoLimite["periodo"], number | null]> = [
      ["mensal", tipo.qtdMensal],
      ["trimestral", tipo.qtdTrimestral],
      ["semestral", tipo.qtdSemestral],
      ["anual", tipo.qtdAnual],
    ];
    const menor = candidatos
      .filter((c): c is [ConsumoLimite["periodo"], number] => c[1] !== null && c[1] > 0)
      .sort((a, b) => a[1] - b[1])[0];
    if (!menor) continue;
    out.push({
      chave,
      nome: v.nome,
      idTipo: tipo.id,
      tipoNome: tipo.nome,
      usadas: v.usadas,
      limite: menor[1],
      periodo: menor[0],
      excedido: v.usadas > menor[1],
    });
  }
  return out.sort((a, b) => b.usadas / b.limite - a.usadas / a.limite);
}

/** Dias entre a data e hoje — idade da justificativa parada na fila da RHiD. */
export function idadeEmDias(data: string, hoje: string): number {
  const d = Date.parse(`${data}T00:00:00Z`);
  const h = Date.parse(`${hoje}T00:00:00Z`);
  if (Number.isNaN(d) || Number.isNaN(h)) return 0;
  return Math.max(0, Math.round((h - d) / 86_400_000));
}
