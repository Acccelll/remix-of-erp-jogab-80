// @ts-nocheck
import { supabase } from "@/integrations/supabase/client";
import { withDeadline } from "@/lib/core/http/withDeadline";

const RPC_DEADLINE_MS = 30_000;

const ROMANEIO_COLS =
  "id, numero, status, obra_origem_id, obra_destino_id, veiculo_transportador_id, mobilizar_veiculo, veiculo_mobilizado_em, veiculo_mobilizacao_erro, data_programada, observacao, criado_por_nome, confirmado_em, created_at, updated_at";

function unwrap<T>(res: { data: T | null; error: unknown }): T {
  if (res.error) throw res.error as Error;
  return (res.data as T) ?? ([] as unknown as T);
}

/** Logística de Ativos & Frotas: romaneios (expedição de estoque + mobilização de patrimônio/veículo). */
export const romaneiosRepo = {
  async listResumo(filtro?: { status?: string; obraId?: string }) {
    let query = supabase
      .from("romaneios")
      .select(ROMANEIO_COLS)
      .order("created_at", { ascending: false });
    if (filtro?.status) query = query.eq("status", filtro.status);
    if (filtro?.obraId)
      query = query.or(`obra_origem_id.eq.${filtro.obraId},obra_destino_id.eq.${filtro.obraId}`);
    return unwrap<any[]>(await query);
  },

  async getById(id: string) {
    const romaneio = unwrap<any>(
      await supabase.from("romaneios").select(ROMANEIO_COLS).eq("id", id).single(),
    );
    const itensEstoque = unwrap<any[]>(
      await supabase
        .from("romaneio_itens_estoque")
        .select(
          "id, romaneio_id, insumo_id, quantidade, local_origem, local_destino, baixado, baixado_em, observacao",
        )
        .eq("romaneio_id", id)
        .order("created_at", { ascending: true }),
    );
    const itensPatrimonio = unwrap<any[]>(
      await supabase
        .from("romaneio_itens_patrimonio")
        .select(
          "id, romaneio_id, patrimonio_id, patrimonio_codigo, patrimonio_nome, mobilizado, mobilizado_em, mobilizacao_erro",
        )
        .eq("romaneio_id", id)
        .order("created_at", { ascending: true }),
    );
    return { romaneio, itensEstoque, itensPatrimonio };
  },

  async create(payload: {
    numero: string;
    obraOrigemId: string | null;
    obraDestinoId: string;
    veiculoTransportadorId?: string | null;
    mobilizarVeiculo?: boolean;
    dataProgramada?: string | null;
    observacao?: string | null;
    criadoPorNome?: string | null;
  }): Promise<string> {
    const { data, error } = await supabase
      .from("romaneios")
      .insert({
        numero: payload.numero,
        obra_origem_id: payload.obraOrigemId,
        obra_destino_id: payload.obraDestinoId,
        veiculo_transportador_id: payload.veiculoTransportadorId ?? null,
        mobilizar_veiculo: payload.mobilizarVeiculo ?? false,
        data_programada: payload.dataProgramada ?? null,
        observacao: payload.observacao ?? null,
        criado_por_nome: payload.criadoPorNome ?? null,
      })
      .select("id")
      .single();
    if (error) throw error;
    return (data as { id: string }).id;
  },

  async addItemEstoque(
    romaneioId: string,
    item: {
      insumoId: string;
      quantidade: number;
      localOrigem: string;
      localDestino: string;
      observacao?: string;
    },
  ): Promise<void> {
    const { error } = await supabase.from("romaneio_itens_estoque").insert({
      romaneio_id: romaneioId,
      insumo_id: item.insumoId,
      quantidade: item.quantidade,
      local_origem: item.localOrigem,
      local_destino: item.localDestino,
      observacao: item.observacao ?? null,
    });
    if (error) throw error;
  },

  async removeItemEstoque(itemId: string): Promise<void> {
    const { error } = await supabase.from("romaneio_itens_estoque").delete().eq("id", itemId);
    if (error) throw error;
  },

  async addItemPatrimonio(
    romaneioId: string,
    item: { patrimonioId: string; patrimonioCodigo?: string; patrimonioNome?: string },
  ): Promise<void> {
    const { error } = await supabase.from("romaneio_itens_patrimonio").insert({
      romaneio_id: romaneioId,
      patrimonio_id: item.patrimonioId,
      patrimonio_codigo: item.patrimonioCodigo ?? null,
      patrimonio_nome: item.patrimonioNome ?? null,
    });
    if (error) throw error;
  },

  async removeItemPatrimonio(itemId: string): Promise<void> {
    const { error } = await supabase.from("romaneio_itens_patrimonio").delete().eq("id", itemId);
    if (error) throw error;
  },

  async setVeiculoTransportador(
    romaneioId: string,
    veiculoId: string | null,
    mobilizar: boolean,
  ): Promise<void> {
    const { error } = await supabase
      .from("romaneios")
      .update({ veiculo_transportador_id: veiculoId, mobilizar_veiculo: mobilizar })
      .eq("id", romaneioId);
    if (error) throw error;
  },

  /** Leg 1 (atômica) da confirmação: baixa todos os itens de estoque via RPC. */
  async confirmarEstoque(romaneioId: string): Promise<{ ok: boolean }> {
    const { data, error } = await withDeadline<any>(
      supabase.rpc("fn_romaneio_confirmar_estoque", {
        p_romaneio_id: romaneioId,
      }) as unknown as Promise<any>,
      RPC_DEADLINE_MS,
    );
    if (error) throw error;
    return data as { ok: boolean };
  },

  async marcarItemPatrimonioMobilizado(
    itemId: string,
    sucesso: boolean,
    erro?: string,
  ): Promise<void> {
    const { error } = await supabase
      .from("romaneio_itens_patrimonio")
      .update(
        sucesso
          ? { mobilizado: true, mobilizado_em: new Date().toISOString(), mobilizacao_erro: null }
          : { mobilizado: false, mobilizacao_erro: erro ?? "Falha desconhecida" },
      )
      .eq("id", itemId);
    if (error) throw error;
  },

  async marcarVeiculoMobilizado(
    romaneioId: string,
    sucesso: boolean,
    erro?: string,
  ): Promise<void> {
    const { error } = await supabase
      .from("romaneios")
      .update(
        sucesso
          ? { veiculo_mobilizado_em: new Date().toISOString(), veiculo_mobilizacao_erro: null }
          : { veiculo_mobilizacao_erro: erro ?? "Falha desconhecida" },
      )
      .eq("id", romaneioId);
    if (error) throw error;
  },

  async setStatusFinal(
    romaneioId: string,
    status: "confirmado" | "confirmado_parcial",
  ): Promise<void> {
    const { error } = await supabase
      .from("romaneios")
      .update({ status, confirmado_em: new Date().toISOString() })
      .eq("id", romaneioId);
    if (error) throw error;
  },

  async cancelar(romaneioId: string): Promise<void> {
    const { error } = await supabase
      .from("romaneios")
      .update({ status: "cancelado" })
      .eq("id", romaneioId);
    if (error) throw error;
  },
};
