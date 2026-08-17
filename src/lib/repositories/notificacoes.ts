/** @module-kind io */
// ARC-003 — repositório de acesso a dados de Notificações.
// Migrado do PHP (MySQL não tem a tabela) para Supabase (`public.notificacoes`).
import { supabase } from "@/integrations/supabase/client";
import type { Notificacao, RoleScope } from "@/lib/notificacoes";

export interface NotificacaoInsert {
  tipo: string;
  role_scope: RoleScope;
  target_id: string | null;
  titulo: string;
  mensagem: string | null;
  autor_login: string | null;
  autor_id: string | null;
  /** PRO-030 — `usuarios.id` do destinatário quando a notificação é dirigida. */
  destinatario_id: string | null;
  /** Setor da solicitação de origem (slug canônico) — pode ser nulo. */
  setor: string | null;
}

export interface NotificacaoCardInsert {
  user_id: string;
  tipo: string;
  card_id: string;
  texto: string;
}

const sb = supabase as any;

const SELECT_LIMIT = 200;

function mapRow(r: any): Notificacao {
  return {
    id: r.id,
    tipo: r.tipo,
    role_scope: r.role_scope,
    target_id: r.target_id,
    titulo: r.titulo,
    mensagem: r.mensagem,
    autor_login: r.autor_login,
    autor_id: r.autor_id,
    destinatario_id: r.destinatario_id ?? null,
    setor: r.setor ?? null,
    lida_por: r.lida_por || [],
    created_at: r.created_at,
  } as Notificacao;
}

export const notificacoesRepo = {
  async insert(payload: NotificacaoInsert): Promise<void> {
    const { error } = await sb.from("notificacoes").insert({
      tipo: payload.tipo,
      role_scope: payload.role_scope,
      target_id: payload.target_id,
      titulo: payload.titulo,
      mensagem: payload.mensagem,
      autor_login: payload.autor_login,
      autor_id: payload.autor_id,
      destinatario_id: payload.destinatario_id,
      setor: payload.setor,
      lida_por: [],
    });
    if (error) throw error;
  },

  async insertCard(payload: NotificacaoCardInsert) {
    const { data, error } = await sb.from("notificacoes").insert({
      tipo: payload.tipo,
      role_scope: "user",
      target_id: payload.card_id,
      titulo: `Notificação de card: ${payload.card_id}`,
      mensagem: payload.texto,
      // PRO-030 — o id aqui é de QUEM RECEBE, não de quem escreveu: passou a
      // morar em `destinatario_id`, a coluna com esse significado.
      destinatario_id: payload.user_id,
      lida_por: [],
    }).select().single();
    if (error) throw error;
    return { data, error: null };
  },

  async insertManyCard(rows: NotificacaoCardInsert[]) {
    if (!rows.length) return { data: null, error: null };
    const results = await Promise.all(rows.map((r) => this.insertCard(r)));
    return { data: results, error: null };
  },

  async listByScopes(scopes: RoleScope[]): Promise<Notificacao[]> {
    if (scopes.length === 0) return [];
    try {
      const { data, error } = await sb
        .from("notificacoes")
        .select("*")
        .in("role_scope", scopes)
        .order("created_at", { ascending: false })
        .limit(SELECT_LIMIT);
      if (error) throw error;
      return (data || []).map(mapRow);
    } catch (err) {
      console.error("notificacoesRepo.listByScopes error", err);
      return [];
    }
  },

  /**
   * PRO-030 — notificações dirigidas a um usuário (`destinatario_id`).
   *
   * Query separada da de escopo, em vez de um `.or()` único, para não
   * interpolar o id na DSL de filtro do PostgREST — onde vírgula e parêntese
   * são sintaxe. `.eq()` manda o valor como parâmetro.
   */
  async listDirigidas(destinatarioId: string): Promise<Notificacao[]> {
    if (!destinatarioId) return [];
    try {
      const { data, error } = await sb
        .from("notificacoes")
        .select("*")
        .eq("destinatario_id", destinatarioId)
        .order("created_at", { ascending: false })
        .limit(SELECT_LIMIT);
      if (error) throw error;
      return (data || []).map(mapRow);
    } catch (err) {
      console.error("notificacoesRepo.listDirigidas error", err);
      return [];
    }
  },

  async updateLidaPor(notifId: string, lidaPor: string[]): Promise<void> {
    const { error } = await sb
      .from("notificacoes")
      .update({ lida_por: lidaPor })
      .eq("id", notifId);
    if (error) throw error;
  },
};
