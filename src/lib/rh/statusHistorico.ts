/** @module-kind pure */
/**
 * Classificação de eventos de status no histórico do colaborador (aba Histórico →
 * "Outros eventos"). Apenas apresentação: converte a descrição textual gravada
 * em `historico[].descricao` num rótulo + tom de badge.
 */

export type StatusTone = "success" | "info" | "warning" | "destructive" | "muted";

export interface EventoStatus {
  label: string;
  tone: StatusTone;
  origem?: string;
  destino?: string;
}

const norm = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

/**
 * Rótulo/tom de um status de alocação. Aceita tanto o vocabulário do banco
 * (`ferias`, `sem_alocacao`) quanto rótulos por extenso vindos de prosa legada
 * ("Sem Alocação") e ids de coluna com underscores (`__ferias__`).
 */
export function rotuloStatus(destino: string): { label: string; tone: StatusTone } {
  switch (norm(destino).replace(/^__|__$/g, "")) {
    case "ferias":
      return { label: "Férias", tone: "info" };
    case "folga":
      return { label: "Folga", tone: "info" };
    case "afastamento":
      return { label: "Afastamento", tone: "warning" };
    case "sem_alocacao":
    case "sem alocacao":
    case "sem alocação":
      return { label: "Sem alocação", tone: "info" };
    case "indeterminado":
      // Movimentação anterior ao log tipado: consta que saiu da obra, mas o
      // destino nunca foi gravado. Melhor dizer isso do que inventar um status.
      return { label: "Saiu da obra", tone: "muted" };
    // Vocabulário de patrimônio. Não colide com o de colaborador, então as duas
    // famílias convivem na mesma função em vez de duplicá-la.
    case "manutencao":
    case "em manutencao":
      return { label: "Em manutenção", tone: "warning" };
    case "sujo":
      return { label: "Sujo", tone: "warning" };
    // Vocabulário de contrato: alocação (ocioso) e situação contratual.
    case "ocioso":
      return { label: "Ocioso", tone: "info" };
    case "rascunho":
      return { label: "Rascunho", tone: "muted" };
    case "ativo":
      return { label: "Ativo", tone: "success" };
    case "suspenso":
      return { label: "Suspenso", tone: "warning" };
    case "encerrado":
      return { label: "Encerrado", tone: "muted" };
    case "inadimplente":
      return { label: "Inadimplente", tone: "destructive" };
    default:
      return { label: "Alocado", tone: "success" };
  }
}

/** Evento tipado do histórico, no formato devolvido pelo api.php. */
export interface EventoHistorico {
  tipo?: string;
  obraOrigemNome?: string | null;
  obraDestinoNome?: string | null;
  statusOrigem?: string | null;
  statusDestino?: string | null;
  /** Nome do colaborador responsável, quando `tipo === "responsavel"`. */
  colaboradorNome?: string | null;
  observacao?: string | null;
  descricao?: string;
}

/**
 * Classifica um evento do histórico usando os campos estruturados. Cai na
 * leitura da prosa apenas para eventos sem tipagem — o que só acontece em banco
 * anterior à migração de eventos tipados.
 *
 * Retorna `null` quando não há nada a rotular (ex.: "Colaborador cadastrado").
 */
