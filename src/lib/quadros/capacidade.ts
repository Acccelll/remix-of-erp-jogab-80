/** @module-kind pure */
/**
 * PRO-022 · slice-01 — Capacidade de mão de obra por obra (regra pura).
 *
 * Agrega colaboradores ativos por `obraAtualId` (excluindo colunas
 * especiais como `__ferias__`, `__afastado__`, etc.) e por função,
 * para exibir no Board um panorama rápido de alocação atual.
 *
 * Não faz I/O — recebe listas prontas de contextos (`useColaboradores`,
 * `useObras`) e, na slice-03, uma lista opcional de demanda planejada
 * por obra/função para comparar necessidade × alocado.
 */

export interface ColabInput {
  id: string;
  ativo: boolean;
  obraAtualId: string | null;
  funcao?: string | null;
}
export interface ObraInput {
  id: string;
  nome: string;
  ativa: boolean;
}
export interface DemandaMaoObraInput {
  obraId: string | null;
  funcao?: string | null;
  quantidade: number;
}

export interface CapacidadeDemandaFuncao {
  funcao: string;
  alocado: number;
  demanda: number;
  saldo: number;
}

export interface CapacidadeObra {
  obraId: string;
  obraNome: string;
  total: number;
  demandaTotal: number;
  deficitTotal: number;
  porFuncao: Array<{ funcao: string; qtd: number }>;
  porFuncaoDemanda: CapacidadeDemandaFuncao[];
}

export interface CapacidadeResumo {
  totalDisponiveis: number;
  totalAlocados: number;
  totalSemObra: number;
  totalEspeciais: number; // férias, afastado, etc.
  porObra: CapacidadeObra[];
}

function isEspecial(obraId: string | null): boolean {
  return !!obraId && obraId.startsWith("__");
}

function funcaoKey(funcao?: string | null): string {
  return (funcao ?? "").trim() || "Sem função";
}

function qtdValida(qtd: number): number {
  return Number.isFinite(qtd) && qtd > 0 ? qtd : 0;
}

export function calcularCapacidade(
  colaboradores: ReadonlyArray<ColabInput>,
  obras: ReadonlyArray<ObraInput>,
  demandas: ReadonlyArray<DemandaMaoObraInput> = [],
): CapacidadeResumo {
  const ativos = colaboradores.filter((c) => c.ativo);
  const obraNome = new Map(obras.map((o) => [o.id, o.nome]));
  const buckets = new Map<string, Map<string, number>>();
  const demandaBuckets = new Map<string, Map<string, number>>();
  let totalAlocados = 0;
  let totalSemObra = 0;
  let totalEspeciais = 0;

  for (const c of ativos) {
    const oid = c.obraAtualId;
    if (!oid) {
      totalSemObra++;
      continue;
    }
    if (isEspecial(oid)) {
      totalEspeciais++;
      continue;
    }
    if (!obraNome.has(oid)) continue; // obra inativa/inexistente
    totalAlocados++;
    const fMap = buckets.get(oid) ?? new Map<string, number>();
    const fkey = funcaoKey(c.funcao);
    fMap.set(fkey, (fMap.get(fkey) ?? 0) + 1);
    buckets.set(oid, fMap);
  }

  for (const d of demandas) {
    if (!d.obraId || isEspecial(d.obraId) || !obraNome.has(d.obraId)) continue;
    const qtd = qtdValida(d.quantidade);
    if (qtd === 0) continue;
    const fMap = demandaBuckets.get(d.obraId) ?? new Map<string, number>();
    const fkey = funcaoKey(d.funcao);
    fMap.set(fkey, (fMap.get(fkey) ?? 0) + qtd);
    demandaBuckets.set(d.obraId, fMap);
  }

  const porObra: CapacidadeObra[] = [];
  const obraIds = new Set([...buckets.keys(), ...demandaBuckets.keys()]);
  for (const oid of obraIds) {
    const fMap = buckets.get(oid) ?? new Map<string, number>();
    const dMap = demandaBuckets.get(oid) ?? new Map<string, number>();
    const porFuncao = Array.from(fMap, ([funcao, qtd]) => ({ funcao, qtd })).sort(
      (a, b) => b.qtd - a.qtd || a.funcao.localeCompare(b.funcao, "pt-BR"),
    );
    const total = porFuncao.reduce((s, x) => s + x.qtd, 0);
    const funcoes = new Set([...fMap.keys(), ...dMap.keys()]);
    const porFuncaoDemanda = Array.from(funcoes, (funcao) => {
      const alocado = fMap.get(funcao) ?? 0;
      const demanda = dMap.get(funcao) ?? 0;
      return { funcao, alocado, demanda, saldo: alocado - demanda };
    }).sort(
      (a, b) =>
        Math.max(0, b.demanda - b.alocado) - Math.max(0, a.demanda - a.alocado) ||
        b.demanda - a.demanda ||
        b.alocado - a.alocado ||
        a.funcao.localeCompare(b.funcao, "pt-BR"),
    );
    const demandaTotal = porFuncaoDemanda.reduce((s, x) => s + x.demanda, 0);
    const deficitTotal = porFuncaoDemanda.reduce((s, x) => s + Math.max(0, -x.saldo), 0);
    porObra.push({
      obraId: oid,
      obraNome: obraNome.get(oid)!,
      total,
      demandaTotal,
      deficitTotal,
      porFuncao,
      porFuncaoDemanda,
    });
  }
  porObra.sort(
    (a, b) =>
      b.deficitTotal - a.deficitTotal ||
      b.demandaTotal - a.demandaTotal ||
      b.total - a.total ||
      a.obraNome.localeCompare(b.obraNome, "pt-BR"),
  );

  return {
    totalDisponiveis: ativos.length,
    totalAlocados,
    totalSemObra,
    totalEspeciais,
    porObra,
  };
}
