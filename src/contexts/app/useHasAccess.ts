import { useCallback } from "react";
import type { NivelAcesso, PageKey, Player } from "@/types";

/**
 * ARC-002/ARC-004 · Onda 6 — verificação de nível de acesso hierárquica extraída do AppProvider.
 * GM (isGM) tem acesso irrestrito; caso contrário, compara o nível concedido no mapa `acessos`
 * contra o nível requerido na hierarquia nenhum → visualizar → editar → compras → financeiro.
 */
export function useHasAccess(currentPlayer: Player | null) {
  return useCallback(
    (page: PageKey, level: NivelAcesso) => {
      if (!currentPlayer) return false;
      if (currentPlayer.isGM) return true;
      const access = currentPlayer.acessos[page];
      if (!access) return level === "nenhum";
      if (level === "nenhum") return true;
      const hierarchy: NivelAcesso[] = ["nenhum", "visualizar", "editar", "compras", "financeiro"];
      const accessLevel = hierarchy.indexOf(access);
      const requiredLevel = hierarchy.indexOf(level);
      return accessLevel >= requiredLevel;
    },
    [currentPlayer],
  );
}
