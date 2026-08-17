/** @module-kind io */
/**
 * Filtros do QuadroBoard — codificação URL-safe, predicado e helpers.
 *
 * Estado vive em `?filters=<base64-json>` do QuadroBoard e é reutilizado
 * pelo Popover de Views Salvas. A predicate é pura — fácil de testar.
 */

export type PrazoFiltro = "vencido" | "hoje" | "semana" | "sem-prazo" | "";

export interface FiltrosCards {
  etiquetaId?: string;
  responsavelId?: string;
  setor?: string;
  prazo?: PrazoFiltro;
  semResponsavel?: boolean;
  checklistIncompleto?: boolean;
}

export interface CardFiltravel {
  responsavelId: string | null;
  setores: string[];
  labelIds: string[];
  prazo: string | null;
  checklistTotal?: number;
  checklistConcluido?: number;
}

export const FILTROS_VAZIO: FiltrosCards = {};

export function temFiltrosAtivos(f: FiltrosCards | null | undefined): boolean {
  if (!f) return false;
  return Boolean(
    f.etiquetaId ||
    f.responsavelId ||
    f.setor ||
    f.prazo ||
    f.semResponsavel ||
    f.checklistIncompleto,
  );
}

function b64encode(s: string): string {
  if (typeof window !== "undefined" && typeof window.btoa === "function") {
    return window.btoa(unescape(encodeURIComponent(s)));
  }
  // Node / vitest
  return Buffer.from(s, "utf8").toString("base64");
}

function b64decode(s: string): string {
  if (typeof window !== "undefined" && typeof window.atob === "function") {
    return decodeURIComponent(escape(window.atob(s)));
  }
  return Buffer.from(s, "base64").toString("utf8");
}

export function encodeFiltros(f: FiltrosCards): string {
  if (!temFiltrosAtivos(f)) return "";
  // remove chaves vazias / falsy para encurtar a URL
  const compact: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(f)) {
    if (v === undefined || v === null || v === "" || v === false) continue;
    compact[k] = v;
  }
  return b64encode(JSON.stringify(compact));
}

export function decodeFiltros(s: string | null | undefined): FiltrosCards {
  if (!s) return {};
  try {
    const json = b64decode(s);
    const obj = JSON.parse(json);
    if (!obj || typeof obj !== "object") return {};
    return obj as FiltrosCards;
  } catch {
    return {};
  }
}

export function bucketPrazo(prazoIso: string | null, hoje: Date): PrazoFiltro {
  if (!prazoIso) return "sem-prazo";
  const p = new Date(prazoIso);
  if (Number.isNaN(p.getTime())) return "sem-prazo";
  const d0 = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
  const pd = new Date(p.getFullYear(), p.getMonth(), p.getDate());
  const diffDias = Math.round((pd.getTime() - d0.getTime()) / 86400000);
  if (diffDias < 0) return "vencido";
  if (diffDias === 0) return "hoje";
  if (diffDias <= 7) return "semana";
  return ""; // fora dos buckets de filtro
}

export function aplicaFiltros<T extends CardFiltravel>(
  cards: T[],
  f: FiltrosCards,
  hoje: Date = new Date(),
): T[] {
  if (!temFiltrosAtivos(f)) return cards;
  return cards.filter((c) => {
    if (f.etiquetaId && !c.labelIds.includes(f.etiquetaId)) return false;
    if (f.responsavelId && c.responsavelId !== f.responsavelId) return false;
    if (f.setor && !c.setores.includes(f.setor)) return false;
    if (f.semResponsavel && c.responsavelId) return false;
    if (f.checklistIncompleto) {
      const total = c.checklistTotal ?? 0;
      const ok = c.checklistConcluido ?? 0;
      if (total === 0 || ok >= total) return false;
    }
    if (f.prazo) {
      const b = bucketPrazo(c.prazo, hoje);
      if (f.prazo === "sem-prazo") {
        if (b !== "sem-prazo") return false;
      } else if (b !== f.prazo) return false;
    }
    return true;
  });
}
