/** @module-kind pure */
// Utilitários para derivar períodos de alocação de um colaborador em obras,
// a partir do histórico de mobilizações, e calcular custo proporcional por obra.
import type { Colaborador, Obra } from "@/types";

export interface PeriodoObra {
  obraId: string | null;
  obraNome: string;
  inicio: Date;
  fim: Date;
}

const RE_MOB = /Mobilizado de "([^"]*)" para "([^"]*)" em (\d{2})\/(\d{2})\/(\d{4})/;

function parseBR(d: string): Date | null {
  const m = d.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return null;
  return new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
}

function parseISOOrBR(d?: string | null): Date | null {
  if (!d) return null;
  const br = parseBR(d);
  if (br) return br;
  const iso = new Date(d);
  return isNaN(iso.getTime()) ? null : iso;
}

function findObraIdByNome(obras: Obra[], nome: string): string | null {
  if (!nome) return null;
  const hit = obras.find((o) => o.nome.trim().toLowerCase() === nome.trim().toLowerCase());
  return hit?.id || null;
}

export function periodosDoColaborador(c: Colaborador, obras: Obra[], ateData: Date): PeriodoObra[] {
  const eventos: Array<{ data: Date; origem: string; destino: string }> = [];
  (c.historico || []).forEach((h) => {
    if (h.tipo !== "mobilizacao") return;
    const m = h.descricao.match(RE_MOB);
    if (!m) return;
    const data = new Date(Number(m[5]), Number(m[4]) - 1, Number(m[3]));
    eventos.push({ data, origem: m[1], destino: m[2] });
  });
  eventos.sort((a, b) => a.data.getTime() - b.data.getTime());

  const periodos: PeriodoObra[] = [];
  const admissao = parseISOOrBR(c.dataAdmissao) || (eventos[0]?.data ?? null);

  if (eventos.length > 0 && admissao) {
    const e0 = eventos[0];
    if (e0.origem && admissao.getTime() < e0.data.getTime()) {
      periodos.push({
        obraId: findObraIdByNome(obras, e0.origem),
        obraNome: e0.origem,
        inicio: admissao,
        fim: e0.data,
      });
    }
    for (let i = 0; i < eventos.length; i++) {
      const ev = eventos[i];
      const next = eventos[i + 1];
      periodos.push({
        obraId: findObraIdByNome(obras, ev.destino),
        obraNome: ev.destino,
        inicio: ev.data,
        fim: next ? next.data : ateData,
      });
    }
  } else {
    const obraAtual = obras.find((o) => o.id === c.obraAtualId);
    if (obraAtual && admissao) {
      periodos.push({
        obraId: obraAtual.id,
        obraNome: obraAtual.nome,
        inicio: admissao,
        fim: ateData,
      });
    }
  }

  return periodos.filter((p) => p.obraNome && p.obraNome.toLowerCase() !== "sem alocação");
}

export function diasIntersecao(a: Date, b: Date, c: Date, d: Date): number {
  const start = Math.max(a.getTime(), c.getTime());
  const end = Math.min(b.getTime(), d.getTime());
  if (end <= start) return 0;
  return Math.round((end - start) / 86400000);
}

export function competenciaRange(competencia: string): { inicio: Date; fim: Date; dias: number } {
  const [y, m] = competencia.split("-").map(Number);
  const inicio = new Date(y, m - 1, 1);
  const fim = new Date(y, m, 1);
  const dias = Math.round((fim.getTime() - inicio.getTime()) / 86400000);
  return { inicio, fim, dias };
}

export function formatRangeBR(inicio: Date, fim: Date): string {
  const f = (d: Date) =>
    `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
  const fimInc = new Date(fim.getTime() - 86400000);
  return `${f(inicio)} a ${f(fimInc)}`;
}

export function obraDoColaboradorNaCompetencia(
  c: Colaborador,
  obras: Obra[],
  competencia: string,
): { id: string | null; nome: string } | null {
  const { inicio, fim } = competenciaRange(competencia);
  const ateData = new Date(Math.max(fim.getTime(), Date.now()));
  const periodos = periodosDoColaborador(c, obras, ateData);
  if (periodos.length === 0) return null;
  const agg = new Map<string, { id: string | null; nome: string; dias: number }>();
  periodos.forEach((p) => {
    const dias = diasIntersecao(p.inicio, p.fim, inicio, fim);
    if (dias <= 0) return;
    const key = (p.obraId || "") + "|" + p.obraNome;
    const cur = agg.get(key) || { id: p.obraId, nome: p.obraNome, dias: 0 };
    cur.dias += dias;
    agg.set(key, cur);
  });
  if (agg.size === 0) return null;
  return Array.from(agg.values()).sort((a, b) => b.dias - a.dias)[0];
}
