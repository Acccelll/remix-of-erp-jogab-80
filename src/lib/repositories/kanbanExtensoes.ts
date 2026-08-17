/**
 * ETAPA 2 · Repositório da camada de extensões e vínculos.
 *
 * Toda escrita de vínculo passa por RPCs `SECURITY DEFINER` que validam
 * existência da entidade, empresa, duplicidade e permissão no servidor.
 */
import { supabase } from "@/integrations/supabase/client";
import type {
  BoardExtensao,
  CardTipo,
  CardVinculo,
  EntidadeResumo,
} from "@/lib/quadros/extensoes/tipos";

function unwrap<T>(res: { data: T | null; error: unknown }): T {
  if (res.error) throw res.error as Error;
  return (res.data ?? []) as T;
}

export const kanbanExtensoesRepo = {
  async listCatalogo() {
    return unwrap(
      await supabase
        .from("kanban_extensoes")
        .select("id,codigo,nome,descricao,icone,versao,modulo,entity_types,ativo,ordem")
        .eq("ativo", true)
        .order("ordem"),
    ) as Array<Record<string, unknown>>;
  },

  async listByBoard(boardId: string): Promise<BoardExtensao[]> {
    const rows = unwrap(
      await supabase
        .from("board_extensoes")
        .select("id,board_id,extensao_codigo,ativo,mostrar_resumo,ordem,config")
        .eq("board_id", boardId)
        .order("ordem"),
    ) as unknown as BoardExtensao[];
    return rows;
  },

  async ativar(boardId: string, codigo: string, ativo: boolean, userId: string | null) {
    const { error } = await supabase.from("board_extensoes").upsert(
      {
        board_id: boardId,
        extensao_codigo: codigo,
        ativo,
        ativado_por: userId,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "board_id,extensao_codigo" },
    );
    if (error) throw error;
    await supabase.from("kanban_extensao_log").insert({
      board_id: boardId,
      extensao_codigo: codigo,
      acao: ativo ? "extensao_ativada" : "extensao_desativada",
      resultado: "ok",
      ator_id: userId,
    });
  },

  async configurar(
    boardId: string,
    codigo: string,
    patch: { mostrar_resumo?: boolean; ordem?: number; config?: Record<string, unknown> },
  ) {
    const { error } = await supabase
      .from("board_extensoes")
      .update({ ...patch, config: patch.config as never, updated_at: new Date().toISOString() })
      .eq("board_id", boardId)
      .eq("extensao_codigo", codigo);
    if (error) throw error;
  },
};

export const cardTiposRepo = {
  async list(): Promise<CardTipo[]> {
    return unwrap(
      await supabase
        .from("card_tipos")
        .select("id,codigo,nome,descricao,icone,cor,extensoes_padrao,sistema,ativo,ordem")
        .eq("ativo", true)
        .order("ordem"),
    ) as unknown as CardTipo[];
  },
  async criar(payload: {
    codigo: string;
    nome: string;
    descricao?: string | null;
    icone?: string | null;
    cor?: string | null;
    extensoes_padrao?: string[];
  }) {
    const { error } = await supabase.from("card_tipos").insert(payload);
    if (error) throw error;
  },
  async aplicarAoCard(cardId: string, tipoId: string | null) {
    const { error } = await supabase.from("cards").update({ card_tipo_id: tipoId }).eq("id", cardId);
    if (error) throw error;
  },
};

export const cardVinculosRepo = {
  async listByCard(cardId: string): Promise<CardVinculo[]> {
    const { data, error } = await supabase.rpc("card_entity_links_listar", {
      p_card_id: cardId,
    });
    if (error) throw error;
    return (data ?? []) as unknown as CardVinculo[];
  },

  async criar(input: {
    cardId: string;
    extensao: string;
    entityType: string;
    entityId: string;
    relationship?: string;
    isPrimary?: boolean;
  }): Promise<string> {
    const { data, error } = await supabase.rpc("card_entity_link_criar", {
      p_card_id: input.cardId,
      p_extensao: input.extensao,
      p_entity_type: input.entityType,
      p_entity_id: input.entityId,
      p_relationship_type: input.relationship ?? "relacionado",
      p_is_primary: input.isPrimary ?? false,
    });
    if (error) throw error;
    return data as unknown as string;
  },

  async remover(linkId: string, arquivar = true) {
    const { error } = await supabase.rpc("card_entity_link_remover", {
      p_link_id: linkId,
      p_arquivar: arquivar,
    });
    if (error) throw error;
  },

  async definirPrincipal(linkId: string) {
    const { error } = await supabase.rpc("card_entity_link_definir_principal", {
      p_link_id: linkId,
    });
    if (error) throw error;
  },

  async reordenar(linkId: string, ordem: number) {
    const { error } = await supabase.rpc("card_entity_link_reordenar", {
      p_link_id: linkId,
      p_ordem: ordem,
    });
    if (error) throw error;
  },

  async cardsPorEntidade(entityType: string, entityId: string) {
    const { data, error } = await supabase.rpc("cards_por_entidade", {
      p_entity_type: entityType,
      p_entity_id: entityId,
    });
    if (error) throw error;
    return (data ?? []) as Array<{
      card_id: string;
      numero: number;
      titulo: string;
      status: string | null;
      arquivado: boolean;
      board_id: string | null;
      board_nome: string | null;
    }>;
  },

  async registrarAcao(cardId: string, extensao: string, acao: string, resultado = "ok") {
    const { error } = await supabase.rpc("kanban_extensao_registrar_acao", {
      p_card_id: cardId,
      p_extensao: extensao,
      p_acao: acao,
      p_resultado: resultado,
    });
    if (error) throw error;
  },

  async logByCard(cardId: string) {
    return unwrap(
      await supabase
        .from("kanban_extensao_log")
        .select("id,acao,resultado,extensao_codigo,entity_type,entity_id,ator_id,created_at")
        .eq("card_id", cardId)
        .order("created_at", { ascending: false })
        .limit(50),
    ) as Array<Record<string, unknown>>;
  },
};

