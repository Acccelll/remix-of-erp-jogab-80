import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";

import { hojeBrasilia } from "@/lib/utils";
import { financeiroRepo, financeiroTotvsRepo } from "@/lib/repositories/financeiro";
import { fetchEvolucaoRollup, fetchObrasComVinculo, finKeys } from "@/lib/financeiro-totvs/queries";
import {
  agingAVencer,
  agingVencidos,
  evolucaoPorNatureza,
  serieTemporal,
  variacao,
  variacaoPorNatureza,
  type AgingLinha,
  type AgingAVencerLinha,
} from "@/lib/financeiro-totvs/evolucao";
import { PGTO_BUCKETS, type PgtoBucket } from "@/components/financeiro/dividas/types";
import {
  classificarBucketStatus,
  ehBaixaParcial,
  STATUS_BAIXADO,
  STATUS_CANCELADO,
  STATUS_VENCE_HOJE,
  STATUS_VENCIDO,
  STATUS_A_VENCER,
} from "@/lib/financeiro-totvs/status-bucket";
export {
  STATUS_BAIXADO,
  STATUS_CANCELADO,
  STATUS_VENCE_HOJE,
  STATUS_VENCIDO,
  STATUS_A_VENCER,
};

export interface NatLinha {
  cod: string;
  desc: string;
  valor: number;
}

