/** @module-kind pure */
/**
 * Anúncios e instruções pt-BR para acessibilidade em `DndContext`
 * (dnd-kit). Aplicáveis via `accessibility={...}` para dar suporte
 * a navegação por leitor de tela e teclado (ARC-013 · UX-005).
 *
 * Passe `getItemLabel(id)` opcional para nomear itens em anúncios.
 * Sem callback, usa o próprio id.
 */
import type { Announcements, ScreenReaderInstructions } from "@dnd-kit/core";

type LabelFn = (id: string | number) => string;

const defaultLabel: LabelFn = (id) => String(id);

export function dndAnnouncementsPtBR(getItemLabel: LabelFn = defaultLabel): Announcements {
  return {
    onDragStart({ active }) {
      return `Item ${getItemLabel(active.id)} selecionado. Use as setas para mover, espaço para confirmar, escape para cancelar.`;
    },
    onDragOver({ active, over }) {
      if (over) {
        return `Item ${getItemLabel(active.id)} movido sobre ${getItemLabel(over.id)}.`;
      }
      return `Item ${getItemLabel(active.id)} não está sobre uma área alvo.`;
    },
    onDragEnd({ active, over }) {
      if (over) {
        return `Item ${getItemLabel(active.id)} solto em ${getItemLabel(over.id)}.`;
      }
      return `Item ${getItemLabel(active.id)} solto fora de área válida.`;
    },
    onDragCancel({ active }) {
      return `Movimento do item ${getItemLabel(active.id)} cancelado.`;
    },
  };
}

export const dndScreenReaderInstructionsPtBR: ScreenReaderInstructions = {
  draggable:
    "Para movimentar um item, pressione espaço ou enter. Use as setas para mudar de posição. Pressione espaço ou enter novamente para confirmar, ou escape para cancelar.",
};
