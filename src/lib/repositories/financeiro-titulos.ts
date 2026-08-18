/** @module-kind io */
import { supabase } from "@/integrations/supabase/client";
import { withDeadline } from "@/lib/core/http/withDeadline";
import type { TituloManualInput } from "@/lib/financeiro-totvs/types";

/**
 * Cria título manual no núcleo canônico com rateio por linha
 * (Natureza × Centro de Custo; obra é resolvida no banco pelo CC).
 */
export async function criarTituloManualCanonico(input: TituloManualInput): Promise<string> {
  const { data, error } = await withDeadline(
    (supabase as any).rpc("fn_criar_titulo_manual_v2", {
      p_natureza_tipo: input.natureza_tipo,
      p_cnpj_cpf: input.cnpj_cpf,
      p_nome: input.nome,
      p_data_emissao: input.data_emissao,
      p_data_vencimento: input.data_vencimento,
      p_historico: input.historico,
      p_rateios: input.rateios,
    }),
    15_000,
    "financeiro.criarTituloManualCanonico",
  );

  if (error) throw new Error(error.message);
  return data as string;
}
