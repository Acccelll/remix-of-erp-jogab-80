/** @module-kind io */
/**
 * Central API client for Planifik PHP backend.
 *
 * Includes a 401 interceptor: on detection, dispatches an `auth:expired` event
 * with a `resolve` callback. A global `ReauthDialog` listens for it, prompts
 * the user to re-login, then resolves; the original request is automatically
 * replayed once with the new token.
 */

import { fetchWithRetry } from "@/lib/core/http/withRetry";
import { logger } from "@/lib/core/logger";
import { swallow } from "@/lib/core/errors";
import { newCorrelationId } from "@/lib/observability/correlation";
import { structured } from "@/lib/observability/structured-logger";

const API_BASE = import.meta.env.VITE_API_URL || "https://jogab.com.br/api.php";

function getToken(): string | null {
  const directToken = localStorage.getItem("go_token");
  if (directToken) return directToken;
  try {
    const player = localStorage.getItem("go_player");
    if (player) {
      const parsed = JSON.parse(player);
      return parsed.token || null;
    }
  } catch (err) { swallow("api.readToken", err, "player token ausente"); }
  return null;
}

function isLocalFallbackToken(token: string | null): boolean {
  return !!token && token.startsWith("local-admin-");
}

// ── Reauth queue: enquanto reauth está pendente, demais 401s aguardam a mesma promise ──
let pendingReauth: Promise<boolean> | null = null;

function requestReauth(): Promise<boolean> {
  if (pendingReauth) return pendingReauth;
  pendingReauth = new Promise<boolean>((resolve) => {
    const detail = {
      resolve: (success: boolean) => {
        pendingReauth = null;
        resolve(success);
      },
    };
    window.dispatchEvent(new CustomEvent("auth:expired", { detail }));
  });
  return pendingReauth;
}

// ── Status de saúde da Planifik (consumido por banner global) ──
let consecutiveFailures = 0;
let lastFailureAt = 0;
const FAIL_THRESHOLD = 3;
const FAIL_WINDOW_MS = 5 * 60 * 1000;

function noteSuccess() {
  if (consecutiveFailures > 0) {
    consecutiveFailures = 0;
    window.dispatchEvent(new CustomEvent("planifik:status", { detail: { healthy: true } }));
  }
}
function noteFailure(err: unknown) {
  const now = Date.now();
  if (now - lastFailureAt > FAIL_WINDOW_MS) consecutiveFailures = 0;
  consecutiveFailures += 1;
  lastFailureAt = now;
  logger.warn("planifik.api falha", { failures: consecutiveFailures, error: String(err) });
  if (consecutiveFailures >= FAIL_THRESHOLD) {
    window.dispatchEvent(new CustomEvent("planifik:status", { detail: { healthy: false } }));
  }
}
export function getPlanifikHealth() {
  return consecutiveFailures < FAIL_THRESHOLD;
}

async function doFetch(
  url: string,
  init: RequestInit,
  correlationId: string,
): Promise<Response> {
  const headers = new Headers(init.headers);
  const token = getToken();
  if (token && !isLocalFallbackToken(token)) headers.set("Authorization", `Bearer ${token}`);
  // Não enviar cabeçalhos de observabilidade customizados para a API PHP legada.
  // O servidor não permite `X-Correlation-Id` no CORS preflight e isso bloqueia
  // o login antes mesmo da requisição chegar ao endpoint.
  const isGet = (init.method ?? "GET").toUpperCase() === "GET";
  return fetchWithRetry(
    url,
    { ...init, headers },
    {
      label: "planifik.api",
      timeoutMs: 10000,
      maxAttempts: isGet ? 3 : 1,
    },
  );
}

