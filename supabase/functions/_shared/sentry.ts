/**
 * Wrapper Sentry para Supabase Edge Functions (H2.2).
 * Ativo só quando SENTRY_DSN_SERVER está no ambiente.
 */
import * as Sentry from "https://deno.land/x/sentry@8.50.0/index.mjs";
import { corsHeadersFor } from "./cors.ts";

let initialized = false;

function ensureInit() {
  if (initialized) return;
  const dsn = Deno.env.get("SENTRY_DSN_SERVER");
  if (!dsn) return;
  Sentry.init({
    dsn,
    environment: Deno.env.get("SUPABASE_ENV") ?? "production",
    tracesSampleRate: 0,
  });
  initialized = true;
}

export function withSentry(name: string, handler: (req: Request) => Promise<Response> | Response) {
  return async (req: Request): Promise<Response> => {
    ensureInit();
    try {
      return await handler(req);
    } catch (err) {
      try {
        if (initialized) {
          Sentry.captureException(err, { tags: { function: name } });
          await Sentry.flush(2000);
        }
      } catch {
        // ignore
      }
      console.error(`[${name}] uncaught`, err);
      // Mantém os cabeçalhos CORS na resposta de erro: sem eles, o browser
      // reporta uma falha opaca de CORS em vez da mensagem real do erro.
      return new Response(
        JSON.stringify({ error: err instanceof Error ? err.message : "internal_error" }),
        { status: 500, headers: { ...corsHeadersFor(req), "Content-Type": "application/json" } },
      );
    }
  };
}

export function reportEvent(
  source: string,
  kind: string,
  severity: "info" | "warn" | "error" | "critical",
  message: string,
) {
  try {
    if (initialized && (severity === "error" || severity === "critical")) {
      Sentry.captureMessage(
        `[${source}] ${kind}: ${message}`,
        severity === "critical" ? "fatal" : "error",
      );
    }
  } catch {
    // ignore
  }
}
