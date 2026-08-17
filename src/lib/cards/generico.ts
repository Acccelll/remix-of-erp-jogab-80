/** @module-kind pure */
/**
 * Conjunto de status do card genérico (colunas do Quadro Geral).
 * Familiar ao Trello: aberto → em andamento → aguardando → concluído.
 * Cards arquivados (`arquivado=true`) não aparecem no board.
 */
export const STATUS_GENERICO = [
  { key: "aberto", label: "Aberto" },
  { key: "em_andamento", label: "Em andamento" },
  { key: "aguardando", label: "Aguardando" },
  { key: "concluido", label: "Concluído" },
] as const;

export type StatusGenerico = (typeof STATUS_GENERICO)[number]["key"];

export const STATUS_GENERICO_KEYS = STATUS_GENERICO.map((s) => s.key) as StatusGenerico[];

export function isStatusGenerico(s: string): s is StatusGenerico {
  return (STATUS_GENERICO_KEYS as string[]).includes(s);
}

/**
 * Deriva o status genérico do card a partir da coluna do quadro.
 * Prioriza `estado_operacional` (mapeamento explícito da lista); caindo
 * para heurística sobre o nome da coluna. Retorna null quando não há
 * correspondência clara (não altera o status do card nesse caso).
 */
export function statusDaLista(lista: {
  nome?: string | null;
  estado_operacional?: string | null;
}): StatusGenerico | null {
  const explicito = (lista.estado_operacional ?? "").trim().toLowerCase();
  if (explicito && isStatusGenerico(explicito)) return explicito;

  const nome = (lista.nome ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
  if (!nome) return null;

  if (/(concl|final|feito|done|entregue|pronto|encerrad)/.test(nome)) return "concluido";
  if (/(aguard|espera|pausad|bloquead|impedid|hold|parad|revis|aprova)/.test(nome))
    return "aguardando";
  if (/(andamento|fazendo|executand|em curso|doing|progress|producao|processo)/.test(nome))
    return "em_andamento";
  if (/(a fazer|afazer|backlog|todo|to do|novo|aberto|entrada|ideia|pendente)/.test(nome))
    return "aberto";
  return null;
}
