import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import * as Sentry from "https://deno.land/x/sentry@8.40.0/index.mjs";
// SEC-003 (Onda 0): CORS por allowlist estrita, sem fallback "*".
import { corsHeadersFor, handlePreflight, isOriginAllowed } from "../_shared/cors.ts";

const SENTRY_DSN = Deno.env.get("SENTRY_DSN");
if (SENTRY_DSN) {
  Sentry.init({ dsn: SENTRY_DSN, tracesSampleRate: 0.1 });
}

/**
 * H3.1.b — Cria (ou recria) uma obra-sandbox para treinamento.
 * Mode: 'create' (default) cria uma nova obra com nome [DEMO] timestamp.
 * Mode: 'reset' apaga todas as obras [DEMO]* do solicitante e cria uma nova.
 * Apenas usuários com profiles.is_gm = true podem invocar.
 */
Deno.serve(async (req) => {
  const preflight = handlePreflight(req);
  if (preflight) return preflight;
  const corsHeaders = corsHeadersFor(req);
  if (!isOriginAllowed(req)) {
    return new Response(JSON.stringify({ error: "origin not allowed" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace(/^Bearer\s+/i, "");
    if (!token) {
      return new Response(JSON.stringify({ error: "missing auth" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Cliente com JWT do usuário para identificar quem chamou
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData } = await userClient.auth.getUser();
    const userId = userData?.user?.id;
    if (!userId) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Service client para checar GM e operar sem RLS
    const admin = createClient(supabaseUrl, serviceKey);
    const { data: profile } = await admin
      .from("profiles")
      .select("is_gm")
      .eq("id", userId)
      .maybeSingle();
    if (!profile?.is_gm) {
      return new Response(JSON.stringify({ error: "forbidden (gm only)" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const mode = body.mode === "reset" ? "reset" : "create";

    if (mode === "reset") {
      // Apaga todas as obras [DEMO]* (cascade nas tabelas filhas via FK)
      await admin.from("obras").delete().ilike("nome", "[DEMO]%");
    }

    const timestamp = new Date().toISOString().slice(0, 16).replace("T", " ");
    const nome = `[DEMO] Treinamento ${timestamp}`;

    const { data: obra, error: obraErr } = await admin
      .from("obras")
      .insert({ nome, status: "ativa" as never })
      .select("id, nome")
      .single();
    if (obraErr) throw obraErr;

    // Cria alguns cards de exemplo (canteiro)
    const cardsSeed = [
      { titulo: "Demolição da alvenaria existente", descricao: "Pavimento térreo" },
      { titulo: "Preparar canteiro para concretagem", descricao: "Pilares P1 a P4" },
      { titulo: "Receber armação de aço", descricao: "Conferir notas e quantidades" },
      { titulo: "Inspeção elétrica — quadro Q1", descricao: "Antes de fechar forros" },
    ];
    for (const c of cardsSeed) {
      await admin.from("cards").insert({
        titulo: c.titulo,
        descricao: c.descricao,
        obra_id: obra.id,
        criado_por: userId,
      } as never);
    }

    return new Response(
      JSON.stringify({
        ok: true,
        obra,
        cards_criados: cardsSeed.length,
        mode,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (err) {
    Sentry.captureException?.(err);
    const message = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
