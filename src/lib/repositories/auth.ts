import { supabase } from "@/integrations/supabase/client";

/**
 * ARC-003 · Lote C.2
 * Wrapper fino sobre supabase.auth para centralizar acessos e permitir
 * substituição/mocks futuros sem espalhar o client bruto pelos componentes.
 */
export const authRepo = {
  async getUserId(): Promise<string | null> {
    const { data } = await supabase.auth.getUser();
    return data?.user?.id ?? null;
  },
  async getUser() {
    const { data } = await supabase.auth.getUser();
    return data?.user ?? null;
  },
  async getSession() {
    const { data } = await supabase.auth.getSession();
    return data?.session ?? null;
  },
};

// ARC-003 — setores do usuário (autorização por setor de card).
export const userSetoresRepo = {
  async listByUser(userId: string): Promise<string[]> {
    const { data, error } = await supabase
      .from("user_setores")
      .select("setor")
      .eq("user_id", userId);
    if (error) throw error;
    return (data ?? []).map((r: { setor: string }) => r.setor);
  },
};
