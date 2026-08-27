// @ts-nocheck
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { REPO_LIMITS } from "./_limits";

export type ObraRow = Database["public"]["Tables"]["obras"]["Row"];
export type ObraInsert = Database["public"]["Tables"]["obras"]["Insert"];
export type ObraUpdate = Database["public"]["Tables"]["obras"]["Update"];

export type ObraResumoCodigo = Pick<ObraRow, "id" | "codigo" | "nome">;
export type ObraResumoCliente = Pick<ObraRow, "id" | "codigo" | "nome" | "cliente_id">;
export type ObraResumoContrato = Pick<ObraRow, "id" | "codigo" | "nome" | "valor_contrato">;

function unwrap<T>(res: { data: T | null; error: unknown }): T {
  if (res.error) throw res.error as Error;
  return res.data as T;
}

/** Repositório de obras — projeções específicas por página. Para lista completa em runtime, use `useObras()`. */
export const obrasRepo = {
  async listComClienteId(): Promise<ObraResumoCliente[]> {
    return (
      unwrap(
        await supabase
          .from("obras")
          .select("id, codigo, nome, cliente_id")
          .order("codigo")
          .limit(REPO_LIMITS.obras),
      ) ?? []
    );
  },

  async listMinContrato(): Promise<ObraResumoContrato[]> {
    return (
      unwrap(
        await supabase
          .from("obras")
          .select("id, codigo, nome, valor_contrato")
          .order("codigo")
          .limit(REPO_LIMITS.obras),
      ) ?? []
    );
  },

  /** Mapa `centro_custo_totvs → id` para parear obras do PHP com o Supabase. */
  async listPareamentoCentroCusto(): Promise<
    Array<{ id: string; centro_custo_totvs: string | null }>
  > {
    const { data, error } = await supabase
      .from("obras")
      .select("id, centro_custo_totvs")
      .limit(2000);
    if (error) throw error;
    return (data as any) ?? [];
  },

  async getCentroCustoTotvs(id: string): Promise<string | null> {
    const { data, error } = await supabase
      .from("obras")
      .select("centro_custo_totvs")
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    return (data?.centro_custo_totvs as string | null) ?? null;
  },

  async getIdByCentroCustoTotvs(centroCusto: string): Promise<string | null> {
    const { data, error } = await supabase
      .from("obras")
      .select("id")
      .eq("centro_custo_totvs", centroCusto)
      .maybeSingle();
    if (error) throw error;
    return (data?.id as string | null) ?? null;
  },

  async getNome(id: string): Promise<string | null> {
    const { data, error } = await supabase.from("obras").select("nome").eq("id", id).maybeSingle();
    if (error) throw error;
    return (data?.nome as string | null) ?? null;
  },

  async getResumoRdo(id: string): Promise<{ nome: string; empresa_id: string | null } | null> {
    const { data, error } = await supabase
      .from("obras")
      .select("nome, empresa_id")
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    return (data as { nome: string; empresa_id: string | null } | null) ?? null;
  },

  async getPedidoValorContrato(
    id: string,
  ): Promise<{ pedido_contrato: string | null; valor_contrato: number | null } | null> {
    const { data, error } = await supabase
      .from("obras")
      .select("pedido_contrato, valor_contrato")
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    return (
      (data as { pedido_contrato: string | null; valor_contrato: number | null } | null) ?? null
    );
  },

  async listComCodigoTotvs(): Promise<Pick<ObraRow, "id" | "nome" | "codigo" | "codigo_totvs">[]> {
    return (
      unwrap(await supabase.from("obras").select("id, nome, codigo, codigo_totvs").limit(2000)) ??
      []
    );
  },

  async listDashboard(): Promise<
    Pick<
      ObraRow,
      | "id"
      | "codigo"
      | "nome"
      | "valor_contrato"
      | "status"
      | "data_previsao_termino"
      | "data_fim"
      | "prazo_emitir_nf_dias"
      | "centro_custo_totvs"
    >[]
  > {
    return (
      unwrap(
        await supabase
          .from("obras")
          .select(
            "id, codigo, nome, valor_contrato, status, data_previsao_termino, data_fim, prazo_emitir_nf_dias, centro_custo_totvs",
          )
          .limit(REPO_LIMITS.obras),
      ) ?? []
    );
  },

  async listComCliente(): Promise<
    (ObraRow & { clientes: { nome: string } | null; obra_valores: any | null })[]
  > {
    return (
      unwrap(
        await supabase
          .from("obras")
          .select(
            "*, clientes(nome), obra_valores:vw_obra_valores(receita_baixada, faturamento_liquido, receita_a_receber, despesa_paga, despesa_a_pagar)",
          )
          .order("codigo")
          .limit(REPO_LIMITS.obras),
      ) ?? []
    );
  },

  async getById(
    id: string,
  ): Promise<(ObraRow & { clientes: { nome: string; cnpj: string } | null }) | null> {
    const { data, error } = await supabase
      .from("obras")
      .select("*, clientes(nome, cnpj)")
      .eq("id", id)
      .limit(1);
    if (error) throw error;
    return (data?.[0] ?? null) as
      (ObraRow & { clientes: { nome: string; cnpj: string } | null }) | null;
  },

  async create(payload: ObraInsert): Promise<void> {
    const { error } = await supabase.from("obras").insert(payload);
    if (error) throw error;
  },

  async update(id: string, patch: ObraUpdate): Promise<void> {
    const { error } = await supabase.from("obras").update(patch).eq("id", id);
    if (error) throw error;
  },

  async remove(id: string): Promise<void> {
    const { error } = await supabase.from("obras").delete().eq("id", id);
    if (error) throw error;
  },

  async upsertLote(payload: unknown[]): Promise<any[]> {
    const { data, error } = await (supabase as any).rpc("obras_upsert_lote", { payload });
    if (error) throw error;
    return data ?? [];
  },

  async selectOrdered(select: string, orderCol: string = "codigo"): Promise<any[]> {
    const { data, error } = await supabase
      .from("obras")
      .select(select)
      .order(orderCol)
      .limit(REPO_LIMITS.obras);
    if (error) throw error;
    return data ?? [];
  },

  async selectAll(select: string): Promise<any[]> {
    const { data, error } = await supabase.from("obras").select(select).limit(REPO_LIMITS.obras);
    if (error) throw error;
    return data ?? [];
  },

  async selectByIdMaybeSingle(select: string, id: string): Promise<any | null> {
    const { data, error } = await supabase.from("obras").select(select).eq("id", id).maybeSingle();
    if (error) throw error;
    return data;
  },

  async updateReturningId(id: string, payload: ObraUpdate): Promise<string | null> {
    const { data, error } = await supabase.from("obras").update(payload).eq("id", id).select("id");
    if (error) throw new Error(error.message);
    return (data?.[0]?.id as string | undefined) ?? null;
  },

  async insertReturningId(payload: ObraInsert): Promise<string> {
    const { data, error } = await supabase.from("obras").insert(payload).select("id").single();
    if (error) throw new Error(error.message);
    return data.id as string;
  },

  async findIdByCentroCustoTotvs(centro: string): Promise<string | null> {
    const { data, error } = await supabase
      .from("obras")
      .select("id")
      .eq("centro_custo_totvs", centro)
      .maybeSingle();
    if (error) throw error;
    return (data?.id as string | undefined) ?? null;
  },
};

