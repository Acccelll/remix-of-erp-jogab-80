/** @module-kind pure */
// PRO-003 · slice-01 — Regras puras de fechamento de competência da folha (DP).
//
// Escopo desta slice: apenas regras puras. UI e persistência ficam em slices futuros.
// Uma competência fechada bloqueia edição/lançamentos com data dentro do intervalo
// fechado e exige reabertura formal (registrada com motivo + responsável).

export type CompetenciaMes = string; // "YYYY-MM"

export interface FechamentoCompetencia {
  competencia: CompetenciaMes;
  fechadoEm: string; // ISO-8601
  fechadoPor: string; // login/nome do responsável
  motivo?: string;
  reabertoEm?: string;
  reabertoPor?: string;
  motivoReabertura?: string;
}

const RE_COMPETENCIA = /^\d{4}-(0[1-9]|1[0-2])$/;

export function competenciaValida(comp: string): comp is CompetenciaMes {
  return RE_COMPETENCIA.test(comp);
}

/** Extrai a competência (YYYY-MM) de uma data ISO/`Date`. */
export function competenciaDe(data: string | Date): CompetenciaMes {
  const d = typeof data === "string" ? new Date(data) : data;
  if (Number.isNaN(d.getTime())) throw new Error("Data inválida");
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

export interface Trava {
  ok: boolean;
  motivo?: string;
}

/** Retorna o fechamento ATIVO da competência (fechada e não reaberta). */
export function fechamentoAtivo(
  fechamentos: FechamentoCompetencia[],
  comp: CompetenciaMes,
): FechamentoCompetencia | null {
  const doMes = fechamentos.filter((f) => f.competencia === comp);
  if (doMes.length === 0) return null;
  // pega o mais recente por fechadoEm
  const ativo = [...doMes].sort((a, b) => b.fechadoEm.localeCompare(a.fechadoEm))[0];
  if (ativo.reabertoEm) return null;
  return ativo;
}

export function competenciaFechada(
  fechamentos: FechamentoCompetencia[],
  comp: CompetenciaMes,
): boolean {
  return fechamentoAtivo(fechamentos, comp) !== null;
}

export function podeEditarCompetencia(
  fechamentos: FechamentoCompetencia[],
  comp: CompetenciaMes,
): Trava {
  const ativo = fechamentoAtivo(fechamentos, comp);
  if (!ativo) return { ok: true };
  return {
    ok: false,
    motivo: `Competência ${comp} fechada em ${ativo.fechadoEm.slice(0, 10)} por ${ativo.fechadoPor}.`,
  };
}

/**
 * Competências (YYYY-MM) tocadas por um intervalo de datas.
 * Uma importação de ponto raramente respeita o mês: `26/07 a 05/08` mexe em
 * duas competências, e basta uma delas estar fechada para a carga ser barrada.
 */
export function competenciasNoIntervalo(inicio: string, fim: string): CompetenciaMes[] {
  const ini = Date.parse(`${inicio}T00:00:00Z`);
  const f = Date.parse(`${fim}T00:00:00Z`);
  if (Number.isNaN(ini) || Number.isNaN(f) || f < ini) return [];

  const out: CompetenciaMes[] = [];
  const cursor = new Date(ini);
  cursor.setUTCDate(1);
  const limite = new Date(f);
  while (cursor.getTime() <= limite.getTime()) {
    out.push(cursor.toISOString().slice(0, 7));
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }
  return out;
}

/**
 * Verifica se um período pode receber carga de ponto. Devolve a primeira
 * competência fechada encontrada, para a mensagem dizer qual delas trava.
 */
export function podeCarregarPeriodo(
  fechamentos: FechamentoCompetencia[],
  inicio: string,
  fim: string,
): Trava {
  for (const comp of competenciasNoIntervalo(inicio, fim)) {
    const ativo = fechamentoAtivo(fechamentos, comp);
    if (ativo) {
      return {
        ok: false,
        motivo: `Competência ${comp} fechada em ${ativo.fechadoEm.slice(0, 10)} por ${ativo.fechadoPor}. Reabra antes de importar.`,
      };
    }
  }
  return { ok: true };
}

export interface FecharCompetenciaInput {
  competencia: CompetenciaMes;
  fechadoPor: string;
  motivo?: string;
  fechamentos: FechamentoCompetencia[];
  agora?: () => Date;
}

/** Regras: competência válida, não pode estar já fechada, responsável obrigatório. */
export function fecharCompetencia(input: FecharCompetenciaInput): FechamentoCompetencia {
  const { competencia, fechadoPor, motivo, fechamentos, agora = () => new Date() } = input;
  if (!competenciaValida(competencia)) throw new Error("Competência inválida (use YYYY-MM).");
  if (!fechadoPor.trim()) throw new Error("Informe o responsável pelo fechamento.");
  if (competenciaFechada(fechamentos, competencia)) {
    throw new Error(`Competência ${competencia} já está fechada.`);
  }
  return {
    competencia,
    fechadoPor: fechadoPor.trim(),
    motivo: motivo?.trim() || undefined,
    fechadoEm: agora().toISOString(),
  };
}

export interface ReabrirCompetenciaInput {
  competencia: CompetenciaMes;
  reabertoPor: string;
  motivoReabertura: string;
  fechamentos: FechamentoCompetencia[];
  agora?: () => Date;
}

/** Reabre a competência ativa (registra reaberturaEm/por + motivo obrigatório). */
export function reabrirCompetencia(input: ReabrirCompetenciaInput): FechamentoCompetencia {
  const {
    competencia,
    reabertoPor,
    motivoReabertura,
    fechamentos,
    agora = () => new Date(),
  } = input;
  const ativo = fechamentoAtivo(fechamentos, competencia);
  if (!ativo) throw new Error(`Competência ${competencia} não está fechada.`);
  if (!reabertoPor.trim()) throw new Error("Informe o responsável pela reabertura.");
  if (!motivoReabertura.trim()) throw new Error("Motivo da reabertura é obrigatório.");
  return {
    ...ativo,
    reabertoEm: agora().toISOString(),
    reabertoPor: reabertoPor.trim(),
    motivoReabertura: motivoReabertura.trim(),
  };
}