export async function apiFetch<T = any>(
  route: string,
  options?: { method?: string; body?: any; params?: Record<string, string> },
): Promise<T> {
  const { method = "GET", body, params } = options || {};

  const url = new URL(API_BASE);
  url.searchParams.set("rota", route);
  if (params) {
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  }

  const init: RequestInit = {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  };

  const correlationId = newCorrelationId("api");
  const started = performance.now();

  let res: Response;
  try {
    res = await doFetch(url.toString(), init, correlationId);
  } catch (err) {
    noteFailure(err);
    structured.error("planifik.api.fail", {
      correlationId,
      fields: { route, method, error: err instanceof Error ? err.message : String(err) },
    });
    throw err;
  }

  // Handle 401: prompt user to re-login, then replay once.
  // Só abre o diálogo de reauth se HAVIA um token (sessão expirou).
  // Sem token, o usuário simplesmente ainda não logou — deixa a tela
  // de login lidar com isso e não empilhe um modal por cima.
  const token = getToken();
  if (res.status === 401 && route !== "login" && token && !isLocalFallbackToken(token)) {
    const ok = await requestReauth();
    if (ok) {
      try {
        res = await doFetch(url.toString(), init, correlationId);
      } catch (err) {
        noteFailure(err);
        structured.error("planifik.api.fail", {
          correlationId,
          fields: { route, method, error: err instanceof Error ? err.message : String(err), replayed: true },
        });
        throw err;
      }
    }
  }

  if (!res.ok) {
    if (res.status >= 500) noteFailure(`HTTP ${res.status}`);
    const errorBody = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
    structured.warn("planifik.api.http_error", {
      correlationId,
      fields: { route, method, status: res.status },
    });
    throw new Error(errorBody.error || `API error: ${res.status}`);
  }

  noteSuccess();
  structured.debug("planifik.api.ok", {
    correlationId,
    fields: { route, method, status: res.status, durationMs: Math.round(performance.now() - started) },
  });
  return res.json();
}

// ── Convenience helpers ──

export const api = {
  async getAll<T = any>(route: string, params?: Record<string, string>): Promise<T[]> {
    return apiFetch<T[]>(route, { params });
  },
  async getById<T = any>(route: string, id: string): Promise<T> {
    return apiFetch<T>(route, { params: { id } });
  },
  async create<T = any>(route: string, data: any): Promise<T> {
    return apiFetch<T>(route, { method: "POST", body: data });
  },
  async update<T = any>(route: string, id: string, data: any): Promise<T> {
    return apiFetch<T>(route, { method: "PUT", body: data, params: { id } });
  },
  async remove(route: string, id: string): Promise<void> {
    await apiFetch(route, { method: "DELETE", params: { id } });
  },
  async createMany<T = any>(route: string, data: any[]): Promise<T> {
    return apiFetch<T>(route, { method: "POST", body: data });
  },

  async mobilizar(payload: {
    colabId: string;
    obraDestinoId: string | null;
    dataProgramada: string | null;
    usuarioId: string | null;
    status?: string | null;
  }) {
    return apiFetch("mobilizar", { method: "POST", body: payload });
  },

  async mobilizarPatrimonio(payload: {
    patId: string;
    obraDestinoId: string | null;
    dataProgramada: string | null;
    usuarioId: string | null;
    status?: string;
  }) {
    return apiFetch("mobilizarPatrimonio", { method: "POST", body: payload });
  },

  async mobilizarVeiculo(payload: {
    vId: string;
    obraDestinoId: string | null;
    dataProgramada: string | null;
    usuarioId: string | null;
    status?: string;
  }) {
    return apiFetch("mobilizarVeiculo", { method: "POST", body: payload });
  },

  async saveDocumentoColaborador(payload: {
    colaborador_id: string;
    documento_id?: string | number | null;
    nome: string;
    dataVencimento: string | null;
    obrigatorio?: boolean;
    feriasId?: string | null;
  }) {
    return apiFetch("documentoColaborador", { method: "POST", body: payload });
  },

  async deleteDocumentoColaborador(colaboradorId: string, documentoId: string | number) {
    return apiFetch("documentoColaborador", {
      method: "DELETE",
      params: { colaborador_id: colaboradorId, documento_id: String(documentoId) },
    });
  },
};
