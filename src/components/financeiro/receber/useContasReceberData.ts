import { useQuery } from "@tanstack/react-query";

import { hojeBrasilia } from "@/lib/utils";
import { financeiroRepo, financeiroTotvsRepo } from "@/lib/repositories/financeiro";
import { classificarBucketStatus } from "@/lib/financeiro-totvs/status-bucket";

export interface ContasReceberBucket {
  titulos: number;
  valor: number;
}

export interface ContasReceberResumo {
  vencido: ContasReceberBucket;
  hoje: ContasReceberBucket;
  avencer: ContasReceberBucket;
  recebido: ContasReceberBucket;
  totalAberto: number;
}

/**
 * Contas a Receber (natureza_tipo = 1 / CR). Reaproveita a tubulação
 * do Fluxo de Dívidas — mesma view e mesmo classificador de status —,
 * apenas invertendo o filtro de natureza. Retorna resumo por bucket.
 */
export function useContasReceberData(obraId: string = "all") {
  const hoje = hojeBrasilia();

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["fin_contas_receber", obraId],
    queryFn: async (): Promise<ContasReceberResumo> => {
      const snap = await financeiroRepo.getLatestSnapshotMeta();
      if (!snap) {
        return {
          vencido: { titulos: 0, valor: 0 },
          hoje: { titulos: 0, valor: 0 },
          avencer: { titulos: 0, valor: 0 },
          recebido: { titulos: 0, valor: 0 },
          totalAberto: 0,
        };
      }
      const rows = await financeiroTotvsRepo.listVwFinanceiroObraPaged(
        [
          "lancamento_id",
          "valor_liquido",
          "valor_baixado",
          "status_cod",
          "data_vencimento",
          "natureza_tipo",
        ].join(", "),
        obraId === "all" ? undefined : obraId,
      );

      // Deduplica por lancamento_id (a view repete linha por rateio).
      const vistos = new Set<string>();
      const acc: ContasReceberResumo = {
        vencido: { titulos: 0, valor: 0 },
        hoje: { titulos: 0, valor: 0 },
        avencer: { titulos: 0, valor: 0 },
        recebido: { titulos: 0, valor: 0 },
        totalAberto: 0,
      };
      for (const r of rows as any[]) {
        // Contas a Receber: apenas natureza_tipo = 1.
        if (r.natureza_tipo !== 1) continue;
        const id = r.lancamento_id ? String(r.lancamento_id) : null;
        if (id) {
          if (vistos.has(id)) continue;
          vistos.add(id);
        }
        const bucket = classificarBucketStatus(r.status_cod, r.data_vencimento, hoje);
        const liquido = Number(r.valor_liquido ?? 0);
        const baixado = Number(r.valor_baixado ?? 0);
        const aberto = Math.max(0, liquido - baixado);
        if (bucket === "pago") {
          acc.recebido.titulos += 1;
          acc.recebido.valor += baixado > 0 ? baixado : liquido;
        } else if (bucket === "vencido") {
          acc.vencido.titulos += 1;
          acc.vencido.valor += aberto;
          acc.totalAberto += aberto;
        } else if (bucket === "hoje") {
          acc.hoje.titulos += 1;
          acc.hoje.valor += aberto;
          acc.totalAberto += aberto;
        } else if (bucket === "avencer") {
          acc.avencer.titulos += 1;
          acc.avencer.valor += aberto;
          acc.totalAberto += aberto;
        }
      }
      return acc;
    },
  });

  return { data, isLoading, isError, error, refetch, hoje };
}