export function classificarEvento(evento: EventoHistorico): EventoStatus | null {
  const { tipo, statusOrigem, statusDestino, obraOrigemNome, obraDestinoNome } = evento;

  if (tipo === "status" || tipo === "mobilizacao") {
    // Origem e destino podem ser obra ou status — o par é sempre resolvido
    // pelos ids/nomes, nunca por regex sobre a descrição.
    const origem = obraOrigemNome ?? (statusOrigem ? rotuloStatus(statusOrigem).label : null);
    const destino = obraDestinoNome ?? (statusDestino ? rotuloStatus(statusDestino).label : null);
    const { label, tone } = obraDestinoNome
      ? { label: "Alocado", tone: "success" as StatusTone }
      : rotuloStatus(statusDestino ?? "");
    return {
      label,
      tone,
      origem: origem ?? "Sem alocação",
      destino: destino ?? "Sem alocação",
    };
  }

  if (tipo === "responsavel") {
    // Transferência de patrimônio para um colaborador. A origem pode ser uma
    // obra, um status ou outro responsável.
    const origem =
      obraOrigemNome ?? (statusOrigem ? rotuloStatus(statusOrigem).label : null) ?? "Sem alocação";
    return {
      label: "Responsável",
      tone: "info",
      origem,
      destino: evento.colaboradorNome ?? "Responsável",
    };
  }

  if (tipo === "status_contrato") {
    // Situação contratual: o rótulo é o próprio destino, e a origem só aparece
    // quando conhecida (contratos antigos não têm o status anterior gravado).
    const { label, tone } = rotuloStatus(statusDestino ?? "");
    return {
      label,
      tone,
      origem: statusOrigem ? rotuloStatus(statusOrigem).label : undefined,
      destino: statusDestino ? label : undefined,
    };
  }

  if (tipo === "inativacao") return { label: "Inativo", tone: "destructive" };
  if (tipo === "reativacao") return { label: "Ativo", tone: "success" };

  // `outro`: programação/cancelamento de inativação e afins, descritos em texto.
  if (evento.observacao || evento.descricao) {
    return classificarEventoStatus(evento.observacao || evento.descricao || "");
  }
  return null;
}

/**
 * Classifica a descrição de um evento de histórico. Retorna `null` quando o
 * texto não corresponde a nenhuma transição de status conhecida.
 *
 * Usado para eventos de texto livre (`tipo: "outro"`) e como caminho de
 * compatibilidade com bancos anteriores ao log tipado.
 */
export function classificarEventoStatus(descricao: string): EventoStatus | null {
  if (!descricao) return null;
  const d = descricao.trim();
  const n = norm(d);

  // "Status alterado de "X" para "Y" em dd/mm/yyyy"
  const transicao = d.match(/status alterado de\s+"?(.+?)"?\s+para\s+"?(.+?)"?(?:\s+em\s+.*)?$/i);
  if (transicao) {
    const origem = transicao[1].trim();
    const destino = transicao[2].trim();
    const { label, tone } = rotuloStatus(destino);
    return { label, tone, origem, destino };
  }

  if (n.startsWith("inativacao programada cancelada")) {
    return { label: "Cancelado", tone: "muted" };
  }
  if (n.startsWith("inativacao programada")) {
    return { label: "Programado", tone: "warning" };
  }
  if (n.startsWith("status alterado para inativo") || n === "inativado") {
    return { label: "Inativo", tone: "destructive" };
  }
  if (n.startsWith("status alterado para ativo") || n === "reativado") {
    return { label: "Ativo", tone: "success" };
  }

  return null;
}

/** Status atual do colaborador, para o resumo no cabeçalho da seção. */
export function statusAtualColaborador(colab: {
  ativo?: boolean;
  dataInativacao?: string | null;
  statusEspecial?: string | null;
}): { label: string; tone: StatusTone } {
  if (!colab.ativo) return { label: "Inativo", tone: "destructive" };
  if (colab.dataInativacao) return { label: "Inativação programada", tone: "warning" };
  if (colab.statusEspecial) return rotuloStatus(String(colab.statusEspecial));
  return { label: "Ativo", tone: "success" };
}

export const STATUS_TONE_CLASSES: Record<StatusTone, string> = {
  muted: "bg-muted text-muted-foreground border-transparent",
  info: "bg-[color:var(--info)]/15 text-[color:var(--info)] border-[color:var(--info)]/20",
  success:
    "bg-[color:var(--success)]/15 text-[color:var(--success)] border-[color:var(--success)]/20",
  warning:
    "bg-[color:var(--warning)]/20 text-[color:var(--warning-foreground)] border-[color:var(--warning)]/30 dark:text-[color:var(--warning)]",
  destructive: "bg-destructive/15 text-destructive border-destructive/20",
};

export const STATUS_DOT_CLASSES: Record<StatusTone, string> = {
  muted: "bg-muted-foreground",
  info: "bg-[color:var(--info)]",
  success: "bg-[color:var(--success)]",
  warning: "bg-[color:var(--warning)]",
  destructive: "bg-destructive",
};
