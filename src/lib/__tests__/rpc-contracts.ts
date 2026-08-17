import type { Database, Json } from "@/integrations/supabase/types";

type GeneratedFns = Database["public"]["Functions"];

// TST-003 / ARC-001: contratos legados ainda ausentes do schema gerado.
// Mantêm os testes tipados sem reabrir `@ts-nocheck`; quando as RPCs entrarem
// no schema real, este tipo deve ser reduzido até sobrar só `GeneratedFns`.
type LegacyFns = {
  criar_medicao_atomica: {
    Args: {
      p_bms_id?: string | null;
      p_data_corte: string;
      p_data_inicio: string;
      p_itens: Json;
      p_numero: string;
      p_observacoes: string;
      p_obra_id: string;
      p_valor_total: number;
    };
    Returns: Json;
  };
  emitir_oc_atomico: {
    Args: { p_oc_id: string };
    Returns: Json;
  };
  excluir_nf_atomica: {
    Args: { p_nf_id: string; p_valor_contrato: number };
    Returns: Json;
  };
  fechar_bms_atomica: {
    Args: {
      p_bms_id: string;
      p_futuras: Json;
      p_registros: Json;
      p_valor_realizado: number;
    };
    Returns: Json;
  };
  fn_estoque_transferir: {
    Args: {
      p_destino: string;
      p_insumo: string;
      p_observacao?: string | null;
      p_origem: string;
      p_quantidade: number;
    };
    Returns: Json;
  };
  fn_oc_aprovar: {
    Args: { p_oc_id: string };
    Returns: { ok: boolean };
  };
  registrar_recebimento_atomico: {
    Args: {
      p_data: string;
      p_itens: Json;
      p_nota_fiscal: string;
      p_observacao?: string | null;
      p_oc_id: string;
      p_owner_id: string;
    };
    Returns: Json;
  };
  salvar_nf_atomica: {
    Args: {
      p_bms_prevista_id: string | null;
      p_data_prevista: string;
      p_medicao_id_fallback: string | null;
      p_nf_id: string | null;
      p_payload: Json;
      p_valor_contrato: number;
      p_valor_liquido: number;
    };
    Returns: Json;
  };
};

export type RpcContracts = GeneratedFns & LegacyFns;
