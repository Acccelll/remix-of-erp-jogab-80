/** @module-kind io */
// ARC-003 — acesso a dados delegado a `notificacoesRepo`.
import { notificacoesRepo } from "@/lib/repositories/notificacoes";
import { logger } from "@/lib/core/logger";
import { STORAGE_KEYS } from "@/lib/core/storage/keys";
import { mesclarNotificacoes } from "./policy";

export {
  deveNotificarCriador,
  mesclarNotificacoes,
  filtrarNotificacoesPorSetor,
} from "./policy";


/**
 * Canal de entrega. `compras`/`financeiro` são setores — quem tem o módulo vê
 * tudo do escopo. `user` (PRO-030) é notificação dirigida: não pertence a setor
 * nenhum e chega só a quem está em `destinatario_id`.
 */
export type RoleScope = "compras" | "financeiro" | "user";

export interface Notificacao {
  id: string;
  tipo: string;
  role_scope: RoleScope;
  target_id: string | null;
  titulo: string;
  mensagem: string | null;
  autor_login: string | null;
  autor_id: string | null;
  /** `usuarios.id` do destinatário — preenchido só quando `role_scope` é `user`. */
  destinatario_id: string | null;
  /** Setor da solicitação de origem — usado para não vazar aviso entre setores. */
  setor: string | null;
  lida_por: string[];
  created_at: string;

}

// PRO-030 — Dedupe client-side por chave estável.
// Evita reinserir a mesma notificação quando o mesmo trigger reexecuta
// (ex.: `useContratosVencendo` a cada montagem do banner).
const DEDUPE_STORAGE_KEY = STORAGE_KEYS.notifDedupe;
const DEDUPE_MAX = 500;

function loadDedupeSet(): Set<string> {
  try {
    const raw = localStorage.getItem(DEDUPE_STORAGE_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? new Set(arr) : new Set();
  } catch {
    return new Set();
  }
}

function saveDedupeSet(set: Set<string>): void {
  try {
    const arr = Array.from(set);
    const trimmed = arr.length > DEDUPE_MAX ? arr.slice(-DEDUPE_MAX) : arr;
    localStorage.setItem(DEDUPE_STORAGE_KEY, JSON.stringify(trimmed));
  } catch {
    /* quota — ignora */
  }
}

/** Testabilidade. */
export function _resetNotificacaoDedupe(): void {
  try {
    localStorage.removeItem(DEDUPE_STORAGE_KEY);
  } catch {
    /* noop */
  }
}

export async function criarNotificacao(input: {
  tipo: string;
  role_scope: RoleScope;
  target_id?: string | null;
  titulo: string;
  mensagem?: string | null;
  autor_login?: string | null;
  autor_id?: string | null;
  /** PRO-030 — destinatário individual (`usuarios.id`). Use com `role_scope: "user"`. */
  destinatario_id?: string | null;
  /** Setor da solicitação de origem — restringe a entrega a quem tem esse setor. */
  setor?: string | null;
  /** PRO-030 — chave idempotente client-side. Se já registrada, ignora silenciosamente. */
  dedupeKey?: string;
}): Promise<{ inserted: boolean }> {
  if (input.dedupeKey) {
    const set = loadDedupeSet();
    if (set.has(input.dedupeKey)) return { inserted: false };
    set.add(input.dedupeKey);
    saveDedupeSet(set);
  }
  try {
    await notificacoesRepo.insert({
      tipo: input.tipo,
      role_scope: input.role_scope,
      target_id: input.target_id ?? null,
      titulo: input.titulo,
      mensagem: input.mensagem ?? null,
      autor_login: input.autor_login ?? null,
      autor_id: input.autor_id ?? null,
      destinatario_id: input.destinatario_id ?? null,
      setor: input.setor ?? null,
    });

    return { inserted: true };
  } catch (e) {
    logger.error("Erro ao criar notificação:", e);
    return { inserted: false };
  }
}

/**
 * Notificações que o usuário deve ver: as dos seus setores mais as dirigidas a
 * ele. Busca as dirigidas mesmo com `scopes` vazio — quem não tem módulo
 * financeiro continua recebendo o que é endereçado a ele.
 */
export async function fetchNotificacoes(
  scopes: RoleScope[],
  destinatarioId?: string | null,
): Promise<Notificacao[]> {
  try {
    const [porEscopo, dirigidas] = await Promise.all([
      notificacoesRepo.listByScopes(scopes),
      destinatarioId ? notificacoesRepo.listDirigidas(destinatarioId) : Promise.resolve([]),
    ]);
    return mesclarNotificacoes(porEscopo, dirigidas);
  } catch (e) {
    logger.error("Erro ao buscar notificações:", e);
    return [];
  }
}

export async function marcarComoLida(notifId: string, userId: string, current: string[]) {
  if (current.includes(userId)) return;
  const next = [...current, userId];
  try {
    await notificacoesRepo.updateLidaPor(notifId, next);
  } catch (e) {
    logger.error("Erro ao marcar como lida:", e);
  }
}
