// Guarda de autenticação compartilhada para edge functions que escrevem no
// banco com a service_role key.
//
// Aceita:
//  1. `Authorization: Bearer <service_role_key>` — usado por jobs agendados
//     (pg_cron/net.http_post) e chamadas server-to-server confiáveis;
//  2. `x-cron-secret: <CRON_SECRET>` — segredo compartilhado opcional;
//  3. um JWT válido de usuário autenticado do Supabase.
//
// Sem nenhum dos três, o handler deve responder 401.

import { createClient } from "npm:@supabase/supabase-js@2";

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export type CallerKind = "service" | "cron" | "user";

export interface AuthResult {
  ok: boolean;
  kind?: CallerKind;
  userId?: string;
}

export async function authorizeCaller(req: Request): Promise<AuthResult> {
  const authHeader = req.headers.get("Authorization") ?? "";
  const bearer = authHeader.toLowerCase().startsWith("bearer ")
    ? authHeader.slice(7).trim()
    : "";

  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (bearer && serviceKey && safeEqual(bearer, serviceKey)) {
    return { ok: true, kind: "service" };
  }

  const cronSecret = Deno.env.get("CRON_SECRET") ?? "";
  const providedCron = req.headers.get("x-cron-secret") ?? "";
  if (cronSecret && providedCron && safeEqual(providedCron, cronSecret)) {
    return { ok: true, kind: "cron" };
  }

  if (bearer) {
    try {
      const supabase = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_ANON_KEY")!,
        { auth: { persistSession: false } },
      );
      const { data, error } = await supabase.auth.getClaims(bearer);
      if (!error && data?.claims?.sub) {
        return { ok: true, kind: "user", userId: String(data.claims.sub) };
      }
    } catch {
      // token inválido — cai no retorno abaixo
    }
  }

  return { ok: false };
}

export function unauthorized(corsHeaders: Record<string, string>): Response {
  return new Response(JSON.stringify({ error: "Unauthorized" }), {
    status: 401,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
