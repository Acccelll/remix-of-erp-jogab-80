/** @module-kind repository */
// ARC-003 — wrapper para invocação da edge function `cnpj-lookup`.
import { supabase } from "@/integrations/supabase/client";

export const cnpjRepo = {
  async lookup(cnpjDigits: string): Promise<{ data: any; error: any }> {
    return await supabase.functions.invoke("cnpj-lookup", {
      body: { cnpj: cnpjDigits },
    });
  },
};
