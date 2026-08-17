// Edge function: sincroniza credenciais PHP -> Supabase Auth.
// Recebe {login, senha}, valida no backend PHP, garante que existe um
// auth.users com email ${login}@planifik.local e senha igual à do PHP.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
// SEC-003 (Onda 0): CORS por allowlist estrita, sem fallback "*".
import { corsHeadersFor, handlePreflight, isOriginAllowed } from "../_shared/cors.ts";

const PHP_API_URL = Deno.env.get("PHP_API_URL") || "https://jogab.com.br/api.php";

/**
 * Cópia da regra de `src/lib/auth/identidade.ts` (`emailDoLogin`) — Deno não
 * importa do bundle do app. As duas precisam gerar a mesma string, senão o
 * front procura uma conta que esta função criou com outro nome.
 *
 * O acento tem de cair: "Letícia.Flink" geraria `letícia.flink@planifik.local`,
 * que o GoTrue não aceita — a conta nunca era criada e a sessão não subia.
 */
function emailFromLogin(login: string) {
  const semAcento = login.trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  return `${semAcento}@planifik.local`;
}

// Valores do enum public.app_role atribuíveis como setor (gm/comum são roles
// base, nunca setores). current_has_setor() compara role::text accent-folded.
const SETORES_VALIDOS = [
  "engenharia",
  "dp",
  "financeiro",
  "compras",
  "seguranca",
  "fiscalizacao",
  "qualidade",
  "almoxarifado",
  "frotas",
] as const;

function rolesDesejados(isGm: boolean, setores: unknown): string[] {
  const roles = new Set<string>([isGm ? "gm" : "comum"]);
  if (Array.isArray(setores)) {
    for (const s of setores) {
      if (typeof s !== "string") continue;
      const norm = s.trim().toLowerCase();
      if ((SETORES_VALIDOS as readonly string[]).includes(norm)) roles.add(norm);
    }
  }
  return [...roles];
}

// Sincroniza public.user_roles do usuário com o estado do MySQL (idempotente):
// insere roles que faltam, remove os que saíram. RLS do financeiro
// (current_is_gm/current_has_setor) lê desta tabela.
async function sincronizarUserRoles(
  admin: ReturnType<typeof createClient>,
  userId: string,
  desejados: string[],
) {
  const { data: atuais, error: readErr } = await admin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);
  if (readErr) throw readErr;
  const atuaisSet = new Set((atuais ?? []).map((r: { role: string }) => String(r.role)));
  const inserir = desejados.filter((r) => !atuaisSet.has(r));
  const remover = [...atuaisSet].filter((r) => !desejados.includes(r));
  if (inserir.length > 0) {
    const { error } = await admin
      .from("user_roles")
      .upsert(
        inserir.map((role) => ({ user_id: userId, role })),
        { onConflict: "user_id,role", ignoreDuplicates: true },
      );
    if (error) throw error;
  }
  if (remover.length > 0) {
    const { error } = await admin
      .from("user_roles")
      .delete()
      .eq("user_id", userId)
      .in("role", remover);
    if (error) throw error;
  }
}

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
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const { login, senha } = await req.json().catch(() => ({}));
    if (typeof login !== "string" || !login.trim() || typeof senha !== "string" || !senha) {
      return new Response(JSON.stringify({ error: "login e senha são obrigatórios" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (login.length > 64 || senha.length > 256) {
      return new Response(JSON.stringify({ error: "payload muito grande" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 1. Valida as credenciais no backend PHP (anti-abuso)
    const phpUrl = new URL(PHP_API_URL);
    phpUrl.searchParams.set("rota", "login");
    const phpRes = await fetch(phpUrl.toString(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: login, password: senha }),
      // SEC-006 slice-02: timeout p/ não estourar o limite da edge function
      signal: AbortSignal.timeout(10_000),
    });
    if (!phpRes.ok) {
      return new Response(JSON.stringify({ error: "Credenciais inválidas" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const phpData = await phpRes.json().catch(() => null);
    const playerId = phpData?.user_id ?? phpData?.id ?? null;
    const nome = phpData?.nome ?? login;
    // PRO-031 · Fase 4 — roles derivados do response do PHP (server-side; o
    // cliente não envia roles, então não consegue se auto-elevar).
    const isGm = phpData?.is_gm === true || phpData?.is_gm === 1 || phpData?.is_gm === "1";
    const setoresBrutos: unknown = phpData?.papeisPermissao?.setores;

    // 2. Cria ou atualiza o auth.users correspondente
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { autoRefreshToken: false, persistSession: false } },
    );

    const email = emailFromLogin(login);

    // Procura existing user por email
    const { data: list, error: listErr } = await admin.auth.admin.listUsers({
      page: 1,
      perPage: 200,
    });
    if (listErr) throw listErr;
    const existing = list.users.find((u) => u.email?.toLowerCase() === email);

    if (existing) {
      // Atualiza senha (sincroniza com a que acabou de ser usada no PHP)
      const { error: updErr } = await admin.auth.admin.updateUserById(existing.id, {
        password: senha,
        user_metadata: { login, nome, player_id: playerId ? String(playerId) : null },
      });
      if (updErr) throw updErr;
      // garante profile atualizado
      await admin.from("profiles").upsert(
        {
          id: existing.id,
          login,
          nome,
          player_id: playerId ? String(playerId) : null,
        },
        { onConflict: "id" },
      );
      await sincronizarUserRoles(admin, existing.id, rolesDesejados(isGm, setoresBrutos));
    } else {
      const { data: created, error: createErr } = await admin.auth.admin.createUser({
        email,
        password: senha,
        email_confirm: true,
        user_metadata: { login, nome, player_id: playerId ? String(playerId) : null },
      });
      if (createErr) throw createErr;
      // o trigger handle_new_user cria o profile com login mas garantimos os outros campos
      if (created.user) {
        await admin.from("profiles").upsert(
          {
            id: created.user.id,
            login,
            nome,
            player_id: playerId ? String(playerId) : null,
          },
          { onConflict: "id" },
        );
        await sincronizarUserRoles(admin, created.user.id, rolesDesejados(isGm, setoresBrutos));
      }
    }

    return new Response(JSON.stringify({ ok: true, email }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("sync-player-auth error:", message);
    const isTimeout =
      err instanceof DOMException && (err.name === "TimeoutError" || err.name === "AbortError");
    return new Response(
      JSON.stringify({ error: isTimeout ? "Timeout ao validar credenciais" : message }),
      {
        status: isTimeout ? 504 : 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
