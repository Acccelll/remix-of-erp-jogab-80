/** @module-kind pure-ish */
// Hook para verificar se uma data (dd/MM/yyyy ou yyyy-MM-dd) é feriado nacional via BrasilAPI.
// Falha silenciosamente para não bloquear fluxo — retorna isFeriado=false em erro.
import { useEffect, useState } from "react";

interface Feriado {
  date: string; // yyyy-MM-dd
  name: string;
  type?: string;
}

const cache = new Map<number, Promise<Feriado[]>>();

async function fetchFeriados(ano: number): Promise<Feriado[]> {
  if (cache.has(ano)) return cache.get(ano)!;
  const p = (async () => {
    try {
      const ctrl = new AbortController();
      const timeout = setTimeout(() => ctrl.abort(), 4000);
      const r = await fetch(`https://brasilapi.com.br/api/feriados/v1/${ano}`, {
        signal: ctrl.signal,
      });
      clearTimeout(timeout);
      if (!r.ok) return [];
      const data = await r.json();
      return Array.isArray(data) ? (data as Feriado[]) : [];
    } catch {
      cache.delete(ano); // permite retry futuro
      return [];
    }
  })();
  cache.set(ano, p);
  return p;
}

function parseData(raw: string): { iso: string; ano: number } | null {
  if (!raw) return null;
  const s = raw.trim();
  // yyyy-MM-dd
  const isoMatch = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (isoMatch) return { iso: `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`, ano: Number(isoMatch[1]) };
  // dd/MM/yyyy
  const brMatch = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(s);
  if (brMatch) {
    const [, dd, mm, yyyy] = brMatch;
    return { iso: `${yyyy}-${mm}-${dd}`, ano: Number(yyyy) };
  }
  return null;
}

export function useValidadorFeriados(data: string) {
  const [isFeriado, setIsFeriado] = useState(false);
  const [nomes, setNomes] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const parsed = parseData(data);
    if (!parsed) {
      setIsFeriado(false);
      setNomes([]);
      return;
    }
    let cancel = false;
    setLoading(true);
    fetchFeriados(parsed.ano)
      .then((lista) => {
        if (cancel) return;
        const found = lista.filter((f) => f.date === parsed.iso);
        setIsFeriado(found.length > 0);
        setNomes(found.map((f) => f.name));
      })
      .finally(() => {
        if (!cancel) setLoading(false);
      });
    return () => {
      cancel = true;
    };
  }, [data]);

  return { isFeriado, nomes, loading };
}
