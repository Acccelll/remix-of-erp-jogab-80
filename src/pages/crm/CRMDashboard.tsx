// CRM — Painel gerencial: funil, conversão, pipeline e oportunidades em aberto.
// Reescrito com layout mobile-first: cards empilhados verticalmente, alvos de toque ≥44px,
// tipografia responsiva e KPIs em grid 2×2 no mobile.
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import {
  FunnelChart,
  Funnel,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Cell,
} from "@/components/ui/chart";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api";
import { formatBRLFromNumber } from "@/lib/core/currency";
import { fmtData } from "@/lib/utils";
import { useClientesContext } from "@/contexts/ClientesContext";
import {
  TrendingUp,
  Clock,
  Wallet,
  ListChecks,
  ArrowRight,
  CalendarClock,
  AlertTriangle,
  ChevronRight,
  Plus,
} from "lucide-react";
import { EmptyState } from "@/components/common/EmptyState";
import { Kpi as KpiBase } from "@/components/common/Kpi";
import { useIsMobile } from "@/hooks/use-mobile";
import { useCrmTarefas, classificarTarefa } from "@/hooks/crm/useCrmTarefas";
import { CRM_ESTAGIO_FECHADO_PERDIDO, useCrmMotivosPerda } from "@/hooks/crm/useCrmMotivosPerda";
import { useCrmScopeFilter } from "@/hooks/crm/useOportunidadesEscopo";

