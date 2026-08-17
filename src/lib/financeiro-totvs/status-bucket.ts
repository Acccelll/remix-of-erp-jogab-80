/** @module-kind pure */
// Módulo central de classificação de status TOTVS.
// Fonte única de verdade para decidir se um lançamento é pago, vencido,
// vencendo hoje, a vencer, cancelado ou "outro" — não deve ser replicado
// em outros arquivos.

export type StatusBucket =
  | "pago"
  | "vencido"
  | "hoje"
  | "avencer"
  | "cancelado"
  | "previsto"
  | "outro";

export const STATUS_BAIXADO = 3;
export const STATUS_BAIXADO_PARCIAL = 15;
export const STATUS_CANCELADO = 18;
export const STATUS_VENCE_HOJE = 29;
export const STATUS_VENCIDO = 40;
export const STATUS_A_VENCER = 56;

/**
 * Classifica um lançamento em um balde único de status.
 *
 * Regras:
 *  - 18 (Cancelado) -> "cancelado"
 *  - 3  (Baixado)    -> "pago"
 *  - 15 (Baixado - Parcial), 29, 40, 56 -> classifica por data_vencimento:
 *      * data_vencimento < hoje -> "vencido"
 *      * data_vencimento = hoje -> "hoje"
 *      * data_vencimento > hoje -> "avencer"
 *  - Qualquer outro código -> "outro"
 *
 * O saldo em aberto (valor_liquido - valor_baixado) já reflete a baixa
 * parcial; por isso o título permanece na dívida com a fatia em aberto.
 */
export function classificarBucketStatus(
  status_cod: number | null | undefined,
  data_vencimento: string | null | undefined,
  hoje: string,
  origem?: string | null,
): StatusBucket {
  if (origem === "sistema") return "previsto";
  if (status_cod === STATUS_CANCELADO) return "cancelado";
  if (status_cod === STATUS_BAIXADO) return "pago";

  const emAberto =
    status_cod === STATUS_BAIXADO_PARCIAL ||
    status_cod === STATUS_VENCE_HOJE ||
    status_cod === STATUS_VENCIDO ||
    status_cod === STATUS_A_VENCER;

  if (!emAberto) return "outro";

  // O código pode estar desatualizado; a data de vencimento manda.
  const dvenc = data_vencimento ? String(data_vencimento).slice(0, 10) : null;
  if (status_cod === STATUS_VENCIDO && !dvenc) return "vencido";
  if (!dvenc) return "avencer";
  if (dvenc < hoje) return "vencido";
  if (dvenc === hoje) return "hoje";
  return "avencer";
}

/** true quando o título está parcialmente baixado — usar para exibir o badge "Parcial". */
export function ehBaixaParcial(status_cod: number | null | undefined): boolean {
  return status_cod === STATUS_BAIXADO_PARCIAL;
}
