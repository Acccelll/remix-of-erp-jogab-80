// @ts-nocheck
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { REPO_LIMITS } from "./_limits";

// categoria/subcategoria são colunas novas (ver migration Fase 1) ainda não
// refletidas em types.ts — estendidas manualmente até a próxima regeneração.
export type InsumoRow = Database["public"]["Tables"]["insumos"]["Row"] & {
  categoria: string | null;
  subcategoria: string | null;
};
export type InsumoInsert = Database["public"]["Tables"]["insumos"]["Insert"] & {
  categoria?: string | null;
  subcategoria?: string | null;
};
export type InsumoUpdate = Database["public"]["Tables"]["insumos"]["Update"] & {
  categoria?: string | null;
  subcategoria?: string | null;
};

export type InsumoCustoReferenciaRow = {
  insumo_id: string;
  descricao: string;
  preco_cadastrado: number;
  preco_medio_cotado_vencedor: number | null;
  preco_medio_comprado: number | null;
  ultima_compra_em: string | null;
};

function unwrap<T>(res: { data: T | null; error: unknown }): T {
  if (res.error) throw res.error as Error;
  return res.data as T;
}

/**
 * @internal ARC-012 — Acesso público apenas via hooks em `@/hooks/useInsumos`
 * (`useInsumosCompleto`, `useInsumosAtivosBasico`, `useInsumosAtivos`,
 * `useInsumosPrecos`, `useInsumosResumoPrecos`, `useCreateInsumo`,
 * `useUpdateInsumo`, `useToggleInsumoAtivo`). Testes de contrato em
 * `src/lib/__tests__/integracao/repositories-contrato-{b,l}.test.ts` são
 * a única exceção permitida.
 */
export const insumosRepo = {
  async listCompleto(
    cols: string = "id, codigo, descricao, tipo, categoria, subcategoria, unidade, preco_unitario, fonte, referencia_externa, ativo, created_at, updated_at",
  ): Promise<InsumoRow[]> {
    return (
      (unwrap(
        await supabase
          .from("insumos")
          .select(cols)
          .order("descricao", { ascending: true })
          .limit(REPO_LIMITS.insumos),
      ) ?? []) as InsumoRow[]
    );
  },
  async listAtivosBasico(): Promise<Pick<InsumoRow, "id" | "codigo" | "descricao" | "unidade">[]> {
    return (
      unwrap(
        await supabase
          .from("insumos")
          .select("id, codigo, descricao, unidade")
          .eq("ativo", true)
          .order("descricao")
          .limit(REPO_LIMITS.insumos),
      ) ?? []
    );
  },
  async listAtivos(): Promise<
    Pick<InsumoRow, "id" | "descricao" | "unidade" | "preco_unitario" | "ativo">[]
  > {
    return (
      unwrap(
        await supabase
          .from("insumos")
          .select("id, descricao, unidade, preco_unitario, ativo")
          .eq("ativo", true)
          .order("descricao")
          .limit(REPO_LIMITS.insumos),
      ) ?? []
    );
  },
  async listPrecos(): Promise<Pick<InsumoRow, "id" | "preco_unitario">[]> {
    return (
      unwrap(
        await supabase.from("insumos").select("id, preco_unitario").limit(REPO_LIMITS.insumos),
      ) ?? []
    );
  },
  async listResumoPrecos(): Promise<
    Pick<InsumoRow, "id" | "descricao" | "unidade" | "preco_unitario">[]
  > {
    return (
      unwrap(
        await supabase
          .from("insumos")
          .select("id, descricao, unidade, preco_unitario")
          .limit(REPO_LIMITS.insumos),
      ) ?? []
    );
  },
  async listCustoReferencia(): Promise<InsumoCustoReferenciaRow[]> {
    return (
      unwrap(await supabase.from("vw_insumo_custo_referencia").select("*")) ?? []
    );
  },
  async create(payload: InsumoInsert): Promise<void> {
    const { error } = await supabase.from("insumos").insert(payload);
    if (error) throw error;
  },
  async update(id: string, patch: InsumoUpdate): Promise<void> {
    const { error } = await supabase.from("insumos").update(patch).eq("id", id);
    if (error) throw error;
  },
  async toggleAtivo(id: string, ativo: boolean): Promise<void> {
    const { error } = await supabase.from("insumos").update({ ativo }).eq("id", id);
    if (error) throw error;
  },
};
