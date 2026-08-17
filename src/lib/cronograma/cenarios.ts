/** @module-kind pure */
// Lib pura para cenários what-if do cronograma.
// Sem side-effects nem chamadas de banco. Datas em ISO (YYYY-MM-DD).

import { addDays, differenceInCalendarDays, format, max, parseISO } from "date-fns";

export type CenarioItemBase = {
  id: string;
  data_inicio: string;
  data_fim: string;
  descricao?: string | null;
  critico?: boolean | null;
};

export type CenarioSnapshot = {
  item_id: string;
  data_inicio_origem: string;
  data_fim_origem: string;
  data_inicio_sim: string;
  data_fim_sim: string;
  observacao?: string | null;
};

const iso = (d: Date) => format(d, "yyyy-MM-dd");

/** Cria snapshots iniciais do cenário a partir dos itens vigentes da obra. */
export function clonarItensParaCenario(itens: CenarioItemBase[]): CenarioSnapshot[] {
  return itens.map((i) => ({
    item_id: i.id,
    data_inicio_origem: i.data_inicio,
    data_fim_origem: i.data_fim,
    data_inicio_sim: i.data_inicio,
    data_fim_sim: i.data_fim,
  }));
}

/** Aplica delta em dias a um snapshot, preservando a duração. */
export function aplicarDeltaDias(snap: CenarioSnapshot, delta: number): CenarioSnapshot {
  if (delta === 0) return snap;
  return {
    ...snap,
    data_inicio_sim: iso(addDays(parseISO(snap.data_inicio_sim), delta)),
    data_fim_sim: iso(addDays(parseISO(snap.data_fim_sim), delta)),
  };
}

/** Edita o intervalo simulado, garantindo duração mínima de 1 dia. */
export function ajustarSnapshot(
  snap: CenarioSnapshot,
  patch: { data_inicio_sim?: string; data_fim_sim?: string; observacao?: string | null },
): CenarioSnapshot {
  const novoIni = patch.data_inicio_sim ?? snap.data_inicio_sim;
  let novoFim = patch.data_fim_sim ?? snap.data_fim_sim;
  if (differenceInCalendarDays(parseISO(novoFim), parseISO(novoIni)) < 0) {
    novoFim = novoIni;
  }
  return {
    ...snap,
    data_inicio_sim: novoIni,
    data_fim_sim: novoFim,
    observacao: patch.observacao === undefined ? snap.observacao : patch.observacao,
  };
}

export type DiffLinha = {
  item_id: string;
  descricao: string | null;
  data_inicio_origem: string;
  data_fim_origem: string;
  data_inicio_sim: string;
  data_fim_sim: string;
  delta_inicio_dias: number;
  delta_fim_dias: number;
  duracao_origem: number;
  duracao_sim: number;
  delta_duracao_dias: number;
  alterado: boolean;
  critico: boolean;
};

/** Compara snapshots simulados com a base original; retorna linhas com deltas. */
export function compararCenario(itens: CenarioItemBase[], snaps: CenarioSnapshot[]): DiffLinha[] {
  const byId = new Map(itens.map((i) => [i.id, i]));
  return snaps.map((s) => {
    const it = byId.get(s.item_id);
    const dIni = differenceInCalendarDays(
      parseISO(s.data_inicio_sim),
      parseISO(s.data_inicio_origem),
    );
    const dFim = differenceInCalendarDays(parseISO(s.data_fim_sim), parseISO(s.data_fim_origem));
    const durO =
      differenceInCalendarDays(parseISO(s.data_fim_origem), parseISO(s.data_inicio_origem)) + 1;
    const durS =
      differenceInCalendarDays(parseISO(s.data_fim_sim), parseISO(s.data_inicio_sim)) + 1;
    return {
      item_id: s.item_id,
      descricao: it?.descricao ?? null,
      data_inicio_origem: s.data_inicio_origem,
      data_fim_origem: s.data_fim_origem,
      data_inicio_sim: s.data_inicio_sim,
      data_fim_sim: s.data_fim_sim,
      delta_inicio_dias: dIni,
      delta_fim_dias: dFim,
      duracao_origem: durO,
      duracao_sim: durS,
      delta_duracao_dias: durS - durO,
      alterado: dIni !== 0 || dFim !== 0,
      critico: !!it?.critico,
    };
  });
}

/** Resumo agregado do cenário. */
export type ResumoCenario = {
  total_itens: number;
  alterados: number;
  termino_origem: string | null;
  termino_sim: string | null;
  delta_termino_dias: number;
  criticos_impactados: number;
};

export function resumoCenario(diff: DiffLinha[]): ResumoCenario {
  if (diff.length === 0) {
    return {
      total_itens: 0,
      alterados: 0,
      termino_origem: null,
      termino_sim: null,
      delta_termino_dias: 0,
      criticos_impactados: 0,
    };
  }
  const fimO = diff.reduce(
    (acc, d) => (acc && acc > d.data_fim_origem ? acc : d.data_fim_origem),
    diff[0].data_fim_origem,
  );
  const fimS = diff.reduce(
    (acc, d) => (acc && acc > d.data_fim_sim ? acc : d.data_fim_sim),
    diff[0].data_fim_sim,
  );
  return {
    total_itens: diff.length,
    alterados: diff.filter((d) => d.alterado).length,
    termino_origem: fimO,
    termino_sim: fimS,
    delta_termino_dias: differenceInCalendarDays(parseISO(fimS), parseISO(fimO)),
    criticos_impactados: diff.filter((d) => d.alterado && d.critico).length,
  };
}

// Mantém o helper `max` referenciado para evitar import não usado em algumas builds.
void max;
