// Fechamento de competência do **ponto** (escopo separado do da folha).
//
// Ponto e folha fecham em momentos diferentes: o DP congela a base do ponto,
// confere a conciliação Ponto × Folha e só então fecha a folha. Uma trava única
// forçaria os dois a acontecerem juntos.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { queryKey } from "@/lib/query-keys";
import {
  podeCarregarPeriodo,
  type CompetenciaMes,
  type FechamentoCompetencia,
} from "@/lib/dp/fechamento-competencia";

const QK = queryKey("dp_fechamento_ponto");

interface LinhaFechamento {
  competencia: string;
  fechado_em: string;
  fechado_por: string;
  motivo?: string | null;
  reaberto_em?: string | null;
  reaberto_por?: string | null;
  motivo_reabertura?: string | null;
  escopo?: string;
}

function paraFechamento(r: LinhaFechamento): FechamentoCompetencia {
  return {
    competencia: r.competencia,
    fechadoEm: r.fechado_em,
    fechadoPor: r.fechado_por,
    motivo: r.motivo ?? undefined,
    reabertoEm: r.reaberto_em ?? undefined,
    reabertoPor: r.reaberto_por ?? undefined,
    motivoReabertura: r.motivo_reabertura ?? undefined,
  };
}

export function useFechamentoPonto() {
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: QK,
    queryFn: async (): Promise<FechamentoCompetencia[]> => {
      const data = await apiFetch<LinhaFechamento[]>("dpFechamentoCompetencia", {
        params: { escopo: "ponto" },
      });
      if (!Array.isArray(data)) return [];
      // Defesa para o api.php ainda sem a coluna: sem `escopo`, a linha é de
      // folha e não pode virar trava de ponto.
      return data.filter((r) => r.escopo === "ponto").map(paraFechamento);
    },
    staleTime: 30_000,
    retry: false,
  });

  const fechamentos = query.data ?? [];

  const fechar = useMutation({
    mutationFn: (v: { competencia: CompetenciaMes; fechadoPor: string; motivo?: string }) =>
      apiFetch("dpFechamentoCompetencia", {
        method: "POST",
        body: {
          acao: "fechar",
          escopo: "ponto",
          competencia: v.competencia,
          fechado_por: v.fechadoPor,
          motivo: v.motivo ?? null,
        },
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: QK }),
  });

  const reabrir = useMutation({
    mutationFn: (v: {
      competencia: CompetenciaMes;
      reabertoPor: string;
      motivoReabertura: string;
    }) =>
      apiFetch("dpFechamentoCompetencia", {
        method: "POST",
        body: {
          acao: "reabrir",
          escopo: "ponto",
          competencia: v.competencia,
          reaberto_por: v.reabertoPor,
          motivo_reabertura: v.motivoReabertura,
        },
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: QK }),
  });

  return {
    fechamentos,
    carregando: query.isLoading,
    fechar,
    reabrir,
    /** Trava do período — a mesma regra que `importarPonto` aplica na gravação. */
    travaDoPeriodo: (inicio: string, fim: string) => podeCarregarPeriodo(fechamentos, inicio, fim),
  };
}
