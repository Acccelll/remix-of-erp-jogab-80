/**
 * ETAPA 1 · Automações de quadro persistidas no banco.
 *
 * Também executa, uma única vez por navegador, a **migração das regras que
 * viviam em `localStorage`** (chave `gestaobra:board:automacoes`) para
 * `board_automacoes`. A chave local é renomeada para `...:migrado` em vez de
 * apagada, preservando backup local (ver 05-migracao-compatibilidade.md).
 */
import { useEffect, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  boardAutomacoesRepo,
  type BoardAutomacaoInput,
  type BoardAutomacaoRow,
} from "@/lib/repositories/boardAutomacoes";
import {
  LEGACY_AUTOMACOES_STORAGE_KEY,
  lerAutomacoesLegado,
  type Automacao,
} from "@/lib/quadros/automacoes";
import { queryKey } from "@/lib/query-keys";

/** Converte a linha do banco para o formato puro consumido pelo motor. */
export function toAutomacao(row: BoardAutomacaoRow): Automacao {
  return {
    id: row.id,
    boardId: row.board_id,
    nome: row.nome,
    ativa: row.ativa,
    gatilho: row.gatilho,
    acoes: row.acoes,
    criadaEm: row.created_at,
  };
}

export const boardAutomacoesKeys = {
  byBoard: (boardId: string) => queryKey("board-automacoes", boardId),
};

export function useBoardAutomacoes(boardId: string, enabled = true) {
  const qc = useQueryClient();
  const migrado = useRef(false);

  const query = useQuery({
    queryKey: boardAutomacoesKeys.byBoard(boardId),
    queryFn: () => boardAutomacoesRepo.listByBoard(boardId),
    enabled: enabled && !!boardId,
  });

  // Migração idempotente localStorage -> banco.
  useEffect(() => {
    if (!enabled || !boardId || migrado.current || query.isLoading) return;
    const locais = lerAutomacoesLegado().filter((a) => a.boardId === boardId);
    if (!locais.length) return;
    migrado.current = true;
    const existentes = new Set((query.data ?? []).map((r) => r.nome));
    const novas: BoardAutomacaoInput[] = locais
      .filter((a) => !existentes.has(a.nome))
      .map((a) => ({
        board_id: boardId,
        nome: a.nome,
        ativa: a.ativa,
        gatilho: a.gatilho,
        acoes: a.acoes,
      }));
    (async () => {
      try {
        await boardAutomacoesRepo.insertMany(novas);
        if (typeof localStorage !== "undefined") {
          const raw = localStorage.getItem(LEGACY_AUTOMACOES_STORAGE_KEY);
          if (raw) {
            localStorage.setItem(`${LEGACY_AUTOMACOES_STORAGE_KEY}:migrado`, raw);
            localStorage.removeItem(LEGACY_AUTOMACOES_STORAGE_KEY);
          }
        }
        qc.invalidateQueries({ queryKey: boardAutomacoesKeys.byBoard(boardId) });
      } catch {
        migrado.current = false; // permite nova tentativa
      }
    })();
  }, [enabled, boardId, query.isLoading, query.data, qc]);

  return query;
}

export function useUpsertBoardAutomacao(boardId: string) {
  const qc = useQueryClient();
  return useMutation<BoardAutomacaoRow, Error, BoardAutomacaoInput>({
    mutationFn: (input) => boardAutomacoesRepo.upsert(input),
    onSettled: () =>
      qc.invalidateQueries({ queryKey: boardAutomacoesKeys.byBoard(boardId) }),
  });
}

export function useRemoveBoardAutomacao(boardId: string) {
  const qc = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: (id) => boardAutomacoesRepo.remove(id),
    onSettled: () =>
      qc.invalidateQueries({ queryKey: boardAutomacoesKeys.byBoard(boardId) }),
  });
}
