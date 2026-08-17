/** @module-kind io */
/**
 * SEC-007 slice-01 — Trilha de auditoria de segurança.
 *
 * Registra eventos de autenticação/autorização em `public.security_events`
 * (separado de `audit_logs`, que é de negócio, e de `system_events`, que é
 * operacional).
 *
 * O helper é *best-effort*: nunca lança, nunca bloqueia o fluxo chamador —
 * uma falha ao gravar a trilha não pode quebrar login/logout/permissão.
 * Erros são apenas logados via `logger` para inspeção posterior.
 *
 * Uso típico:
 * ```ts
 * await logSecurityEvent("login_ok", { email });
 * await logSecurityEvent("authz_denied", { origem: "/dp/folha", metadata: { motivo: "sem_grupo" } });
 * ```
 */
import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/lib/core/logger";

export type SecurityEventTipo =
  | "login_ok"
  | "login_fail"
  | "logout"
  | "reauth"
  | "authz_denied"
  | "perm_change"
  | "role_assigned"
  | "role_revoked"
  | "session_expired";

export interface SecurityEventInput {
  userId?: string | null;
  email?: string | null;
  origem?: string | null;
  sucesso?: boolean;
  metadata?: Record<string, unknown>;
}

/**
 * Captura user-agent do navegador de forma defensiva (SSR/tests seguros).
 * IP não é capturável no client — permanece null e deve ser preenchido por
 * edge function quando disponível.
 */
function currentUserAgent(): string | null {
  try {
    if (typeof navigator !== "undefined" && typeof navigator.userAgent === "string") {
      return navigator.userAgent.slice(0, 500);
    }
  } catch {
    /* ignore */
  }
  return null;
}

function currentOrigem(fallback?: string | null): string | null {
  if (fallback) return fallback.slice(0, 200);
  try {
    if (typeof window !== "undefined" && window.location) {
      return window.location.pathname.slice(0, 200);
    }
  } catch {
    /* ignore */
  }
  return null;
}

/**
 * Registra um evento de segurança. Nunca lança; retorna `true` se persistiu.
 * `sucesso` default:
 *   - `false` para `login_fail`, `authz_denied`, `session_expired`
 *   - `true`  para os demais tipos
 */
export async function logSecurityEvent(
  tipo: SecurityEventTipo,
  input: SecurityEventInput = {},
): Promise<boolean> {
  const sucessoDefault =
    tipo !== "login_fail" && tipo !== "authz_denied" && tipo !== "session_expired";

  const payload = {
    tipo,
    user_id: input.userId ?? null,
    email: input.email ?? null,
    ip: null, // capturado por edge function quando aplicável (SEC-007 slice-02)
    user_agent: currentUserAgent(),
    origem: currentOrigem(input.origem),
    sucesso: input.sucesso ?? sucessoDefault,
    metadata: input.metadata ?? {},
  } as const;

  try {
    const { data: sess } = await supabase.auth.getSession();
    if (!sess?.session) {
      // Sem sessão Supabase, o insert retornaria 401. Silencia sem tentar.
      return false;
    }
    const { error } = await (supabase as any).from("security_events").insert(payload as never);
    if (error) {
      logger?.warn?.("security_event_insert_failed", {
        tipo,
        error: error.message,
      });
      return false;
    }
    return true;
  } catch (err) {
    logger?.warn?.("security_event_insert_threw", {
      tipo,
      error: err instanceof Error ? err.message : String(err),
    });
    return false;
  }
}
