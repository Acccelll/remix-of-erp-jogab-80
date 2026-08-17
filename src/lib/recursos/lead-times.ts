/** @module-kind pure */
/**
 * Cálculo da cascata de prazos de um card de recurso.
 *
 * Função pura, sem I/O, sem React, sem Supabase. Espelha o padrão de
 * `src/lib/pmbok/evm.ts` e `src/lib/resultado/curva-resultado.ts` e é
 * coberta por testes vitest em `__tests__/lead-times.test.ts`.
 *
 * Por padrão, preserva a regra histórica de dias corridos. Quando a tela
 * informar um calendário da obra, o cálculo passa a usar dias úteis e exceções
 * sem alterar os campos persistidos nos cards.
 */

import { CALENDARIO_PADRAO, somaDiasUteis, type Calendario } from "@/lib/cronograma/calendario";

export type TipoRecurso = "material_pronto" | "manufaturado" | "servico" | "equipamento";

export interface LeadTimeTemplate {
  tipoRecurso: TipoRecurso;
  diasNecessidade: number;
  diasPedido: number;
  diasNotifCompras: number;
  /** Obrigatório para `manufaturado`. */
  diasProdIniciar?: number | null;
  /** Obrigatório para `manufaturado`. */
  diasNotifProducao?: number | null;
}

export interface PrazosCalculados {
  /** ISO yyyy-mm-dd */
  dataNecessidadeObra: string;
  /** ISO yyyy-mm-dd */
  prazoPedido: string;
  /** ISO yyyy-mm-dd */
  prazoNotifCompras: string;
  /** ISO yyyy-mm-dd — apenas para `manufaturado` */
  prazoProdIniciar?: string;
  /** ISO yyyy-mm-dd — apenas para `manufaturado` */
  prazoNotifProducao?: string;
}

export interface CalcularPrazosOptions {
  calendario?: Calendario | null;
  usarDiasUteis?: boolean;
}

// ---------------------------------------------------------------------------
// Helpers de data (UTC para evitar drift de fuso na virada do dia)
// ---------------------------------------------------------------------------

function parseISO(iso: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) throw new Error(`Data inválida: "${iso}" (esperado yyyy-mm-dd)`);
  const [, y, mo, d] = m;
  const dt = new Date(Date.UTC(Number(y), Number(mo) - 1, Number(d)));
  if (Number.isNaN(dt.getTime())) throw new Error(`Data inválida: "${iso}"`);
  return dt;
}

function toISO(dt: Date): string {
  const y = dt.getUTCFullYear();
  const m = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const d = String(dt.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function subDiasCorridos(iso: string, dias: number): string {
  const dt = parseISO(iso);
  dt.setUTCDate(dt.getUTCDate() - dias);
  return toISO(dt);
}

function subtrairPrazo(iso: string, dias: number, options?: CalcularPrazosOptions): string {
  if (options?.usarDiasUteis || options?.calendario) {
    return somaDiasUteis(iso, -dias, options.calendario ?? CALENDARIO_PADRAO);
  }
  return subDiasCorridos(iso, dias);
}

// ---------------------------------------------------------------------------
// API pública
// ---------------------------------------------------------------------------

/**
 * Calcula a cascata de prazos a partir da data de início da atividade
 * no cronograma.
 *
 * Regras (decididas no prompt da Fase 2):
 *
 * material_pronto / equipamento / servico:
 *   necessidade  = inicio - diasNecessidade
 *   pedido       = necessidade - diasPedido
 *   notifCompras = pedido - diasNotifCompras
 *
 * manufaturado (insere a etapa de produção entre necessidade e pedido):
 *   necessidade   = inicio - diasNecessidade
 *   prodIniciar   = necessidade - diasProdIniciar
 *   pedido        = prodIniciar - diasPedido
 *   notifCompras  = pedido - diasNotifCompras
 *   notifProducao = prodIniciar - diasNotifProducao
 */
export function calcularPrazos(
  dataInicioAtividade: string,
  template: LeadTimeTemplate,
  options?: CalcularPrazosOptions,
): PrazosCalculados {
  // valida ISO o quanto antes
  parseISO(dataInicioAtividade);

  const dataNecessidadeObra = subtrairPrazo(dataInicioAtividade, template.diasNecessidade, options);

  if (template.tipoRecurso === "manufaturado") {
    if (template.diasProdIniciar == null || template.diasNotifProducao == null) {
      throw new Error("Template manufaturado exige diasProdIniciar e diasNotifProducao");
    }
    const prazoProdIniciar = subtrairPrazo(dataNecessidadeObra, template.diasProdIniciar, options);
    const prazoPedido = subtrairPrazo(prazoProdIniciar, template.diasPedido, options);
    const prazoNotifCompras = subtrairPrazo(prazoPedido, template.diasNotifCompras, options);
    const prazoNotifProducao = subtrairPrazo(prazoProdIniciar, template.diasNotifProducao, options);
    return {
      dataNecessidadeObra,
      prazoPedido,
      prazoNotifCompras,
      prazoProdIniciar,
      prazoNotifProducao,
    };
  }

  const prazoPedido = subtrairPrazo(dataNecessidadeObra, template.diasPedido, options);
  const prazoNotifCompras = subtrairPrazo(prazoPedido, template.diasNotifCompras, options);
  return { dataNecessidadeObra, prazoPedido, prazoNotifCompras };
}
