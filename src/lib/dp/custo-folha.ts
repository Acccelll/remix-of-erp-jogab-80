/** @module-kind pure */
// Agregações de custo da folha — fonte única para a página Custo do Colaborador
// (que absorveu a antiga Folha de Pagamento) e para quem mais precisar somar
// holerites.
//
// Regra que este módulo existe para garantir: as parcelas de `PARCELAS_CUSTO`
// somam EXATAMENTE `custo_total`. A tela antiga da Folha decompunha o custo em
// cards que somavam `custo_total − rat`, porque o card de encargos ignorava o
// RAT/SAT — o total nunca fechava com a explicação dele.
//
// A definição de `custo_total` é a do parser e da coluna gerada de
// `dp_holerite` (ver parser-holerite-xls.ts):
//
//   custo_total = proventos + inss_empresa + rat + inss_terceiros + fgts
//               + provisao_13 + provisao_ferias
//               + inss_provisao_13  + fgts_provisao_13
//               + inss_provisao_ferias + fgts_provisao_ferias

import type { DpHoleriteRow } from "@/lib/repositories/dpHolerite";

/** O mínimo que uma linha precisa ter para ser agregada aqui. */
export type LinhaCusto = Pick<
  DpHoleriteRow,
  | "proventos"
  | "salario_base"
  | "horas_extras_valor"
  | "inss_empresa"
  | "rat"
  | "inss_terceiros"
  | "fgts"
  | "provisao_13"
  | "provisao_ferias"
  | "inss_provisao_13"
  | "fgts_provisao_13"
  | "inss_provisao_ferias"
  | "fgts_provisao_ferias"
  | "custo_total"
>;

/** Encargos patronais: INSS empresa + RAT/SAT + INSS Terceiros (Sistema S). */
export function encargosPatronais(r: LinhaCusto): number {
  return r.inss_empresa + r.rat + r.inss_terceiros;
}

/** Provisões de 13º e férias, incluindo o INSS e o FGTS que incidem sobre elas. */
export function provisoesTotais(r: LinhaCusto): number {
  return (
    r.provisao_13 +
    r.provisao_ferias +
    r.inss_provisao_13 +
    r.fgts_provisao_13 +
    r.inss_provisao_ferias +
    r.fgts_provisao_ferias
  );
}

/**
 * Proventos que não são salário base nem hora extra (periculosidade,
 * insalubridade, prêmios, DSR…). O piso em zero protege contra competências em
 * que o salário base lido supera os proventos (afastamento, admissão no mês).
 */
export function outrosProventos(r: LinhaCusto): number {
  return Math.max(0, r.proventos - r.salario_base - r.horas_extras_valor);
}

/**
 * As seis parcelas do custo, na ordem em que a tela as apresenta. Somadas,
 * reproduzem `custo_total` — é isso que `custo-folha.test.ts` trava.
 */
export const PARCELAS_CUSTO = [
  { id: "salario", rotulo: "Salário base", valor: (r: LinhaCusto) => r.salario_base },
  { id: "he", rotulo: "Horas extras", valor: (r: LinhaCusto) => r.horas_extras_valor },
  { id: "outros", rotulo: "Outros proventos", valor: outrosProventos },
  { id: "encargos", rotulo: "Encargos patronais", valor: encargosPatronais },
  { id: "fgts", rotulo: "FGTS", valor: (r: LinhaCusto) => r.fgts },
  { id: "provisoes", rotulo: "Provisões (13º + férias)", valor: provisoesTotais },
] as const;

export type ParcelaId = (typeof PARCELAS_CUSTO)[number]["id"];

export interface AgregadoCusto {
  /** Salário base (verba 001). */
  salarioBase: number;
  /** Horas extras em valor. */
  he: number;
  /** Demais proventos (periculosidade, prêmios…). */
  outros: number;
  /** salarioBase + he + outros — igual a `Σ proventos`. */
  proventos: number;
  /** INSS empresa + RAT + Terceiros. */
  encargos: number;
  fgts: number;
  provisoes: number;
  /** `Σ custo_total`, a coluna do banco — não uma reconstrução. */
  custoTotal: number;
  /**
   * Fator K ponderado pela folha (custo ÷ salário base). A média aritmética dos
   * K individuais distorce quando os salários são muito diferentes.
   */
  fatorK: number;
}

export function agregarCusto(rows: readonly LinhaCusto[]): AgregadoCusto {
  const a: AgregadoCusto = {
    salarioBase: 0,
    he: 0,
    outros: 0,
    proventos: 0,
    encargos: 0,
    fgts: 0,
    provisoes: 0,
    custoTotal: 0,
    fatorK: 0,
  };
  for (const r of rows) {
    a.salarioBase += r.salario_base;
    a.he += r.horas_extras_valor;
    a.outros += outrosProventos(r);
    a.encargos += encargosPatronais(r);
    a.fgts += r.fgts;
    a.provisoes += provisoesTotais(r);
    a.custoTotal += r.custo_total;
  }
  a.proventos = a.salarioBase + a.he + a.outros;
  a.fatorK = a.salarioBase > 0 ? a.custoTotal / a.salarioBase : 0;
  return a;
}

/** Fator K de uma linha isolada. `null` quando não há salário base para dividir. */
export function fatorKDe(salarioBase: number, custoTotal: number): number | null {
  return salarioBase > 0 ? custoTotal / salarioBase : null;
}

/**
 * Diferença entre `Σ custo_total` e a soma das parcelas exibidas. Deve ser zero
 * (a menos de centavos de ponto flutuante); a tela usa isto para não afirmar
 * "fecha" quando uma importação vier com dados inconsistentes.
 */
export function residuoReconciliacao(rows: readonly LinhaCusto[]): number {
  const a = agregarCusto(rows);
  const soma = a.salarioBase + a.he + a.outros + a.encargos + a.fgts + a.provisoes;
  return soma - a.custoTotal;
}

/** Tolerância de arredondamento: meio centavo por linha, com piso de 1 centavo. */
export function reconcilia(rows: readonly LinhaCusto[]): boolean {
  const tolerancia = Math.max(0.01, rows.length * 0.005);
  return Math.abs(residuoReconciliacao(rows)) <= tolerancia;
}
