// ARC-004 · Onda 6 — DP/Holerites sob máquina única de estado servidor (TanStack Query).
import { useCallback, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  fetchAllHolerites,
  upsertHoleriteBatch,
  type DpHoleriteRow,
} from "@/lib/repositories/dpHolerite";
import type { LinhaHolerite } from "@/lib/dp/parser-holerite-xls";
import { queryKey } from "@/lib/query-keys";
import { cleanCPF } from "@/lib/utils";
import { useCatalogos } from "@/contexts/catalogos/useCatalogos";
import { obraDoColaboradorNaCompetencia } from "@/lib/dp/alocacao";
import type { DpFilters } from "@/components/dp/DpFilterBar";

export type DpHoleriteRowEnriched = DpHoleriteRow & {
  obraResolvida: string;
  obraResolvidaId: string | null;
  funcaoCadastro: string;
};

export const dpHoleriteKeys = {
  all: queryKey("dp_holerites"),
};

export function useImportDpHolerites() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (args: {
      linhas: LinhaHolerite[];
      resolveColabId: (cpf: string) => string | null;
    }) => upsertHoleriteBatch(args.linhas, args.resolveColabId),
    onSuccess: () => {
      return queryClient.invalidateQueries({ queryKey: dpHoleriteKeys.all });
    },
  });
}

export function useDpHolerites() {
  const { colaboradores, obras } = useCatalogos();
  const {
    data: all = [],
    isLoading,
    isFetching,
    refetch,
  } = useQuery({
    queryKey: dpHoleriteKeys.all,
    queryFn: fetchAllHolerites,
  });
  const reload = useCallback(() => {
    refetch();
  }, [refetch]);

  const colabByCpf = useMemo(() => {
    const m = new Map<string, (typeof colaboradores)[number]>();
    colaboradores.forEach((c) => {
      const k = cleanCPF(c.cpf);
      if (k) m.set(k, c);
    });
    return m;
  }, [colaboradores]);

  const enrich = useCallback(
    (r: DpHoleriteRow): DpHoleriteRowEnriched => {
      const colab = colabByCpf.get(r.cpf);
      const funcaoCadastro = colab?.funcao || "";
      const fallbackNome = r.centro_custo_nome_lido || "";
      if (!colab)
        return { ...r, obraResolvida: fallbackNome, obraResolvidaId: null, funcaoCadastro };
      const o = obraDoColaboradorNaCompetencia(colab, obras, r.competencia);
      if (!o) {
        const hit = obras.find(
          (ob) => ob.nome.trim().toLowerCase() === fallbackNome.trim().toLowerCase(),
        );
        return {
          ...r,
          obraResolvida: fallbackNome,
          obraResolvidaId: hit?.id || null,
          funcaoCadastro,
        };
      }
      return { ...r, obraResolvida: o.nome, obraResolvidaId: o.id, funcaoCadastro };
    },
    [colabByCpf, obras],
  );

  const allEnriched = useMemo(() => all.map(enrich), [all, enrich]);
  const rows = useMemo(() => allEnriched.filter((r) => r.tipo !== "adiantamento"), [allEnriched]);
  const adiantamentos = useMemo(
    () => allEnriched.filter((r) => r.tipo === "adiantamento"),
    [allEnriched],
  );

  const adiantamentoMap = useMemo(() => {
    const m = new Map<string, DpHoleriteRowEnriched>();
    adiantamentos.forEach((r) => m.set(`${r.cpf}|${r.competencia}`, r));
    return m;
  }, [adiantamentos]);
  const getAdiantamento = useCallback(
    (cpf: string, competencia: string) => adiantamentoMap.get(`${cpf}|${competencia}`) || null,
    [adiantamentoMap],
  );

  const competencias = useMemo(
    () =>
      Array.from(new Set(allEnriched.map((r) => r.competencia)))
        .filter(Boolean)
        .sort()
        .reverse(),
    [allEnriched],
  );
  const obrasList = useMemo(
    () => Array.from(new Set(rows.map((r) => r.obraResolvida || "").filter(Boolean))).sort(),
    [rows],
  );
  const cargos = useMemo(
    () => Array.from(new Set(rows.map((r) => r.funcaoCadastro || "").filter(Boolean))).sort(),
    [rows],
  );

  return {
    rows,
    adiantamentos,
    getAdiantamento,
    loading: isLoading || isFetching,
    reload,
    competencias,
    obras: obrasList,
    cargos,
  };
}

export function applyFilters(rows: DpHoleriteRowEnriched[], f: DpFilters): DpHoleriteRowEnriched[] {
  const sc = cleanCPF(f.search);
  const sl = f.search.toLowerCase().trim();
  return rows.filter((r) => {
    if (f.competencia && r.competencia !== f.competencia) return false;
    if (f.obra && r.obraResolvida !== f.obra) return false;
    if (f.cargo && r.funcaoCadastro !== f.cargo) return false;
    if (sl) {
      const hitCpf = sc && r.cpf.includes(sc);
      const hitNome = (r.nome_lido || "").toLowerCase().includes(sl);
      if (!hitCpf && !hitNome) return false;
    }
    return true;
  });
}

export function defaultFilters(competencias: string[]): DpFilters {
  return { competencia: competencias[0] || "", obra: "", cargo: "", search: "" };
}
