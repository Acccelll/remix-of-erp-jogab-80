/**
 * /gm/saude — Painel operacional (H2.2).
 *
 * Mostra:
 *   - Idade do snapshot TOTVS (reaproveita SnapshotAgeAlert).
 *   - Últimos eventos de sistema (system_events) — falhas, alertas, avisos.
 *   - Fila offline (pendentes, último erro, status do sync).
 *
 * Acesso: apenas GM (currentPlayer.isGM). Para usuários não-GM, redireciona.
 */
import { useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  CloudOff,
  Database,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { useAuth } from "@/contexts/auth/useAuth";
import { gmSaudeRepo } from "@/lib/repositories/gmSaude";
import { SnapshotAgeAlert } from "@/components/financeiro/SnapshotAgeAlert";
import { useSyncQueueStatus } from "@/hooks/useSyncQueueStatus";
import { fmtData } from "@/lib/utils";
import { fmtCurtoBRL } from "@/lib/core/money";
import { checkRpcDegradation, resetRpcBaseline } from "@/lib/rpc-baseline";

type Severity = "info" | "warn" | "error" | "critical";
interface SystemEvent {
  id: string;
  kind: string;
  severity: Severity;
  source: string;
  message: string;
  context: Record<string, unknown>;
  created_at: string;
}

interface TotvsRun {
  id: string;
  arquivo_nome: string | null;
  status: string;
  total_recebidas: number;
  total_processadas: number;
  total_rejeitadas: number;
  created_at: string;
}

interface ObraDashboardRow {
  obra_id: string | null;
  status: string | null;
  financeiro_saldo: number | null;
  progresso_fisico: number | null;
  requisicoes_pendentes: number | null;
  ordens_compra_abertas: number | null;
  atualizado_em: string | null;
}

interface QueryPerformanceRow {
  queryid: number | null;
  calls: number | null;
  total_ms: number | null;
  mean_ms: number | null;
  p95_ms: number | null;
  max_ms: number | null;
  rows: number | null;
  categoria: string | null;
  statement: string | null;
}

function fmtMs(v: number | null | undefined) {
  const n = Number(v ?? 0);
  if (!Number.isFinite(n)) return "—";
  return `${n.toLocaleString("pt-BR", { maximumFractionDigits: n >= 100 ? 0 : 1 })}ms`;
}

const severityStyles: Record<
  Severity,
  { variant: "default" | "destructive" | "secondary" | "outline"; label: string }
> = {
  info: { variant: "secondary", label: "Info" },
  warn: { variant: "outline", label: "Aviso" },
  error: { variant: "destructive", label: "Erro" },
  critical: { variant: "destructive", label: "Crítico" },
};

export default function GMSaude() {
  const { currentPlayer } = useAuth();
  const sync = useSyncQueueStatus();

  const {
    data: events,
    isLoading,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: ["system_events", "recent"],
    queryFn: async (): Promise<SystemEvent[]> => {
      return (await gmSaudeRepo.listSystemEvents(100)) as SystemEvent[];
    },
    refetchInterval: 30_000,
    staleTime: 10_000,
  });

  const { data: totvsRuns } = useQuery({
    queryKey: ["totvs_import_runs", "recent"],
    queryFn: async (): Promise<TotvsRun[]> => {
      return (await gmSaudeRepo.listTotvsRuns(10)) as TotvsRun[];
    },
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  const { data: cutoverStatus } = useQuery({
    queryKey: ["vw_cutover_legacy_status"],
    queryFn: async () => {
      return (await gmSaudeRepo.listCutoverStatus()) as Array<{
        obra_id: string;
        obra_nome: string;
        ativa: boolean;
        legados_desligados: number;
        legados_total: number;
        todos_desligados: boolean;
      }>;
    },
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  const { data: obrasDashboard } = useQuery({
    queryKey: ["vw_mv_obra_dashboard", "saude"],
    queryFn: async (): Promise<ObraDashboardRow[]> => {
      return (await gmSaudeRepo.listObrasDashboard()) as ObraDashboardRow[];
    },
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  const { data: queryPerformance } = useQuery({
    queryKey: ["gm_query_performance", "top10"],
    queryFn: async (): Promise<QueryPerformanceRow[]> => {
      return (await gmSaudeRepo.queryPerformance(10)) as QueryPerformanceRow[];
    },
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  const [degradations, setDegradations] = useState<
    Array<{ queryid: string; p95: number; baseline: number; categoria: string | null }>
  >([]);

  useEffect(() => {
    if (!queryPerformance?.length) return;
    const alerts = checkRpcDegradation(queryPerformance);
    if (alerts.length) setDegradations(alerts);
  }, [queryPerformance]);

  const cutoverKpi = useMemo(() => {
    const ativas = (cutoverStatus ?? []).filter((o) => o.ativa);
    const desligadas = ativas.filter((o) => o.todos_desligados).length;
    return { desligadas, total: ativas.length };
  }, [cutoverStatus]);

  const counters = useMemo(() => {
    const c = { info: 0, warn: 0, error: 0, critical: 0 };
    for (const e of events ?? []) c[e.severity]++;
    return c;
  }, [events]);

  const obraKpi = useMemo(() => {
    const rows = obrasDashboard ?? [];
    const ativas = rows.filter((o) => o.status !== "cancelada");
    const progresso = ativas.length
      ? ativas.reduce((acc, o) => acc + Number(o.progresso_fisico ?? 0), 0) / ativas.length
      : 0;
    const saldo = ativas.reduce((acc, o) => acc + Number(o.financeiro_saldo ?? 0), 0);
    const pendencias = ativas.reduce(
      (acc, o) => acc + Number(o.requisicoes_pendentes ?? 0) + Number(o.ordens_compra_abertas ?? 0),
      0,
    );
    const atualizado = rows.find((o) => o.atualizado_em)?.atualizado_em ?? null;
    return { total: ativas.length, progresso, saldo, pendencias, atualizado };
  }, [obrasDashboard]);

  if (!currentPlayer) return <Navigate to="/" replace />;
  if (!currentPlayer.isGM) return <Navigate to="/" replace />;

  const offlineHasError = Boolean(sync.lastError);
  const offlineHealthy = sync.total === 0 && !offlineHasError;

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <Activity className="h-6 w-6" />
            Saúde do sistema
          </h1>
          <p className="text-sm text-muted-foreground">
            Sinais operacionais — integrações, fila offline e eventos críticos.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
          <RefreshCw className={`h-4 w-4 mr-2 ${isFetching ? "animate-spin" : ""}`} />
          Atualizar
        </Button>
      </div>

      <SnapshotAgeAlert />

      <Card>
        <CardHeader>
          <CardTitle>Últimas importações TOTVS</CardTitle>
          <CardDescription>
            Runs registradas por <code>totvs-import-validar</code> — ok / parcial / erro.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {(totvsRuns ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma run registrada ainda.</p>
          ) : (
            <div className="space-y-2">
              {(totvsRuns ?? []).map((r) => {
                const variant =
                  r.status === "ok"
                    ? "secondary"
                    : r.status === "parcial"
                      ? "outline"
                      : "destructive";
                return (
                  <div
                    key={r.id}
                    className="flex items-center justify-between border rounded-md p-2 text-sm"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <Badge variant={variant}>{r.status}</Badge>
                      <span className="truncate font-mono text-xs">
                        {r.arquivo_nome ?? r.id.slice(0, 8)}
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground flex items-center gap-3">
                      <span>
                        {r.total_processadas}/{r.total_recebidas} ok
                        {r.total_rejeitadas > 0 && (
                          <span className="text-destructive ml-1">· {r.total_rejeitadas} rej</span>
                        )}
                      </span>
                      <span>{fmtData(r.created_at)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4" /> Cutover legados
            </CardDescription>
            <CardTitle className="text-3xl">
              {cutoverKpi.desligadas}/{cutoverKpi.total}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            obras com os 4 importadores desligados
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <Database className="h-4 w-4" /> Eventos (24h)
            </CardDescription>
            <CardTitle className="text-3xl">{(events ?? []).length}</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-x-2">
            <Badge variant="destructive">{counters.critical + counters.error} erros</Badge>
            <Badge variant="outline">{counters.warn} avisos</Badge>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <CloudOff className="h-4 w-4" /> Fila offline
            </CardDescription>
            <CardTitle className="text-3xl">{sync.total}</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            {sync.pending} mutações · {sync.mediaPending} mídias
            {sync.syncing && (
              <span className="ml-2 inline-flex items-center text-foreground">
                <Loader2 className="h-3 w-3 mr-1 animate-spin" /> sincronizando
              </span>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Conectividade</CardDescription>
            <CardTitle className="text-3xl">
              {sync.online ? (
                <span className="text-success">Online</span>
              ) : (
                <span className="text-destructive">Offline</span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            {offlineHealthy ? (
              <span className="inline-flex items-center text-success">
                <CheckCircle2 className="h-3 w-3 mr-1" /> sem pendências
              </span>
            ) : offlineHasError ? (
              <span className="inline-flex items-center text-destructive">
                <AlertTriangle className="h-3 w-3 mr-1" /> último erro: {sync.lastError}
              </span>
            ) : (
              "aguardando flush"
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Resumo consolidado das obras</CardTitle>
          <CardDescription>
            Leitura materializada para validar rapidamente carteira, financeiro e suprimentos sem
            varrer tabelas pesadas.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <div className="text-sm text-muted-foreground">Obras ativas</div>
            <div className="text-2xl font-semibold tabular-nums">{obraKpi.total}</div>
          </div>
          <div>
            <div className="text-sm text-muted-foreground">Progresso médio</div>
            <div className="text-2xl font-semibold tabular-nums">
              {obraKpi.progresso.toFixed(1)}%
            </div>
          </div>
          <div>
            <div className="text-sm text-muted-foreground">Saldo financeiro</div>
            <div className="text-2xl font-semibold tabular-nums">{fmtCurtoBRL(obraKpi.saldo)}</div>
          </div>
          <div>
            <div className="text-sm text-muted-foreground">Pendências suprimentos</div>
            <div className="text-2xl font-semibold tabular-nums">{obraKpi.pendencias}</div>
            {obraKpi.atualizado && (
              <div className="text-xs text-muted-foreground mt-1">
                Atualizado em {fmtData(obraKpi.atualizado)}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" /> Consultas mais pesadas
          </CardTitle>
          <CardDescription>
            Top 10 por tempo acumulado — chamadas, média, p95 estimado e pico observados no backend.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {degradations.length > 0 && (
            <Alert variant="destructive" className="mb-3">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Degradação de performance detectada</AlertTitle>
              <AlertDescription>
                <ul className="mt-1 space-y-1 text-xs">
                  {degradations.slice(0, 5).map((d) => (
                    <li key={d.queryid} className="tabular-nums">
                      <span className="font-medium">{d.categoria ?? "Geral"}</span> — p95{" "}
                      {fmtMs(d.p95)} (baseline {fmtMs(d.baseline)},{" "}
                      {(d.p95 / d.baseline).toFixed(1)}×)
                    </li>
                  ))}
                </ul>
                <div className="mt-2 flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      resetRpcBaseline();
                      setDegradations([]);
                    }}
                  >
                    <RefreshCw className="h-3 w-3 mr-1" /> Recalibrar baseline
                  </Button>
                  <span className="text-xs text-muted-foreground">
                    Alertas foram enviados ao Sentry.
                  </span>
                </div>
              </AlertDescription>
            </Alert>
          )}
          {(queryPerformance ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Ainda não há métricas suficientes de consulta.
            </p>
          ) : (
            <div className="space-y-2">
              {(queryPerformance ?? []).map((q, idx) => (
                <div key={`${q.queryid ?? idx}`} className="rounded-md border p-3 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2">
                      <Badge variant="secondary">{q.categoria ?? "Geral"}</Badge>
                      <span className="font-medium tabular-nums">
                        {Number(q.calls ?? 0).toLocaleString("pt-BR")} chamadas
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                      <span>média {fmtMs(q.mean_ms)}</span>
                      <span>p95 {fmtMs(q.p95_ms)}</span>
                      <span>máx {fmtMs(q.max_ms)}</span>
                      <span>total {fmtMs(q.total_ms)}</span>
                    </div>
                  </div>
                  <code className="mt-2 block overflow-hidden text-ellipsis whitespace-nowrap rounded bg-muted px-2 py-1 text-xs text-muted-foreground">
                    {q.statement ?? "consulta não identificada"}
                  </code>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Últimos eventos do sistema</CardTitle>
          <CardDescription>
            Falhas de edge functions, importadores TOTVS, alertas operacionais e divergências.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8 text-muted-foreground">
              <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Carregando…
            </div>
          ) : (events ?? []).length === 0 ? (
            <Alert>
              <CheckCircle2 className="h-4 w-4" />
              <AlertTitle>Nada a relatar</AlertTitle>
              <AlertDescription>
                Sem eventos registrados nas últimas execuções. Quando uma edge function falhar ou um
                import vier parcial, aparecerá aqui.
              </AlertDescription>
            </Alert>
          ) : (
            <ScrollArea className="h-[480px] pr-4">
              <div className="space-y-2">
                {(events ?? []).map((e) => {
                  const s = severityStyles[e.severity];
                  return (
                    <div key={e.id} className="rounded-md border p-3 text-sm">
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <Badge variant={s.variant}>{s.label}</Badge>
                          <span className="font-mono text-xs text-muted-foreground">
                            {e.source}
                          </span>
                          <span className="font-medium">{e.kind}</span>
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {fmtData(e.created_at)}
                        </span>
                      </div>
                      <p className="text-foreground">{e.message}</p>
                      {e.context && Object.keys(e.context).length > 0 && (
                        <details className="mt-2">
                          <summary className="cursor-pointer text-xs text-muted-foreground">
                            contexto
                          </summary>
                          <pre className="text-xs bg-muted rounded p-2 mt-1 overflow-x-auto">
                            {JSON.stringify(e.context, null, 2)}
                          </pre>
                        </details>
                      )}
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
