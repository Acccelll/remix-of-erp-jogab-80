/** @module-kind pure */
/**
 * Máquinas de estado dos cards de recurso.
 *
 * Função pura, sem I/O. Cobre os 4 tipos (material_pronto, manufaturado,
 * servico, equipamento). Para `manufaturado`, o card tem 2 trilhos em
 * card_setores.status_setor (Compras e Producao) e o status global do card
 * é derivado: "o mais atrasado dos dois trilhos", concluído só quando ambos
 * fecham.
 */

import type { TipoRecurso } from "./lead-times";

/** Status do trilho simples (material_pronto, equipamento, servico). */
export type StatusSimples =
  | "identificado"
  | "em_cotacao"
  | "pedido_emitido"
  | "aguardando_entrega"
  | "entregue"
  | "concluido";

/** Trilho de Compras dentro de um card manufaturado. */
export type StatusCompras = "identificado" | "em_cotacao" | "pedido_emitido" | "materia_entregue";

/** Trilho de Produção dentro de um card manufaturado. */
export type StatusProducao =
  "aguardando_material" | "em_fabricacao" | "produzido" | "entregue_obra";

/** Status global possível de um card de recurso (qualquer tipo). */
export type StatusCardGlobal = StatusSimples | "concluido";

// ---------------------------------------------------------------------------
// Transições permitidas (linear, sem skip)
// ---------------------------------------------------------------------------

const FLUXO_SIMPLES: StatusSimples[] = [
  "identificado",
  "em_cotacao",
  "pedido_emitido",
  "aguardando_entrega",
  "entregue",
  "concluido",
];

const FLUXO_COMPRAS: StatusCompras[] = [
  "identificado",
  "em_cotacao",
  "pedido_emitido",
  "materia_entregue",
];

const FLUXO_PRODUCAO: StatusProducao[] = [
  "aguardando_material",
  "em_fabricacao",
  "produzido",
  "entregue_obra",
];

function proximosLineares<T extends string>(fluxo: T[], atual: T): T[] {
  const i = fluxo.indexOf(atual);
  if (i < 0) return [fluxo[0]];
  const opcoes: T[] = [atual];
  if (i + 1 < fluxo.length) opcoes.push(fluxo[i + 1]);
  // permite voltar uma casa (correção operacional)
  if (i - 1 >= 0) opcoes.unshift(fluxo[i - 1]);
  return opcoes;
}

export function proximosStatusSimples(atual: StatusSimples): StatusSimples[] {
  return proximosLineares(FLUXO_SIMPLES, atual);
}
export function proximosStatusCompras(atual: StatusCompras): StatusCompras[] {
  return proximosLineares(FLUXO_COMPRAS, atual);
}
export function proximosStatusProducao(atual: StatusProducao): StatusProducao[] {
  return proximosLineares(FLUXO_PRODUCAO, atual);
}

/**
 * Produção depende de Compras: só pode avançar de `aguardando_material`
 * quando Compras estiver em `materia_entregue`. Se o trilho de Compras
 * ainda não fechou, Produção fica travada (só permite voltar uma casa
 * para correção operacional).
 */
export function proximosStatusProducaoComDependencia(
  atual: StatusProducao,
  compras: StatusCompras | null | undefined,
): StatusProducao[] {
  const comprasOk = compras === "materia_entregue";
  if (comprasOk) return proximosLineares(FLUXO_PRODUCAO, atual);
  // Compras ainda não entregou: trava o avanço, mas permite correção.
  const i = FLUXO_PRODUCAO.indexOf(atual);
  if (i <= 0) return [atual];
  return [FLUXO_PRODUCAO[i - 1], atual];
}

// ---------------------------------------------------------------------------
// Status global do card manufaturado (derivado dos 2 trilhos)
// ---------------------------------------------------------------------------

/** Mapeia status_setor dos trilhos para um status global "humano". */
export function calcularStatusGlobalManufaturado(
  compras: StatusCompras | null | undefined,
  producao: StatusProducao | null | undefined,
): StatusCardGlobal {
  const c = compras ?? "identificado";
  const p = producao ?? "aguardando_material";

  // Concluído SOMENTE quando ambos os trilhos fecham.
  if (c === "materia_entregue" && p === "entregue_obra") return "concluido";

  // O global espelha o trilho mais atrasado, priorizando produção
  // quando a matéria já chegou.
  if (c !== "materia_entregue") {
    // ainda há ação de Compras pendente -> reflete trilho de Compras
    if (c === "pedido_emitido") return "pedido_emitido";
    if (c === "em_cotacao") return "em_cotacao";
    return "identificado";
  }
  // Compras terminou; o atraso está em Produção
  if (p === "produzido") return "aguardando_entrega";
  if (p === "em_fabricacao") return "pedido_emitido";
  if (p === "aguardando_material") return "pedido_emitido";
  return "entregue";
}

/** Opções de transição válidas para um card, conforme tipo. */
export function opcoesStatus(tipo: TipoRecurso, atual: StatusSimples): StatusSimples[] {
  if (tipo === "manufaturado") {
    // status global do manufaturado é derivado e não deve ser editado
    // direto na UI — retornamos só o atual.
    return [atual];
  }
  return proximosStatusSimples(atual);
}