const COLORS = ["hsl(var(--primary))", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#6366f1"];

type FunilRow = { chave: string; rotulo: string; ordem: number; quantidade: number; valor: number };

const FECHADOS = new Set(["fechado_ganho", "fechado_perdido"]);

const tempClass = (t?: string) => {
  const v = (t || "").toLowerCase();
  if (v.includes("quente")) return "bg-red-500";
  if (v.includes("morno")) return "bg-amber-500";
  if (v.includes("frio")) return "bg-blue-500";
  return "bg-muted-foreground/40";
};

export default function CRMDashboard() {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const { oportunidades: oportunidadesAll } = useClientesContext();
  const { filter: scopeFilter, restrito: crmRestrito } = useCrmScopeFilter();
  const oportunidades = useMemo(() => scopeFilter(oportunidadesAll), [scopeFilter, oportunidadesAll]);
  const { todas: tarefasCrm } = useCrmTarefas();
  const { getRegistro } = useCrmMotivosPerda();

  const oportNome = useMemo(() => {
    const m = new Map<string, string>();
    oportunidades.forEach((o) => m.set(o.id, o.nome));
    return m;
  }, [oportunidades]);
  const oportTemp = useMemo(() => {
    const m = new Map<string, string | undefined>();
    oportunidades.forEach((o) => m.set(o.id, (o as any).temperatura_temperatura));
    return m;
  }, [oportunidades]);

  const hojeISO = new Date().toISOString().slice(0, 10);
  const followUpsAbertos = useMemo(
    () => tarefasCrm.filter((t) => t.status === "aberta").sort((a, b) => a.data.localeCompare(b.data)),
    [tarefasCrm],
  );
  const followUpsVencidos = followUpsAbertos.filter(
    (t) => classificarTarefa(t, hojeISO) === "vencida",
  );

  const funil = useQuery({
    queryKey: ["crm-stats-funil"],
    queryFn: () => apiFetch<FunilRow[]>("crmStats", { params: { tipo: "funil" } }),
  });
  const conversao = useQuery({
    queryKey: ["crm-stats-conversao"],
    queryFn: () =>
      apiFetch<{ total: number; ganhos: number; taxa: number; tempoMedioDias: number | null }>(
        "crmStats",
        { params: { tipo: "conversao" } },
      ),
  });
  const pipeline = useQuery({
    queryKey: ["crm-stats-pipeline"],
    queryFn: () =>
      apiFetch<{ ponderado: number; bruto: number }>("crmStats", { params: { tipo: "pipeline" } }),
  });
  const atividades = useQuery({
    queryKey: ["crm-stats-atividades"],
    queryFn: () =>
      apiFetch<{ vencidas: number; pendentes: number; concluidas: number }>("crmStats", {
        params: { tipo: "atividades" },
      }),
  });

  const funnelRowsLocais = useMemo<FunilRow[]>(() => {
    const rot = new Map<string, string>();
    const ord = new Map<string, number>();
    oportunidades.forEach((o, i) => {
      if (!rot.has(o.estagio)) {
        rot.set(o.estagio, o.estagio);
        ord.set(o.estagio, i);
      }
    });
    const map = new Map<string, FunilRow>();
    oportunidades.forEach((o) => {
      const chave = o.estagio;
      const curr =
        map.get(chave) ?? {
          chave,
          rotulo: rot.get(chave) ?? chave,
          ordem: ord.get(chave) ?? 0,
          quantidade: 0,
          valor: 0,
        };
      curr.quantidade += 1;
      curr.valor += Number(o.valorEstimado) || 0;
      map.set(chave, curr);
    });
    return [...map.values()].sort((a, b) => a.ordem - b.ordem);
  }, [oportunidades]);
  const funnelRows = crmRestrito ? funnelRowsLocais : funil.data ?? [];
  const topoQtd = funnelRows[0]?.quantidade || 0;
  const funnelData = funnelRows.map((r, i) => ({
    name: r.rotulo,
    value: r.quantidade,
    valor: r.valor,
    pct: topoQtd > 0 ? Math.round((r.quantidade / topoQtd) * 100) : 0,
    fill: COLORS[i % COLORS.length],
  }));
  const valorData = funnelRows.map((r) => ({ name: r.rotulo, valor: r.valor }));

  const abertas = useMemo(() => {
    return oportunidades
      .filter((l) => !FECHADOS.has(l.estagio))
      .sort((a, b) => {
        const da = a.dataPrevistaFechamento || "9999";
        const db = b.dataPrevistaFechamento || "9999";
        return da.localeCompare(db);
      });
  }, [oportunidades]);

  const perdasPorMotivo = useMemo(() => {
    const map = new Map<string, { motivo: string; quantidade: number; valor: number }>();
    oportunidades
      .filter((o) => o.estagio === CRM_ESTAGIO_FECHADO_PERDIDO)
      .forEach((o) => {
        const motivo = getRegistro(o.id)?.motivoRotulo ?? "Sem motivo registrado";
        const curr = map.get(motivo) ?? { motivo, quantidade: 0, valor: 0 };
        curr.quantidade += 1;
        curr.valor += Number(o.valorEstimado) || 0;
        map.set(motivo, curr);
      });
    return [...map.values()].sort((a, b) => b.quantidade - a.quantidade || b.valor - a.valor);
  }, [oportunidades, getRegistro]);

  return (
    <div className="p-3 sm:p-6 space-y-4 max-w-7xl mx-auto pb-24 md:pb-6">
      {/* Header */}
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold leading-tight">CRM</h1>
          <p className="text-xs sm:text-sm text-muted-foreground">
            Painel gerencial · funil, conversão e pipeline
          </p>
        </div>
        <Button
          size={isMobile ? "sm" : "default"}
          className="min-h-11 shrink-0"
          onClick={() => navigate("/crm/oportunidades")}
        >
          <Plus className="h-4 w-4 mr-1" />
          <span className="hidden xs:inline sm:inline">Nova</span>
        </Button>
      </header>

      {/* KPIs — 2×2 mobile, 4 cols desktop */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
        <KpiCard
          icon={TrendingUp}
          label="Conversão"
          value={`${conversao.data?.taxa ?? 0}%`}
          hint={`${conversao.data?.ganhos ?? 0}/${conversao.data?.total ?? 0}`}
        />
        <KpiCard
          icon={Clock}
          label="Tempo médio"
          value={
            conversao.data?.tempoMedioDias != null ? `${conversao.data.tempoMedioDias}d` : "—"
          }
          hint="no funil"
        />
        <KpiCard
          icon={Wallet}
          label="Pipeline"
          value={formatBRLFromNumber(pipeline.data?.ponderado ?? 0)}
          hint={`bruto ${formatBRLFromNumber(pipeline.data?.bruto ?? 0)}`}
        />
        <KpiCard
          icon={ListChecks}
          label="Atividades"
          value={`${(atividades.data?.vencidas ?? 0) + followUpsVencidos.length}`}
          hint={`${(atividades.data?.pendentes ?? 0) + followUpsAbertos.length} pendentes`}
          tone={
            (atividades.data?.vencidas ?? 0) + followUpsVencidos.length > 0 ? "danger" : "default"
          }
        />
      </section>

      {/* Gráficos — empilhados no mobile */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm sm:text-base">
              <Link
                to="/crm/funil"
                className="inline-flex items-center gap-1.5 hover:text-primary hover:underline min-h-11 py-2"
              >
                Funil de vendas <ArrowRight className="h-4 w-4" />
              </Link>
            </CardTitle>
          </CardHeader>
          <CardContent className="h-64 sm:h-80 px-2 sm:px-6">
            {funnelData.length === 0 ? (
              <EmptyState title="Sem dados." />
            ) : (
              <ResponsiveContainer>
                <FunnelChart>
                  <Tooltip
                    formatter={(v: number, _n, p: any) => {
                      const row = p?.payload;
                      const pct = row?.pct ?? 0;
                      const valor = row?.valor ?? 0;
                      return [
                        `${v} oport. • ${pct}% • ${formatBRLFromNumber(valor)}`,
                        row?.name ?? "",
                      ];
                    }}
                  />
                  <Funnel dataKey="value" data={funnelData} isAnimationActive>
                    <LabelList
                      position="right"
                      fill="hsl(var(--foreground))"
                      stroke="none"
                      dataKey="name"
                      className="text-[10px] sm:text-xs"
                    />
                    <LabelList
                      position="left"
                      fill="hsl(var(--foreground))"
                      stroke="none"
                      dataKey="value"
                    />
                  </Funnel>
                </FunnelChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm sm:text-base">Valor por estágio</CardTitle>
          </CardHeader>
          <CardContent className="h-64 sm:h-80 px-2 sm:px-6">
            {valorData.length === 0 ? (
              <EmptyState title="Sem dados." />
            ) : (
              <ResponsiveContainer>
                <BarChart data={valorData} layout="vertical" margin={{ left: 4, right: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" tickFormatter={(v) => formatBRLFromNumber(v)} hide />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={isMobile ? 80 : 110}
                    tick={{ fontSize: isMobile ? 10 : 12 }}
                  />
                  <Tooltip formatter={(v: number) => formatBRLFromNumber(v)} />
                  <Bar dataKey="valor" radius={[0, 4, 4, 0]}>
                    {valorData.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </section>

      {/* Follow-ups */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm sm:text-base flex flex-wrap items-center gap-2">
            <CalendarClock className="h-4 w-4" />
            Follow-ups ({followUpsAbertos.length})
            {followUpsVencidos.length > 0 && (
              <Badge variant="destructive" className="text-[10px]">
                {followUpsVencidos.length} vencido(s)
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-2 sm:p-6 sm:pt-0">
          {followUpsAbertos.length === 0 ? (
            <EmptyState title="Nenhum follow-up pendente." />
          ) : (
            <ul className="divide-y divide-border rounded-md border overflow-hidden">
              {followUpsAbertos.slice(0, 12).map((t) => {
                const kind = classificarTarefa(t, hojeISO);
                const cls =
                  kind === "vencida"
                    ? "text-destructive"
                    : kind === "hoje"
                      ? "text-warning"
                      : "text-muted-foreground";
                return (
                  <li
                    key={t.id}
                    className="flex items-center gap-3 px-3 py-3 text-sm cursor-pointer hover:bg-muted/50 active:bg-muted min-h-14"
                    onClick={() => navigate(`/crm/oportunidades/${t.oportunidadeId}`)}
                  >
                    <div className="flex flex-col items-center justify-center min-w-14">
                      <span className={`text-[10px] uppercase tracking-wide ${cls}`}>
                        {kind === "vencida" ? "Atraso" : kind === "hoje" ? "Hoje" : "Futuro"}
                      </span>
                      <span className={`text-xs tabular-nums font-medium ${cls}`}>
                        {fmtData(t.data)}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{t.titulo}</div>
                      <div className="text-[11px] text-muted-foreground truncate">
                        {oportNome.get(t.oportunidadeId) ?? "—"}
                        {t.responsavelLogin ? ` · ${t.responsavelLogin}` : ""}
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Perdas */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm sm:text-base flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" /> Perdas por motivo
          </CardTitle>
        </CardHeader>
        <CardContent className="p-2 sm:p-6 sm:pt-0">
          {perdasPorMotivo.length === 0 ? (
            <EmptyState title="Nenhuma oportunidade perdida." />
          ) : (
            <ul className="divide-y divide-border rounded-md border overflow-hidden">
              {perdasPorMotivo.map((item) => (
                <li
                  key={item.motivo}
                  className="flex items-center justify-between gap-3 px-3 py-3 text-sm min-h-14"
                >
                  <div className="min-w-0 flex-1">
                    <div className="font-medium truncate">{item.motivo}</div>
                    <div className="text-[11px] text-muted-foreground">
                      {item.quantidade} oportunidade{item.quantidade !== 1 ? "s" : ""}
                    </div>
                  </div>
                  <div className="tabular-nums text-right font-semibold text-destructive shrink-0">
                    {formatBRLFromNumber(item.valor)}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Oportunidades em aberto — cards no mobile, lista compacta no desktop */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm sm:text-base">
            Oportunidades em aberto ({abertas.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-2 sm:p-6 sm:pt-0">
          {abertas.length === 0 ? (
            <EmptyState title="Nenhuma oportunidade em aberto." />
          ) : (
            <ul className="divide-y divide-border rounded-md border overflow-hidden">
              {abertas.slice(0, 30).map((o: any) => (
                <li
                  key={o.id}
                  className="flex items-center gap-3 px-3 py-3 cursor-pointer hover:bg-muted/50 active:bg-muted min-h-16"
                  onClick={() => navigate(`/crm/oportunidades/${o.id}`)}
                >
                  <span
                    className={`h-2.5 w-2.5 rounded-full shrink-0 ${tempClass(o.temperatura_temperatura)}`}
                    aria-hidden
                  />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate text-sm">{o.nome}</div>
                    <div className="text-[11px] text-muted-foreground truncate flex items-center gap-1.5 flex-wrap">
                      {o.empresa && <span className="truncate">{o.empresa}</span>}
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">
                        {o.estagio}
                      </Badge>
                      {o.dataPrevistaFechamento && (
                        <span className="tabular-nums">· {fmtData(o.dataPrevistaFechamento)}</span>
                      )}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="tabular-nums font-semibold text-sm">
                      {formatBRLFromNumber(o.valorEstimado || 0)}
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function KpiCard({
  icon: Icon,
  label,
  value,
  hint,
  tone,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  hint?: string;
  tone?: "default" | "danger" | "success" | "warning";
}) {
  return (
    <KpiBase
      size="sm"
      tone={tone}
      label={
        <span className="flex items-center gap-1.5 text-[11px] sm:text-xs">
          <Icon className="h-3.5 w-3.5" /> {label}
        </span>
      }
      value={value}
      hint={hint}
      valueClassName="text-base sm:text-xl truncate"
    />
  );
}
