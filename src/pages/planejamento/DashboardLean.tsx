import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useObras } from "@/hooks/obras/useObras";
import { Link } from "react-router-dom";
import { format, subDays, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  ClipboardList,
  GitCompare,
  Loader2,
  TrendingUp,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip as RTooltip,
  ResponsiveContainer,
  ReferenceLine,
  Cell,
} from "@/components/ui/chart";
import { supabase } from "@/integrations/supabase/client";
import {
  riscosRepo,
  restricoesRepo,
  pacotesTrabalhoRepo,
  pacoteRestricoesRepo,
  causasNaoConclusaoRepo,
} from "@/lib/repositories/planejamento";
import { cronogramaFns as cronogramaRepo } from "@/hooks/obras/useCronograma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import DatePickerField from "@/components/common/DatePickerField";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  consolidarPpcPorObra,
  consolidarRestricoesPorCategoria,
  semaforoLookahead,
  topCausasGlobal,
  topRiscosCriticos,
  type CompromissoLite,
  type RestricaoLite,
  type PacoteLite,
  type PacoteRestricaoLite,
  type RiscoLite,
  type CausaLite,
} from "@/lib/lean-dashboard/aggregations";
import {
  reconciliarLeanCpm,
  type CronogramaItemLite,
  type PacoteReconLite,
} from "@/lib/planejamento/reconciliacao";
import { SEVERIDADE_BG, SEVERIDADE_LABEL, severidadeDe } from "@/lib/riscos/matriz";
import { useUrlState } from "@/hooks/useUrlState";

const META_PPC = 0.85;

type DashboardPacote = PacoteLite & PacoteReconLite & { descricao?: string | null };

type CronogramaReconRow = {
  id: string;
  obra_id: string;
  descricao: string | null;
  percentual_realizado: number | null;
};

function statusCpmPorPercentual(
  percentual: number | null | undefined,
): CronogramaItemLite["status"] {
  const pct = Number(percentual ?? 0);
  if (pct >= 100) return "concluido";
  if (pct > 0) return "em_andamento";
  return "nao_iniciado";
}

