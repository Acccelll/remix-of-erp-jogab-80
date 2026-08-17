/**
 * alertas-operacao — cron operacional (H2.2).
 * Verifica idade do snapshot TOTVS ativo e registra em system_events.
 */
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { authorizeCaller, unauthorized } from "../_shared/auth.ts";
import { withSentry, reportEvent } from "../_shared/sentry.ts";

const SNAPSHOT_WARN_DAYS = Number(Deno.env.get("SNAPSHOT_WARN_DAYS") ?? 3);
const SNAPSHOT_ERROR_DAYS = Number(Deno.env.get("SNAPSHOT_ERROR_DAYS") ?? 7);

Deno.serve(
  withSentry("alertas-operacao", async (req) => {
    if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

    // SEC: exige service_role, CRON_SECRET ou JWT de usuário autenticado.
    const auth = await authorizeCaller(req);
    if (!auth.ok) return unauthorized(corsHeaders);

    const url = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

    const results: Array<{ check: string; status: string; detail?: unknown }> = [];

    try {
      const { data: snap } = await admin
        .from("financeiro_snapshots")
        .select("id, importado_em")
        .order("importado_em", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!snap?.importado_em) {
        results.push({ check: "snapshot_totvs", status: "skip" });
      } else {
        const ageDays = Math.floor(
          (Date.now() - new Date(snap.importado_em).getTime()) / 86_400_000,
        );
        if (ageDays > SNAPSHOT_ERROR_DAYS) {
          const message = `Snapshot TOTVS com ${ageDays} dias (limite ${SNAPSHOT_ERROR_DAYS}).`;
          await admin.from("system_events").insert({
            kind: "snapshot_totvs_atrasado",
            severity: "error",
            source: "alertas-operacao",
            message,
            context: {
              age_days: ageDays,
              importado_em: snap.importado_em,
              snapshot_id: snap.id,
            },
          });
          reportEvent("alertas-operacao", "snapshot_totvs_atrasado", "error", message);
          results.push({ check: "snapshot_totvs", status: "error", detail: { ageDays } });
        } else if (ageDays > SNAPSHOT_WARN_DAYS) {
          await admin.from("system_events").insert({
            kind: "snapshot_totvs_atencao",
            severity: "warn",
            source: "alertas-operacao",
            message: `Snapshot TOTVS com ${ageDays} dias.`,
            context: { age_days: ageDays, importado_em: snap.importado_em },
          });
          results.push({ check: "snapshot_totvs", status: "warn", detail: { ageDays } });
        } else {
          results.push({ check: "snapshot_totvs", status: "ok", detail: { ageDays } });
        }
      }
    } catch (e) {
      results.push({ check: "snapshot_totvs", status: "fail", detail: String(e) });
    }

    return new Response(JSON.stringify({ ok: true, results }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }),
);
