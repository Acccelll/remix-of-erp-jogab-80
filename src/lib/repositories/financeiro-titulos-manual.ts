/** @module-kind io */
import { supabase } from "@/integrations/supabase/client";
import { withDeadline } from "@/lib/core/http/withDeadline";
import type { RateioManualInput } from "@/lib/financeiro-totvs/types";

export interface CriarTituloManualV3Input {
  natureza_tipo: 1 | 2;
  tipo_documento: string;
  numero_documento: string;
  cnpj_cpf: string | null;
  nome: string | null;
  data_emissao: string | null;
  data_vencimento: string;
  historico: string | null;
  rateios: RateioManualInput[];
}

export interface EditarTituloManualV3Input extends CriarTituloManualV3Input {
  titulo_id: string;
}

export async function criarTituloManualCanonicoV3(input: CriarTituloManualV3Input): Promise<string> {
  const { data, error } = await withDeadline(
    (supabase as any).rpc("fn_criar_titulo_manual_v3", {
      p_natureza_tipo: input.natureza_tipo,
      p_tipo_documento: input.tipo_documento,
      p_numero_documento: input.numero_documento,
      p_cnpj_cpf: input.cnpj_cpf,
      p_nome: input.nome,
      p_data_emissao: input.data_emissao,
      p_data_vencimento: input.data_vencimento,
      p_historico: input.historico,
      p_rateios: input.rateios,
    }),
    15_000,
    "financeiro.criarTituloManualCanonicoV3",
  );

  if (error) throw new Error(error.message);
  return data as string;
}

export async function editarTituloManualCanonicoV3(input: EditarTituloManualV3Input): Promise<void> {
  const { error } = await withDeadline(
    (supabase as any).rpc("fn_editar_titulo_manual_v3", {
      p_titulo_id: input.titulo_id,
      p_natureza_tipo: input.natureza_tipo,
      p_tipo_documento: input.tipo_documento,
      p_numero_documento: input.numero_documento,
      p_cnpj_cpf: input.cnpj_cpf,
      p_nome: input.nome,
      p_data_emissao: input.data_emissao,
      p_data_vencimento: input.data_vencimento,
      p_historico: input.historico,
      p_rateios: input.rateios,
    }),
    15_000,
    "financeiro.editarTituloManualCanonicoV3",
  );

  if (error) throw new Error(error.message);
}
