/** @module-kind pure */
// Conciliação Ponto × Folha: a hora extra apurada no relógio bate com a paga
// no holerite?
//
// Os dois lados sempre estiveram no banco (`ponto_registros` e `dp_holerite`) e
// nunca foram cruzados. É a checagem que pega pagamento a maior ou a menor
// antes de o dinheiro sair.
//
// Duas armadilhas que a conta precisa respeitar:
//
//  1. **Unidades diferentes.** O ponto apura minutos; o holerite traz reais. A
//     ponte é o salário base: hora normal = salário ÷ jornada mensal, e cada
//     faixa de HE tem seu adicional (50%, 60%, 100%).
//  2. **O DSR está dentro do total de HE.** As rubricas 250 e 854 pertencem a
//     `HE_CODIGOS` *e* a `DSR_HE_CODIGOS`, então `horas_extras_valor` já soma o
//     descanso semanal. Comparar esse total contra a HE esperada acusaria
//     "pago a maior" em toda a folha — o DSR sai da comparação e aparece à parte.

import {
  FATOR_HE_50,
  FATOR_HE_60,
  FATOR_HE_100,
  JORNADA_MENSAL_HORAS,
  TOLERANCIA_CONCILIACAO_PCT,
  TOLERANCIA_CONCILIACAO_REAIS,
} from "@/lib/dp/codigos";

/** Horas extras apuradas no ponto, por colaborador, na competência. */
export interface PontoDaCompetencia {
  chave: string;
  colaboradorId: string | null;
  nome: string;
  he50Min: number;
  he60Min: number;
  he100Min: number;
  horasFaltaMin: number;
  diasFalta: number;
}

/** O que a folha pagou, por colaborador, na mesma competência. */
export interface HoleriteDaCompetencia {
  chave: string;
  colaboradorId: string | null;
  nome: string;
  salarioBase: number;
  /** `horas_extras_valor` do holerite — inclui o DSR sobre HE. */
  heValorTotal: number;
  /** Parcela de DSR dentro do total acima. */
  dsrValor: number;
}

export type SituacaoConciliacao =
  "ok" | "pago_a_maior" | "pago_a_menor" | "sem_holerite" | "sem_ponto" | "sem_salario_base";

export const ROTULO_SITUACAO: Record<SituacaoConciliacao, string> = {
  ok: "Confere",
  pago_a_maior: "Pago a maior",
  pago_a_menor: "Pago a menor",
  sem_holerite: "Sem holerite",
  sem_ponto: "Sem ponto",
  sem_salario_base: "Sem salário base",
};

export interface LinhaConciliacao {
  chave: string;
  colaboradorId: string | null;
  nome: string;
  he50Min: number;
  he60Min: number;
  he100Min: number;
  heTotalMin: number;
  salarioBase: number;
  /** HE esperada em R$ a partir do ponto; `null` sem salário base. */
  valorEsperado: number | null;
  /** HE paga, já sem o DSR. */
  valorPago: number;
  dsrPago: number;
  /** Pago − esperado; `null` quando não dá para comparar. */
  diferenca: number | null;
  diferencaPct: number | null;
  situacao: SituacaoConciliacao;
  diasFalta: number;
}

/**
 * Valor esperado das horas extras a partir do salário base.
 * `jornadaMensal` default 220h (CLT 44h/semana), o mesmo denominador que o
 * módulo de Custos usa para custo/hora.
 */
export function valorEsperadoHe(
  faixas: { he50Min: number; he60Min: number; he100Min: number },
  salarioBase: number,
  jornadaMensal: number = JORNADA_MENSAL_HORAS,
): number {
  if (salarioBase <= 0 || jornadaMensal <= 0) return 0;
  const horaNormal = salarioBase / jornadaMensal;
  return (
    (faixas.he50Min / 60) * horaNormal * FATOR_HE_50 +
    (faixas.he60Min / 60) * horaNormal * FATOR_HE_60 +
    (faixas.he100Min / 60) * horaNormal * FATOR_HE_100
  );
}

/**
 * Diferença dentro da tolerância? Precisa estar dentro dos **dois** limites —
 * o percentual sozinho deixaria passar centavos numa base minúscula, e o
 * absoluto sozinho deixaria passar R$ 5 num salário alto.
 */
export function dentroDaTolerancia(diferenca: number, esperado: number): boolean {
  const abs = Math.abs(diferenca);
  if (abs > TOLERANCIA_CONCILIACAO_REAIS) return false;
  if (esperado <= 0) return abs <= TOLERANCIA_CONCILIACAO_REAIS;
  return (abs / esperado) * 100 <= TOLERANCIA_CONCILIACAO_PCT;
}