export function useDividasData(
  obraId: string,
  pgtoBuckets: Set<PgtoBucket>,
  solicitacoes: any[] = [],
) {
  const hoje = useMemo(() => hojeBrasilia(), []);


  const { data: obras } = useQuery({
    queryKey: ["fin_obras_vinculo"],
    queryFn: fetchObrasComVinculo,
  });

  const {
    data: rollup,
    isLoading: loadingRollup,
    isError: errorRollup,
    error: rollupError,
    refetch: refetchRollup,
  } = useQuery({
    queryKey: finKeys.evolucao({ obraId: obraId === "all" ? null : obraId }),
    queryFn: () => fetchEvolucaoRollup({ obraId: obraId === "all" ? null : obraId }),
  });

  const { data: snapshotData } = useQuery({
    queryKey: ["fin_dividas_snapshot", obraId],
    queryFn: async () => {
      const snap = await financeiroRepo.getLatestSnapshotMeta();
      if (!snap) return null;

      const lancs = await financeiroTotvsRepo.listVwFinanceiroObraPaged(
        [
          "lancamento_id",
          "ref_lancamento",
          "contraparte",
          "centro_custo",
          "desc_centro_custo",
          "valor_liquido",
          "valor_baixado",
          "dias_atraso",
          "status_cod",
          "status_label",
          "data_emissao",
          "data_vencimento",
          "pendente_natureza",
          "mes_competencia_estimado",
          "dias_atraso_estimado",
          "sem_atualizacao_recente",
          "ultima_atualizacao",
          "obra_id",
          "cod_natureza",
          "desc_natureza",
          "valor_rateio",
          "natureza_tipo",
          "origem",
          "previsto",
          "solicitacao_id",
        ].join(", "),
        obraId === "all" ? undefined : obraId,
      );
      const centros = await financeiroRepo.listCentrosCustoTotvs();

      return { snapshot: snap, lancamentos: lancs, matrizRows: [], centros };
    },
  });

  const centroNome = useMemo(() => {
    const m = new Map<string, string>();
    for (const c of snapshotData?.centros ?? []) {
      if (c.codigo && c.nome) m.set(c.codigo, c.nome);
    }
    return m;
  }, [snapshotData]);

  const lancamentosTotvs = useMemo(() => {
    const linhas = snapshotData?.lancamentos ?? [];
    const porFatia = new Map<string, any & { naturezas: any[] }>();

    for (const row of linhas as any[]) {
      if (row.status_cod === STATUS_CANCELADO) continue;
      // Fluxo de Dívidas mostra apenas despesas (CP). Receitas (CR) vão para
      // Contas a Receber. Títulos sem natureza (pendentes) permanecem para
      // aparecer no card de pendentes.
      if (row.natureza_tipo === 1) continue;
      const id = String(
        row.lancamento_id ?? `${row.ref_lancamento ?? "sem-ref"}-${row.centro_custo ?? "sem-cc"}`,
      );
      const atual = porFatia.get(id) ?? {
        id,
        lancamento_id: row.lancamento_id ?? id,
        ref_lancamento: row.ref_lancamento,
        nome: row.contraparte ?? row.nome ?? "—",
        contraparte: row.contraparte ?? row.nome ?? "—",
        centro_custo: row.centro_custo,
        desc_centro_custo: row.desc_centro_custo,
        valor_liquido: Number(row.valor_liquido ?? 0),
        valor_baixado: Number(row.valor_baixado ?? 0),
        dias_atraso: row.dias_atraso,
        status_cod: row.status_cod,
        status_label: row.status_label,
        data_emissao: row.data_emissao,
        data_vencimento: row.data_vencimento,
        pendente_natureza: row.pendente_natureza,
        mes_competencia_estimado: row.mes_competencia_estimado ?? false,
        dias_atraso_estimado: row.dias_atraso_estimado ?? false,
        sem_atualizacao_recente: row.sem_atualizacao_recente ?? false,
        ultima_atualizacao: row.ultima_atualizacao ?? null,
        obra_id: row.obra_id,
        origem: row.origem ?? "totvs",
        previsto: row.previsto ?? row.origem === "sistema",
        solicitacao_id: row.solicitacao_id ?? null,
        naturezas: [],
      };
      if (row.cod_natureza || row.desc_natureza) {
        atual.naturezas.push({
          cod: row.cod_natureza ?? "",
          desc: row.desc_natureza ?? "",
          valor_rateio: Number(row.valor_rateio ?? 0),
        });
      }
      porFatia.set(id, atual);
    }

    return Array.from(porFatia.values()).map((l: any) => {
      const nats = l.naturezas ?? [];
      nats.sort((a: any, b: any) => b.valor_rateio - a.valor_rateio);
      const principal = nats[0];
      let prazo_dias: number | null = null;
      let pgto: "avista" | "aprazo" | "indef" = "indef";
      if (l.data_emissao && l.data_vencimento) {
        const e = new Date(`${String(l.data_emissao).slice(0, 10)}T00:00:00Z`).getTime();
        const v = new Date(`${String(l.data_vencimento).slice(0, 10)}T00:00:00Z`).getTime();
        if (Number.isFinite(e) && Number.isFinite(v)) {
          prazo_dias = Math.round((v - e) / 86400000);
          pgto = prazo_dias <= 2 ? "avista" : "aprazo";
        }
      }
      const bucket = classificarBucketStatus(l.status_cod, l.data_vencimento, hoje, l.origem);
      const parcial = ehBaixaParcial(l.status_cod);
      const valor_efetivo =
        bucket === "pago"
          ? Number(l.valor_baixado ?? 0)
          : Math.max(0, Number(l.valor_liquido ?? 0) - Number(l.valor_baixado ?? 0));
      // Baixas parciais vencidas costumam vir sem `dias_atraso` do TOTVS —
      // recalcula pela data de vencimento para não sumirem do aging.
      let dias_atraso_efetivo = Number(l.dias_atraso ?? 0) || 0;
      if (bucket === "vencido" && dias_atraso_efetivo < 1 && l.data_vencimento) {
        const v = new Date(`${String(l.data_vencimento).slice(0, 10)}T00:00:00Z`).getTime();
        const h = new Date(`${hoje}T00:00:00Z`).getTime();
        if (Number.isFinite(v)) dias_atraso_efetivo = Math.max(1, Math.floor((h - v) / 86400000));
      }
      return {
        ...l,
        centro_nome:
          centroNome.get(l.centro_custo ?? "") ?? l.desc_centro_custo ?? l.centro_custo ?? "—",
        natureza_cod: principal?.cod ?? "",
        natureza_desc: principal?.desc ?? "",
        natureza_count: nats.length,
        aberto: Math.max(0, Number(l.valor_liquido ?? 0) - Number(l.valor_baixado ?? 0)),
        prazo_dias,
        pgto,
        bucket,
        parcial,
        valor_efetivo,
        dias_atraso_efetivo,
      };
    });
  }, [snapshotData, centroNome, hoje]);


  /**
   * Solicitações do módulo de aprovação entram na MESMA base de dívidas,
   * marcadas com `origem: "aprovacao"` para exibir badge nas tabelas.
   */
  const lancamentosAprovacao = useMemo(() => {
    const obraNome = new Map<string, string>(
      (obras ?? []).map((o: any) => [String(o.id), String(o.nome ?? o.id)]),
    );
    const out: any[] = [];
    for (const s of solicitacoes ?? []) {
      if (s.status === "reprovado" || s.status === "cancelado") continue;
      const valor = Number(s.valor ?? 0) || 0;
      const pago = s.status === "aprovado" && !s.pagamento_pendente;
      const venc = String(s.data_pagamento || s.prazo_estimado || "").slice(0, 10) || null;
      let status_cod: number = STATUS_A_VENCER;
      if (pago) status_cod = STATUS_BAIXADO;
      else if (venc && venc < hoje) status_cod = STATUS_VENCIDO;
      else if (venc && venc === hoje) status_cod = STATUS_VENCE_HOJE;
      const dias_atraso =
        !pago && venc && venc < hoje
          ? Math.floor(
              (new Date(`${hoje}T00:00:00Z`).getTime() -
                new Date(`${venc}T00:00:00Z`).getTime()) /
                86400000,
            )
          : 0;
      const aberto = pago ? 0 : valor;
      out.push({
        id: `sol-${s.id}`,
        lancamento_id: `sol-${s.id}`,
        ref_lancamento: null,
        solicitacao_id: s.id,
        nome: s.fornecedor || s.solicitante || "—",
        contraparte: s.fornecedor || s.solicitante || "—",
        centro_custo: s.centro_custo_id ?? null,
        desc_centro_custo: s.centro_custo_id
          ? (obraNome.get(String(s.centro_custo_id)) ?? String(s.centro_custo_id))
          : "—",
        centro_nome: s.centro_custo_id
          ? (obraNome.get(String(s.centro_custo_id)) ?? String(s.centro_custo_id))
          : "—",
        valor_liquido: valor,
        valor_baixado: pago ? valor : 0,
        dias_atraso,
        status_cod,
        status_label: pago ? "Pago (aprovação)" : "Aprovação financeira",
        data_emissao: String(s.created_at ?? "").slice(0, 10) || null,
        data_vencimento: venc,
        pendente_natureza: false,
        obra_id: s.centro_custo_id ?? null,
        origem: "aprovacao",
        previsto: true,
        naturezas: [],
        natureza_cod: "",
        natureza_desc: "Aprovação financeira",
        natureza_count: 0,
        aberto,
        prazo_dias: null,
        pgto: "indef" as const,
        bucket: pago
          ? "pago"
          : status_cod === STATUS_VENCIDO
            ? "vencido"
            : status_cod === STATUS_VENCE_HOJE
              ? "hoje"
              : "avencer",
        parcial: false,
        valor_efetivo: pago ? valor : aberto,
        dias_atraso_efetivo: dias_atraso,

      });
    }
    return out;
  }, [solicitacoes, obras, hoje]);

  const lancamentosDecorados = useMemo(
    () => [...lancamentosTotvs, ...lancamentosAprovacao],
    [lancamentosTotvs, lancamentosAprovacao],
  );



  const serie = useMemo(() => serieTemporal(rollup ?? []), [rollup]);
  const ultimo = serie[serie.length - 1] ?? null;
  const varTotal = useMemo(() => variacao(serie), [serie]);

  const serieChart = useMemo(
    () =>
      serie.map((p, i) => ({
        ...p,
        pago_periodo: i === 0 ? null : Math.max(0, p.valor_pago - serie[i - 1].valor_pago),
      })),
    [serie],
  );

  const seriesNat = useMemo(() => evolucaoPorNatureza(rollup ?? []), [rollup]);
  const varNat = useMemo(() => variacaoPorNatureza(seriesNat), [seriesNat]);

  const aging = useMemo<ReturnType<typeof agingVencidos>>(() => {
    const linhas: AgingLinha[] = lancamentosDecorados.map((l: any) => ({
      status_cod: l.status_cod,
      dias_atraso: l.dias_atraso_efetivo ?? l.dias_atraso,
      valor: l.aberto,
      bucket: l.bucket,
    }));
    return agingVencidos(linhas);
  }, [lancamentosDecorados]);

  const agingFut = useMemo(() => {
    const linhas: AgingAVencerLinha[] = lancamentosDecorados.map((l: any) => ({
      status_cod: l.status_cod,
      data_vencimento: l.data_vencimento,
      valor: l.aberto,
      bucket: l.bucket,
    }));
    return agingAVencer(linhas, hoje);
  }, [lancamentosDecorados, hoje]);

  const vencendoHoje = useMemo(() => {
    const lancs = lancamentosDecorados.filter((l: any) => l.bucket === "hoje");
    const total = lancs.reduce((acc: number, l: any) => acc + l.aberto, 0);
    return { titulos: lancs.length, total };
  }, [lancamentosDecorados]);

  /** Inclui baixas parciais vencidas — o valor somado é sempre o saldo em aberto. */
  const vencidosSnapshot = useMemo(() => {
    const lancs = lancamentosDecorados.filter(
      (l: any) => l.bucket === "vencido" && Number(l.aberto ?? 0) > 0,
    );
    const total = lancs.reduce((acc: number, l: any) => acc + l.aberto, 0);
    return { titulos: lancs.length, total };
  }, [lancamentosDecorados]);


  const agingTotalValor = useMemo(() => aging.reduce((s, a) => s + a.valor, 0), [aging]);
  const agingTotalTitulos = useMemo(() => aging.reduce((s, a) => s + a.titulos, 0), [aging]);
  const agingFutTotalValor = useMemo(() => agingFut.reduce((s, a) => s + a.valor, 0), [agingFut]);
  const agingFutTotalTitulos = useMemo(
    () => agingFut.reduce((s, a) => s + a.titulos, 0),
    [agingFut],
  );

  const naturezaAcumulada = useMemo(() => {
    const ultimoData = serie[serie.length - 1]?.data;
    if (!ultimoData)
      return [] as Array<NatLinha & { vencido: number; aVencer: number; pct: number }>;
    const acc = new Map<string, { desc: string; vencido: number; aVencer: number }>();
    const rows = (rollup ?? []).filter((r) => r.data_snapshot === ultimoData);
    for (const r of rows) {
      if (r.status_cod === STATUS_CANCELADO) continue;
      const key = `${r.grupo ?? "?"}|${r.cod_natureza ?? "?"}`;
      const cur = acc.get(key) ?? { desc: r.desc_natureza ?? "", vencido: 0, aVencer: 0 };
      if (!cur.desc && r.desc_natureza) cur.desc = r.desc_natureza;
      const v = Number(r.valor_aberto ?? 0);
      if (r.status_cod === STATUS_VENCIDO) cur.vencido += v;
      else if (r.status_cod === STATUS_A_VENCER || r.status_cod === STATUS_VENCE_HOJE)
        cur.aVencer += v;
      acc.set(key, cur);
    }
    const arr = Array.from(acc.entries()).map(([key, v]) => {
      const cod = key.split("|")[1];
      return {
        cod,
        desc: v.desc,
        valor: v.vencido + v.aVencer,
        vencido: v.vencido,
        aVencer: v.aVencer,
        pct: 0,
      };
    });
    const total = arr.reduce((s, a) => s + a.valor, 0);
    for (const a of arr) a.pct = total > 0 ? (a.valor / total) * 100 : 0;
    return arr.sort((a, b) => b.valor - a.valor);
  }, [rollup, serie]);

  const naturezaTotal = useMemo(
    () =>
      naturezaAcumulada.reduce(
        (acc, n) => ({
          valor: acc.valor + n.valor,
          vencido: acc.vencido + n.vencido,
          aVencer: acc.aVencer + n.aVencer,
        }),
        { valor: 0, vencido: 0, aVencer: 0 },
      ),
    [naturezaAcumulada],
  );

  const centrosRanking = useMemo(() => {
    const acc = new Map<
      string,
      { codigo: string; nome: string; vencido: number; aVencer: number; titulos: number }
    >();
    for (const l of lancamentosDecorados as any[]) {
      const isVenc = l.bucket === "vencido";
      const isFut = l.bucket === "hoje" || l.bucket === "avencer";
      if (!isVenc && !isFut) continue;

      const codigo = l.centro_custo ?? "—";
      const nome = l.centro_nome ?? codigo;
      const cur = acc.get(codigo) ?? { codigo, nome, vencido: 0, aVencer: 0, titulos: 0 };
      if (isVenc) cur.vencido += Number(l.aberto ?? 0);
      else cur.aVencer += Number(l.aberto ?? 0);
      cur.titulos += 1;
      acc.set(codigo, cur);
    }
    const arr = Array.from(acc.values()).map((c) => ({ ...c, valor: c.vencido + c.aVencer }));
    const total = arr.reduce((s, c) => s + c.valor, 0);
    return arr
      .map((c) => ({ ...c, pct: total > 0 ? (c.valor / total) * 100 : 0 }))
      .sort((a, b) => b.valor - a.valor);
  }, [lancamentosDecorados]);

  const pgtoStats = useMemo(() => {
    const acc = {
      avista: { titulos: 0, valor: 0 },
      aprazo: { titulos: 0, valor: 0 },
      indef: { titulos: 0, valor: 0 },
    };
    for (const l of lancamentosDecorados as any[]) {
      if (l.bucket === "outro") continue;
      if (!pgtoBuckets.has(l.bucket as PgtoBucket)) continue;
      acc[l.pgto as keyof typeof acc].titulos += 1;
      acc[l.pgto as keyof typeof acc].valor += Number(l.valor_efetivo ?? 0);
    }
    const totalValor = acc.avista.valor + acc.aprazo.valor + acc.indef.valor;
    const totalTitulos = acc.avista.titulos + acc.aprazo.titulos + acc.indef.titulos;
    return { ...acc, total: { titulos: totalTitulos, valor: totalValor } };
  }, [lancamentosDecorados, pgtoBuckets]);

  const pendentes = useMemo(() => {
    return lancamentosDecorados.filter((l: any) => l.pendente_natureza);
  }, [lancamentosDecorados]);

  // Suppress unused warning — kept exported through `seriesNat` consumers in the future.
  void seriesNat;

  return {
    hoje,
    obras,
    rollup,
    snapshotData,
    loadingRollup,
    errorRollup,
    rollupError,
    refetchRollup,
    lancamentosDecorados,
    serie,
    serieChart,
    ultimo,
    varTotal,
    varNat,
    aging,
    agingFut,
    agingTotalValor,
    agingTotalTitulos,
    agingFutTotalValor,
    agingFutTotalTitulos,
    vencendoHoje,
    vencidosSnapshot,
    naturezaAcumulada,
    naturezaTotal,
    centrosRanking,
    pgtoStats,
    pendentes,
  };
}

export const PGTO_BUCKETS_INITIAL = new Set<PgtoBucket>(PGTO_BUCKETS);
