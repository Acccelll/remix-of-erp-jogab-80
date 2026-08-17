/**
 * ETAPA 1 · Repositório de automações de quadro (`board_automacoes`).
 *
 * Substitui a persistência em `localStorage` de `src/lib/quadros/automacoes.ts`.
 * A regra passa a ser da equipe (visível por todos os membros do quadro),
 * protegida por RLS via `pode_ver_board`.
 */
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import type { AutomacaoAcao, AutomacaoGatilho } from "@/lib/quadros/automacoes";

export interface BoardAutomacaoRow {
  id: string;
  board_id: string;
  nome: string;
  ativa: boolean;
  gatilho: AutomacaoGatilho;
  acoes: AutomacaoAcao[];
  criado_por: string | null;
  created_at: string;
}

export interface BoardAutomacaoInput {
  id?: string;
  board_id: string;
  nome: string;
  ativa: boolean;
  gatilho: AutomacaoGatilho;
  acoes: AutomacaoAcao[];
  criado_por?: string | null;
}

function normalizar(row: any): BoardAutomacaoRow {
  return {
    id: row.id,
    board_id: row.board_id,
    nome: row.nome,
    ativa: !!row.ativa,
    gatilho: (row.gatilho ?? {}) as AutomacaoGatilho,
    acoes: Array.isArray(row.acoes) ? (row.acoes as AutomacaoAcao[]) : [],
    criado_por: row.criado_por ?? null,
    created_at: row.created_at,
  };
}

export const boardAutomacoesRepo = {
  async listByBoard(boardId: string): Promise<BoardAutomacaoRow[]> {
    const { data, error } = await supabase
      .from("board_automacoes")
      .select("id,board_id,nome,ativa,gatilho,acoes,criado_por,created_at")
      .eq("board_id", boardId)
      .order("created_at");
    if (error) throw error;
    return (data ?? []).map(normalizar);
  },

  async upsert(input: BoardAutomacaoInput): Promise<BoardAutomacaoRow> {
    const payload = {
      ...(input.id ? { id: input.id } : {}),
      board_id: input.board_id,
      nome: input.nome,
      ativa: input.ativa,
      gatilho: input.gatilho as unknown as Json,
      acoes: input.acoes as unknown as Json,
      criado_por: input.criado_por ?? null,
    };
    const { data, error } = await supabase
      .from("board_automacoes")
      .upsert(payload)
      .select("id,board_id,nome,ativa,gatilho,acoes,criado_por,created_at")
      .single();
    if (error) throw error;
    return normalizar(data);
  },

  async insertMany(rows: BoardAutomacaoInput[]): Promise<void> {
    if (!rows.length) return;
    const { error } = await supabase.from("board_automacoes").insert(
      rows.map((r) => ({
        board_id: r.board_id,
        nome: r.nome,
        ativa: r.ativa,
        gatilho: r.gatilho as unknown as Json,
        acoes: r.acoes as unknown as Json,
        criado_por: r.criado_por ?? null,
      })),
    );
    if (error) throw error;
  },

  async remove(id: string): Promise<void> {
    const { error } = await supabase.from("board_automacoes").delete().eq("id", id);
    if (error) throw error;
  },
};

// ----- board_favoritos -----
export const boardFavoritosRepo = {
  async listMeus(userId: string): Promise<string[]> {
    const { data, error } = await supabase
      .from("board_favoritos")
      .select("board_id")
      .eq("user_id", userId);
    if (error) throw error;
    return (data ?? []).map((r: { board_id: string }) => r.board_id);
  },
  async favoritar(boardId: string, userId: string): Promise<void> {
    const { error } = await supabase
      .from("board_favoritos")
      .insert({ board_id: boardId, user_id: userId });
    if (error) throw error;
  },
  async desfavoritar(boardId: string, userId: string): Promise<void> {
    const { error } = await supabase
      .from("board_favoritos")
      .delete()
      .eq("board_id", boardId)
      .eq("user_id", userId);
    if (error) throw error;
  },
};
