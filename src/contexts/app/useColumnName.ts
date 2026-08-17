import { useCallback } from "react";
import type { Colaborador, Obra } from "@/types";

interface Params {
  obras: Obra[];
  colaboradores: Colaborador[];
}

/**
 * ARC-002/ARC-004 · Onda 6 — resolução de nome de coluna extraída do AppProvider.
 * Cobre colunas especiais (folga/afastamento/férias/manutenção/sujo), colunas de responsabilidade
 * (__resp__/__resp_v__) e nomes de obras. Estabiliza a identidade via useCallback.
 */
export function useColumnName({ obras, colaboradores }: Params) {
  return useCallback(
    (id: string | null): string => {
      if (!id) return "Sem Alocação";
      const specialNames: Record<string, string> = {
        folga: "Folga",
        afastamento: "Afastamento",
        ferias: "Férias",
        manutencao: "Em Manutenção",
        sujo: "Sujo",
        sem_alocacao: "Sem Alocação",
      };
      // O id da coluna especial chega com underscores (`__ferias__`) vindo dos
      // quadros de patrimônio/veículo e sem eles (`ferias`) vindo do quadro de
      // colaboradores e da coluna `status_especial` do banco. Sem normalizar,
      // metade dos casos não casava, caía no `obras.find` abaixo e devolvia
      // "Sem Alocação" — era assim que uma ida para férias virava
      // `Status alterado de "212" para "Sem Alocação"` no histórico.
      const normalizado = id.replace(/^__|__$/g, "");
      if (specialNames[normalizado]) return specialNames[normalizado];
      if (id.startsWith("__resp__")) {
        const colabId = id.replace("__resp__", "");
        const colab = colaboradores.find((c) => c.id === colabId);
        return colab?.nome || "Responsável";
      }
      if (id.startsWith("__resp_v__")) {
        const colabId = id.replace("__resp_v__", "");
        const colab = colaboradores.find((c) => c.id === colabId);
        return colab?.nome || "Responsável";
      }
      return obras.find((o) => o.id === id)?.nome || "Sem Alocação";
    },
    [obras, colaboradores],
  );
}