export default function DashboardLean() {
  const today = new Date();
  const [de, setDe] = useUrlState("de", format(subDays(today, 28), "yyyy-MM-dd"));
  const [ate, setAte] = useUrlState("ate", format(today, "yyyy-MM-dd"));

  const obrasQuery = useObras();
  const obras = useMemo(
    () => (obrasQuery.data ?? []).map((o) => ({ id: o.id, nome: o.nome })),
    [obrasQuery.data],
  );

  const { data, isLoading: isLoadingData } = useQuery({
    queryKey: ["dashboard-lean", de, ate],
    queryFn: async () => {
      const [compRes, restRes, pacRes, linkRes, riscRes, causaRes, rdoRes, cronoRes] =
        await Promise.all([
          supabase
            .from("compromissos_semanais")
            .select("id, obra_id, concluido, causa_chave, semana_inicio")
            .gte("semana_inicio", de)
            .lte("semana_inicio", ate),
          restricoesRepo.listDashboard().then((data) => ({ data, error: null as any })),
          pacotesTrabalhoRepo.listCompleto().then((data) => ({ data, error: null as any })),
          pacoteRestricoesRepo.listDashboard().then((data) => ({ data, error: null as any })),
          riscosRepo.listDashboard().then((data) => ({ data, error: null as any })),
          causasNaoConclusaoRepo.listChaveLabel().then((data) => ({ data, error: null as any })),
          supabase
            .from("rdo")
            .select("id, obra_id, data, status")
            .gte("data", format(subDays(today, 7), "yyyy-MM-dd"))
            .order("data", { ascending: false }),
          cronogramaRepo.listDashboard().then((data) => ({ data, error: null as any })),
        ]);

      return {
        compromissos: (compRes.data ?? []) as CompromissoLite[],
        restricoes: (restRes.data ?? []) as RestricaoLite[],
        pacotes: (pacRes.data ?? []) as DashboardPacote[],
        links: (linkRes.data ?? []) as PacoteRestricaoLite[],
        riscos: (riscRes.data ?? []) as RiscoLite[],
        causas: (causaRes.data ?? []) as CausaLite[],
        rdos: (rdoRes.data ?? []) as {
          id: string;
          obra_id: string;
          data: string;
          status: string;
        }[],
        cronogramaItens: (cronoRes.data ?? []) as CronogramaReconRow[],
      };
    },
  });
  const isLoading = isLoadingData || obrasQuery.isLoading;

  const hojeISO = format(today, "yyyy-MM-dd");

  const computed = useMemo(() => {
    if (!data) return null;
    const ppcPorObra = consolidarPpcPorObra(data.compromissos);
    const totalCompr = data.compromissos.length;
    const concluidos = data.compromissos.filter((c) => c.concluido).length;
    const ppcGlobal = totalCompr === 0 ? 0 : concluidos / totalCompr;
    const semaforo = semaforoLookahead(data.pacotes, data.links, data.restricoes, hojeISO);
    const restCat = consolidarRestricoesPorCategoria(data.restricoes);
    const topCausas = topCausasGlobal(data.compromissos, data.causas);
    const topRiscos = topRiscosCriticos(data.riscos);
    const obraNome = new Map(obras.map((o) => [o.id, o.nome]));
    const itensRecon: CronogramaItemLite[] = data.cronogramaItens.map((it) => ({
      id: it.id,
      obra_id: it.obra_id,
      nome: it.descricao ?? "Item sem descrição",
      status: statusCpmPorPercentual(it.percentual_realizado),
    }));
    const pacotesRecon: PacoteReconLite[] = data.pacotes.map((p) => ({
      id: p.id,
      obra_id: p.obra_id,
      cronograma_item_id: p.cronograma_item_id ?? null,
      status: p.status ?? null,
    }));
    const reconciliacao = reconciliarLeanCpm(itensRecon, pacotesRecon);
    const obraIdsRecon = new Set<string>([
      ...itensRecon.map((it) => it.obra_id),
      ...pacotesRecon.map((p) => p.obra_id),
    ]);
    const reconciliacaoPorObra = Array.from(obraIdsRecon)
      .map((obra_id) => {
        const rec = reconciliarLeanCpm(
          itensRecon.filter((it) => it.obra_id === obra_id),
          pacotesRecon.filter((p) => p.obra_id === obra_id),
        );
        const problemas =
          rec.itens_sem_pacote.length + rec.itens_divergentes.length + rec.pacotes_orfaos.length;
        return {
          obra_id,
          nome: obraNome.get(obra_id) ?? obra_id.slice(0, 8),
          cobertura: rec.totais.itens === 0 ? 0 : rec.totais.itens_cobertos / rec.totais.itens,
          itens: rec.totais.itens,
          itensSemPacote: rec.itens_sem_pacote.length,
          divergentes: rec.itens_divergentes.length,
          pacotesOrfaos: rec.pacotes_orfaos.length,
          problemas,
        };
      })
      .sort((a, b) => b.problemas - a.problemas || a.nome.localeCompare(b.nome));
    const riscosCriticos = data.riscos.filter(
      (r) =>
        (r.status === "aberto" || r.status === "em_andamento") &&
        (r.probabilidade ?? 0) * (r.impacto ?? 0) >= 16,
    ).length;
    const rdosSync = data.rdos.filter((r) => r.status === "sincronizado").length;
    return {
      ppcPorObra,
      ppcGlobal,
      semaforo,
      restCat,
      topCausas,
      topRiscos,
      obraNome,
      reconciliacao,
      reconciliacaoPorObra,
      riscosCriticos,
      rdosSync,
    };
  }, [data, hojeISO, obras]);

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center gap-3">
        <Activity className="h-7 w-7 text-primary" />
        <div>
          <h1 className="text-2xl font-semibold">Dashboard Executivo Lean</h1>
          <p className="text-sm text-muted-foreground">
            Visão consolidada multi-obra: Last Planner, Lookahead, Riscos e RDO.
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Período</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-3 max-w-md">
          <div>
            <Label className="text-xs">De</Label>
            <DatePickerField value={de} onChange={(v) => setDe(v)} />
          </div>
          <div>
            <Label className="text-xs">Até</Label>
            <DatePickerField value={ate} onChange={(v) => setAte(v)} />
          </div>
        </CardContent>
      </Card>

      {isLoading || !computed ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-12 justify-center">
          <Loader2 className="h-5 w-5 animate-spin" /> Carregando dados...
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <KpiCard
              icon={<TrendingUp className="h-4 w-4" />}
              label="PPC consolidado"
              value={`${(computed.ppcGlobal * 100).toFixed(0)}%`}
              hint={`Meta ${META_PPC * 100}%`}
              good={computed.ppcGlobal >= META_PPC}
            />
            <KpiCard
              icon={<CheckCircle2 className="h-4 w-4" />}
              label="Pacotes (semáforo)"
              value={`${computed.semaforo.verde}/${computed.semaforo.verde + computed.semaforo.amarelo + computed.semaforo.vermelho}`}
              hint={`${computed.semaforo.amarelo} amar · ${computed.semaforo.vermelho} verm`}
            />
            <KpiCard
              icon={<AlertTriangle className="h-4 w-4" />}
              label="Riscos críticos abertos"
              value={String(computed.riscosCriticos)}
              hint="P × I ≥ 16"
              good={computed.riscosCriticos === 0}
            />
            <KpiCard
              icon={<ClipboardList className="h-4 w-4" />}
              label="RDOs sincronizados (7d)"
              value={String(computed.rdosSync)}
            />
            <KpiCard
              icon={<GitCompare className="h-4 w-4" />}
              label="Cobertura Lean×CPM"
              value={`${computed.reconciliacao.totais.itens_cobertos}/${computed.reconciliacao.totais.itens}`}
              hint={`${computed.reconciliacao.itens_divergentes.length} diverg · ${computed.reconciliacao.pacotes_orfaos.length} órfãos`}
              good={
                computed.reconciliacao.itens_sem_pacote.length === 0 &&
                computed.reconciliacao.itens_divergentes.length === 0 &&
                computed.reconciliacao.pacotes_orfaos.length === 0
              }
            />
          </div>

          <Card
            role="region"
            aria-label={`Reconciliação Lean e CPM. ${computed.reconciliacaoPorObra.length} obra(s) avaliadas.`}
          >
            <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <CardTitle className="flex items-center gap-2 text-base">
                <GitCompare className="h-4 w-4" /> Reconciliação Lean × CPM
              </CardTitle>
              <Link to="/planejamento/pacotes" className="text-sm text-primary hover:underline">
                Abrir pacotes
              </Link>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <ResumoRecon
                  label="Itens sem pacote"
                  value={computed.reconciliacao.itens_sem_pacote.length}
                  tone={computed.reconciliacao.itens_sem_pacote.length > 0 ? "bad" : "ok"}
                />
                <ResumoRecon
                  label="Divergências Lean→CPM"
                  value={computed.reconciliacao.itens_divergentes.length}
                  tone={computed.reconciliacao.itens_divergentes.length > 0 ? "bad" : "ok"}
                />
                <ResumoRecon
                  label="Pacotes órfãos"
                  value={computed.reconciliacao.pacotes_orfaos.length}
                  tone={computed.reconciliacao.pacotes_orfaos.length > 0 ? "warn" : "ok"}
                />
              </div>

              {computed.reconciliacaoPorObra.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Sem itens de cronograma ou pacotes para reconciliar.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Obra</TableHead>
                      <TableHead>Cobertura</TableHead>
                      <TableHead className="text-right">Sem pacote</TableHead>
                      <TableHead className="text-right">Divergentes</TableHead>
                      <TableHead className="text-right">Órfãos</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {computed.reconciliacaoPorObra.slice(0, 8).map((obra) => (
                      <TableRow key={obra.obra_id}>
                        <TableCell className="font-medium">{obra.nome}</TableCell>
                        <TableCell>
                          <div className="flex min-w-36 items-center gap-2">
                            <div className="h-2 flex-1 overflow-hidden rounded bg-muted">
                              <div
                                className="h-full bg-primary"
                                style={{ width: `${Math.round(obra.cobertura * 100)}%` }}
                              />
                            </div>
                            <span className="w-10 text-right text-xs text-muted-foreground">
                              {Math.round(obra.cobertura * 100)}%
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <Badge variant={obra.itensSemPacote > 0 ? "destructive" : "secondary"}>
                            {obra.itensSemPacote}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Badge variant={obra.divergentes > 0 ? "destructive" : "secondary"}>
                            {obra.divergentes}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Badge variant={obra.pacotesOrfaos > 0 ? "outline" : "secondary"}>
                            {obra.pacotesOrfaos}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}

              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <ReconDrilldown
                  title="Itens sem pacote"
                  empty="Todos os itens CPM ativos têm ao menos um pacote Lean."
                  rows={computed.reconciliacao.itens_sem_pacote.slice(0, 6).map((it) => ({
                    id: it.id,
                    title: it.nome,
                    meta: computed.obraNome.get(it.obra_id) ?? it.obra_id.slice(0, 8),
                  }))}
                />
                <ReconDrilldown
                  title="Lean concluído, CPM aberto"
                  empty="Nenhuma divergência de conclusão encontrada."
                  rows={computed.reconciliacao.itens_divergentes.slice(0, 6).map((it) => ({
                    id: it.item_id,
                    title: it.nome,
                    meta: `${computed.obraNome.get(it.obra_id) ?? it.obra_id.slice(0, 8)} · ${it.concluidos}/${it.total_pacotes} pacotes`,
                  }))}
                />
              </div>
            </CardContent>
          </Card>

          <Card
            role="figure"
            aria-label={`PPC por obra. ${computed.ppcPorObra.length} obra(s). ${
              computed.ppcPorObra.length
                ? `Maior: ${
                    computed.obraNome.get(
                      computed.ppcPorObra.slice().sort((a, b) => b.ppc - a.ppc)[0].obra_id,
                    ) ?? "—"
                  } com ${Math.round(
                    computed.ppcPorObra.slice().sort((a, b) => b.ppc - a.ppc)[0].ppc * 100,
                  )}%. Meta: ${Math.round(META_PPC * 100)}%.`
                : "Sem dados no período."
            }`}
          >
            <CardHeader>
              <CardTitle className="text-base">PPC por obra</CardTitle>
            </CardHeader>
            <CardContent>
              {computed.ppcPorObra.length === 0 ? (
                <p className="text-sm text-muted-foreground">Sem compromissos no período.</p>
              ) : (
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={computed.ppcPorObra.map((p) => ({
                        nome: computed.obraNome.get(p.obra_id) ?? p.obra_id.slice(0, 8),
                        ppc: Number((p.ppc * 100).toFixed(1)),
                      }))}
                    >
                      <XAxis dataKey="nome" tick={{ fontSize: 11 }} />
                      <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} unit="%" />
                      <RTooltip formatter={(v: number) => `${v}%`} />
                      <ReferenceLine
                        y={META_PPC * 100}
                        stroke="hsl(var(--primary))"
                        strokeDasharray="3 3"
                      />
                      <Bar dataKey="ppc">
                        {computed.ppcPorObra.map((p, i) => (
                          <Cell
                            key={i}
                            fill={
                              p.ppc >= META_PPC
                                ? "hsl(142 76% 36%)"
                                : p.ppc >= 0.6
                                  ? "hsl(38 92% 50%)"
                                  : "hsl(var(--destructive))"
                            }
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Restrições por categoria</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {computed.restCat.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Sem restrições cadastradas.</p>
                ) : (
                  computed.restCat.map((r) => {
                    const max = computed.restCat[0].abertas || 1;
                    return (
                      <div key={r.categoria}>
                        <div className="flex justify-between text-xs mb-1">
                          <span className="capitalize">{r.categoria}</span>
                          <span className="text-muted-foreground">
                            {r.abertas} aberta{r.abertas === 1 ? "" : "s"} / {r.total}
                          </span>
                        </div>
                        <div className="h-2 rounded bg-muted overflow-hidden">
                          <div
                            className="h-full bg-destructive"
                            style={{ width: `${(r.abertas / max) * 100}%` }}
                          />
                        </div>
                      </div>
                    );
                  })
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Top causas (Pareto)</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {computed.topCausas.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Sem causas registradas no período.
                  </p>
                ) : (
                  computed.topCausas.map((c) => (
                    <div key={c.chave}>
                      <div className="flex justify-between text-xs mb-1">
                        <span>{c.label}</span>
                        <span className="text-muted-foreground">
                          {c.count} ({(c.pct * 100).toFixed(0)}%)
                        </span>
                      </div>
                      <div className="h-2 rounded bg-muted overflow-hidden">
                        <div className="h-full bg-primary" style={{ width: `${c.pct * 100}%` }} />
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Top 5 riscos críticos</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {computed.topRiscos.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Sem riscos abertos.</p>
                ) : (
                  computed.topRiscos.map((r) => {
                    const sev = severidadeDe(r.probabilidade ?? 0, r.impacto ?? 0);
                    return (
                      <Link
                        key={r.id}
                        to="/planejamento/riscos"
                        className={`flex items-center justify-between gap-2 rounded px-3 py-2 text-sm border ${SEVERIDADE_BG[sev]}`}
                      >
                        <span className="truncate">{r.descricao}</span>
                        <Badge variant="outline">{SEVERIDADE_LABEL[sev]}</Badge>
                      </Link>
                    );
                  })
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">RDOs recentes (7 dias)</CardTitle>
              </CardHeader>
              <CardContent>
                {!data || data.rdos.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nenhum RDO nos últimos 7 dias.</p>
                ) : (
                  <ul className="space-y-1 text-sm">
                    {data.rdos.slice(0, 10).map((r) => (
                      <li key={r.id} className="flex justify-between gap-2">
                        <span>
                          {format(parseISO(r.data), "dd/MM", { locale: ptBR })} ·{" "}
                          {computed.obraNome.get(r.obra_id) ?? r.obra_id.slice(0, 8)}
                        </span>
                        <Badge variant={r.status === "sincronizado" ? "default" : "secondary"}>
                          {r.status}
                        </Badge>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}

function ResumoRecon({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "ok" | "warn" | "bad";
}) {
  return (
    <div className="rounded-md border p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div
        className={`mt-1 text-2xl font-semibold ${
          tone === "bad" ? "text-destructive" : tone === "warn" ? "text-primary" : "text-primary"
        }`}
      >
        {value}
      </div>
    </div>
  );
}

function ReconDrilldown({
  title,
  empty,
  rows,
}: {
  title: string;
  empty: string;
  rows: { id: string; title: string; meta: string }[];
}) {
  return (
    <section className="rounded-md border p-3" aria-label={title}>
      <h2 className="text-sm font-medium">{title}</h2>
      {rows.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">{empty}</p>
      ) : (
        <ul className="mt-2 divide-y">
          {rows.map((row) => (
            <li key={row.id} className="py-2 text-sm">
              <div className="font-medium leading-snug">{row.title}</div>
              <div className="text-xs text-muted-foreground">{row.meta}</div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function KpiCard({
  icon,
  label,
  value,
  hint,
  good,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint?: string;
  good?: boolean;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {icon}
          {label}
        </div>
        <div
          className={`text-2xl font-semibold mt-1 ${
            good === true ? "text-success" : good === false ? "text-destructive" : ""
          }`}
        >
          {value}
        </div>
        {hint && <div className="text-xs text-muted-foreground mt-0.5">{hint}</div>}
      </CardContent>
    </Card>
  );
}
