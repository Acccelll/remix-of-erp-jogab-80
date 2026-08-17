/** @module-kind pure */
/**
 * Workflow de Não Conformidades — PRO-007.slice-01
 *
 * Modelo puro (FSM) do ciclo de vida de uma NC com responsável, prazo,
 * tratativa e reinspeção. Sem I/O, sem UI, sem Date.now — decisões
 * de transição recebem `now` explicitamente.
 *
 * Compatível com o `nao_conformidades.status` legado (`aberta`, `em_tratativa`,
 * `resolvida`, `cancelada`), adicionando o estado intermediário
 * `aguardando_reinspecao` (persistido também como `em_tratativa` no banco
 * quando o slice de UI/repositório for encaixado — ver slice-02).
 */

export type NCStatus =
  | "aberta"
  | "em_tratativa"
  | "aguardando_reinspecao"
  | "resolvida"
  | "cancelada";

export type NCReinspecaoResultado = "aprovada" | "reprovada";

export interface NCState {
  status: NCStatus;
  responsavelId: string | null;
  prazoISO: string | null;
  tratativa: string | null;
  reinspecaoResultado: NCReinspecaoResultado | null;
  reinspecionadaEmISO: string | null;
  encerradaEmISO: string | null;
}

export type NCEvent =
  | { type: "atribuir"; responsavelId: string; prazoISO: string; nowISO: string }
  | { type: "registrar_tratativa"; tratativa: string; nowISO: string }
  | { type: "solicitar_reinspecao"; nowISO: string }
  | { type: "reinspecionar"; resultado: NCReinspecaoResultado; nowISO: string }
  | { type: "cancelar"; motivo: string; nowISO: string };

export type NCTransitionError =
  | "transicao-invalida"
  | "responsavel-obrigatorio"
  | "prazo-invalido"
  | "prazo-no-passado"
  | "tratativa-obrigatoria"
  | "sem-tratativa-para-reinspecao";

export type NCTransitionResult =
  | { ok: true; state: NCState }
  | { ok: false; error: NCTransitionError };

export const NC_FINAL_STATES: readonly NCStatus[] = ["resolvida", "cancelada"];

export function createNC(): NCState {
  return {
    status: "aberta",
    responsavelId: null,
    prazoISO: null,
    tratativa: null,
    reinspecaoResultado: null,
    reinspecionadaEmISO: null,
    encerradaEmISO: null,
  };
}

export function isFinal(state: NCState): boolean {
  return NC_FINAL_STATES.includes(state.status);
}

/** Prazo em dias corridos até o vencimento (negativo = vencido). Puro. */
export function diasAteVencimento(state: NCState, nowISO: string): number | null {
  if (!state.prazoISO) return null;
  const prazo = Date.parse(state.prazoISO);
  const now = Date.parse(nowISO);
  if (!Number.isFinite(prazo) || !Number.isFinite(now)) return null;
  const MS = 24 * 60 * 60 * 1000;
  return Math.floor((prazo - now) / MS);
}

export function estaVencida(state: NCState, nowISO: string): boolean {
  if (isFinal(state)) return false;
  const d = diasAteVencimento(state, nowISO);
  return d !== null && d < 0;
}

export function transition(state: NCState, event: NCEvent): NCTransitionResult {
  if (isFinal(state) && event.type !== "cancelar") {
    return { ok: false, error: "transicao-invalida" };
  }

  switch (event.type) {
    case "atribuir": {
      if (state.status !== "aberta" && state.status !== "em_tratativa") {
        return { ok: false, error: "transicao-invalida" };
      }
      const responsavelId = event.responsavelId.trim();
      if (!responsavelId) return { ok: false, error: "responsavel-obrigatorio" };
      const prazo = Date.parse(event.prazoISO);
      const now = Date.parse(event.nowISO);
      if (!Number.isFinite(prazo)) return { ok: false, error: "prazo-invalido" };
      if (Number.isFinite(now) && prazo < now) {
        return { ok: false, error: "prazo-no-passado" };
      }
      return {
        ok: true,
        state: {
          ...state,
          status: "em_tratativa",
          responsavelId,
          prazoISO: event.prazoISO,
        },
      };
    }

    case "registrar_tratativa": {
      if (state.status !== "em_tratativa") {
        return { ok: false, error: "transicao-invalida" };
      }
      const tratativa = event.tratativa.trim();
      if (!tratativa) return { ok: false, error: "tratativa-obrigatoria" };
      return { ok: true, state: { ...state, tratativa } };
    }

    case "solicitar_reinspecao": {
      if (state.status !== "em_tratativa") {
        return { ok: false, error: "transicao-invalida" };
      }
      if (!state.tratativa) return { ok: false, error: "sem-tratativa-para-reinspecao" };
      return { ok: true, state: { ...state, status: "aguardando_reinspecao" } };
    }

    case "reinspecionar": {
      if (state.status !== "aguardando_reinspecao") {
        return { ok: false, error: "transicao-invalida" };
      }
      if (event.resultado === "aprovada") {
        return {
          ok: true,
          state: {
            ...state,
            status: "resolvida",
            reinspecaoResultado: "aprovada",
            reinspecionadaEmISO: event.nowISO,
            encerradaEmISO: event.nowISO,
          },
        };
      }
      return {
        ok: true,
        state: {
          ...state,
          status: "em_tratativa",
          reinspecaoResultado: "reprovada",
          reinspecionadaEmISO: event.nowISO,
        },
      };
    }

    case "cancelar": {
      if (isFinal(state)) return { ok: false, error: "transicao-invalida" };
      const motivo = event.motivo.trim();
      if (!motivo) return { ok: false, error: "tratativa-obrigatoria" };
      return {
        ok: true,
        state: {
          ...state,
          status: "cancelada",
          tratativa: state.tratativa ?? motivo,
          encerradaEmISO: event.nowISO,
        },
      };
    }
  }
}
