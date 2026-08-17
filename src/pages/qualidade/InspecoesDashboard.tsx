/**
 * Dashboard de Inspeções (INSP.6)
 * - KPIs: total, aprovadas, reprovadas, em aberto, score médio
 * - Tendência semanal (últimas 8 semanas)
 * - Ranking por obra e por modelo
 * - NCs abertas por severidade
 */
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCatalogos } from "@/contexts/catalogos/useCatalogos";
import { useUrlState } from "@/hooks/useUrlState";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ClipboardCheck,
  CheckCircle2,
  XCircle,
  Clock,
  Gauge,
  AlertTriangle,
  ArrowRight,
  TrendingUp,
} from "lucide-react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  BarChart,
  Bar,
  Legend,
} from "@/components/ui/chart";

interface InspecaoRow {
  id: string;
  modelo_id: string;
  obra_id: string;
  status: string;
  score: number | null;
  aprovado: boolean | null;
  data_inspecao: string | null;
  created_at: string;
}

interface NcRow {
  id: string;
  obra_id: string;
  severidade: string | null;
  status: string | null;
  created_at: string;
}

interface ModeloRow {
  id: string;
  codigo: string;
  nome: string;
  categoria: string;
}

interface ObraRow {
  id: string;
  nome: string;
}

const SEV_COLOR: Record<string, string> = {
  baixa: "bg-sev-baixa/15 text-sev-baixa border-sev-baixa/40",
  media: "bg-sev-media/15 text-sev-media border-sev-media/40",
  alta: "bg-sev-alta/15 text-sev-alta border-sev-alta/40",
  critica: "bg-sev-critica/15 text-sev-critica border-sev-critica/40",
};

function weekKey(iso: string): string {
  const d = new Date(iso);
  // segunda-feira da semana ISO
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() - day + 1);
  d.setUTCHours(0, 0, 0, 0);
  return d.toISOString().slice(0, 10);
}

