/** @module-kind pure */
// PRO-032 · slice-02 — Série mensal de contratos (novos vs. encerrados).
// Pura: recebe contratos + horizonte de meses, devolve buckets ordenados.
import type { Contrato } from "@/types";

export interface ContratoMesBucket {
  /** yyyy-MM */
  chave: string;
  /** rótulo curto pt-BR (ex.: "jul/26"). */
  rotulo: string;
  novos: number;
  encerrados: number;
}

function parseData(s?: string | null): Date | null {
  if (!s) return null;
  const br = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (br) return new Date(Number(br[3]), Number(br[2]) - 1, Number(br[1]));
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
  const dt = new Date(s);
  return Number.isNaN(dt.getTime()) ? null : dt;
}

function chaveMes(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function rotuloMes(d: Date): string {
  const meses = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
  return `${meses[d.getMonth()]}/${String(d.getFullYear()).slice(2)}`;
}

/**
 * Retorna `meses` buckets consecutivos terminando no mês atual.
 * "Novo" = data de início cai no bucket. "Encerrado" = último aditivo
 * (ou `termino` se não houver aditivo) cai no bucket E status = "encerrado".
 */
export function serieContratosMensal(
  contratos: Contrato[],
  meses = 6,
  hoje: Date = new Date(),
): ContratoMesBucket[] {
  const buckets: ContratoMesBucket[] = [];
  const anchor = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
  for (let i = meses - 1; i >= 0; i--) {
    const d = new Date(anchor.getFullYear(), anchor.getMonth() - i, 1);
    buckets.push({ chave: chaveMes(d), rotulo: rotuloMes(d), novos: 0, encerrados: 0 });
  }
  const idx = new Map(buckets.map((b, i) => [b.chave, i]));

  for (const c of contratos) {
    const inicio = parseData(c.inicio);
    if (inicio) {
      const i = idx.get(chaveMes(inicio));
      if (i !== undefined) buckets[i].novos += 1;
    }
    if (c.status === "encerrado") {
      const ultAditivo = (c.aditivos ?? [])
        .map((a) => parseData(a.novoTermino))
        .filter((d): d is Date => !!d)
        .sort((a, b) => b.getTime() - a.getTime())[0];
      const fim = ultAditivo ?? parseData(c.termino);
      if (fim) {
        const i = idx.get(chaveMes(fim));
        if (i !== undefined) buckets[i].encerrados += 1;
      }
    }
  }

  return buckets;
}

/**
 * PRO-032 · slice-04 — Detalhamento por mês.
 * Retorna quais contratos entraram como "novos" e "encerrados" em `chave` (yyyy-MM).
 */
export function contratosDoMes(
  contratos: Contrato[],
  chave: string,
): { novos: Contrato[]; encerrados: Contrato[] } {
  const novos: Contrato[] = [];
  const encerrados: Contrato[] = [];
  for (const c of contratos) {
    const inicio = parseData(c.inicio);
    if (inicio && chaveMes(inicio) === chave) novos.push(c);
    if (c.status === "encerrado") {
      const ultAditivo = (c.aditivos ?? [])
        .map((a) => parseData(a.novoTermino))
        .filter((d): d is Date => !!d)
        .sort((a, b) => b.getTime() - a.getTime())[0];
      const fim = ultAditivo ?? parseData(c.termino);
      if (fim && chaveMes(fim) === chave) encerrados.push(c);
    }
  }
  return { novos, encerrados };
}

