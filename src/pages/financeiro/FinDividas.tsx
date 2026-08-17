import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { TrendingDown, X, Calculator } from "lucide-react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "@/components/ui/chart";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { brl } from "@/lib/billing";
import { fmtCurtoBRL } from "@/lib/core/money";
import { fmtData } from "@/lib/utils";
import { EmptyMsg } from "@/components/financeiro/dividas/EmptyMsg";
import { QueryState } from "@/components/common/QueryState";
import { KpiCard } from "@/components/financeiro/dividas/KpiCard";
import { PgtoCard } from "@/components/financeiro/dividas/PgtoCard";
import { AgingCard } from "@/components/financeiro/dividas/AgingCard";
import { TitulosDialog } from "@/components/financeiro/dividas/TitulosDialog";
import { NaturezaCard } from "@/components/financeiro/dividas/NaturezaCard";
import { CentrosCard } from "@/components/financeiro/dividas/CentrosCard";
import { VariacoesNaturezaCard } from "@/components/financeiro/dividas/VariacoesNaturezaCard";
import { PendentesCard } from "@/components/financeiro/dividas/PendentesCard";
import { EvolucaoEndividamentoCard } from "@/components/financeiro/dividas/EvolucaoEndividamentoCard";
import { useSolicitacoesFinanceiras } from "@/hooks/financeiro/useSolicitacoesFinanceiras";
import {
  useDividasData,
  PGTO_BUCKETS_INITIAL,
} from "@/components/financeiro/dividas/useDividasData";
import {
  filtrarAging,
  filtrarKpi,
  filtrarPgto,
} from "@/components/financeiro/dividas/dialogSelectors";
import { type PgtoBucket } from "@/components/financeiro/dividas/types";

function variacaoEntre(anterior: number, atual: number) {
  const delta = Math.round((atual - anterior) * 100) / 100;
  const pct = anterior === 0 ? null : Math.round((delta / anterior) * 100 * 100) / 100;
  return { anterior, atual, delta, pct };
}

