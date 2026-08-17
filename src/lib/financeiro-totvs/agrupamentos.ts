/** @module-kind pure */
// Helpers puros de agrupamento reutilizáveis pela tela de Simulação (Prompt 6).
// Padrão idêntico ao centrosRanking em useDividasData.ts, mas operando sobre
// uma lista de títulos decorados avulsa (não sobre rollup histórico).

export interface TituloAgrupavel {
  centro_custo?: string | null;
  centro_nome?: string | null;
  natureza_cod?: string | null;
  natureza_desc?: string | null;
  aberto?: number | null;
  status_cod?: number | null;
}

export interface GrupoAgregado {
  codigo: string;
  nome: string;
  valor: number;
  titulos: number;
  pct: number;
}

function acumular(
  titulos: TituloAgrupavel[],
  getCod: (t: TituloAgrupavel) => string,
  getNome: (t: TituloAgrupavel) => string,
): GrupoAgregado[] {
  const acc = new Map<string, { codigo: string; nome: string; valor: number; titulos: number }>();
  for (const t of titulos) {
    const codigo = getCod(t) || "—";
    const nome = getNome(t) || codigo;
    const cur = acc.get(codigo) ?? { codigo, nome, valor: 0, titulos: 0 };
    cur.valor += Number(t.aberto ?? 0);
    cur.titulos += 1;
    acc.set(codigo, cur);
  }
  const arr = Array.from(acc.values());
  const total = arr.reduce((s, c) => s + c.valor, 0);
  return arr
    .map((c) => ({ ...c, pct: total > 0 ? (c.valor / total) * 100 : 0 }))
    .sort((a, b) => b.valor - a.valor);
}

export function agruparPorCentroCusto(titulos: TituloAgrupavel[]): GrupoAgregado[] {
  return acumular(titulos, (t) => t.centro_custo ?? "—", (t) => t.centro_nome ?? "");
}

export function agruparPorNatureza(titulos: TituloAgrupavel[]): GrupoAgregado[] {
  return acumular(titulos, (t) => t.natureza_cod ?? "—", (t) => t.natureza_desc ?? "");
}
