/** @module-kind pure */
/**
 * H1 — Card sob demanda (Trello-like).
 * Decide se uma seção opcional do card deve aparecer no diálogo.
 *
 * Regra:
 *   visível = registrada manualmente em `card_secoes_visiveis`
 *           OR já tem dado (`temDado`)
 *           OR (secao === 'datas' && cronogramaItemId) — vínculo força datas
 */

export const SECOES_OPCIONAIS = [
  "datas",
  "etiquetas",
  "checklist",
  "membros",
  "anexos",
  "local",
  "lembrete",
  "campos_custom",
  "cronograma",
] as const;

export type SecaoOpcional = (typeof SECOES_OPCIONAIS)[number];

export interface VisibilidadeInput {
  /** Seção tem dado (1+ registro / valor não-nulo). */
  temDado: boolean;
  /** Está registrada em card_secoes_visiveis. */
  registrada: boolean;
  /** Card está vinculado a uma etapa de cronograma. */
  cronogramaItemId?: string | null;
}

export function isSecaoVisivel(secao: SecaoOpcional, input: VisibilidadeInput): boolean {
  if (input.temDado) return true;
  if (input.registrada) return true;
  // Vínculo com cronograma força as duas seções relacionadas.
  if ((secao === "datas" || secao === "cronograma") && input.cronogramaItemId) return true;
  return false;
}

/** Seções que ainda podem ser adicionadas (não visíveis no momento). */
export function secoesAdicionaveis(
  estados: Record<SecaoOpcional, VisibilidadeInput>,
): SecaoOpcional[] {
  return SECOES_OPCIONAIS.filter((s) => !isSecaoVisivel(s, estados[s]));
}

export const SECAO_LABEL: Record<SecaoOpcional, string> = {
  datas: "Datas",
  etiquetas: "Etiquetas",
  checklist: "Checklist",
  membros: "Membros",
  anexos: "Anexos",
  local: "Local",
  lembrete: "Lembrete",
  campos_custom: "Campos personalizados",
  cronograma: "Etapa do cronograma",
};
