/** @module-kind pure */
/**
 * Agrega os marcos da cascata de prazos por linha do cronograma.
 *
 * Função pura, sem I/O. Para cada linha, consolida os cards ativos
 * vinculados e retorna a data mais cedo de cada marco (a mais
 * "urgente") junto com a severidade pior caso, reaproveitando os
 * critérios de `alertas-prazo.ts`.
 *
 * Marcos considerados:
 *   - notif_compras   (prazo_notif_compras)
 *   - pedido          (prazo_pedido)
 *   - prod_iniciar    (prazo_prod_iniciar)        — manufaturado
 *   - notif_producao  (prazo_notif_producao)      — manufaturado
 *   - necessidade     (data_necessidade_obra)
 */

import { hojeUtcMs, type Severidade } from "./alertas-prazo";

export type MarcoKind =
  "notif_compras" | "pedido" | "prod_iniciar" | "notif_producao" | "necessidade";

export interface CardCascataInput {
  card_id: string;
  numero?: string | number | null;
  titulo?: string | null;
  status_card: string | null | undefined;
  arquivado?: boolean | null;
  tipo_recurso: string;
  prazo_notif_compras: string | null;
  prazo_pedido: string | null;
  prazo_prod_iniciar: string | null;
  prazo_notif_producao: string | null;
  data_necessidade_obra: string | null;
}

export interface CascataFonte {
  card_id: string;
  numero?: string | number | null;
  titulo?: string | null;
}

export interface Marco {
  kind: MarcoKind;
  /** ISO yyyy-mm-dd */
  data: string;
  /** Dias corridos a partir de hoje (UTC). Negativo = passado. */
  dias: number;
  severidade: Severidade;
  /** Cards que originaram a data consolidada deste marco. */
  fontes: CascataFonte[];
}

export interface CascataLinha {
  /** Hoje em ISO (yyyy-mm-dd) — referência da linha. */
  hoje: string;
  /** Data final visível (data de necessidade ou marco mais futuro). */
  fim: string;
  marcos: Marco[];
}

const ORDEM: Record<Severidade, number> = {
  vencido: 0,
  urgente: 1,
  proximo: 2,
  ok: 3,
};

function severidadeDe(dias: number): Severidade {
  if (dias < 0) return "vencido";
  if (dias <= 3) return "urgente";
  if (dias <= 7) return "proximo";
  return "ok";
}

function diasUtc(iso: string, hojeMs: number): number {
  const d = new Date(iso + "T00:00:00Z").getTime();
  return Math.round((d - hojeMs) / 86_400_000);
}

function isoUtc(ms: number): string {
  const d = new Date(ms);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

/**
 * Para um conjunto de cards de uma mesma linha, devolve a cascata
 * consolidada (1 marcador por tipo, com a data mais cedo entre os
 * cards). Retorna `null` quando não há nenhum marco utilizável.
 */
export function calcularCascataLinha(
  cards: readonly CardCascataInput[],
  agora: Date = new Date(),
): CascataLinha | null {
  const hMs = hojeUtcMs(agora);
  const ativos = cards.filter((c) => !c.arquivado && c.status_card !== "concluido");
  if (ativos.length === 0) return null;

  const earliest = new Map<MarcoKind, { data: string; fontes: CascataFonte[] }>();

  function fonteDe(card: CardCascataInput): CascataFonte {
    return { card_id: card.card_id, numero: card.numero ?? null, titulo: card.titulo ?? null };
  }

  function consider(card: CardCascataInput, kind: MarcoKind, iso: string | null | undefined) {
    if (!iso) return;
    const prev = earliest.get(kind);
    const fonte = fonteDe(card);
    if (!prev || iso < prev.data) {
      earliest.set(kind, { data: iso, fontes: [fonte] });
      return;
    }
    if (iso === prev.data && !prev.fontes.some((f) => f.card_id === fonte.card_id)) {
      prev.fontes.push(fonte);
    }
  }

  for (const c of ativos) {
    consider(c, "notif_compras", c.prazo_notif_compras);
    consider(c, "pedido", c.prazo_pedido);
    consider(c, "necessidade", c.data_necessidade_obra);
    if (c.tipo_recurso === "manufaturado") {
      consider(c, "prod_iniciar", c.prazo_prod_iniciar);
      consider(c, "notif_producao", c.prazo_notif_producao);
    }
  }

  if (earliest.size === 0) return null;

  const marcos: Marco[] = [];
  for (const [kind, { data, fontes }] of earliest) {
    const dias = diasUtc(data, hMs);
    marcos.push({ kind, data, dias, severidade: severidadeDe(dias), fontes });
  }
  marcos.sort((a, b) => (a.data < b.data ? -1 : a.data > b.data ? 1 : 0));

  // Janela visível: do hoje (ou marco mais antigo, o que for menor)
  // até a data de necessidade (ou marco mais tardio).
  const hojeIso = isoUtc(hMs);
  const fim = marcos[marcos.length - 1].data;

  return { hoje: hojeIso, fim, marcos };
}

/**
 * Severidade pior caso da linha (útil para ordenar/colorir badges).
 */
export function piorSeveridade(linha: CascataLinha): Severidade {
  let pior: Severidade = "ok";
  for (const m of linha.marcos) {
    if (ORDEM[m.severidade] < ORDEM[pior]) pior = m.severidade;
  }
  return pior;
}

export const MARCO_LABEL: Record<MarcoKind, string> = {
  notif_compras: "Notif. Compras",
  pedido: "Pedido",
  prod_iniciar: "Início produção",
  notif_producao: "Notif. Produção",
  necessidade: "Necessidade",
};
