/** @module-kind pure */
/**
 * Agregações puras para o Dashboard Executivo Lean.
 * Sem dependências externas — alimentam KPIs multi-obra.
 */

export interface CompromissoLite {
  id: string;
  obra_id: string;
  concluido: boolean;
  causa_chave: string | null;
  semana_inicio: string;
}

export interface RestricaoLite {
  id: string;
  obra_id: string;
  tipo: string | null;
  status: string;
  prazo: string | null;
}

export interface PacoteLite {
  id: string;
  obra_id: string;
}

export interface PacoteRestricaoLite {
  pacote_id: string;
  restricao_id: string;
}

export interface RiscoLite {
  id: string;
  obra_id: string;
  probabilidade: number | null;
  impacto: number | null;
  status: string;
  descricao: string;
}

export interface CausaLite {
  chave: string;
  label: string;
}

export interface PpcPorObra {
  obra_id: string;
  total: number;
  concluidos: number;
  ppc: number;
}

export function consolidarPpcPorObra(compromissos: CompromissoLite[]): PpcPorObra[] {
  const acc = new Map<string, { total: number; concluidos: number }>();
  for (const c of compromissos) {
    const cur = acc.get(c.obra_id) ?? { total: 0, concluidos: 0 };
    cur.total += 1;
    if (c.concluido) cur.concluidos += 1;
    acc.set(c.obra_id, cur);
  }
  return Array.from(acc, ([obra_id, v]) => ({
    obra_id,
    total: v.total,
    concluidos: v.concluidos,
    ppc: v.total === 0 ? 0 : v.concluidos / v.total,
  })).sort((a, b) => b.ppc - a.ppc);
}

export function consolidarRestricoesPorCategoria(
  restricoes: RestricaoLite[],
): { categoria: string; abertas: number; total: number }[] {
  const acc = new Map<string, { abertas: number; total: number }>();
  for (const r of restricoes) {
    const cat = r.tipo ?? "outros";
    const cur = acc.get(cat) ?? { abertas: 0, total: 0 };
    cur.total += 1;
    if (r.status === "aberta") cur.abertas += 1;
    acc.set(cat, cur);
  }
  return Array.from(acc, ([categoria, v]) => ({ categoria, ...v })).sort(
    (a, b) => b.abertas - a.abertas,
  );
}

/**
 * Classifica cada pacote segundo restrições associadas:
 *  - vermelho: ao menos 1 restrição aberta vencida
 *  - amarelo: ao menos 1 restrição aberta (não vencida)
 *  - verde: nenhuma restrição aberta
 */
export function semaforoLookahead(
  pacotes: PacoteLite[],
  links: PacoteRestricaoLite[],
  restricoes: RestricaoLite[],
  hojeISO: string,
): { verde: number; amarelo: number; vermelho: number } {
  const rmap = new Map(restricoes.map((r) => [r.id, r]));
  const porPacote = new Map<string, RestricaoLite[]>();
  for (const l of links) {
    const r = rmap.get(l.restricao_id);
    if (!r) continue;
    const arr = porPacote.get(l.pacote_id) ?? [];
    arr.push(r);
    porPacote.set(l.pacote_id, arr);
  }
  let verde = 0,
    amarelo = 0,
    vermelho = 0;
  for (const p of pacotes) {
    const rs = porPacote.get(p.id) ?? [];
    const abertas = rs.filter((r) => r.status === "aberta");
    if (abertas.length === 0) {
      verde += 1;
    } else if (abertas.some((r) => r.prazo && r.prazo < hojeISO)) {
      vermelho += 1;
    } else {
      amarelo += 1;
    }
  }
  return { verde, amarelo, vermelho };
}

export function topCausasGlobal(
  compromissos: CompromissoLite[],
  causas: CausaLite[],
  limit = 5,
): { chave: string; label: string; count: number; pct: number }[] {
  const naoConcl = compromissos.filter((c) => !c.concluido && c.causa_chave);
  const total = naoConcl.length;
  const labelMap = new Map(causas.map((c) => [c.chave, c.label]));
  const acc = new Map<string, number>();
  for (const c of naoConcl) {
    const k = c.causa_chave!;
    acc.set(k, (acc.get(k) ?? 0) + 1);
  }
  return Array.from(acc, ([chave, count]) => ({
    chave,
    label: labelMap.get(chave) ?? chave,
    count,
    pct: total === 0 ? 0 : count / total,
  }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

export function topRiscosCriticos(riscos: RiscoLite[], limit = 5): RiscoLite[] {
  return [...riscos]
    .filter((r) => r.status === "aberto" || r.status === "em_andamento")
    .sort(
      (a, b) =>
        (b.probabilidade ?? 0) * (b.impacto ?? 0) - (a.probabilidade ?? 0) * (a.impacto ?? 0),
    )
    .slice(0, limit);
}
