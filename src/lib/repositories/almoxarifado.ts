// @ts-nocheck
// Camada de acesso a `depositos` / `solicitacoes_almoxarifado` /
// `solicitacao_almoxarifado_itens` (Fase 2+3 da evolução de Suprimentos).
// Tabelas novas, ainda não refletidas em src/integrations/supabase/types.ts
// (tipos regenerados manualmente aqui até a próxima regeneração real).
import { supabase } from "@/integrations/supabase/client";
import { withDeadline } from "@/lib/core/http/withDeadline";

const RPC_DEADLINE_MS = 30_000;

export type DepositoRow = {
  id: string;
  nome: string;
  tipo: "central" | "obra";
  obra_id: string | null;
  ativo: boolean;
};

export type SolicitacaoAlmoxarifadoStatus = "triagem" | "resolvida" | "cancelada";
export type SolicitacaoOrigem = "planejada" | "campo";

export type SolicitacaoAlmoxarifadoRow = {
  id: string;
  obra_id: string;
  cronograma_item_id: string;
  card_recurso_id: string | null;
  origem: SolicitacaoOrigem;
  solicitante: string | null;
  urgencia: "normal" | "urgente";
  observacao: string | null;
  status: SolicitacaoAlmoxarifadoStatus;
  created_at: string;
};

export type SolicitacaoAlmoxarifadoItemRow = {
  id: string;
  solicitacao_id: string;
  insumo_id: string | null;
  descricao_livre: string | null;
  quantidade: number;
  unidade: string | null;
  atendido_estoque: boolean;
  requisicao_id: string | null;
};

function unwrap<T>(res: { data: T | null; error: unknown }): T {
  if (res.error) throw res.error as Error;
  return (res.data as T) ?? ([] as unknown as T);
}

export const depositosRepo = {
  async listAtivos(): Promise<DepositoRow[]> {
    return unwrap(
      await supabase
        .from("depositos")
        .select("id, nome, tipo, obra_id, ativo")
        .eq("ativo", true)
        .order("tipo")
        .order("nome"),
    );
  },
  async porObra(obraId: string): Promise<DepositoRow[]> {
    return unwrap(
      await supabase
        .from("depositos")
        .select("id, nome, tipo, obra_id, ativo")
        .eq("obra_id", obraId)
        .eq("ativo", true)
        .order("nome"),
    );
  },
};

export const solicitacoesAlmoxarifadoRepo = {
  async listPendentes(): Promise<SolicitacaoAlmoxarifadoRow[]> {
    return unwrap(
      await supabase
        .from("solicitacoes_almoxarifado")
        .select(
          "id, obra_id, cronograma_item_id, card_recurso_id, origem, solicitante, urgencia, observacao, status, created_at",
        )
        .eq("status", "triagem")
        .order("urgencia", { ascending: false })
        .order("created_at", { ascending: true }),
    );
  },
  async listItens(solicitacaoIds: string[]): Promise<SolicitacaoAlmoxarifadoItemRow[]> {
    if (!solicitacaoIds.length) return [];
    return unwrap(
      await supabase
        .from("solicitacao_almoxarifado_itens")
        .select(
          "id, solicitacao_id, insumo_id, descricao_livre, quantidade, unidade, atendido_estoque, requisicao_id",
        )
        .in("solicitacao_id", solicitacaoIds),
    );
  },
  async criarSolicitacaoCampo(payload: {
    obraId: string;
    cronogramaItemId: string;
    urgencia: "normal" | "urgente";
    observacao?: string;
    itens: { insumoId?: string | null; descricaoLivre?: string | null; quantidade: number; unidade?: string | null }[];
  }): Promise<string> {
    const { data: solicitacao, error: errHeader } = await supabase
      .from("solicitacoes_almoxarifado")
      .insert({
        obra_id: payload.obraId,
        cronograma_item_id: payload.cronogramaItemId,
        origem: "campo",
        urgencia: payload.urgencia,
        observacao: payload.observacao || null,
      })
      .select("id")
      .single();
    if (errHeader) throw errHeader;

    const itensPayload = payload.itens.map((i) => ({
      solicitacao_id: solicitacao.id,
      insumo_id: i.insumoId || null,
      descricao_livre: i.descricaoLivre || null,
      quantidade: i.quantidade,
      unidade: i.unidade || null,
    }));
    const { error: errItens } = await supabase
      .from("solicitacao_almoxarifado_itens")
      .insert(itensPayload);
    if (errItens) throw errItens;

    return solicitacao.id as string;
  },
  async atenderDoEstoque(itemId: string, depositoId: string): Promise<void> {
    const { error } = await withDeadline(
      supabase.rpc("fn_atender_item_estoque", { p_item_id: itemId, p_deposito_id: depositoId }),
      RPC_DEADLINE_MS,
      "almoxarifado.atenderDoEstoque",
    );
    if (error) throw error;
  },
  async encaminharParaCompras(itemId: string): Promise<void> {
    const { error } = await withDeadline(
      supabase.rpc("fn_encaminhar_item_compras", { p_item_id: itemId }),
      RPC_DEADLINE_MS,
      "almoxarifado.encaminharParaCompras",
    );
    if (error) throw error;
  },
};