function FinDividas() {
  const [params, setParams] = useSearchParams();
  const obraId = params.get("obraId") || "all";
  const pendenteOnly = params.get("pendente") === "1";

  const [agingSel, setAgingSel] = useState<{ tipo: "vencido" | "avencer"; faixa: string } | null>(
    null,
  );
  const [natSel, setNatSel] = useState<{ cod: string; desc: string } | null>(null);
  const [kpiSel, setKpiSel] = useState<"vencido" | "hoje" | "avencer" | "total" | null>(null);
  const [centroSel, setCentroSel] = useState<{ codigo: string; nome: string } | null>(null);
  const [pgtoSel, setPgtoSel] = useState<"avista" | "aprazo" | "indef" | null>(null);
  const [pgtoBuckets, setPgtoBuckets] = useState<Set<PgtoBucket>>(
    () => new Set(PGTO_BUCKETS_INITIAL),
  );
  const [natQ, setNatQ] = useState("");
  const [natFiltro, setNatFiltro] = useState<"todos" | "vencido" | "avencer">("todos");

  const { data: solicitacoes = [] } = useSolicitacoesFinanceiras();
  const solicitacoesEscopo = useMemo(
    () =>
      obraId === "all"
        ? solicitacoes
        : solicitacoes.filter((s) => s.centro_custo_id === obraId),
    [solicitacoes, obraId],
  );
  const d = useDividasData(obraId, pgtoBuckets, solicitacoesEscopo);

  const pendentesView = pendenteOnly ? d.pendentes : d.pendentes.slice(0, 10);

  const dialogTitulos = useMemo(
    () => filtrarAging(d.lancamentosDecorados, d.hoje, agingSel),
    [d.lancamentosDecorados, d.hoje, agingSel],
  );
  const dialogNatureza = useMemo(
    () =>
      natSel
        ? d.lancamentosDecorados
            .map((l: any) => {
              const naturezas = Array.isArray(l.naturezas) ? l.naturezas : [];
              const totalNaturezas = naturezas.reduce(
                (s: number, n: any) => s + Math.max(0, Number(n.valor_rateio ?? 0)),
                0,
              );
              const valorNatureza = naturezas
                .filter((n: any) => n.cod === natSel.cod)
                .reduce((s: number, n: any) => s + Math.max(0, Number(n.valor_rateio ?? 0)), 0);
              const matchPrincipal = l.natureza_cod === natSel.cod;
              if (!valorNatureza && !matchPrincipal) return null;
              const ratio = totalNaturezas > 0 ? valorNatureza / totalNaturezas : 1;
              return {
                ...l,
                natureza_cod: natSel.cod,
                natureza_desc: natSel.desc,
                valor_liquido: Number(l.valor_liquido ?? 0) * ratio,
                valor_baixado: Number(l.valor_baixado ?? 0) * ratio,
                aberto: Number(l.aberto ?? 0) * ratio,
                valor_efetivo: Number(l.valor_efetivo ?? 0) * ratio,
              };
            })
            .filter(Boolean)
        : [],
    [d.lancamentosDecorados, natSel],
  );
  const dialogKpi = useMemo(
    () => filtrarKpi(d.lancamentosDecorados, d.hoje, kpiSel),
    [d.lancamentosDecorados, d.hoje, kpiSel],
  );
  const dialogCentro = useMemo(
    () =>
      centroSel
        ? d.lancamentosDecorados.filter((l: any) => (l.centro_custo ?? "—") === centroSel.codigo)
        : [],
    [d.lancamentosDecorados, centroSel],
  );
  const dialogPgto = useMemo(
    () => filtrarPgto(d.lancamentosDecorados, pgtoBuckets, pgtoSel),
    [d.lancamentosDecorados, pgtoBuckets, pgtoSel],
  );

  function setObra(v: string) {
    const next = new URLSearchParams(params);
    if (v === "all") next.delete("obraId");
    else next.set("obraId", v);
    setParams(next, { replace: true });
  }

  if (d.loadingRollup) {
    return (
      <div className="p-6 lg:p-8 space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-lg" />
          ))}
        </div>
        <Skeleton className="h-80 rounded-lg" />
      </div>
    );
  }

  if (d.errorRollup) {
    return (
      <div className="p-6 lg:p-8">
        <QueryState
          isLoading={false}
          isError
          error={d.rollupError}
          onRetry={() => d.refetchRollup()}
        >
          {() => null}
        </QueryState>
      </div>
    );
  }

  const obraNome =
    obraId === "all" ? null : ((d.obras ?? []).find((o: any) => o.id === obraId)?.nome ?? null);

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <header className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold flex items-center gap-2">
              <TrendingDown className="h-6 w-6 text-primary" />
              Evolução de Dívidas
            </h1>
            <p className="text-sm text-muted-foreground">
              Histórico permanente do vencido e a vencer ao longo de cada importação do relatório
              TOTVS.
              {d.snapshotData?.snapshot?.importado_em && (
                <>
                  {" · Último snapshot em "}
                  <strong>{fmtData(d.snapshotData.snapshot.importado_em)}</strong>
                </>
              )}
              {" · Hoje (Brasília): "}
              <strong>{fmtData(d.hoje)}</strong>
            </p>
          </div>
          <div className="flex items-end gap-2">
            <div className="space-y-1.5 min-w-[260px]">
              <Label className="text-xs">Escopo</Label>
              <Select value={obraId} onValueChange={setObra}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Empresa toda</SelectItem>
                  {(d.obras ?? []).map((o: any) => (
                    <SelectItem key={o.id} value={o.id} title={o.codigo}>
                      {o.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button asChild variant="default" size="sm" title="Abrir a Previsão de Pagamento">
              <Link to="/financeiro/previsao-pagamento">
                <Calculator className="h-4 w-4 mr-1" />
                Previsão de Pagamento
              </Link>
            </Button>
          </div>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">Escopo atual:</span>
          <Badge variant={obraId === "all" ? "secondary" : "default"} className="gap-1 px-2 py-1">
            {obraId === "all" ? "Empresa toda" : (obraNome ?? "—")}
            {obraId !== "all" && (
              <button
                type="button"
                onClick={() => setObra("all")}
                className="ml-1 hover:text-foreground/80"
                aria-label="Limpar escopo"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </Badge>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard
          label="Vencido (último ponto)"
          valor={d.ultimo?.valor_vencido ?? 0}
          tone="danger"
          onClick={() => setKpiSel("vencido")}
          variacao={
            d.serie.length >= 2
              ? variacaoEntre(
                  d.serie[d.serie.length - 2].valor_vencido,
                  d.serie[d.serie.length - 1].valor_vencido,
                )
              : null
          }
          footer={
            d.vencidosSnapshot.titulos > 0
              ? `${d.vencidosSnapshot.titulos} título(s) · ${brl(d.vencidosSnapshot.total)} no snapshot`
              : "Sem títulos vencidos"
          }
        />
        <KpiCard
          label="Vencendo hoje"
          valor={d.vencendoHoje.total}
          tone="warn"
          onClick={() => setKpiSel("hoje")}
          variacao={null}
          footer={`${d.vencendoHoje.titulos} título(s) com vencimento em ${fmtData(d.hoje)}`}
        />
        <KpiCard
          label="A vencer (último ponto)"
          valor={d.ultimo?.valor_a_vencer ?? 0}
          tone="warn"
          onClick={() => setKpiSel("avencer")}
          variacao={
            d.serie.length >= 2
              ? variacaoEntre(
                  d.serie[d.serie.length - 2].valor_a_vencer,
                  d.serie[d.serie.length - 1].valor_a_vencer,
                )
              : null
          }
        />
        <KpiCard
          label="Total em aberto"
          valor={(d.ultimo?.valor_vencido ?? 0) + (d.ultimo?.valor_a_vencer ?? 0)}
          tone="neutral"
          onClick={() => setKpiSel("total")}
          variacao={d.varTotal}
        />
      </div>

      <EvolucaoEndividamentoCard serie={d.serie} />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Evolução do vencido</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {d.serie.length === 0 ? (
            <EmptyMsg>Sem snapshots ainda. Importe um relatório para começar.</EmptyMsg>
          ) : (
            <>
              <div className="text-xs text-muted-foreground bg-muted/40 border rounded-md px-3 py-2">
                Acumulado pago até <strong>{fmtData(d.serie[0].data)}</strong> (base inicial, fora
                do eixo): <strong className="text-foreground">{brl(d.serie[0].valor_pago)}</strong>.
                {d.serie.length >= 2 && (
                  <>
                    {" "}
                    A partir do segundo snapshot, a linha <strong>Pago no período</strong> mostra
                    apenas o que foi pago entre snapshots.
                  </>
                )}
              </div>
              <div className="h-[400px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={d.serieChart} margin={{ top: 8, right: 16, left: 8, bottom: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis
                      dataKey="data"
                      stroke="hsl(var(--muted-foreground))"
                      tickFormatter={(x) => {
                        const s = String(x);
                        return `${s.slice(8, 10)}/${s.slice(5, 7)}`;
                      }}
                    />
                    <YAxis
                      stroke="hsl(var(--muted-foreground))"
                      tickFormatter={(v) => fmtCurtoBRL(v)}
                      width={72}
                    />
                    <Tooltip
                      formatter={(v, name) =>
                        v == null ? ["—", String(name)] : [brl(Number(v)), String(name)]
                      }
                      labelFormatter={(x) => fmtData(x as any)}
                      contentStyle={{
                        background: "hsl(var(--popover))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: 8,
                      }}
                    />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="valor_vencido"
                      name="Vencido"
                      stroke="hsl(var(--destructive))"
                      strokeWidth={2}
                      dot
                    />
                    <Line
                      type="monotone"
                      dataKey="valor_a_vencer"
                      name="A vencer"
                      stroke="hsl(var(--primary))"
                      strokeWidth={2}
                      dot
                    />
                    <Line
                      type="monotone"
                      dataKey="pago_periodo"
                      name="Pago no período"
                      stroke="hsl(var(--muted-foreground))"
                      strokeWidth={1.5}
                      strokeDasharray="4 4"
                      connectNulls={false}
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <AgingCard
          titulo="Aging dos vencidos"
          aging={d.aging}
          total={{ titulos: d.agingTotalTitulos, valor: d.agingTotalValor }}
          empty="Nenhum título vencido no snapshot atual."
          onSel={(faixa) => setAgingSel({ tipo: "vencido", faixa })}
          alerta={
            Math.abs(d.agingTotalValor - (d.ultimo?.valor_vencido ?? 0)) > 1
              ? `Diferença vs. KPI Vencido (${brl(d.ultimo?.valor_vencido ?? 0)}): ${brl((d.ultimo?.valor_vencido ?? 0) - d.agingTotalValor)}. KPI usa rollup (rateio normalizado); aging usa título bruto.`
              : null
          }
          legenda="Fonte: Matriz central + status TOTVS; em aberto = valor oficial da Matriz ainda não baixado."
        />
        <AgingCard
          titulo="Aging a vencer"
          aging={d.agingFut}
          total={{ titulos: d.agingFutTotalTitulos, valor: d.agingFutTotalValor }}
          empty="Nenhum título a vencer no snapshot atual."
          onSel={(faixa) => setAgingSel({ tipo: "avencer", faixa })}
          legenda={`Fonte: Matriz central + status TOTVS; referência hoje = ${fmtData(d.hoje)} (America/Sao_Paulo).`}
          variantDestaque={(ordem) => ordem === 0}
        />
      </div>

      <PgtoCard
        stats={d.pgtoStats}
        onSel={setPgtoSel}
        bucketsSel={pgtoBuckets}
        setBucketsSel={setPgtoBuckets}
      />

      <NaturezaCard
        rows={d.naturezaAcumulada}
        totalGeral={d.naturezaTotal}
        q={natQ}
        setQ={setNatQ}
        filtro={natFiltro}
        setFiltro={setNatFiltro}
        onSel={(n) => setNatSel({ cod: n.cod, desc: n.desc })}
      />

      <CentrosCard
        rows={d.centrosRanking}
        onSel={(c) => setCentroSel(c)}
        escopoUnico={obraId !== "all" && d.centrosRanking.length <= 1}
      />

      <VariacoesNaturezaCard varNat={d.varNat} />

      <PendentesCard
        pendentes={d.pendentes}
        pendentesView={pendentesView}
        pendenteOnly={pendenteOnly}
        onSeeAll={() => {
          const next = new URLSearchParams(params);
          next.set("pendente", "1");
          setParams(next, { replace: true });
        }}
      />

      <TitulosDialog
        open={!!agingSel}
        onClose={() => setAgingSel(null)}
        titulo={
          agingSel
            ? agingSel.tipo === "vencido"
              ? `Vencidos ${agingSel.faixa} dias`
              : `A vencer · ${agingSel.faixa}`
            : ""
        }
        titulos={dialogTitulos}
      />
      <TitulosDialog
        open={!!natSel}
        onClose={() => setNatSel(null)}
        titulo={natSel ? `Natureza ${natSel.cod} — ${natSel.desc || ""}` : ""}
        titulos={dialogNatureza}
      />
      <TitulosDialog
        open={!!kpiSel}
        onClose={() => setKpiSel(null)}
        titulo={
          kpiSel === "vencido"
            ? "Títulos vencidos"
            : kpiSel === "hoje"
              ? `Vencendo hoje (${fmtData(d.hoje)})`
              : kpiSel === "avencer"
                ? "Títulos a vencer"
                : kpiSel === "total"
                  ? "Total em aberto"
                  : ""
        }
        titulos={dialogKpi}
      />
      <TitulosDialog
        open={!!centroSel}
        onClose={() => setCentroSel(null)}
        titulo={centroSel ? `${centroSel.nome} (${centroSel.codigo})` : ""}
        titulos={dialogCentro}
      />
      <TitulosDialog
        open={!!pgtoSel}
        onClose={() => setPgtoSel(null)}
        titulo={
          pgtoSel === "avista"
            ? "Pagamento à vista (≤ 2 dias entre emissão e vencimento)"
            : pgtoSel === "aprazo"
              ? "Pagamento a prazo (> 2 dias entre emissão e vencimento)"
              : pgtoSel === "indef"
                ? "Sem datas para classificar"
                : ""
        }
        titulos={dialogPgto}
      />
    </div>
  );
}

export default FinDividas;
