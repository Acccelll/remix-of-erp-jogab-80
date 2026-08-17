/** @module-kind pure */
/**
 * ETAPA 2 · Regras puras de vínculos (espelho local das validações do banco).
 *
 * O banco continua sendo a última linha de defesa: estas funções existem para
 * gating de UI, mensagens claras e testabilidade.
 */
import type { BoardExtensao, CardVinculo, VinculoSituacao } from "./tipos";
import { extensaoCompativelComTipo, extensaoSuportaEntidade, getExtensao } from "./registry";

export interface NovoVinculo {
  extensao_codigo: string;
  entity_type: string;
  entity_id: string;
  relationship_type?: string;
}

export interface ValidacaoVinculo {
  ok: boolean;
  motivo?: string;
}

export function isDuplicado(atuais: CardVinculo[], novo: NovoVinculo): boolean {
  const rel = novo.relationship_type ?? "relacionado";
  return atuais.some(
    (v) =>
      !v.archived_at &&
      v.entity_type === novo.entity_type &&
      v.entity_id === novo.entity_id &&
      v.relationship_type === rel,
  );
}

export function validarNovoVinculo(
  novo: NovoVinculo,
  ctx: {
    vinculosAtuais: CardVinculo[];
    extensoesAtivas: string[];
    cardTipoCodigo?: string | null;
    podeEditar: boolean;
  },
): ValidacaoVinculo {
  if (!ctx.podeEditar) return { ok: false, motivo: "Sem permissão para editar este card." };
  const ext = getExtensao(novo.extensao_codigo);
  if (!ext) return { ok: false, motivo: "Extensão desconhecida." };
  if (!ctx.extensoesAtivas.includes(novo.extensao_codigo))
    return { ok: false, motivo: `Extensão "${ext.nome}" não está ativa neste quadro.` };
  if (!extensaoSuportaEntidade(novo.extensao_codigo, novo.entity_type))
    return { ok: false, motivo: "Tipo de entidade não suportado pela extensão." };
  if (!extensaoCompativelComTipo(novo.extensao_codigo, ctx.cardTipoCodigo))
    return { ok: false, motivo: "Extensão incompatível com o tipo deste card." };
  if (!novo.entity_id) return { ok: false, motivo: "Selecione uma entidade." };
  if (isDuplicado(ctx.vinculosAtuais, novo))
    return { ok: false, motivo: "Este vínculo já existe no card." };
  return { ok: true };
}

/** Ativos primeiro; principal no topo; depois ordem manual e data. */
export function ordenarVinculos(links: CardVinculo[]): CardVinculo[] {
  return [...links].sort((a, b) => {
    const arq = Number(!!a.archived_at) - Number(!!b.archived_at);
    if (arq !== 0) return arq;
    const prim = Number(b.is_primary) - Number(a.is_primary);
    if (prim !== 0) return prim;
    if (a.display_order !== b.display_order) return a.display_order - b.display_order;
    return a.created_at.localeCompare(b.created_at);
  });
}

export function vinculosAtivos(links: CardVinculo[]): CardVinculo[] {
  return links.filter((l) => !l.archived_at);
}

export function rotuloSituacao(v: CardVinculo): {
  situacao: VinculoSituacao;
  rotulo: string;
  tom: "ok" | "aviso" | "erro";
} {
  if (v.archived_at) return { situacao: "arquivada", rotulo: "Arquivado", tom: "aviso" };
  if (!v.entidade_disponivel)
    return { situacao: "quebrado", rotulo: "Entidade indisponível", tom: "erro" };
  if (v.entidade_arquivada)
    return { situacao: "arquivada", rotulo: "Entidade arquivada", tom: "aviso" };
  return { situacao: "ok", rotulo: "Ativo", tom: "ok" };
}

/** Nome exibível respeitando permissão da entidade (sem vazar dados). */
export function nomeExibivel(v: CardVinculo): string {
  if (!v.acesso_permitido) return "Restrito";
  if (!v.entidade_disponivel) return "Entidade indisponível";
  return v.entidade_nome ?? "Sem nome";
}

export interface ResumoChip {
  extensao: string;
  texto: string;
}

/**
 * Resumos na frente do card. Limite rígido para não inflar o card e manter o
 * drag-and-drop leve.
 */
export function resumoDosVinculos(
  links: CardVinculo[],
  boardExtensoes: BoardExtensao[],
  limite = 3,
): ResumoChip[] {
  const habilitadas = new Set(
    boardExtensoes.filter((b) => b.ativo && b.mostrar_resumo).map((b) => b.extensao_codigo),
  );
  const chips: ResumoChip[] = [];
  for (const v of ordenarVinculos(vinculosAtivos(links))) {
    if (chips.length >= limite) break;
    if (!habilitadas.has(v.extensao_codigo)) continue;
    const def = getExtensao(v.extensao_codigo);
    if (!def?.suportaResumo) continue;
    if (!v.acesso_permitido) continue;
    chips.push({ extensao: v.extensao_codigo, texto: nomeExibivel(v) });
  }
  return chips;
}

/** Painéis a renderizar no card, na ordem do registro/quadro. */
export function painesDoCard(
  boardExtensoes: BoardExtensao[],
  cardTipoCodigo?: string | null,
): string[] {
  return boardExtensoes
    .filter((b) => b.ativo)
    .filter((b) => !!getExtensao(b.extensao_codigo))
    .filter((b) => extensaoCompativelComTipo(b.extensao_codigo, cardTipoCodigo))
    .sort((a, b) => {
      const oa = a.ordem || getExtensao(a.extensao_codigo)!.painelOrdem;
      const ob = b.ordem || getExtensao(b.extensao_codigo)!.painelOrdem;
      return oa - ob;
    })
    .map((b) => b.extensao_codigo);
}

/** Extensões ativas por quadro, considerando também os padrões do tipo do card. */
export function extensoesEfetivas(
  boardExtensoes: BoardExtensao[],
  extensoesPadraoDoTipo: string[] = [],
): string[] {
  const ativas = new Set(boardExtensoes.filter((b) => b.ativo).map((b) => b.extensao_codigo));
  for (const c of extensoesPadraoDoTipo) if (getExtensao(c)) ativas.add(c);
  return [...ativas];
}
