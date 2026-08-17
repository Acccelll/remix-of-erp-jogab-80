/** @module-kind pure */
/**
 * Mapper entre `NCState` (workflow FSM — PRO-007.slice-01) e a linha
 * persistida em `public.nao_conformidades` — PRO-007.slice-02.
 *
 * Regras de compatibilidade retroativa:
 * - `status` legado só aceita `aberta | em_tratativa | resolvida | cancelada`;
 *   `aguardando_reinspecao` do FSM é persistido como `em_tratativa` +
 *   flag `aguardando_reinspecao=true` na coluna auxiliar materializada em
 *   `PRO-007.slice-03`.
 * - Datas persistidas em ISO 8601; workflow lê/escreve sem `Date.now`.
 * - Mapper puro: sem I/O, sem Supabase, sem `Date.now`.
 */

import type { NCState, NCStatus } from "./nc-workflow";

export type NCStatusPersistido =
  | "aberta"
  | "em_tratativa"
  | "resolvida"
  | "cancelada";

export interface NCRow {
  status: NCStatusPersistido;
  responsavel_id: string | null;
  prazo: string | null;
  tratativa: string | null;
  reinspecao_resultado: "aprovada" | "reprovada" | null;
  reinspecionada_em: string | null;
  encerrada_em: string | null;
  aguardando_reinspecao: boolean;
}

const FSM_TO_LEGACY: Record<NCStatus, NCStatusPersistido> = {
  aberta: "aberta",
  em_tratativa: "em_tratativa",
  aguardando_reinspecao: "em_tratativa",
  resolvida: "resolvida",
  cancelada: "cancelada",
};

export function toRow(state: NCState): NCRow {
  return {
    status: FSM_TO_LEGACY[state.status],
    responsavel_id: state.responsavelId,
    prazo: state.prazoISO,
    tratativa: state.tratativa,
    reinspecao_resultado: state.reinspecaoResultado,
    reinspecionada_em: state.reinspecionadaEmISO,
    encerrada_em: state.encerradaEmISO,
    aguardando_reinspecao: state.status === "aguardando_reinspecao",
  };
}

export function fromRow(row: Partial<NCRow>): NCState {
  const legacy = (row.status ?? "aberta") as NCStatusPersistido;
  const aguardando = row.aguardando_reinspecao === true;
  const status: NCStatus =
    legacy === "em_tratativa" && aguardando ? "aguardando_reinspecao" : legacy;
  return {
    status,
    responsavelId: row.responsavel_id ?? null,
    prazoISO: row.prazo ?? null,
    tratativa: row.tratativa ?? null,
    reinspecaoResultado: row.reinspecao_resultado ?? null,
    reinspecionadaEmISO: row.reinspecionada_em ?? null,
    encerradaEmISO: row.encerrada_em ?? null,
  };
}

/** Diff mínimo para `UPDATE`: só as colunas alteradas em relação ao anterior. */
export function diffRow(before: NCState, after: NCState): Partial<NCRow> {
  const b = toRow(before);
  const a = toRow(after);
  const patch: Partial<NCRow> = {};
  (Object.keys(a) as (keyof NCRow)[]).forEach((k) => {
    if (b[k] !== a[k]) (patch as Record<string, unknown>)[k] = a[k];
  });
  return patch;
}
