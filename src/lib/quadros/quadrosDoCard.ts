/** @module-kind pure */
/**
 * quadrosDoCard — função pura.
 *
 * Dado um card (setores + obra) e a lista de quadros existentes,
 * retorna em quais quadros ele aparece. NÃO duplica o card: a
 * visibilidade é derivada por filtro (pool único).
 *
 * Regras:
 * - Quadro `setor`: aparece se o card possuir aquele setor.
 * - Quadro `obra`:  aparece se o card pertencer àquela obra.
 * - Quadro `custom`: só aparece se houver `card_board_posicao`
 *   explícita (inclusão manual). A lib aceita um Set opcional de
 *   board ids explícitos para refletir isso sem consulta extra.
 * - Quadros arquivados são ignorados.
 */

export interface QuadroRef {
  id: string;
  nome: string;
  tipo: "setor" | "obra" | "custom";
  setor?: string | null;
  obra_id?: string | null;
  arquivado?: boolean;
}

export interface CardRef {
  id: string;
  obra_id?: string | null;
  setores?: ReadonlyArray<string> | null;
}

export function quadrosDoCard(
  card: CardRef,
  boards: ReadonlyArray<QuadroRef>,
  explicitCustomBoardIds: ReadonlySet<string> = new Set(),
): QuadroRef[] {
  if (!card || !Array.isArray(boards)) return [];
  const setoresCard = new Set((card.setores ?? []).filter(Boolean));
  const out: QuadroRef[] = [];

  for (const b of boards) {
    if (b.arquivado) continue;
    switch (b.tipo) {
      case "setor":
        if (b.setor && setoresCard.has(b.setor)) out.push(b);
        break;
      case "obra":
        if (b.obra_id && card.obra_id && b.obra_id === card.obra_id) out.push(b);
        break;
      case "custom":
        if (explicitCustomBoardIds.has(b.id)) out.push(b);
        break;
    }
  }
  return out;
}
