/** @module-kind pure */
// BIZ-002.c — resolução pura de obra_id para NFS-e a partir de mapas já carregados.
// Sem I/O: recebe os mapas prontos (centros_custo_totvs.codigo→obra_id e obras aliases→id).
import type { NfseParsed } from "./parse-xml";

export function criarResolverObraNfse(
  mapaCentros: Map<string, string>,
  mapaObras: Map<string, string>,
) {
  return (l: NfseParsed): string | null => {
    const cod = (l.codigo_obra ?? "").toString().trim();
    if (cod) {
      const viaCentro = mapaCentros.get(cod) ?? mapaCentros.get(cod.padStart(3, "0"));
      if (viaCentro) return viaCentro;
      const viaObra = mapaObras.get(cod) ?? mapaObras.get(cod.replace(/^0+/, ""));
      if (viaObra) return viaObra;
    }
    const interno = (l.codigo_obra_interno ?? "").toString().trim();
    if (interno) {
      const viaObra = mapaObras.get(interno) ?? mapaObras.get(interno.replace(/^0+/, ""));
      if (viaObra) return viaObra;
    }
    return null;
  };
}

// Constrói o mapa de aliases de obras a partir das linhas cruas do banco.
export function buildMapaObrasAliases(
  rows: Array<{ id: string; nome?: string | null; codigo?: string | null; codigo_totvs?: string | null }>,
): Map<string, string> {
  const m = new Map<string, string>();
  for (const o of rows) {
    const id = o.id;
    const reg = (k?: string | null) => {
      if (!k) return;
      const s = String(k).trim();
      if (!s) return;
      if (!m.has(s)) m.set(s, id);
      const sn = s.replace(/^0+/, "");
      if (sn && !m.has(sn)) m.set(sn, id);
    };
    reg(o.codigo);
    reg(o.codigo_totvs);
    const nome = String(o.nome ?? "");
    const mm = nome.match(/^\s*(\d{2,4}(?:\.\d+)?)\b/);
    if (mm) reg(mm[1]);
  }
  return m;
}
