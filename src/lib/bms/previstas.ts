/** @module-kind pure */
// Geração de janelas de corte de BMS por obra.
import { addDays, differenceInCalendarDays, parseISO } from "date-fns";
import { calcularVencimento } from "@/lib/billing";

export type JanelaBms = {
  numero: number;
  data_inicio_janela: Date;
  data_corte: Date;
};

/**
 * Lista cortes (datas) entre [inicio, fim] usando os dias do mês em diasCorte.
 *
 * @param incluirFimComoCorte Se `true` (default), força `fim` como último corte
 *   mesmo que não caia num dia configurado — última janela pode ser irregular.
 *   Se `false`, a última janela termina no último dia-de-corte regular ≤ `fim`;
 *   caso `fim` ultrapasse, uma janela residual extra é criada terminando em `fim`.
 */
function listarCortes(
  inicio: Date,
  fim: Date,
  diasCorte: number[],
  incluirFimComoCorte = true,
): Date[] {
  const dias = [...new Set(diasCorte.filter((d) => d >= 1 && d <= 31))].sort((a, b) => a - b);
  if (!dias.length) return [];
  const cortes: Date[] = [];
  const cursor = new Date(inicio.getFullYear(), inicio.getMonth(), 1);
  const limite = new Date(fim.getFullYear(), fim.getMonth() + 2, 1);
  while (cursor < limite) {
    const lastDay = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate();
    for (const dia of dias) {
      const d = new Date(cursor.getFullYear(), cursor.getMonth(), Math.min(dia, lastDay));
      if (d >= inicio && d <= addDays(fim, 0)) cortes.push(d);
    }
    cursor.setMonth(cursor.getMonth() + 1);
  }
  const ultimo = cortes[cortes.length - 1];
  if (incluirFimComoCorte) {
    // Comportamento legado: garante último corte == `fim` (pode achatar a última janela).
    if (!ultimo || ultimo < fim) cortes.push(fim);
  } else {
    // Janela residual explícita: só cria se `fim` ultrapassa o último corte regular.
    if (!ultimo) cortes.push(fim);
    else if (ultimo < fim) cortes.push(fim); // residual final
  }
  return cortes;
}

export function montarJanelas(
  inicio: Date,
  fim: Date,
  diasCorte: number[],
  opts?: { incluirFimComoCorte?: boolean },
): JanelaBms[] {
  const cortes = listarCortes(inicio, fim, diasCorte, opts?.incluirFimComoCorte ?? true);
  const janelas: JanelaBms[] = [];
  let cursorInicio = inicio;
  cortes.forEach((corte, idx) => {
    janelas.push({ numero: idx + 1, data_inicio_janela: cursorInicio, data_corte: corte });
    cursorInicio = addDays(corte, 1);
  });
  return janelas;
}

/**
 * Calcula a sobreposição em dias entre [aIni,aFim] e [bIni,bFim]. 0 se não houver.
 */
export function diasSobreposicao(aIni: Date, aFim: Date, bIni: Date, bFim: Date): number {
  const ini = aIni > bIni ? aIni : bIni;
  const fim = aFim < bFim ? aFim : bFim;
  const d = differenceInCalendarDays(fim, ini) + 1;
  return d > 0 ? d : 0;
}

export type ContribuicaoItem = {
  itemId: string;
  dataInicio: Date;
  dataFim: Date;
  valorTotal: number;
};

/**
 * Distribui o valor total de cada item proporcionalmente entre as janelas que ele intersecta.
 * Retorna um array paralelo a `janelas` com a soma de contribuições.
 */
export function distribuirContribuicoes(itens: ContribuicaoItem[], janelas: JanelaBms[]): number[] {
  const totais = janelas.map(() => 0);
  for (const it of itens) {
    const duracao = differenceInCalendarDays(it.dataFim, it.dataInicio) + 1;
    if (duracao <= 0 || it.valorTotal <= 0) continue;
    for (let i = 0; i < janelas.length; i++) {
      const j = janelas[i];
      const dias = diasSobreposicao(it.dataInicio, it.dataFim, j.data_inicio_janela, j.data_corte);
      if (dias > 0) totais[i] += (dias / duracao) * it.valorTotal;
    }
  }
  return totais;
}

export type BmsPrevistaInsert = {
  obra_id: string;
  numero: number;
  data_inicio_janela: string;
  data_corte: string;
  valor_previsto_inicial: number;
  valor_previsto_dinamico: number;
  data_emissao_nfs_prevista: string | null;
  data_pagamento_prevista: string | null;
  status: "prevista";
  observacoes?: string | null;
};

