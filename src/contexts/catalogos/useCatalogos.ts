// ARC-002 · Onda 6 — Fachada de catálogos (leitura).
// Terceiro domínio extraído do God-context AppContext.
// Uso: `const { obras, clientes, funcoes, documentosTipo, patrimonios, veiculos, players, colaboradores } = useCatalogos();`
// Consumidores existentes de `useApp()` seguem funcionando; migração é incremental.
//
// ARC-002.slice-03-prep: colaboradores e patrimonios agora vêm dos
// subcontextos de domínio (ColaboradoresContext/PatrimoniosContext),
// preparando a mudança de fonte-de-verdade sem alterar contrato público.

import { useMemo } from "react";
import { useApp } from "@/contexts/AppContext";
import { useColaboradoresContext } from "@/contexts/ColaboradoresContext";
import { usePatrimoniosContext } from "@/contexts/PatrimoniosContext";
import { useClientesContext } from "@/contexts/ClientesContext";
import type {
  Cliente,
  Colaborador,
  DocumentoTipo,
  Funcao,
  Obra,
  Patrimonio,
  Player,
  Veiculo,
} from "@/types";

export interface CatalogosState {
  obras: Obra[];
  clientes: Cliente[];
  funcoes: Funcao[];
  documentosTipo: DocumentoTipo[];
  patrimonios: Patrimonio[];
  veiculos: Veiculo[];
  players: Player[];
  colaboradores: Colaborador[];
}

export function useCatalogos(): CatalogosState {
  const app = useApp();
  const { colaboradores } = useColaboradoresContext();
  const { patrimonios } = usePatrimoniosContext();
  const { clientes } = useClientesContext();
  return useMemo(
    () => ({
      obras: app.obras,
      clientes,
      funcoes: app.funcoes,
      documentosTipo: app.documentosTipo,
      patrimonios,
      veiculos: app.veiculos,
      players: app.players,
      colaboradores,
    }),
    [
      app.obras,
      clientes,
      app.funcoes,
      app.documentosTipo,
      patrimonios,
      app.veiculos,
      app.players,
      colaboradores,
    ],
  );
}
