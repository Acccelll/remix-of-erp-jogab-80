// @ts-nocheck
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type ClienteRow = Database["public"]["Tables"]["clientes"]["Row"];
type ClienteInsert = Database["public"]["Tables"]["clientes"]["Insert"];
type ClienteUpdate = Database["public"]["Tables"]["clientes"]["Update"];

/**
 * @internal ARC-012 — Acesso público apenas via hooks em `@/hooks/useClientes`
 * (`useClientes`, `useClientesResumo`, `useClienteObrasVinculadas`,
 * `useCreateCliente`, `useUpdateCliente`, `useDeleteCliente`,
 * `fetchClienteObrasVinculadas`). Testes de contrato são a única exceção.
 */
export const clientesRepo = {
  async list(): Promise<ClienteRow[]> {
    const { data, error } = await supabase
      .from("clientes")
      .select(
        "id, nome, nome_fantasia, cnpj, telefone, email, cep, logradouro, numero, complemento, bairro, municipio, uf, observacoes, prazo_emitir_nf_dias, prazo_pagamento_dias, dia_fixo_pagamento, dias_fixos_pagamento, aliquota_iss, aliquota_inss, aliquota_cbs, aliquota_ibs, percentual_material, owner_id, created_at, updated_at",
      )
      .order("nome");
    if (error) throw error;
    return data ?? [];
  },
  async listIdNome(): Promise<Pick<ClienteRow, "id" | "nome">[]> {
    const { data, error } = await supabase.from("clientes").select("id,nome").order("nome");
    if (error) throw error;
    return data ?? [];
  },
  async create(payload: ClienteInsert): Promise<void> {
    const { error } = await supabase.from("clientes").insert(payload);
    if (error) throw error;
  },
  async update(id: string, payload: ClienteUpdate): Promise<void> {
    const { error } = await supabase.from("clientes").update(payload).eq("id", id);
    if (error) throw error;
  },
  async remove(id: string): Promise<void> {
    const { error } = await supabase.from("clientes").delete().eq("id", id);
    if (error) throw error;
  },
  async countObrasVinculadas(clienteId: string): Promise<number> {
    const { count, error } = await supabase
      .from("obras")
      .select("id", { count: "exact", head: true })
      .eq("cliente_id", clienteId);
    if (error) throw error;
    return count ?? 0;
  },
};
