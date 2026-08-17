// Fase 0.2/0.4 — Self-heal de usuários no Supabase Auth.
//
// SEC: o endpoint NUNCA confia no corpo da requisição. As credenciais enviadas
// são revalidadas contra o backend PHP autoritativo (rota `login`) antes de
// criar/atualizar qualquer usuário, e o papel (`gm`/`comum`) vem exclusivamente
// da resposta do PHP — o flag `is_gm` do cliente é ignorado.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { withSentry } from "../_shared/sentry.ts";
// SEC-003 (Onda 0): CORS por allowlist estrita, sem fallback "*".
import { corsHeadersFor, handlePreflight, isOriginAllowed } from "../_shared/cors.ts";

const PHP_API_URL = Deno.env.get("PHP_API_URL") || "https://jogab.com.br/api.php";

interface Payload {
  login: string;
  email: string;
  password: string;
  acessos?: Record<string, unknown>;
}

Deno.serve(
  withSentry("provision-auth-user", async (req) => {
    const preflight = handlePreflight(req);
    if (preflight) return preflight;

    const corsHeaders = corsHeadersFor(req);
    const json = (body: unknown, status: number) =>
      new Response(JSON.stringify(body), {
        status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });

    if (!isOriginAllowed(req)) return json({ error: "Origem não autorizada" }, 403);
    if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

    try {
      const { login, email, password } = (await req.json().catch(() => ({}))) as Payload;

      if (
        typeof login !== "string" || !login.trim() ||
        typeof email !== "string" || !email.trim() ||
        typeof password !== "string" || !password
      ) {
        return json({ error: "login, email e password são obrigatórios" }, 400);
      }
      if (login.length > 64 || email.length > 254 || password.length > 256) {
        return json({ error: "payload muito grande" }, 400);
      }

      // 1) Revalida as credenciais no backend PHP (fonte da verdade).
      const phpUrl = new URL(PHP_API_URL);
      phpUrl.searchParams.set("rota", "login");
      const phpRes = await fetch(phpUrl.toString(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: login, password }),
        signal: AbortSignal.timeout(10_000),
      });
      if (!phpRes.ok) return json({ error: "Credenciais inválidas" }, 401);
      const phpData = await phpRes.json().catch(() => null);
      if (!phpData || phpData.error || !(phpData.id ?? phpData.user_id)) {
        return json({ error: "Credenciais inválidas" }, 401);
      }
      // Papel derivado SOMENTE do backend — cliente não pode se auto-elevar.
      const isGm =
        phpData.is_gm === true || phpData.is_gm === 1 || phpData.is_gm === "1";

      const admin = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
        { auth: { persistSession: false } },
      );

      // 2) Procura profile existente pelo `login` (chave estável vinda do PHP).
      const { data: existingProfile } = await admin
        .from("profiles")
        .select("id, email")
        .eq("login", login)
        .maybeSingle();

      let userId: string | undefined = existingProfile?.id;

      if (userId) {
        const updates: Record<string, unknown> = { password };
        if ((existingProfile?.email ?? "").toLowerCase() !== email.toLowerCase()) {
          updates.email = email;
          updates.email_confirm = true;
        }
        const { error: updErr } = await admin.auth.admin.updateUserById(userId, updates);
        if (updErr) {
          console.error("provision-auth-user auth update", updErr.message);
          return json({ error: "Falha ao atualizar usuário" }, 500);
        }
      } else {
        const { data: created, error: createErr } = await admin.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
          user_metadata: { login, is_gm: isGm },
        });
        userId = created?.user?.id;
        if (!userId) {
          const { data: list } = await admin.auth.admin.listUsers();
          userId = list.users.find((u) => u.email?.toLowerCase() === email.toLowerCase())?.id;
          if (!userId) {
            console.error("provision-auth-user create", createErr?.message);
            return json({ error: "Falha ao provisionar usuário" }, 400);
          }
          await admin.auth.admin.updateUserById(userId, { password });
        }
      }

      // 3) Upsert do profile. RBAC fica exclusivamente em `user_roles`.
      const { error: upsertErr } = await admin.from("profiles").upsert({
        id: userId,
        login,
        email,
        nome: login,
      });
      if (upsertErr) {
        console.error("provision-auth-user profile upsert", upsertErr.message);
        return json({ error: "Falha ao gravar perfil" }, 500);
      }

      const role = isGm ? "gm" : "comum";
      const { error: roleErr } = await admin.from("user_roles").upsert(
        { user_id: userId, role },
        { onConflict: "user_id,role" },
      );
      if (roleErr) {
        console.error("provision-auth-user role upsert", roleErr.message);
        return json({ error: "Falha ao gravar papel" }, 500);
      }

      return json({ ok: true, userId }, 200);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("provision-auth-user error:", message);
      return json({ error: "Erro interno" }, 500);
    }
  }),
);
