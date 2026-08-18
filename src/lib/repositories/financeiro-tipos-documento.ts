/** @module-kind io */
import { supabase } from "@/integrations/supabase/client";
import { withDeadline } from "@/lib/core/http/withDeadline";

export interface FinanceiroTipoDocumento {
  codigo: string;
  descricao: string;
}

export async function listarTiposDocumentoFinanceiro(): Promise<FinanceiroTipoDocumento[]> {
  const { data, error } = await withDeadline(
    (supabase as any)
      .from("financeiro_tipos_documento")
      .select("codigo,descricao")
      .eq("ativo", true)
      .order("codigo", { ascending: true }),
    10_000,
    "financeiro.listarTiposDocumentoFinanceiro",
  );

  if (error) throw new Error(error.message);
  return (data ?? []) as FinanceiroTipoDocumento[];
}