/** Buscas de entidade usadas pelos adaptadores (respeitam RLS do módulo). */
export const entidadesRepo = {
  async buscarObras(termo: string, limite = 20): Promise<EntidadeResumo[]> {
    let q = supabase.from("obras").select("id,nome,codigo,status,ativa,empresa_id").limit(limite);
    if (termo) q = q.ilike("nome", `%${termo}%`);
    const { data, error } = await q;
    if (error) throw error;
    return (data ?? []).map((o) => ({
      id: o.id as string,
      entityType: "obra" as const,
      nome: (o.nome as string) ?? "Obra",
      subtitulo: (o.codigo as string) ?? null,
      status: (o.status as string) ?? null,
      arquivada: o.ativa === false,
      empresaId: (o.empresa_id as string) ?? null,
    }));
  },

  async obraPorId(id: string): Promise<EntidadeResumo | null> {
    const { data, error } = await supabase
      .from("obras")
      .select("id,nome,codigo,status,ativa,empresa_id")
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;
    return {
      id: data.id as string,
      entityType: "obra",
      nome: (data.nome as string) ?? "Obra",
      subtitulo: (data.codigo as string) ?? null,
      status: (data.status as string) ?? null,
      arquivada: data.ativa === false,
      empresaId: (data.empresa_id as string) ?? null,
    };
  },

  async buscarCronogramaItens(termo: string, limite = 20): Promise<EntidadeResumo[]> {
    let q = supabase
      .from("cronograma_itens")
      .select("id,descricao,obra_id,ativo,data_inicio,data_fim")
      .limit(limite);
    if (termo) q = q.ilike("descricao", `%${termo}%`);
    const { data, error } = await q;
    if (error) throw error;
    return (data ?? []).map((i) => ({
      id: i.id as string,
      entityType: "cronograma_item" as const,
      nome: (i.descricao as string) ?? "Atividade",
      subtitulo: [i.data_inicio, i.data_fim].filter(Boolean).join(" → ") || null,
      arquivada: i.ativo === false,
      empresaId: null,
    }));
  },

  async cronogramaItemPorId(id: string): Promise<EntidadeResumo | null> {
    const { data, error } = await supabase
      .from("cronograma_itens")
      .select("id,descricao,obra_id,ativo,data_inicio,data_fim")
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;
    return {
      id: data.id as string,
      entityType: "cronograma_item",
      nome: (data.descricao as string) ?? "Atividade",
      subtitulo: [data.data_inicio, data.data_fim].filter(Boolean).join(" → ") || null,
      arquivada: data.ativo === false,
      empresaId: null,
    };
  },

  async buscarUsuarios(termo: string, limite = 20): Promise<EntidadeResumo[]> {
    let q = supabase.from("profiles").select("id,login,nome").limit(limite);
    if (termo) q = q.ilike("login", `%${termo}%`);
    const { data, error } = await q;
    if (error) throw error;
    return (data ?? []).map((p) => ({
      id: p.id as string,
      entityType: "usuario" as const,
      nome: (p.login as string) ?? (p.nome as string) ?? "Usuário",
      subtitulo: (p.nome as string) ?? null,
      empresaId: null,
    }));
  },

  async usuarioPorId(id: string): Promise<EntidadeResumo | null> {
    const { data, error } = await supabase
      .from("profiles")
      .select("id,login,nome")
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;
    return {
      id: data.id as string,
      entityType: "usuario",
      nome: (data.login as string) ?? (data.nome as string) ?? "Usuário",
      subtitulo: (data.nome as string) ?? null,
      empresaId: null,
    };
  },
};
