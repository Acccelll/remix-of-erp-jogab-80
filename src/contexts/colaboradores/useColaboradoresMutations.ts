// ARC-002 · Onda 6 — Fachada de mutações de Colaboradores.
// Extrai CRUD de colaboradores + leitura da lista (para consumidores que
// combinam list + mutação típico em telas de gestão de pessoas).
// Consumidores existentes de `useApp()` seguem funcionando; migração é incremental.

import { useMemo } from "react";
import { useApp } from "@/contexts/AppContext";
import type { Colaborador } from "@/types";

type AddColaboradorInput = Omit<
  Colaborador,
  "id" | "integracoes" | "documentos" | "historico" | "mobilizacaoPendente" | "ferias"
>;

export interface ColaboradoresState {
  colaboradores: Colaborador[];
  addColaborador: (d: AddColaboradorInput) => void;
  updateColaborador: (id: string, d: Partial<Colaborador>) => void;
  deleteColaborador: (id: string) => void;
}

export function useColaboradoresMutations(): ColaboradoresState {
  const app = useApp();
  return useMemo(
    () => ({
      colaboradores: app.colaboradores,
      addColaborador: app.addColaborador,
      updateColaborador: app.updateColaborador,
      deleteColaborador: app.deleteColaborador,
    }),
    [app.colaboradores, app.addColaborador, app.updateColaborador, app.deleteColaborador],
  );
}
