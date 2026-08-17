/** @module-kind pure */
/**
 * Calcula alertas de prazo para os cards de recurso a partir das datas
 * já gravadas em `card_recursos` (sem fetch). Função pura.
 *
 * Critérios (em dias corridos a partir de `hoje`):
 *  - vencido:  prazo < 0
 *  - urgente:  0 <= prazo <= 3
 *  - proximo:  4 <= prazo <= 7
 *  - ok:       prazo > 7
 *
 * Considera os dois trilhos do manufaturado (`prazo_notif_compras` e
 * `prazo_notif_producao`). Para tipos simples, só Compras.
 *
 * Cards `concluido` são ignorados.
 */

export type Severidade = "vencido" | "urgente" | "proximo" | "ok";

export interface AlertaInput {
  card_id: string;
  numero: number;
  titulo: string;
  obra_id: string | null;
  tipo_recurso: string;
  status_card: string | null | undefined;
  prazo_notif_compras: string | null;
  prazo_notif_producao: string | null;
}

export interface AlertaSaida {
  card_id: string;
  numero: number;
  titulo: string;
  obra_id: string | null;
  tipo_recurso: string;
  /** "Compras" | "Producao" — qual trilho disparou o pior caso */
  trilho: "Compras" | "Producao";
  prazo: string;
  dias: number;
  severidade: Severidade;
}

function diasUtc(iso: string, hojeMs: number): number {
  const d = new Date(iso + "T00:00:00Z").getTime();
  return Math.round((d - hojeMs) / 86_400_000);
}

function severidadeDe(dias: number): Severidade {
  if (dias < 0) return "vencido";
  if (dias <= 3) return "urgente";
  if (dias <= 7) return "proximo";
  return "ok";
}

const ORDEM: Record<Severidade, number> = {
  vencido: 0,
  urgente: 1,
  proximo: 2,
  ok: 3,
};

/** Hoje em UTC à meia-noite, para diff por dia corrido sem timezone. */
export function hojeUtcMs(now: Date = new Date()): number {
  return Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
}

/**
 * Retorna o pior trilho de cada card (mais severo). Cards concluídos são
 * filtrados. Saída ordenada por severidade -> dias asc.
 */
export function calcularAlertasPrazo(
  cards: readonly AlertaInput[],
  agora: Date = new Date(),
): AlertaSaida[] {
  const hMs = hojeUtcMs(agora);
  const out: AlertaSaida[] = [];

  for (const c of cards) {
    if (c.status_card === "concluido") continue;
    const candidatos: AlertaSaida[] = [];
    if (c.prazo_notif_compras) {
      const dias = diasUtc(c.prazo_notif_compras, hMs);
      candidatos.push({
        card_id: c.card_id,
        numero: c.numero,
        titulo: c.titulo,
        obra_id: c.obra_id,
        tipo_recurso: c.tipo_recurso,
        trilho: "Compras",
        prazo: c.prazo_notif_compras,
        dias,
        severidade: severidadeDe(dias),
      });
    }
    if (c.prazo_notif_producao && c.tipo_recurso === "manufaturado") {
      const dias = diasUtc(c.prazo_notif_producao, hMs);
      candidatos.push({
        card_id: c.card_id,
        numero: c.numero,
        titulo: c.titulo,
        obra_id: c.obra_id,
        tipo_recurso: c.tipo_recurso,
        trilho: "Producao",
        prazo: c.prazo_notif_producao,
        dias,
        severidade: severidadeDe(dias),
      });
    }
    if (candidatos.length === 0) continue;
    // pior trilho do card
    candidatos.sort((a, b) => ORDEM[a.severidade] - ORDEM[b.severidade] || a.dias - b.dias);
    out.push(candidatos[0]);
  }

  out.sort((a, b) => ORDEM[a.severidade] - ORDEM[b.severidade] || a.dias - b.dias);
  return out;
}

export function contarPorSeveridade(alertas: readonly AlertaSaida[]) {
  const c = { vencido: 0, urgente: 0, proximo: 0, ok: 0 };
  for (const a of alertas) c[a.severidade] += 1;
  return c;
}
