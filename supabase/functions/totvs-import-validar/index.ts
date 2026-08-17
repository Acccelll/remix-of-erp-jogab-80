/**
 * totvs-import-validar — H2.3
 *
 * Recebe um payload de import TOTVS (linhas brutas + hash) e:
 *   1. Valida formato mínimo (linhas, colunas obrigatórias).
 *   2. Registra em public.totvs_import_runs com status ok | parcial | erro.
 *   3. Publica system_events nas falhas.
 *
 * NÃO faz o upsert real do snapshot — apenas valida e registra a run,
 * deixando o pipeline existente intacto.
 */
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { authorizeCaller, unauthorized } from "../_shared/auth.ts";
import { withSentry, reportEvent } from "../_shared/sentry.ts";

interface Payload {
  arquivo_nome: string;
  arquivo_hash: string;
  linhas: Array<Record<string, unknown>>;
  snapshot_id?: string;
  user_id?: string;
}

const REQUIRED_COLS = ["centro_custo", "natureza", "valor"];

Deno.serve(
  withSentry("totvs-import-validar", async (req) => {
    if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

    // SEC: exige service_role, CRON_SECRET ou JWT de usuário autenticado.
    const auth = await authorizeCaller(req);
    if (!auth.ok) return unauthorized(corsHeaders);

    const url = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

    let body: Payload;
    try {
      body = await req.json();
    } catch {
      return new Response(JSON.stringify({ error: "invalid_json" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!body?.arquivo_hash || !Array.isArray(body?.linhas)) {
      return new Response(JSON.stringify({ error: "payload_invalido" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const total_recebidas = body.linhas.length;
    const erros: Array<{ linha: number; motivo: string }> = [];

    body.linhas.forEach((row, idx) => {
      for (const col of REQUIRED_COLS) {
        if (row[col] === undefined || row[col] === null || row[col] === "") {
          erros.push({ linha: idx + 1, motivo: `coluna_obrigatoria:${col}` });
          return;
        }
      }
      const v = Number(row.valor);
      if (!Number.isFinite(v)) {
        erros.push({ linha: idx + 1, motivo: "valor_nao_numerico" });
      }
    });

    const total_rejeitadas = erros.length;
    const total_processadas = total_recebidas - total_rejeitadas;
    const status = total_rejeitadas === 0 ? "ok" : total_processadas === 0 ? "erro" : "parcial";

    const { data: run, error: insErr } = await admin
      .from("totvs_import_runs")
      .insert({
        arquivo_nome: body.arquivo_nome ?? null,
        arquivo_hash: body.arquivo_hash,
        status,
        total_recebidas,
        total_processadas,
        total_rejeitadas,
        erros: erros.slice(0, 100),
        snapshot_id: body.snapshot_id ?? null,
        user_id: body.user_id ?? null,
      })
      .select("id")
      .single();

    if (insErr) {
      reportEvent("totvs-import-validar", "totvs_run_insert_falhou", "error", insErr.message);
      return new Response(JSON.stringify({ error: insErr.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (status !== "ok") {
      await admin.from("system_events").insert({
        kind: status === "erro" ? "totvs_import_falhou" : "totvs_import_parcial",
        severity: status === "erro" ? "error" : "warn",
        source: "totvs-import-validar",
        message: `Import TOTVS ${body.arquivo_nome ?? body.arquivo_hash} ${status}: ${total_rejeitadas}/${total_recebidas} rejeitadas.`,
        context: {
          run_id: run?.id,
          arquivo_hash: body.arquivo_hash,
          total_recebidas,
          total_processadas,
          total_rejeitadas,
          amostra_erros: erros.slice(0, 10),
        },
      });
    }

    return new Response(
      JSON.stringify({
        ok: true,
        run_id: run?.id,
        status,
        total_recebidas,
        total_processadas,
        total_rejeitadas,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }),
);
