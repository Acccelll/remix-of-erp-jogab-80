/** @module-kind pure */
/**
 * Lib pura de métricas do RDO consolidado.
 * Sem dependências externas — testável isoladamente com Vitest.
 */

export interface RdoRow {
  id: string;
  obra_id: string;
  data: string; // yyyy-MM-dd
  trabalhavel_manha: boolean | null;
  trabalhavel_tarde: boolean | null;
  trabalhavel_noite: boolean | null;
}

export interface EfetivoRow {
  rdo_id: string;
  quantidade: number;
  presente: boolean;
}

export interface OcorrenciaRow {
  rdo_id: string;
  tipo: string;
  descricao: string;
}

export interface AtividadeRow {
  rdo_id: string;
  cronograma_item_id: string | null;
  descricao: string;
  quantidade: number | null;
}

export interface CompromissoRow {
  id: string;
  pacote_id: string;
  semana_inicio: string;
  concluido: boolean;
}

export interface PacoteRow {
  id: string;
  cronograma_item_id: string | null;
}

/** Média de pessoas presentes por RDO (apenas linhas `presente=true`). */
export function mediaEfetivo(rdos: RdoRow[], efetivo: EfetivoRow[]): number {
  if (rdos.length === 0) return 0;
  const porRdo = new Map<string, number>();
  for (const e of efetivo) {
    if (!e.presente) continue;
    porRdo.set(e.rdo_id, (porRdo.get(e.rdo_id) ?? 0) + (e.quantidade ?? 0));
  }
  let total = 0;
  for (const r of rdos) total += porRdo.get(r.id) ?? 0;
  return total / rdos.length;
}

/** Percentual de turnos trabalháveis (manhã/tarde/noite) sobre o universo de turnos. */
export function percentTrabalhavel(rdos: RdoRow[]): number {
  if (rdos.length === 0) return 0;
  let ok = 0;
  let total = 0;
  for (const r of rdos) {
    for (const t of [r.trabalhavel_manha, r.trabalhavel_tarde, r.trabalhavel_noite]) {
      total += 1;
      if (t) ok += 1;
    }
  }
  return total === 0 ? 0 : ok / total;
}

/** Ranking de ocorrências agrupadas por tipo. */
export function ocorrenciasPorTipo(
  ocorrencias: OcorrenciaRow[],
): { tipo: string; count: number }[] {
  const acc = new Map<string, number>();
  for (const o of ocorrencias) acc.set(o.tipo, (acc.get(o.tipo) ?? 0) + 1);
  return Array.from(acc, ([tipo, count]) => ({ tipo, count })).sort((a, b) => b.count - a.count);
}

/**
 * Cruza atividades de RDO com compromissos do Last Planner: para cada
 * compromisso encontra a execução mais recente cujo `cronograma_item_id`
 * bate com `pacote.cronograma_item_id` e cuja `data` cai na semana do
 * compromisso. Útil para alimentar PPC automaticamente.
 */
export function cruzarRdoComCompromissos(
  rdos: RdoRow[],
  atividades: AtividadeRow[],
  pacotes: PacoteRow[],
  compromissos: CompromissoRow[],
): { compromissoId: string; executadoEm: string; quantidade: number }[] {
  const pacoteIndex = new Map(pacotes.map((p) => [p.id, p.cronograma_item_id]));
  const rdoIndex = new Map(rdos.map((r) => [r.id, r.data]));
  const out: { compromissoId: string; executadoEm: string; quantidade: number }[] = [];
  for (const c of compromissos) {
    const cronId = pacoteIndex.get(c.pacote_id);
    if (!cronId) continue;
    const semanaInicio = new Date(c.semana_inicio + "T00:00:00");
    const semanaFim = new Date(semanaInicio);
    semanaFim.setDate(semanaFim.getDate() + 6);
    let melhor: { data: string; qtd: number } | null = null;
    for (const a of atividades) {
      if (a.cronograma_item_id !== cronId) continue;
      const data = rdoIndex.get(a.rdo_id);
      if (!data) continue;
      const dt = new Date(data + "T00:00:00");
      if (dt < semanaInicio || dt > semanaFim) continue;
      if (!melhor || data > melhor.data) {
        melhor = { data, qtd: a.quantidade ?? 0 };
      }
    }
    if (melhor) {
      out.push({ compromissoId: c.id, executadoEm: melhor.data, quantidade: melhor.qtd });
    }
  }
  return out;
}

export const OCORRENCIA_LABEL: Record<string, string> = {
  chuva: "Chuva",
  falta_material: "Falta de material",
  acidente: "Acidente",
  visita: "Visita",
  outro: "Outro",
};
