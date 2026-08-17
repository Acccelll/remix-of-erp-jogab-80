/**
 * card-prazo-lembrete
 *
 * Job diário: gera notificações de prazo para cards (genéricos e de recurso).
 * - Para cada card com prazo = hoje ou amanhã, status != concluido,
 *   arquivado=false e responsavel_id não nulo, cria 1 notificação por dia
 *   (deduplica via consulta antes do insert).
 *
 * Agendado via pg_cron (ver supabase/insert SQL fora da migração).
 */
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { authorizeCaller, unauthorized } from "../_shared/auth.ts";
import { withSentry } from "../_shared/sentry.ts";

Deno.serve(
  withSentry("card-prazo-lembrete", async (req) => {
    if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

    // SEC: exige service_role, CRON_SECRET ou JWT de usuário autenticado.
    const auth = await authorizeCaller(req);
    if (!auth.ok) return unauthorized(corsHeaders);

    const url = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const amanha = new Date(hoje);
    amanha.setDate(amanha.getDate() + 1);
    const fmt = (d: Date) => d.toISOString().slice(0, 10);

    // Cards com prazo hoje ou amanhã (genéricos e de recurso)
    const { data: cards, error } = await admin
      .from("cards")
      .select("id, numero, titulo, prazo, responsavel_id, status, tipo")
      .in("tipo", ["generico", "recurso"])
      .eq("arquivado", false)
      .neq("status", "concluido")
      .not("responsavel_id", "is", null)
      .in("prazo", [fmt(hoje), fmt(amanha)]);

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let criadas = 0;
    let puladas = 0;

    for (const c of cards ?? []) {
      const venceHoje = c.prazo === fmt(hoje);
      const texto = venceHoje
        ? `Prazo HOJE — #${c.numero} ${c.titulo}`
        : `Prazo amanhã — #${c.numero} ${c.titulo}`;

      // Deduplicação: já existe notificação do mesmo tipo/card/usuário criada hoje?
      const inicioDia = new Date(hoje).toISOString();
      const { data: existente } = await admin
        .from("notificacoes")
        .select("id")
        .eq("user_id", c.responsavel_id)
        .eq("card_id", c.id)
        .eq("tipo", "prazo")
        .gte("created_at", inicioDia)
        .limit(1);

      if (existente && existente.length > 0) {
        puladas++;
        continue;
      }

      const { error: insErr } = await admin.from("notificacoes").insert({
        user_id: c.responsavel_id,
        tipo: "prazo",
        card_id: c.id,
        texto,
      });
      if (!insErr) criadas++;
    }

    // Auto-arquivar cards "concluido" há > 30 dias (Passo 1.8)
    let arquivados = 0;
    const { data: arqData, error: arqErr } = await admin.rpc("fn_auto_arquivar_concluidos");
    if (!arqErr && typeof arqData === "number") arquivados = arqData;

    return new Response(
      JSON.stringify({ ok: true, total: cards?.length ?? 0, criadas, puladas, arquivados }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }),
);
