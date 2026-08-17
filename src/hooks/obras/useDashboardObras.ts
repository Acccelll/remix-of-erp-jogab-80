import { useMemo } from "react";
import { useObras } from "@/hooks/obras/useObras";
import { useQuery } from "@tanstack/react-query";
import {
  agruparPorObra,
  resumirObra,
  type ItemCronoDashboard,
  type ResumoObra,
} from "@/lib/obras/dashboardObras";
import { obrasRepo } from "@/lib/repositories/obras";
import { cronogramaRepo } from "@/lib/repositories/cronograma";

export interface ObraComProgresso {
  obra: any;
  resumo: ResumoObra | null;
  diagnostico: {
    temFlowcastId: boolean;
    chaveUsada: string;
    motivoSemCronograma?: "sem_flowcast_id" | "vazio_no_flowcast";
  };
}

const ordemFaixa = { critico: 0, alerta: 1, bom: 2 } as const;

export type SortType = "piores" | "melhores" | "codigo_asc" | "codigo_desc" | "nome_asc";

export function useDashboardObras(options?: { sort?: SortType }) {
  const sort = options?.sort ?? "piores";
  const hoje = useMemo(() => new Date(), []);

  const obrasQuery = useObras();

  // Substituindo o hook ausente por uma query direta ao cronogramaRepo
  const cronoQuery = useQuery({
    queryKey: ["cronograma", "dashboard"],
    queryFn: () => cronogramaRepo.listDashboard(),
    staleTime: 60_000,
  });

  const pareamentoQuery = useQuery({
    queryKey: ["obras", "pareamento-totvs"],
    queryFn: () => obrasRepo.listPareamentoCentroCusto(),
    staleTime: 5 * 60_000,
  });

  const { obras, totalObrasOcultas, diagnostico } = useMemo(() => {
    if (!obrasQuery.data || !cronoQuery.data) {
      return {
        obras: [],
        totalObrasOcultas: 0,
        diagnostico: {
          totalItensCronograma: 0,
          obrasSemFlowcastId: 0,
          obrasSemItens: 0,
          chavesOrfas: [],
        },
      };
    }

    const itensCrono = cronoQuery.data as ItemCronoDashboard[];
    const porObra = agruparPorObra(itensCrono);

    const obrasSemFlowcastId: string[] = [];
    const obrasSemItens: string[] = [];
    const chavesUsadas = new Set<string>();

    const lista: ObraComProgresso[] = obrasQuery.data.map((obra) => {
      const flowcastId = (obra as any).flowcastId;
      const centroCusto = (obra as any).centro_custo_totvs;

      let chave = String(flowcastId || "");
      let temFlowcastId = !!flowcastId;

      if (!temFlowcastId && centroCusto) {
        chave = String(centroCusto);
      }

      const itens = porObra.get(chave);
      let resumo: ResumoObra | null = null;
      let motivoSemCronograma: "sem_flowcast_id" | "vazio_no_flowcast" | undefined;

      if (itens && itens.length > 0) {
        resumo = resumirObra(itens, hoje);
        chavesUsadas.add(chave);
      } else {
        if (!flowcastId && !centroCusto) {
          obrasSemFlowcastId.push(obra.id);
          motivoSemCronograma = "sem_flowcast_id";
        } else {
          obrasSemItens.push(obra.id);
          motivoSemCronograma = "vazio_no_flowcast";
        }
      }

      return {
        obra,
        resumo,
        diagnostico: { temFlowcastId, chaveUsada: chave, motivoSemCronograma },
      };
    });

    const chavesOrfas: string[] = [];
    for (const k of porObra.keys()) {
      if (!chavesUsadas.has(k)) chavesOrfas.push(k);
    }

    lista.sort((a, b) => {
      const isAlphaSort = sort.startsWith("codigo") || sort === "nome_asc";
      if (!isAlphaSort) {
        if (!a.resumo && !b.resumo) return a.obra.nome.localeCompare(b.obra.nome);
        if (!a.resumo) return 1;
        if (!b.resumo) return -1;
      }

      switch (sort) {
        case "codigo_asc":
          return (a.obra.codigo || "").localeCompare(b.obra.codigo || "");
        case "codigo_desc":
          return (b.obra.codigo || "").localeCompare(a.obra.codigo || "");
        case "nome_asc":
          return a.obra.nome.localeCompare(b.obra.nome);
        case "melhores": {
          const fa = a.resumo?.faixaSpi ? ordemFaixa[a.resumo.faixaSpi] : 3;
          const fb = b.resumo?.faixaSpi ? ordemFaixa[b.resumo.faixaSpi] : 3;
          if (fa !== fb) return fb - fa;
          return (a.resumo?.atrasados ?? 0) - (b.resumo?.atrasados ?? 0);
        }
        case "piores":
        default: {
          const fa = a.resumo?.faixaSpi ? ordemFaixa[a.resumo.faixaSpi] : 3;
          const fb = b.resumo?.faixaSpi ? ordemFaixa[b.resumo.faixaSpi] : 3;
          if (fa !== fb) return fa - fb;
          return (b.resumo?.atrasados ?? 0) - (a.resumo?.atrasados ?? 0);
        }
      }
    });

    const listaFiltrada = lista.filter((item) => item.resumo !== null);
    const totalObrasOcultas = lista.length - listaFiltrada.length;

    return {
      obras: listaFiltrada,
      totalObrasOcultas,
      diagnostico: {
        totalItensCronograma: itensCrono.length,
        obrasSemFlowcastId: obrasSemFlowcastId.length,
        obrasSemItens: obrasSemItens.length,
        chavesOrfas,
      },
    };
  }, [obrasQuery.data, cronoQuery.data, sort, hoje]);

  return {
    obras,
    totalObrasOcultas,
    diagnostico,
    isLoading: obrasQuery.isLoading || cronoQuery.isLoading,
    isError: obrasQuery.isError || cronoQuery.isError,
    error: obrasQuery.error ?? cronoQuery.error,
  };
}