function formatWeekLabel(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getUTCDate()).padStart(2, "0")}/${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export default function InspecoesDashboard() {
  const { obras: obrasCtx } = useCatalogos();
  const [obraFiltroId, setObraFiltroId] = useUrlState("obra", "all");
  const obraSelecionada =
    obraFiltroId === "all" ? null : (obrasCtx.find((o) => o.id === obraFiltroId) ?? null);

  const desde = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 56); // 8 semanas
    return d.toISOString();
  }, []);

  const { data: inspecoes = [], isLoading: loadingInsp } = useQuery({
    queryKey: ["insp-dash", "inspecoes", obraSelecionada?.id, desde],
    queryFn: async () => {
      let q = supabase
        .from("inspecoes")
        .select("id,modelo_id,obra_id,status,score,aprovado,data_inspecao,created_at")
        .gte("created_at", desde)
        .order("created_at", { ascending: false });
      if (obraSelecionada?.id) q = q.eq("obra_id", obraSelecionada.id);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as InspecaoRow[];
    },
  });

  const { data: ncs = [], isLoading: loadingNcs } = useQuery({
    queryKey: ["insp-dash", "ncs", obraSelecionada?.id],
    queryFn: async () => {
      let q = supabase
        .from("nao_conformidades")
        .select("id,obra_id,severidade,status,created_at")
        .neq("status", "resolvida");
      if (obraSelecionada?.id) q = q.eq("obra_id", obraSelecionada.id);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as NcRow[];
    },
  });

  const { data: modelos = [] } = useQuery({
    queryKey: ["insp-dash", "modelos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("inspecao_modelos")
        .select("id,codigo,nome,categoria");
      if (error) throw error;
      return (data ?? []) as ModeloRow[];
    },
  });

  const obras: ObraRow[] = useMemo(
    () => obrasCtx.map((o) => ({ id: o.id, nome: o.nome })),
    [obrasCtx],
  );

  const modeloMap = useMemo(() => new Map(modelos.map((m) => [m.id, m])), [modelos]);
  const obraMap = useMemo(() => new Map(obras.map((o) => [o.id, o])), [obras]);

  // KPIs
  const kpis = useMemo(() => {
    const concluidas = inspecoes.filter((i) => i.status === "concluida");
    const aprovadas = concluidas.filter((i) => i.aprovado === true).length;
    const reprovadas = concluidas.filter((i) => i.aprovado === false).length;
    const emAberto = inspecoes.filter((i) => i.status !== "concluida").length;
    const scores = concluidas.map((i) => i.score).filter((s): s is number => s !== null);
    const scoreMedio = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
    const taxaAprovacao = concluidas.length ? (aprovadas / concluidas.length) * 100 : 0;
    return {
      total: inspecoes.length,
      concluidas: concluidas.length,
      aprovadas,
      reprovadas,
      emAberto,
      scoreMedio,
      taxaAprovacao,
    };
  }, [inspecoes]);

  // Tendência semanal
  const tendencia = useMemo(() => {
    const buckets = new Map<
      string,
      { semana: string; concluidas: number; reprovadas: number; scoreSum: number; scoreN: number }
    >();
    // sementes (8 semanas)
    for (let i = 7; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i * 7);
      const k = weekKey(d.toISOString());
      buckets.set(k, { semana: k, concluidas: 0, reprovadas: 0, scoreSum: 0, scoreN: 0 });
    }
    for (const i of inspecoes) {
      if (i.status !== "concluida") continue;
      const k = weekKey(i.data_inspecao ?? i.created_at);
      const b = buckets.get(k);
      if (!b) continue;
      b.concluidas++;
      if (i.aprovado === false) b.reprovadas++;
      if (i.score !== null) {
        b.scoreSum += i.score;
        b.scoreN++;
      }
    }
    return Array.from(buckets.values()).map((b) => ({
      semana: formatWeekLabel(b.semana),
      concluidas: b.concluidas,
      reprovadas: b.reprovadas,
      score: b.scoreN ? Math.round(b.scoreSum / b.scoreN) : 0,
    }));
  }, [inspecoes]);

  // Ranking por modelo
  const rankingModelos = useMemo(() => {
    const agg = new Map<
      string,
      { id: string; total: number; aprov: number; scoreSum: number; scoreN: number }
    >();
    for (const i of inspecoes) {
      if (i.status !== "concluida") continue;
      const cur = agg.get(i.modelo_id) ?? {
        id: i.modelo_id,
        total: 0,
        aprov: 0,
        scoreSum: 0,
        scoreN: 0,
      };
      cur.total++;
      if (i.aprovado) cur.aprov++;
      if (i.score !== null) {
        cur.scoreSum += i.score;
        cur.scoreN++;
      }
      agg.set(i.modelo_id, cur);
    }
    return Array.from(agg.values())
      .map((a) => {
        const m = modeloMap.get(a.id);
        return {
          id: a.id,
          codigo: m?.codigo ?? "—",
          nome: m?.nome ?? "Modelo removido",
          total: a.total,
          aprovacao: a.total ? (a.aprov / a.total) * 100 : 0,
          score: a.scoreN ? a.scoreSum / a.scoreN : 0,
        };
      })
      .sort((a, b) => b.total - a.total)
      .slice(0, 8);
  }, [inspecoes, modeloMap]);

  // Ranking por obra (apenas quando "Todas as obras")
  const rankingObras = useMemo(() => {
    if (obraSelecionada?.id) return [];
    const agg = new Map<string, { id: string; total: number; aprov: number }>();
    for (const i of inspecoes) {
      if (i.status !== "concluida") continue;
      const cur = agg.get(i.obra_id) ?? { id: i.obra_id, total: 0, aprov: 0 };
      cur.total++;
      if (i.aprovado) cur.aprov++;
      agg.set(i.obra_id, cur);
    }
    return Array.from(agg.values())
      .map((a) => ({
        id: a.id,
        nome: obraMap.get(a.id)?.nome ?? "—",
        total: a.total,
        aprovacao: a.total ? (a.aprov / a.total) * 100 : 0,
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 8);
  }, [inspecoes, obraMap, obraSelecionada?.id]);

  // NCs por severidade
  const ncsPorSeveridade = useMemo(() => {
    const agg: Record<string, number> = { baixa: 0, media: 0, alta: 0, critica: 0 };
    for (const n of ncs) {
      const s = (n.severidade ?? "media").toLowerCase();
      agg[s] = (agg[s] ?? 0) + 1;
    }
    return agg;
  }, [ncs]);

  const loading = loadingInsp || loadingNcs;

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Gauge className="h-6 w-6" /> Dashboard de Inspeções
          </h1>
          <p className="text-sm text-muted-foreground">
            Últimas 8 semanas {obraSelecionada ? `· ${obraSelecionada.nome}` : "· todas as obras"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={obraFiltroId} onValueChange={setObraFiltroId}>
            <SelectTrigger className="w-[220px]" aria-label="Filtrar por obra">
              <SelectValue placeholder="Todas as obras" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as obras</SelectItem>
              {obras.map((o) => (
                <SelectItem key={o.id} value={o.id}>
                  {o.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button asChild variant="outline">
            <Link to="/inspecoes">
              Nova inspeção <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </div>

      {/* KPIs */}
      <p className="sr-only" aria-live="polite">
        Resumo: {kpis.total} inspeções no período, {kpis.aprovadas} aprovadas, {kpis.reprovadas}{" "}
        reprovadas,
        {kpis.emAberto} em aberto, score médio {Math.round(kpis.scoreMedio)}, taxa de aprovação{" "}
        {Math.round(kpis.taxaAprovacao)}%. {ncs.length} NCs ativas.
      </p>
      <div
        className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3"
        role="list"
        aria-label="Indicadores de qualidade"
      >
        <KpiCard icon={ClipboardCheck} label="Total" value={kpis.total} loading={loading} />
        <KpiCard
          icon={CheckCircle2}
          label="Aprovadas"
          value={kpis.aprovadas}
          tone="success"
          loading={loading}
        />
        <KpiCard
          icon={XCircle}
          label="Reprovadas"
          value={kpis.reprovadas}
          tone="danger"
          loading={loading}
        />
        <KpiCard
          icon={Clock}
          label="Em aberto"
          value={kpis.emAberto}
          tone="warning"
          loading={loading}
        />
        <KpiCard
          icon={Gauge}
          label="Score médio"
          value={`${Math.round(kpis.scoreMedio)}`}
          loading={loading}
        />
        <KpiCard
          icon={TrendingUp}
          label="Taxa aprovação"
          value={`${Math.round(kpis.taxaAprovacao)}%`}
          tone={
            kpis.taxaAprovacao >= 80 ? "success" : kpis.taxaAprovacao >= 60 ? "warning" : "danger"
          }
          loading={loading}
        />
      </div>

      {/* Tendência + NCs */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card
          className="lg:col-span-2"
          role="figure"
          aria-label={`Tendência semanal: ${tendencia.length} semanas plotadas (inspeções concluídas, reprovadas e score médio).`}
        >
          <CardHeader>
            <CardTitle className="text-base">Tendência semanal</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={tendencia}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="semana" className="text-xs" />
                  <YAxis yAxisId="left" className="text-xs" />
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    domain={[0, 100]}
                    className="text-xs"
                  />
                  <Tooltip
                    contentStyle={{
                      background: "hsl(var(--popover))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Line
                    yAxisId="left"
                    type="monotone"
                    dataKey="concluidas"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                    name="Concluídas"
                  />
                  <Line
                    yAxisId="left"
                    type="monotone"
                    dataKey="reprovadas"
                    stroke="hsl(var(--destructive))"
                    strokeWidth={2}
                    name="Reprovadas"
                  />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="score"
                    stroke="hsl(var(--chart-3, 142 71% 45%))"
                    strokeWidth={2}
                    name="Score médio"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card
          role="figure"
          aria-label={`NCs em aberto por severidade. Total ${ncs.length}. Crítica ${ncsPorSeveridade.critica ?? 0}, Alta ${ncsPorSeveridade.alta ?? 0}, Média ${ncsPorSeveridade.media ?? 0}, Baixa ${ncsPorSeveridade.baixa ?? 0}.`}
        >
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-destructive" /> NCs em aberto
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {(["critica", "alta", "media", "baixa"] as const).map((sev) => (
              <div
                key={sev}
                className={`flex items-center justify-between rounded-lg border px-3 py-2 ${SEV_COLOR[sev]}`}
              >
                <span className="text-sm font-medium capitalize">{sev}</span>
                <span className="text-lg font-bold">{ncsPorSeveridade[sev] ?? 0}</span>
              </div>
            ))}
            <div className="pt-2 text-xs text-muted-foreground">
              Total: <strong>{ncs.length}</strong> NCs ativas
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Rankings */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Top modelos (volume)</CardTitle>
          </CardHeader>
          <CardContent>
            {rankingModelos.length === 0 ? (
              <div className="text-sm text-muted-foreground py-8 text-center">
                Sem inspeções concluídas no período.
              </div>
            ) : (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={rankingModelos} layout="vertical" margin={{ left: 60 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis type="number" className="text-xs" />
                    <YAxis dataKey="codigo" type="category" className="text-xs" width={80} />
                    <Tooltip
                      contentStyle={{
                        background: "hsl(var(--popover))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: 8,
                        fontSize: 12,
                      }}
                      formatter={(v: number, _n, p) => {
                        if (p.dataKey === "score") return [`${Math.round(v)}`, "Score médio"];
                        if (p.dataKey === "aprovacao") return [`${Math.round(v)}%`, "Aprovação"];
                        return [v, "Total"];
                      }}
                    />
                    <Bar
                      dataKey="total"
                      fill="hsl(var(--primary))"
                      name="Inspeções"
                      radius={[0, 4, 4, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {obraSelecionada ? "Modelos — detalhe" : "Top obras (volume)"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {obraSelecionada ? (
              <div className="space-y-3">
                {rankingModelos.length === 0 ? (
                  <div className="text-sm text-muted-foreground py-8 text-center">Sem dados.</div>
                ) : (
                  rankingModelos.map((m) => (
                    <div key={m.id} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium truncate" title={m.nome}>
                          <Badge variant="outline" className="mr-2">
                            {m.codigo}
                          </Badge>
                          {m.nome}
                        </span>
                        <span className="text-muted-foreground tabular-nums">
                          {Math.round(m.aprovacao)}% · {m.total}
                        </span>
                      </div>
                      <Progress value={m.aprovacao} className="h-1.5" />
                    </div>
                  ))
                )}
              </div>
            ) : rankingObras.length === 0 ? (
              <div className="text-sm text-muted-foreground py-8 text-center">
                Sem dados no período.
              </div>
            ) : (
              <div className="space-y-3">
                {rankingObras.map((o) => (
                  <div key={o.id} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium truncate">{o.nome}</span>
                      <span className="text-muted-foreground tabular-nums">
                        {Math.round(o.aprovacao)}% · {o.total}
                      </span>
                    </div>
                    <Progress value={o.aprovacao} className="h-1.5" />
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function KpiCard({
  icon: Icon,
  label,
  value,
  tone,
  loading,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number | string;
  tone?: "success" | "danger" | "warning";
  loading?: boolean;
}) {
  const toneCls =
    tone === "success"
      ? "text-sev-baixa"
      : tone === "danger"
        ? "text-destructive"
        : tone === "warning"
          ? "text-sev-media"
          : "text-foreground";
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs text-muted-foreground">{label}</span>
          <Icon className={`h-4 w-4 ${toneCls}`} />
        </div>
        <div className={`text-2xl font-bold tabular-nums ${toneCls}`}>{loading ? "…" : value}</div>
      </CardContent>
    </Card>
  );
}
