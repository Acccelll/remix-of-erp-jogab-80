/** @module-kind io */
import { supabase } from "@/integrations/supabase/client";
import { emailDoLogin } from "@/lib/auth/identidade";

type LegacyPlayer = {
  login?: string | null;
  email?: string | null;
  senha?: string | null;
  isGM?: boolean | null;
  acessos?: Record<string, unknown> | null;
};

export async function ensureCloudSession(player: LegacyPlayer | null | undefined) {
  const { data: current } = await supabase.auth.getSession();
  if (current.session?.user) return { ok: true as const, repaired: false };

  const login = player?.login?.trim();
  const password = player?.senha?.trim();
  // Domínio técnico único: o mesmo usado no login normal (`useAuthSession`),
  // evitando criar contas duplicadas `@obraflow.local` para o mesmo login.
  // A derivação é a de `emailDoLogin` — se este arquivo montasse o endereço por
  // conta própria, um login acentuado geraria aqui uma conta diferente da que o
  // login normal procura.
  const email = login ? emailDoLogin(login) : undefined;


  if (!login || !email || !password) {
    return { ok: false as const, repaired: false, reason: "missing_legacy_credentials" };
  }

  const firstSignIn = await supabase.auth.signInWithPassword({ email, password });
  if (!firstSignIn.error) return { ok: true as const, repaired: true };

  const provision = await supabase.functions.invoke("provision-auth-user", {
    body: {
      login,
      email,
      password,
      is_gm: Boolean(player?.isGM),
      acessos: player?.acessos ?? {},
    },
  });

  if (provision.error) {
    return { ok: false as const, repaired: false, reason: provision.error.message };
  }

  const secondSignIn = await supabase.auth.signInWithPassword({ email, password });
  if (secondSignIn.error) {
    return { ok: false as const, repaired: false, reason: secondSignIn.error.message };
  }

  return { ok: true as const, repaired: true };
}
