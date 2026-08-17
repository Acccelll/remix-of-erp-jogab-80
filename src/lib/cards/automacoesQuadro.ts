/** @module-kind pure */

export type QuadroSetor = "Compras" | "Producao";

export interface ContextoMovimentacaoQuadro {
  cardId: string;
  numero: number;
  titulo: string;
  setor: QuadroSetor;
  deStatus: string;
  paraStatus: string;
  tipoRecurso?: string | null;
}

export interface AutomacaoQuadroAcao {
  id: string;
  tipo: "comentario";
  texto: string;
}

export interface RegraAutomacaoQuadro {
  id: string;
  setor: QuadroSetor;
  paraStatus: string;
  titulo: string;
  descricao: string;
  criarAcao: (ctx: ContextoMovimentacaoQuadro) => AutomacaoQuadroAcao;
}

export interface OpcoesAutomacoesQuadro {
  regrasDesativadas?: Iterable<string>;
}

const STATUS_LABEL: Record<string, string> = {
  identificado: "Identificado",
  em_cotacao: "Em cotação",
  pedido_emitido: "Pedido emitido",
  materia_entregue: "Matéria entregue",
  aguardando_material: "Aguardando material",
  em_fabricacao: "Em fabricação",
  produzido: "Produzido",
  entregue_obra: "Entregue à obra",
};

function labelStatus(status: string): string {
  return STATUS_LABEL[status] ?? status;
}

function textoBase(ctx: ContextoMovimentacaoQuadro): string {
  return `Automação do quadro: card #${ctx.numero} movido de “${labelStatus(
    ctx.deStatus,
  )}” para “${labelStatus(ctx.paraStatus)}”.`;
}

export const REGRAS_AUTOMACAO_QUADRO: RegraAutomacaoQuadro[] = [
  {
    id: "compras.pedido_emitido.comentario",
    setor: "Compras",
    paraStatus: "pedido_emitido",
    titulo: "Pedido emitido",
    descricao: "Registra conferência de prazo de entrega e OC/anexos.",
    criarAcao: (ctx) => ({
      id: "compras.pedido_emitido.comentario",
      tipo: "comentario",
      texto: `${textoBase(ctx)} Conferir prazo de entrega e manter a OC/anexos atualizados.`,
    }),
  },
  {
    id: "compras.materia_entregue.comentario",
    setor: "Compras",
    paraStatus: "materia_entregue",
    titulo: "Matéria entregue",
    descricao: "Registra liberação do material para a próxima etapa operacional.",
    criarAcao: (ctx) => ({
      id: "compras.materia_entregue.comentario",
      tipo: "comentario",
      texto: `${textoBase(ctx)} Material liberado para a próxima etapa operacional.`,
    }),
  },
  {
    id: "producao.em_fabricacao.comentario",
    setor: "Producao",
    paraStatus: "em_fabricacao",
    titulo: "Em fabricação",
    descricao: "Registra início de fabricação e controle de restrições.",
    criarAcao: (ctx) => ({
      id: "producao.em_fabricacao.comentario",
      tipo: "comentario",
      texto: `${textoBase(ctx)} Registrar início de fabricação e eventuais restrições no card.`,
    }),
  },
  {
    id: "producao.entregue_obra.comentario",
    setor: "Producao",
    paraStatus: "entregue_obra",
    titulo: "Entregue à obra",
    descricao: "Registra validação de recebimento e reflexo em RDO quando aplicável.",
    criarAcao: (ctx) => ({
      id: "producao.entregue_obra.comentario",
      tipo: "comentario",
      texto: `${textoBase(ctx)} Validar recebimento na obra e refletir a entrega no RDO quando aplicável.`,
    }),
  },
];

export function listarRegrasAutomacaoQuadro(setor?: QuadroSetor): RegraAutomacaoQuadro[] {
  return setor ? REGRAS_AUTOMACAO_QUADRO.filter((regra) => regra.setor === setor) : [...REGRAS_AUTOMACAO_QUADRO];
}

export function normalizarRegrasAutomacaoDesativadas(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const conhecidas = new Set(REGRAS_AUTOMACAO_QUADRO.map((regra) => regra.id));
  return Array.from(new Set(value.filter((id): id is string => typeof id === "string"))).filter(
    (id) => conhecidas.has(id),
  );
}

/**
 * PRO-027 — regras básicas de movimentação → ação por quadro.
 *
 * Mantém a regra pura e determinística: a UI decide como persistir as ações.
 */
export function automacoesMovimentacaoQuadro(
  ctx: ContextoMovimentacaoQuadro,
  opcoes: OpcoesAutomacoesQuadro = {},
): AutomacaoQuadroAcao[] {
  if (ctx.deStatus === ctx.paraStatus) return [];

  const desativadas = new Set(opcoes.regrasDesativadas ?? []);
  return REGRAS_AUTOMACAO_QUADRO.filter(
    (regra) =>
      regra.setor === ctx.setor &&
      regra.paraStatus === ctx.paraStatus &&
      !desativadas.has(regra.id),
  ).map((regra) => regra.criarAcao(ctx));
}

export function chaveExecucaoAutomacaoQuadro(
  ctx: Pick<ContextoMovimentacaoQuadro, "cardId" | "setor" | "paraStatus">,
  acaoId: string,
): string {
  return `${ctx.cardId}:${ctx.setor}:${ctx.paraStatus}:${acaoId}`;
}
