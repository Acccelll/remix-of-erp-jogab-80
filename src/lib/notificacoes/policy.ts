/** @module-kind pure */
/**
 * Regras puras de entrega das notificações dirigidas a um usuário.
 *
 * Genérico em `T` de propósito: mantém este módulo sem importar nada de
 * `@/lib/notificacoes` (que é `io`), evitando ciclo de import e deixando
 * explícito o mínimo de que cada regra depende.
 */

/** Normaliza id vindo do MySQL, que chega ora como number, ora como string. */
function idStr(v: string | number | null | undefined): string {
  return v === null || v === undefined ? "" : String(v).trim();
}

/**
 * Quem criou a solicitação deve ser avisado de um comentário novo?
 *
 * Só quando há criador identificado (solicitações antigas têm `criado_por`
 * nulo) e ele não é o próprio autor do comentário — ninguém quer ser
 * notificado da própria ação.
 */
export function deveNotificarCriador(
  criadoPor: string | number | null | undefined,
  autorId: string | number | null | undefined,
): boolean {
  const criador = idStr(criadoPor);
  if (!criador) return false;
  return criador !== idStr(autorId);
}

/**
 * Une as notificações vindas por setor com as dirigidas ao usuário.
 *
 * O dedupe por `id` é o que garante uma única entrada no sino para quem é
 * criador da solicitação E também pertence ao setor avisado (o caso do GM, que
 * enxerga os dois escopos). Ordena por `created_at` desc — a ordem que o sino
 * exibe — sem mutar as listas recebidas.
 */
export function mesclarNotificacoes<T extends { id: string; created_at: string }>(
  porEscopo: readonly T[],
  dirigidas: readonly T[],
): T[] {
  const porId = new Map<string, T>();
  for (const n of [...porEscopo, ...dirigidas]) {
    if (!porId.has(n.id)) porId.set(n.id, n);
  }
  return Array.from(porId.values()).sort((a, b) =>
    b.created_at.localeCompare(a.created_at),
  );
}

/**
 * Filtra o que o usuário pode ver por setor.
 *
 * O canal (`role_scope`) diz por qual "caixa" a notificação chega, não a que
 * setor ela pertence — era por isso que um aviso de solicitação do Depto.
 * Pessoal aparecia para quem só cuida de Compras. Agora cada notificação
 * carrega o `setor` da solicitação:
 *  - sem `setor` (registros antigos): continua visível, para não sumir histórico;
 *  - com `setor`: só para quem tem aquele setor concedido (GM vê todos);
 *  - dirigida a mim (`destinatario_id`): sempre passa — é sobre a minha coisa.
 */
export function filtrarNotificacoesPorSetor<
  T extends { setor?: string | null; destinatario_id?: string | null },
>(
  lista: readonly T[],
  opts: { podeVerSetor: (setor: string) => boolean; meusIds?: readonly string[] },
): T[] {
  const meus = new Set((opts.meusIds ?? []).map((v) => idStr(v)).filter(Boolean));
  return lista.filter((n) => {
    if (n.destinatario_id && meus.has(idStr(n.destinatario_id))) return true;
    const setor = idStr(n.setor);
    if (!setor) return true;
    return opts.podeVerSetor(setor);
  });
}