// ARC-003 — Vínculos de usuário com obras.
export const obraMembrosRepo = {
  async listByUser(userId: string): Promise<{ obra_id: string }[]> {
    const { data, error } = await supabase
      .from("obra_membros")
      .select("obra_id,papel")
      .eq("user_id", userId)
      .in("papel", ["gestor", "membro"]);
    if (error) throw error;
    return (data ?? []) as any;
  },

  async getPapel(obraId: string, userId: string): Promise<string | null> {
    const { data, error } = await supabase
      .from("obra_membros")
      .select("papel")
      .eq("obra_id", obraId)
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw error;
    return (data?.papel as string | undefined) ?? null;
  },

  /**
   * Membros de uma obra, com login/nome resolvidos via `profiles` (RLS: GM
   * ou o próprio). Duas consultas, não um embed: `obra_membros.user_id`
   * referencia `auth.users(id)`, não `public.profiles(id)` — PostgREST não
   * tem FK pra inferir o join automático de `profiles:user_id(...)`.
   */
  async listByObra(obraId: string): Promise<
    Array<{ user_id: string; papel: string; created_at: string; login: string | null; nome: string | null }>
  > {
    const { data: membros, error } = await supabase
      .from("obra_membros")
      .select("user_id,papel,created_at")
      .eq("obra_id", obraId)
      .order("created_at");
    if (error) throw error;
    const ids = (membros ?? []).map((m: any) => m.user_id as string);
    if (ids.length === 0) return [];
    const { data: perfis, error: errPerfis } = await supabase
      .from("profiles")
      .select("id,login,nome")
      .in("id", ids);
    if (errPerfis) throw errPerfis;
    const porId = new Map((perfis ?? []).map((p: any) => [p.id as string, p]));
    return (membros ?? []).map((m: any) => ({
      user_id: m.user_id,
      papel: m.papel,
      created_at: m.created_at,
      login: (porId.get(m.user_id)?.login as string | undefined) ?? null,
      nome: (porId.get(m.user_id)?.nome as string | undefined) ?? null,
    }));
  },

  /** Escrita restrita a GM pela RLS ("obra_membros write gm"). */
  async add(obraId: string, userId: string, papel: "gestor" | "membro" | "observador" = "membro") {
    const { error } = await supabase
      .from("obra_membros")
      .upsert({ obra_id: obraId, user_id: userId, papel }, { onConflict: "user_id,obra_id" });
    if (error) throw error;
  },

  async remove(obraId: string, userId: string) {
    const { error } = await supabase
      .from("obra_membros")
      .delete()
      .eq("obra_id", obraId)
      .eq("user_id", userId);
    if (error) throw error;
  },
};