function classificar(
  temPonto: boolean,
  temHolerite: boolean,
  salarioBase: number,
  diferenca: number | null,
  esperado: number | null,
): SituacaoConciliacao {
  if (!temHolerite) return "sem_holerite";
  if (!temPonto) return "sem_ponto";
  if (salarioBase <= 0) return "sem_salario_base";
  if (diferenca === null || esperado === null) return "sem_salario_base";
  if (dentroDaTolerancia(diferenca, esperado)) return "ok";
  return diferenca > 0 ? "pago_a_maior" : "pago_a_menor";
}

/**
 * Cruza os dois lados por `chave` (id do colaborador quando há vínculo).
 * Quem aparece só de um lado entra na lista mesmo assim: colaborador com HE
 * apurada e sem holerite é tão relevante quanto uma diferença de valor.
 */
export function conciliar(
  pontos: readonly PontoDaCompetencia[],
  holerites: readonly HoleriteDaCompetencia[],
  jornadaMensal: number = JORNADA_MENSAL_HORAS,
): LinhaConciliacao[] {
  const pontoPorChave = new Map(pontos.map((p) => [p.chave, p]));
  const holeritePorChave = new Map(holerites.map((h) => [h.chave, h]));
  const chaves = new Set<string>([...pontoPorChave.keys(), ...holeritePorChave.keys()]);

  const linhas: LinhaConciliacao[] = [];
  for (const chave of chaves) {
    const p = pontoPorChave.get(chave);
    const h = holeritePorChave.get(chave);

    const faixas = {
      he50Min: p?.he50Min ?? 0,
      he60Min: p?.he60Min ?? 0,
      he100Min: p?.he100Min ?? 0,
    };
    const heTotalMin = faixas.he50Min + faixas.he60Min + faixas.he100Min;
    const salarioBase = h?.salarioBase ?? 0;

    // DSR fora da comparação: ele não é hora extra, é reflexo dela.
    const valorPago = Math.max(0, (h?.heValorTotal ?? 0) - (h?.dsrValor ?? 0));
    const valorEsperado =
      h && salarioBase > 0 ? valorEsperadoHe(faixas, salarioBase, jornadaMensal) : null;
    const diferenca = valorEsperado === null ? null : valorPago - valorEsperado;

    linhas.push({
      chave,
      colaboradorId: p?.colaboradorId ?? h?.colaboradorId ?? null,
      nome: p?.nome ?? h?.nome ?? chave,
      ...faixas,
      heTotalMin,
      salarioBase,
      valorEsperado,
      valorPago,
      dsrPago: h?.dsrValor ?? 0,
      diferenca,
      diferencaPct:
        diferenca === null || !valorEsperado || valorEsperado <= 0
          ? null
          : (diferenca / valorEsperado) * 100,
      situacao: classificar(!!p, !!h, salarioBase, diferenca, valorEsperado),
      diasFalta: p?.diasFalta ?? 0,
    });
  }

  // Maior divergência em dinheiro primeiro — é a fila de trabalho do DP.
  return linhas.sort((a, b) => Math.abs(b.diferenca ?? 0) - Math.abs(a.diferenca ?? 0));
}

export interface ResumoConciliacao {
  colaboradores: number;
  divergentes: number;
  /** Soma das diferenças positivas (folha pagou mais do que o ponto apurou). */
  totalPagoAMaior: number;
  /** Soma das diferenças negativas, em valor absoluto. */
  totalPagoAMenor: number;
  semHolerite: number;
  semPonto: number;
  semSalarioBase: number;
}

export function resumirConciliacao(linhas: readonly LinhaConciliacao[]): ResumoConciliacao {
  const resumo: ResumoConciliacao = {
    colaboradores: linhas.length,
    divergentes: 0,
    totalPagoAMaior: 0,
    totalPagoAMenor: 0,
    semHolerite: 0,
    semPonto: 0,
    semSalarioBase: 0,
  };
  for (const l of linhas) {
    if (l.situacao === "pago_a_maior") {
      resumo.divergentes += 1;
      resumo.totalPagoAMaior += l.diferenca ?? 0;
    } else if (l.situacao === "pago_a_menor") {
      resumo.divergentes += 1;
      resumo.totalPagoAMenor += Math.abs(l.diferenca ?? 0);
    } else if (l.situacao === "sem_holerite") {
      resumo.semHolerite += 1;
    } else if (l.situacao === "sem_ponto") {
      resumo.semPonto += 1;
    } else if (l.situacao === "sem_salario_base") {
      resumo.semSalarioBase += 1;
    }
  }
  return resumo;
}
