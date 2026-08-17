/** @module-kind io */
// Identidade do usuário logado no Supabase Auth.
//
// Historicamente o app criou mais de uma conta de autenticação para o mesmo
// login (`<login>@planifik.local` e `<login>@obraflow.local`), e algumas telas
// filtravam por `players.id` (backend legado), que nunca bate com o
// `responsavel_id` gravado nos cartões. Este módulo centraliza a resolução:
// devolve TODOS os ids de usuário que pertencem ao login logado.
import { supabase } from "@/integrations/supabase/client";

/** Tira acento sem mexer no resto ("Letícia" → "Leticia"). */
function semAcento(valor: string): string {
  return valor.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

/**
 * Normaliza logins para comparação ("Adriana.Penso" ≡ "adriana penso").
 *
 * Ignora acento de propósito: o login do GM vem digitado por gente
 * ("Letícia.Flink") e do outro lado a comparação costuma ser contra o prefixo
 * de um e-mail, que é sempre ASCII ("leticia.flink"). Sem isso, todo usuário
 * com acento no nome deixava de casar consigo mesmo.
 */
export function normalizarLogin(valor?: string | null): string {
  return semAcento((valor ?? "").trim().toLowerCase()).replace(/[.\s_-]+/g, "");
}

/**
 * E-mail da conta Supabase correspondente a um login do GM.
 *
 * O acento tem de cair aqui: "Letícia.Flink" geraria
 * `letícia.flink@planifik.local`, que o GoTrue não aceita — a conta nunca era
 * criada, a sessão não subia e a tela ficava vazia sem erro visível.
 *
 * ATENÇÃO: `supabase/functions/sync-player-auth/index.ts` tem uma cópia desta
 * regra (Deno não importa daqui). As duas precisam gerar a mesma string, senão
 * o front procura uma conta que a função criou com outro nome.
 */
export function emailDoLogin(login: string): string {
  return `${semAcento(login.trim().toLowerCase())}@planifik.local`;
}

/**
 * Ids de `auth.users` equivalentes ao usuário logado: o id da sessão atual
 * mais os perfis cujo login normalizado é o mesmo (contas duplicadas).
 */
export async function getMeusUserIds(loginHint?: string | null): Promise<string[]> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const ids = new Set<string>();
  if (user?.id) ids.add(user.id);

  const emailLogin = user?.email ? user.email.split("@")[0] : null;
  const alvo = normalizarLogin(loginHint || emailLogin);
  if (!alvo) return Array.from(ids);

  const { data } = await supabase.from("profiles").select("id, login");
  for (const p of data ?? []) {
    if (normalizarLogin((p as any).login) === alvo) ids.add(String((p as any).id));
  }
  return Array.from(ids);
}
