/** @module-kind io */
/**
 * Fetch interceptor — OPS-003.slice-03
 *
 * Instala um wrapper sobre `globalThis.fetch` que, para requisições
 * feitas aos hosts alvo (por padrão: `VITE_SUPABASE_URL` + rota
 * `/functions/v1/`), garante o header `X-Correlation-Id`:
 * - usa o id do contexto corrente (`getCorrelationId()`);
 * - senão, gera um id efêmero (`newCorrelationId("sb")`).
 *
 * Também emite eventos estruturados por request:
 *   `sb.fetch.ok` | `sb.fetch.http_error` | `sb.fetch.fail`
 *
 * Idempotente: instalar duas vezes não empilha wrappers.
 * Não altera o cliente supabase-js gerado automaticamente.
 */

import { getCorrelationId, newCorrelationId } from "./correlation";
import { structured } from "./structured-logger";

type FetchFn = typeof fetch;

interface InstallOptions {
  /** Hosts (origin) que devem receber o header. */
  matchHosts?: string[];
  /** Trechos de path que sinalizam alvo (ex.: "/functions/v1/"). */
  matchPathIncludes?: string[];
}

let installed = false;
let originalFetch: FetchFn | null = null;

function urlOf(input: RequestInfo | URL): string {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.toString();
  if (typeof Request !== "undefined" && input instanceof Request) return input.url;
  return String(input);
}

function shouldInstrument(
  urlStr: string,
  hosts: string[],
  pathIncludes: string[],
): boolean {
  try {
    const u = new URL(urlStr, "http://local/");
    if (hosts.some((h) => h && u.host === new URL(h).host)) return true;
    if (pathIncludes.some((p) => p && u.pathname.includes(p))) return true;
    return false;
  } catch {
    return false;
  }
}

export function installFetchInterceptor(opts: InstallOptions = {}): void {
  if (installed) return;
  const g = globalThis as unknown as { fetch: FetchFn };
  if (typeof g.fetch !== "function") return;

  installed = true;
  originalFetch = g.fetch.bind(globalThis);

  const supabaseUrl =
    (import.meta as ImportMeta & { env?: { VITE_SUPABASE_URL?: string } }).env
      ?.VITE_SUPABASE_URL ?? "";
  const hosts = opts.matchHosts ?? (supabaseUrl ? [supabaseUrl] : []);
  const pathIncludes = opts.matchPathIncludes ?? ["/functions/v1/"];

  const wrapped: FetchFn = async (input, init) => {
    const urlStr = urlOf(input);
    if (!shouldInstrument(urlStr, hosts, pathIncludes)) {
      return originalFetch!(input, init);
    }

    const correlationId = getCorrelationId() ?? newCorrelationId("sb");
    const headers = new Headers(init?.headers);
    if (!headers.has("X-Correlation-Id")) {
      headers.set("X-Correlation-Id", correlationId);
    }

    const started =
      typeof performance !== "undefined" ? performance.now() : Date.now();
    try {
      const res = await originalFetch!(input, { ...init, headers });
      const durationMs = Math.round(
        (typeof performance !== "undefined" ? performance.now() : Date.now()) -
          started,
      );
      if (!res.ok) {
        structured.warn("sb.fetch.http_error", {
          correlationId,
          fields: { url: urlStr, status: res.status, durationMs },
        });
      } else {
        structured.debug("sb.fetch.ok", {
          correlationId,
          fields: { url: urlStr, status: res.status, durationMs },
        });
      }
      return res;
    } catch (err) {
      structured.error("sb.fetch.fail", {
        correlationId,
        fields: {
          url: urlStr,
          error: err instanceof Error ? err.message : String(err),
        },
      });
      throw err;
    }
  };

  g.fetch = wrapped;
}

/** Uso em testes. */
export function __uninstallFetchInterceptorForTests(): void {
  if (!installed || !originalFetch) return;
  (globalThis as unknown as { fetch: FetchFn }).fetch = originalFetch;
  installed = false;
  originalFetch = null;
}
