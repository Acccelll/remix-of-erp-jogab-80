/** @module-kind io */
// Registro de logins de usuários — persistência no MySQL via api.php
// (rota auditLogins; POST aberto para registrar tentativas falhas
// pré-token). O localStorage atua como cache local e fallback offline.
// Usado pela página de Auditoria (aba "Logins" e "última vez online").
import { apiFetch } from "@/lib/api";

const KEY = "planifik.login-log.v1";
const RECONCILED_FLAG = "planifik.login-log.reconciliadoEm";

export interface LoginEvent {
  id: string;
  userId: string;
  login: string;
  nome?: string | null;
  sucesso: boolean;
  createdAt: string; // ISO
  userAgent?: string;
}

function load(): LoginEvent[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as LoginEvent[]) : [];
  } catch {
    return [];
  }
}

function save(list: LoginEvent[]) {
  try {
    // mantém no máximo 2000 registros
    const trimmed = list.slice(-2000);
    localStorage.setItem(KEY, JSON.stringify(trimmed));
  } catch {
    /* ignore */
  }
}

function toApi(evt: LoginEvent) {
  return {
    user_id: evt.userId,
    login: evt.login,
    nome: evt.nome ?? null,
    sucesso: evt.sucesso,
    user_agent: evt.userAgent ?? null,
    created_at: evt.createdAt,
  };
}

function fromApi(r: any): LoginEvent {
  return {
    id: String(r.id),
    userId: String(r.user_id),
    login: r.login ?? "",
    nome: r.nome ?? null,
    sucesso: !!r.sucesso,
    createdAt: r.created_at,
    userAgent: r.user_agent ?? undefined,
  };
}

export function registrarLogin(evt: Omit<LoginEvent, "id" | "createdAt" | "userAgent">) {
  const createdAt = new Date().toISOString();
  const userAgent = typeof navigator !== "undefined" ? navigator.userAgent : undefined;
  const full: LoginEvent = {
    ...evt,
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt,
    userAgent,
  };
  const list = load();
  list.push(full);
  save(list);
  // Persistência real no MySQL (best-effort — não bloqueia o login).
  void apiFetch("auditLogins", { method: "POST", body: toApi(full) }).catch(() => {
    /* silencioso: fallback é o localStorage acima */
  });
}

/** Empurra o histórico local legado para o MySQL (uma vez por navegador). */
async function reconciliarLegado(): Promise<void> {
  if (localStorage.getItem(RECONCILED_FLAG)) return;
  const locais = load();
  if (locais.length > 0) {
    await apiFetch("auditLogins", {
      method: "POST",
      body: { rows: locais.slice(-500).map(toApi) },
    });
  }
  localStorage.setItem(RECONCILED_FLAG, new Date().toISOString());
}

/**
 * Lê os logins da fonte canônica (MySQL). Reconcilia o legado local na
 * primeira chamada; em falha de rede degrada para o cache localStorage.
 */
export async function listarLoginsRemoto(): Promise<LoginEvent[]> {
  try {
    await reconciliarLegado();
  } catch {
    /* tenta na próxima sessão */
  }
  try {
    const rows = await apiFetch<any[]>("auditLogins");
    return (Array.isArray(rows) ? rows : []).map(fromApi);
  } catch {
    return listarLogins();
  }
}

/** Cache local (fallback offline). Preferir `listarLoginsRemoto` na UI. */
export function listarLogins(): LoginEvent[] {
  return load().sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function ultimosLoginsPorUsuario(eventos?: LoginEvent[]): Map<string, LoginEvent> {
  const map = new Map<string, LoginEvent>();
  for (const evt of eventos ?? load()) {
    if (!evt.sucesso) continue;
    const prev = map.get(evt.userId);
    if (!prev || prev.createdAt < evt.createdAt) map.set(evt.userId, evt);
  }
  return map;
}
