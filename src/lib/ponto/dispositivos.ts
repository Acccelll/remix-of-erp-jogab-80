/** @module-kind pure */
// Equipamentos REP: normalização do `GET /device` e diagnóstico de saúde.
//
// Existe para responder à pergunta que a Visão Geral não responde: a obra tem
// marcação inválida porque o pessoal esquece de bater, ou porque o relógio está
// mudo há três dias? O `lastConnectionDate` da RHiD dá a resposta e era
// descartado.

/** Dias sem comunicar a partir dos quais o REP vira alerta. */
export const DIAS_REP_ATENCAO = 1;
export const DIAS_REP_CRITICO = 3;

export interface Dispositivo {
  id: number;
  nome: string | null;
  serial: string | null;
  versao: string | null;
  status: string | null;
  statusPapel: string | null;
  idEmpresa: string | null;
  numPessoas: number | null;
  numDigitais: number | null;
  /** Datas em ISO (`YYYY-MM-DD HH:MM:SS`), como o MySQL guarda. */
  ultimaConexao: string | null;
  ultimaSincronizacao: string | null;
}

export type SaudeRep = "ok" | "atencao" | "critico" | "desconhecido";

export const ROTULO_SAUDE: Record<SaudeRep, string> = {
  ok: "Comunicando",
  atencao: "Atrasado",
  critico: "Mudo",
  desconhecido: "Sem informação",
};

function normalizaChave(chave: string): string {
  return chave
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

const ALIASES = {
  id: ["id", "iddevice", "idequipamento"],
  nome: ["name", "nome", "descricao"],
  serial: ["serial", "numeroserie", "nserie"],
  versao: ["version", "versao", "firmware"],
  status: ["status", "situacao"],
  statusPapel: ["statuspapel", "papel", "paperstatus"],
  idEmpresa: ["linkedcompanyid", "idempresa", "idcompany"],
  numPessoas: ["numberofpeople", "numpessoas", "quantidadepessoas"],
  numDigitais: ["numberoffingerprints", "numdigitais", "quantidadedigitais"],
  ultimaConexao: ["lastconnectiondate", "ultimaconexao", "dataultimaconexao"],
  ultimaSincronizacao: ["lastsyncdate", "ultimasincronizacao", "dataultimasincronizacao"],
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

/**
 * Data/hora para o formato que o MySQL aceita em DATETIME.
 * A RHiD manda ISO com `T` (e às vezes `Z`); o driver rejeita o `T`.
 */
export function normalizaDataHora(valor: unknown): string | null {
  const s = texto(valor);
  if (!s) return null;
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?/);
  if (m) return `${m[1]}-${m[2]}-${m[3]} ${m[4]}:${m[5]}:${m[6] ?? "00"}`;
  const soData = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (soData) return `${s} 00:00:00`;
  const br = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:[ ](\d{2}):(\d{2}))?/);
  if (br) {
    const dia = br[1].padStart(2, "0");
    const mes = br[2].padStart(2, "0");
    return `${br[3]}-${mes}-${dia} ${br[4] ?? "00"}:${br[5] ?? "00"}:00`;
  }
  return null;
}

export function normalizarDispositivos(brutos: readonly Record<string, unknown>[]): Dispositivo[] {
  const out: Dispositivo[] = [];
  for (const d of brutos) {
    const id = inteiroOuNulo(buscar(d, ALIASES.id));
    // Sem id não há como fazer upsert nem pedir o AFD do equipamento.
    if (id === null || id <= 0) continue;
    out.push({
      id,
      nome: texto(buscar(d, ALIASES.nome)),
      serial: texto(buscar(d, ALIASES.serial)),
      versao: texto(buscar(d, ALIASES.versao)),
      status: texto(buscar(d, ALIASES.status)),
      statusPapel: texto(buscar(d, ALIASES.statusPapel)),
      idEmpresa: texto(buscar(d, ALIASES.idEmpresa)),
      numPessoas: inteiroOuNulo(buscar(d, ALIASES.numPessoas)),
      numDigitais: inteiroOuNulo(buscar(d, ALIASES.numDigitais)),
      ultimaConexao: normalizaDataHora(buscar(d, ALIASES.ultimaConexao)),
      ultimaSincronizacao: normalizaDataHora(buscar(d, ALIASES.ultimaSincronizacao)),
    });
  }
  return out;
}

/** Dias inteiros desde a última comunicação; `null` quando nunca comunicou. */
export function diasSemComunicar(ultimaConexao: string | null, agoraIso: string): number | null {
  if (!ultimaConexao) return null;
  const ultima = Date.parse(ultimaConexao.replace(" ", "T"));
  const agora = Date.parse(agoraIso.replace(" ", "T"));
  if (Number.isNaN(ultima) || Number.isNaN(agora)) return null;
  return Math.max(0, Math.floor((agora - ultima) / 86_400_000));
}

/**
 * Saúde do REP. Sem data de conexão o estado é `desconhecido`, não `ok`:
 * equipamento que nunca reportou é justamente o mais suspeito.
 */
export function saudeDoRep(ultimaConexao: string | null, agoraIso: string): SaudeRep {
  const dias = diasSemComunicar(ultimaConexao, agoraIso);
  if (dias === null) return "desconhecido";
  if (dias >= DIAS_REP_CRITICO) return "critico";
  if (dias >= DIAS_REP_ATENCAO) return "atencao";
  return "ok";
}
