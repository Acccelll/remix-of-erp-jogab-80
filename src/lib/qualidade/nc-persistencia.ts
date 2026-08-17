/** @module-kind pure */
/**
 * Mappers puros NC → linha de `restricoes` (M4) e `cards` (M2).
 * PRO-008.slice-02
 *
 * Complementa `nc-derivados.ts` transformando os payloads canônicos em
 * linhas prontas para persistência e calculando `diff` para escrever apenas
 * o que mudou (evita sobrescrever campos alheios em upserts idempotentes).
 *
 * Sem I/O, sem UI. As slices seguintes (04) usam estes mappers dentro do
 * repositório para aplicar `ensureFromNC(ncId)`.
 */

import type { CardPayload, RestricaoPayload } from "@/lib/qualidade/nc-derivados";

/* ---------------- Restricoes ---------------- */

export interface RestricaoRow {
  id?: string;
  obra_id: string | null;
  tipo: string;
  descricao: string;
  responsavel_id: string | null;
  prazo: string | null;
  status: string;
  origem_tipo?: string | null;
  origem_id?: string | null;
}

export function restricaoToRow(payload: RestricaoPayload): Omit<RestricaoRow, "id"> {
  return {
    obra_id: payload.obra_id,
    tipo: payload.tipo,
    descricao: payload.descricao,
    responsavel_id: payload.responsavel_id,
    prazo: payload.prazo,
    status: payload.status,
    origem_tipo: payload.origem_tipo,
    origem_id: payload.origem_id,
  };
}

export function diffRestricao(
  before: Partial<RestricaoRow> | null | undefined,
  after: Omit<RestricaoRow, "id">,
): Partial<RestricaoRow> {
  const patch: Partial<RestricaoRow> = {};
  const b = (before ?? {}) as Partial<RestricaoRow>;
  (Object.keys(after) as Array<keyof typeof after>).forEach((k) => {
    if ((b as any)[k] !== (after as any)[k]) (patch as any)[k] = (after as any)[k];
  });
  return patch;
}

/* ---------------- Cards ---------------- */

export interface CardRow {
  id?: string;
  tipo: string;
  titulo: string;
  descricao: string | null;
  obra_id: string | null;
  responsavel_id: string | null;
  prazo: string | null;
  status: string;
  arquivado: boolean;
  origem_externa: string | null;
  origem_id: string | null;
}

export function cardToRow(payload: CardPayload): Omit<CardRow, "id"> {
  return {
    tipo: payload.tipo,
    titulo: payload.titulo,
    descricao: payload.descricao,
    obra_id: payload.obra_id,
    responsavel_id: payload.responsavel_id,
    prazo: payload.prazo,
    status: payload.status,
    arquivado: payload.arquivado,
    origem_externa: payload.origem_externa,
    origem_id: payload.origem_id,
  };
}

/**
 * Diff conservador: só sobrescreve campos considerados "derivados da NC".
 * Título, descrição livre, posição, capa, etc. do card podem ser editados
 * manualmente pelo usuário e NÃO devem ser sobrescritos pelo espelhamento
 * automático — exceto quando são vazios (primeira criação).
 */
export const CARD_CAMPOS_DERIVADOS: Array<keyof Omit<CardRow, "id">> = [
  "tipo",
  "obra_id",
  "responsavel_id",
  "prazo",
  "status",
  "arquivado",
  "origem_externa",
  "origem_id",
];

export function diffCard(
  before: Partial<CardRow> | null | undefined,
  after: Omit<CardRow, "id">,
  campos: Array<keyof Omit<CardRow, "id">> = CARD_CAMPOS_DERIVADOS,
): Partial<CardRow> {
  const patch: Partial<CardRow> = {};
  const b = (before ?? {}) as Partial<CardRow>;
  const isNew = !before || Object.keys(b).length === 0;
  const alvos = isNew ? (Object.keys(after) as Array<keyof typeof after>) : campos;
  alvos.forEach((k) => {
    if ((b as any)[k] !== (after as any)[k]) (patch as any)[k] = (after as any)[k];
  });
  return patch;
}
