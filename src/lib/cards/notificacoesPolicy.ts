/** @module-kind pure */
/**
 * Regras puras de quem recebe notificação para cada evento de card.
 *
 * A criação efetiva é feita por trigger no banco (ver migration H5),
 * mas esta lib espelha a mesma regra para uso no cliente (preview de
 * comportamento, testes e futura central de "quem foi notificado").
 */

export type EventoNotificacao =
  | { tipo: "comentario"; autorId: string | null; mencionadosIds: string[] }
  | { tipo: "mencao"; autorId: string | null; mencionadosIds: string[] }
  | {
      tipo: "responsavel";
      autorId: string | null;
      novoResponsavelId: string | null;
      antigoResponsavelId: string | null;
    };

export interface ContextoCard {
  responsavelId: string | null;
}

/**
 * Retorna o conjunto (sem duplicatas) de usuários que devem receber
 * notificação para o evento. Regras:
 *  - comentário: notifica responsável (≠ autor) + cada mencionado (≠ autor, ≠ responsável).
 *  - menção: notifica cada mencionado distinto do autor.
 *  - responsável: notifica novoResponsavel (≠ ator atual, ≠ antigo).
 */
export function destinatariosNotificacao(
  ev: EventoNotificacao,
  card: ContextoCard,
): { userId: string; tipo: "comentario" | "mencao" | "responsavel" }[] {
  const out: { userId: string; tipo: "comentario" | "mencao" | "responsavel" }[] = [];
  const visto = new Set<string>();
  const push = (
    userId: string | null | undefined,
    tipo: "comentario" | "mencao" | "responsavel",
  ) => {
    if (!userId) return;
    const key = `${tipo}:${userId}`;
    if (visto.has(key)) return;
    visto.add(key);
    out.push({ userId, tipo });
  };

  if (ev.tipo === "comentario") {
    if (card.responsavelId && card.responsavelId !== ev.autorId) {
      push(card.responsavelId, "comentario");
    }
    for (const u of ev.mencionadosIds) {
      if (u === ev.autorId) continue;
      if (u === card.responsavelId) continue;
      push(u, "mencao");
    }
  } else if (ev.tipo === "mencao") {
    for (const u of ev.mencionadosIds) {
      if (u === ev.autorId) continue;
      push(u, "mencao");
    }
  } else if (ev.tipo === "responsavel") {
    if (
      ev.novoResponsavelId &&
      ev.novoResponsavelId !== ev.autorId &&
      ev.novoResponsavelId !== ev.antigoResponsavelId
    ) {
      push(ev.novoResponsavelId, "responsavel");
    }
  }
  return out;
}