/** Helper para conversão segura de string ISO → Date local. */
export function iso(d: string | Date): Date {
  return typeof d === "string" ? parseISO(d) : d;
}

export function toISO(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export type GerarBmsPrevistasResultado = {
  linhas: BmsPrevistaInsert[];
  avisos: string[];
};

/**
 * Função principal: monta o conjunto completo de BMS previstas para uma obra,
 * incluindo (opcional) a antecipação como BMS número 0.
 *
 * Retorna `{ linhas, avisos }`. `avisos` traz mensagens informativas (ex.: itens
 * todos com duração zero), úteis para feedback ao usuário.
 */
export function gerarBmsPrevistasParaObra(opts: {
  obraId: string;
  dataInicio: Date;
  dataFim: Date;
  valorContrato: number;
  valorAntecipacao: number;
  diasCorteBms: number[];
  diasAteEmissaoNf: number;
  prazoPagamentoDias: number;
  diasFixosPagamento: number[];
  itens: ContribuicaoItem[];
  /** Se informado e maior que `dataFim`, estende a janela de geração de BMS até essa
   *  data (para cobrir cronogramas que ultrapassam o prazo contratual da obra). */
  dataFimCronograma?: Date;
}): GerarBmsPrevistasResultado {
  const {
    obraId,
    dataInicio,
    dataFim,
    valorContrato,
    valorAntecipacao,
    diasCorteBms,
    diasAteEmissaoNf,
    prazoPagamentoDias,
    diasFixosPagamento,
    itens,
    dataFimCronograma,
  } = opts;

  const fimEfetivo = dataFimCronograma && dataFimCronograma > dataFim ? dataFimCronograma : dataFim;

  const janelas = montarJanelas(dataInicio, fimEfetivo, diasCorteBms);
  const contribs = distribuirContribuicoes(itens, janelas);
  const avisos: string[] = [];

  // Escala uniforme: garante que (antecipação + Σ contribuições) == valor do contrato.
  // Preserva a proporção temporal das janelas; absorve a diferença entre custo
  // (baseline) e preço de venda (margem/BDI) e qualquer resíduo de arredondamento.
  const baseDistribuir = Math.max(0, valorContrato - valorAntecipacao);
  const somaContribs = contribs.reduce((a, b) => a + b, 0);

  // Edge case: todos os itens têm duração zero (marcos) ou valor zero — a
  // distribuição temporal é impossível. Fallback: divisão IGUAL entre janelas
  // para que o valor do contrato chegue às BMS, e emite aviso.
  let contribsEscaladas: number[];
  if (somaContribs <= 0 && baseDistribuir > 0 && janelas.length > 0) {
    const parte = baseDistribuir / janelas.length;
    contribsEscaladas = janelas.map(() => parte);
    avisos.push(
      "Itens do cronograma sem duração (todos marcos) ou sem valor. O valor do contrato foi dividido igualmente entre as janelas de BMS.",
    );
  } else {
    const fator = somaContribs > 0 ? baseDistribuir / somaContribs : 1;
    contribsEscaladas = contribs.map((v) => v * fator);
  }

  const linhas: BmsPrevistaInsert[] = [];

  if (valorAntecipacao > 0) {
    const emissao = addDays(dataInicio, diasAteEmissaoNf);
    const pgto = calcularVencimento(emissao, prazoPagamentoDias, diasFixosPagamento);
    linhas.push({
      obra_id: obraId,
      numero: 0,
      data_inicio_janela: toISO(dataInicio),
      data_corte: toISO(dataInicio),
      valor_previsto_inicial: valorAntecipacao,
      valor_previsto_dinamico: valorAntecipacao,
      data_emissao_nfs_prevista: toISO(emissao),
      data_pagamento_prevista: toISO(pgto),
      status: "prevista",
      observacoes: "Antecipação / Mobilização",
    });
  }

  janelas.forEach((j, idx) => {
    const valor = contribsEscaladas[idx];
    const emissao = addDays(j.data_corte, diasAteEmissaoNf);
    const pgto = calcularVencimento(emissao, prazoPagamentoDias, diasFixosPagamento);
    linhas.push({
      obra_id: obraId,
      numero: j.numero,
      data_inicio_janela: toISO(j.data_inicio_janela),
      data_corte: toISO(j.data_corte),
      valor_previsto_inicial: valor,
      valor_previsto_dinamico: valor,
      data_emissao_nfs_prevista: toISO(emissao),
      data_pagamento_prevista: toISO(pgto),
      status: "prevista",
      observacoes: null,
    });
  });

  return { linhas, avisos };
}
