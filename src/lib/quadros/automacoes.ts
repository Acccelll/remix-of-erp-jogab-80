/** @module-kind io */
/**
 * PRO-027 · Motor mínimo de automações de Board.
 *
 * Persistência local por board (localStorage). Regras declarativas com
 * um único gatilho suportado no slice-01: `card_movido_para_lista`.
 * Ação suportada: `notificar` (mensagem via toast no chamador).
 *
 * A execução é feita em `runOnMove` — pura, sem I/O — e devolve a lista
 * de ações efetivas para o chamador executar (toast, futuras integrações).
 * Isso mantém o motor testável em Node/Vitest sem dependência de UI.
 */

export type AutomacaoGatilho =
  | { tipo: "card_movido_para_lista"; listaId: string }
  | { tipo: "card_vencendo"; diasAntes: number };
export type AutomacaoAcao =
  | { tipo: "notificar"; mensagem: string }
  | { tipo: "adicionar_label"; labelId: string; labelNome?: string };



export interface Automacao {
  id: string;
  boardId: string;
  ativa: boolean;
  nome: string;
  gatilho: AutomacaoGatilho;
  acoes: AutomacaoAcao[];
  criadaEm: string;
}

/**
 * ETAPA 1 — as automações passaram a viver em `board_automacoes` (banco).
 * O acesso a `localStorage` abaixo é mantido **apenas** como origem da migração
 * única executada por `useBoardAutomacoes`. Não use para leitura/escrita nova.
 */
export const LEGACY_AUTOMACOES_STORAGE_KEY = "gestaobra:board:automacoes";

/** Lê as regras legadas do navegador (somente migração). */
export function lerAutomacoesLegado(): Automacao[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(LEGACY_AUTOMACOES_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as Automacao[]) : [];
  } catch {
    return [];
  }
}


/**
 * Avalia regras aplicáveis quando um card muda de lista e devolve as
 * ações a executar. Puro e determinístico — chamador roda os efeitos.
 */
export function runOnMove(
  automacoes: Automacao[],
  ctx: { boardId: string; cardId: string; listaDestinoId: string },
): AutomacaoAcao[] {
  return automacoes
    .filter(
      (a) =>
        a.ativa &&
        a.boardId === ctx.boardId &&
        a.gatilho.tipo === "card_movido_para_lista" &&
        a.gatilho.listaId === ctx.listaDestinoId,
    )
    .flatMap((a) => a.acoes);
}

/**
 * Avalia regras `card_vencendo` para uma lista de cards com `data_fim`.
 * Devolve, por regra x card, as ações a executar. Puro e determinístico.
 * `hoje` (YYYY-MM-DD) é injetado para facilitar teste.
 */
export interface CardVencivel {
  id: string;
  titulo?: string;
  data_fim: string | null; // YYYY-MM-DD
}

export interface AcaoAgendada {
  cardId: string;
  regraId: string;
  acao: AutomacaoAcao;
}

export function runOnVencimento(
  automacoes: Automacao[],
  cards: CardVencivel[],
  ctx: { boardId: string; hoje: string },
): AcaoAgendada[] {
  const out: AcaoAgendada[] = [];
  const hojeMs = Date.parse(ctx.hoje);
  if (Number.isNaN(hojeMs)) return out;
  for (const r of automacoes) {
    if (!r.ativa || r.boardId !== ctx.boardId) continue;
    if (r.gatilho.tipo !== "card_vencendo") continue;
    const dias = r.gatilho.diasAntes;
    for (const c of cards) {
      if (!c.data_fim) continue;
      const fimMs = Date.parse(c.data_fim);
      if (Number.isNaN(fimMs)) continue;
      const delta = Math.round((fimMs - hojeMs) / 86400000);
      if (delta <= dias) {
        for (const acao of r.acoes) out.push({ cardId: c.id, regraId: r.id, acao });
      }
    }
  }
  return out;
}

/**
 * Presets de regras por template de quadro. Retorna regras já
 * materializadas (sem `id`/`criadaEm`) — o chamador finaliza e persiste.
 */
export type PresetRegra = Omit<Automacao, "id" | "boardId" | "criadaEm">;

export function presetsForTemplate(templateId: string): PresetRegra[] {
  switch (templateId) {
    case "obras":
    case "obra":
      return [
        {
          ativa: true,
          nome: "Aviso quando entrar em Bloqueado",
          gatilho: { tipo: "card_movido_para_lista", listaId: "" },
          acoes: [{ tipo: "notificar", mensagem: "Card bloqueado — verificar impedimento." }],
        },
        {
          ativa: true,
          nome: "Alerta 3 dias antes do vencimento",
          gatilho: { tipo: "card_vencendo", diasAntes: 3 },
          acoes: [{ tipo: "notificar", mensagem: "Card vence em até 3 dias." }],
        },
      ];
    case "crm":
      return [
        {
          ativa: true,
          nome: "Follow-up hoje",
          gatilho: { tipo: "card_vencendo", diasAntes: 0 },
          acoes: [{ tipo: "notificar", mensagem: "Follow-up devido hoje." }],
        },
      ];
    default:
      return [
        {
          ativa: true,
          nome: "Aviso ao entrar em Concluído",
          gatilho: { tipo: "card_movido_para_lista", listaId: "" },
          acoes: [{ tipo: "notificar", mensagem: "Card concluído." }],
        },
      ];
  }
}
