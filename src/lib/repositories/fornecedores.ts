// @ts-nocheck
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { REPO_LIMITS } from "./_limits";

export type FornecedorRow = Database["public"]["Tables"]["fornecedores"]["Row"];
export type FornecedorInsert = Database["public"]["Tables"]["fornecedores"]["Insert"];
export type FornecedorUpdate = Database["public"]["Tables"]["fornecedores"]["Update"];

// vw_fornecedor_historico ainda não está em types.ts (view nova, tipos não
// regenerados neste ciclo) — tipado manualmente aqui, único ponto de contato.
export type FornecedorHistoricoRow = {
  fornecedor_id: string;
  razao_social: string;
  total_cotacoes: number;
  cotacoes_vencidas: number;
  taxa_vitoria_pct: number | null;
  preco_medio_vencedor: number | null;
  prazo_medio_prometido_dias: number | null;
  prazo_medio_real_dias: number | null;
};

function unwrap<T>(res: { data: T | null; error: unknown }): T {
  if (res.error) throw res.error as Error;
  return res.data as T;
}

/**
 * @internal ARC-011 — Camada de acesso a `fornecedores`. Não consumir diretamente em
 * componentes/páginas. Use os hooks públicos em `@/hooks/useFornecedores`
 * (`useFornecedoresCompleto`, `useFornecedoresResumo`, `useFornecedoresResumoAtivos`,
 * `useCreateFornecedor`, `useUpdateFornecedor`). Testes de contrato em
 * `src/lib/__tests__/integracao/repositories-contrato*.test.ts` são a única exceção.
 */
export const fornecedoresRepo = {
  async listCompleto(
    cols: string = "id, cnpj, razao_social, nome_fantasia, contato, email, telefone, categorias, ativo, created_at, updated_at",
  ): Promise<FornecedorRow[]> {
    return (
      (unwrap(
        await supabase
          .from("fornecedores")
          .select(cols)
          .order("razao_social", { ascending: true })
          .limit(REPO_LIMITS.fornecedores),
      ) ?? []) as FornecedorRow[]
    );
  },
  async listResumo(): Promise<Pick<FornecedorRow, "id" | "razao_social">[]> {
    return (
      unwrap(
        await supabase
          .from("fornecedores")
          .select("id, razao_social")
          .order("razao_social")
          .limit(REPO_LIMITS.fornecedores),
      ) ?? []
    );
  },
  async listResumoAtivos(): Promise<Pick<FornecedorRow, "id" | "razao_social" | "ativo">[]> {
    return (
      unwrap(
        await supabase
          .from("fornecedores")
          .select("id, razao_social, ativo")
          .order("razao_social")
          .limit(REPO_LIMITS.fornecedores),
      ) ?? []
    );
  },
  async listContatos(): Promise<
    Pick<FornecedorRow, "id" | "razao_social" | "nome_fantasia" | "contato" | "email" | "telefone" | "ativo">[]
  > {
    return (
      unwrap(
        await supabase
          .from("fornecedores")
          .select("id, razao_social, nome_fantasia, contato, email, telefone, ativo")
          .order("razao_social")
          .limit(REPO_LIMITS.fornecedores),
      ) ?? []
    );
  },
  async listHistorico(): Promise<FornecedorHistoricoRow[]> {
    return (
      unwrap(
        await supabase.from("vw_fornecedor_historico").select("*").order("razao_social"),
      ) ?? []
    );
  },
  async create(payload: FornecedorInsert): Promise<void> {
    const { error } = await supabase.from("fornecedores").insert(payload);
    if (error) throw error;
  },
  async update(id: string, patch: FornecedorUpdate): Promise<void> {
    const { error } = await supabase.from("fornecedores").update(patch).eq("id", id);
    if (error) throw error;
  },
};
