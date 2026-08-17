import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useObras } from "@/hooks/obras/useObras";
import { Link } from "react-router-dom";
import { format, parseISO, subDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ClipboardList, Loader2, ExternalLink, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { rdoEfetivoRepo, rdoOcorrenciasRepo } from "@/lib/repositories/obraDetalhe";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import DatePickerField from "@/components/common/DatePickerField";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  mediaEfetivo,
  percentTrabalhavel,
  ocorrenciasPorTipo,
  OCORRENCIA_LABEL,
  type RdoRow,
  type EfetivoRow,
  type OcorrenciaRow,
} from "@/lib/rdo/metrics";
import { resumoMensalFechados, type RdoFechadoRow } from "@/lib/rdo/resumo-mensal";
import { resumoMensalToCsv, nomeArquivoResumo } from "@/lib/rdo/resumo-mensal-csv";
import { OnboardingHint } from "@/components/onboarding/OnboardingHint";
import { Kpi } from "@/components/common/Kpi";
import { DataTable } from "@/components/ui/data-table";
import { EmptyState } from "@/components/common/EmptyState";
import { PageLoading } from "@/components/common/PageLoading";
import type { ColumnDef } from "@tanstack/react-table";

type Obra = { id: string; nome: string };

export default function RdoConsolidado() {
  const today = new Date();
  const [obraId, setObraId] = useState<string>("todas");
  const [statusFilter, setStatusFilter] = useState<string>("todos");
  const [de, setDe] = useState<string>(format(subDays(today, 30), "yyyy-MM-dd"));
  const [ate, setAte] = useState<string>(format(today, "yyyy-MM-dd"));
  const [assinanteFilter, setAssinanteFilter] = useState<string>("todos");

  const obrasQuery = useObras();
  const obras = useMemo<Obra[]>(
    () => (obrasQuery.data ?? []).map((o) => ({ id: o.id, nome: o.nome })),
    [obrasQuery.data],
  );

  const { data, isLoading } = useQuery({
    queryKey: ["rdo-consol", obraId, statusFilter, de, ate],
    queryFn: async () => {
      let q = supabase
        .from("rdo")
        .select(
          "id, obra_id, data, status, trabalhavel_manha, trabalhavel_tarde, trabalhavel_noite, synced_at, numero_documental, fechado_em, fechado_por, assinado_em, assinado_por",
        )
        .gte("data", de)
        .lte("data", ate)
        .order("data", { ascending: false });
      if (obraId !== "todas") q = q.eq("obra_id", obraId);
      if (statusFilter !== "todos") q = q.eq("status", statusFilter);
      const { data: rdos, error } = await q;
      if (error) throw error;
      const rdoList = (rdos ?? []) as (RdoRow & {
        status: string;
        synced_at: string | null;
        numero_documental: string | null;
        fechado_em: string | null;
        fechado_por: string | null;
        assinado_em: string | null;
        assinado_por: string | null;
      })[];
      const ids = rdoList.map((r) => r.id);

      const [ef, oc] = await Promise.all([
        rdoEfetivoRepo.listPorRdos(ids),
        rdoOcorrenciasRepo.listPorRdos(ids),
      ]);

      return {
        rdos: rdoList,
        efetivo: (ef ?? []) as EfetivoRow[],
        ocorrencias: (oc ?? []) as OcorrenciaRow[],
      };
    },
  });

  const kpis = useMemo(() => {
    if (!data) return null;
    return {
      total: data.rdos.length,
      media: mediaEfetivo(data.rdos, data.efetivo),
      pct: percentTrabalhavel(data.rdos),
      top: ocorrenciasPorTipo(data.ocorrencias).slice(0, 3),
    };
  }, [data]);

  const obraNome = useMemo(() => {
    const m = new Map(obras.map((o) => [o.id, o.nome]));
    return (id: string) => m.get(id) ?? id.slice(0, 8);
  }, [obras]);

  const efetivoPorRdo = useMemo(() => {
    const m = new Map<string, number>();
    if (!data) return m;
    for (const e of data.efetivo) {
      if (!e.presente) continue;
      m.set(e.rdo_id, (m.get(e.rdo_id) ?? 0) + (e.quantidade ?? 0));
    }
    return m;
  }, [data]);

  const ocorrPorRdo = useMemo(() => {
    const m = new Map<string, number>();
    if (!data) return m;
    for (const o of data.ocorrencias) {
      m.set(o.rdo_id, (m.get(o.rdo_id) ?? 0) + 1);
    }
    return m;
  }, [data]);

  const resumoMensalTodos = useMemo(() => {
    if (!data) return [];
    return resumoMensalFechados(data.rdos as unknown as RdoFechadoRow[]);
  }, [data]);

  const assinantes = useMemo(() => {
    const set = new Set<string>();
    for (const l of resumoMensalTodos) set.add(l.assinado_por);
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [resumoMensalTodos]);

  const resumoMensal = useMemo(() => {
    if (assinanteFilter === "todos") return resumoMensalTodos;
    return resumoMensalTodos.filter((l) => l.assinado_por === assinanteFilter);
  }, [resumoMensalTodos, assinanteFilter]);

  const handleExportCsv = () => {
    const csv = resumoMensalToCsv(resumoMensal, { obraNome });
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = nomeArquivoResumo(de, ate);
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center gap-3">
        <ClipboardList className="h-7 w-7 text-primary" />
        <div>
          <h1 className="text-2xl font-semibold">RDO Consolidado</h1>
          <p className="text-sm text-muted-foreground">
            Visão multi-obra do diário de obra. A captura continua na aba RDO de cada obra
            (offline-first).
          </p>
        </div>
      </div>

      <OnboardingHint storageKey="rdo-consolidado.v1" title="Onde abrir o RDO do dia">
        Esta tela é apenas o consolidado. Para preencher o diário, abra a obra e vá em{" "}
        <strong>RDO</strong> — funciona offline e sincroniza quando voltar ao sinal.
      </OnboardingHint>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Filtros</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div>
            <Label className="text-xs">Obra</Label>
            <Select value={obraId} onValueChange={setObraId}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas as obras</SelectItem>
                {obras.map((o) => (
                  <SelectItem key={o.id} value={o.id}>
                    {o.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Status</Label>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="rascunho">Rascunho</SelectItem>
                <SelectItem value="sincronizado">Sincronizado</SelectItem>
                <SelectItem value="fechado">Fechado (assinado)</SelectItem>
              </SelectContent>
            </Select>
          </div>
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

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard label="RDOs no período" value={kpis ? String(kpis.total) : "—"} />
        <KpiCard label="Efetivo médio / dia" value={kpis ? kpis.media.toFixed(1) : "—"} />
        <KpiCard
          label="Turnos trabalháveis"
          value={kpis ? `${(kpis.pct * 100).toFixed(0)}%` : "—"}
        />
        <KpiCard
          label="Top ocorrência"
          value={
            kpis && kpis.top.length > 0
              ? `${OCORRENCIA_LABEL[kpis.top[0].tipo] ?? kpis.top[0].tipo} (${kpis.top[0].count})`
              : "—"
          }
        />
      </div>

      {kpis && kpis.top.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Ranking de ocorrências</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {kpis.top.map((t) => (
              <Badge key={t.tipo} variant="secondary">
                {OCORRENCIA_LABEL[t.tipo] ?? t.tipo}: <strong className="ml-1">{t.count}</strong>
              </Badge>
            ))}
          </CardContent>
        </Card>
      )}

      {resumoMensalTodos.length > 0 && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
            <CardTitle className="text-base">Resumo mensal de RDOs fechados</CardTitle>
            <div className="flex items-center gap-2">
              <Select value={assinanteFilter} onValueChange={setAssinanteFilter}>
                <SelectTrigger className="h-8 w-[200px] text-xs">
                  <SelectValue placeholder="Assinante" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos assinantes</SelectItem>
                  {assinantes.map((a) => (
                    <SelectItem key={a} value={a}>
                      {a}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportCsv}
                disabled={resumoMensal.length === 0}
              >
                <Download className="h-4 w-4 mr-1" />
                Exportar CSV
              </Button>
            </div>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            {resumoMensal.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nenhum RDO fechado para o assinante selecionado.
              </p>
            ) : (
              <div className="w-full overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-xs text-muted-foreground">
                    <tr className="border-b">
                      <th className="text-left py-2 pr-3">Mês</th>
                      <th className="text-left py-2 pr-3">Obra</th>
                      <th className="text-left py-2 pr-3">Assinado por</th>
                      <th className="text-right py-2 pr-3">Fechados</th>
                      <th className="text-left py-2 pr-3">Faixa Nº documental</th>
                    </tr>
                  </thead>
                  <tbody>
                    {resumoMensal.map((l) => (
                      <tr key={l.chave} className="border-b last:border-0">
                        <td className="py-2 pr-3 font-mono">{l.mes}</td>
                        <td className="py-2 pr-3">{obraNome(l.obra_id)}</td>
                        <td className="py-2 pr-3">{l.assinado_por}</td>
                        <td className="py-2 pr-3 text-right tabular-nums">{l.total}</td>
                        <td className="py-2 pr-3 font-mono text-xs">
                          {l.primeiro_numero && l.ultimo_numero
                            ? l.primeiro_numero === l.ultimo_numero
                              ? l.primeiro_numero
                              : `${l.primeiro_numero} → ${l.ultimo_numero}`
                            : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">RDOs</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <PageLoading />
          ) : (
            <DataTable
              columns={rdoColumns(obraNome, efetivoPorRdo, ocorrPorRdo)}
              data={data?.rdos ?? []}
              hideSearch
              pageSize={25}
              emptyState={<EmptyState title="Nenhum RDO no período selecionado." />}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function KpiCard({ label, value }: { label: string; value: string }) {
  return <Kpi label={label} value={value} size="lg" tabularNums={false} />;
}

function rdoColumns(
  obraNome: (id: string) => string,
  efetivoPorRdo: Map<string, number>,
  ocorrPorRdo: Map<string, number>,
): ColumnDef<RdoRow, any>[] {
  return [
    {
      accessorKey: "data",
      header: "Data",
      cell: ({ row }) => format(parseISO(row.original.data), "dd/MM/yyyy", { locale: ptBR }),
    },
    {
      accessorKey: "obra_id",
      header: "Obra",
      cell: ({ row }) => obraNome(row.original.obra_id),
    },
    {
      id: "status",
      header: "Status",
      cell: ({ row }) => {
        const r = row.original as unknown as {
          status: string;
          fechado_em: string | null;
          assinado_por: string | null;
        };
        const variant =
          r.status === "fechado"
            ? "default"
            : r.status === "sincronizado"
              ? "default"
              : "secondary";
        return (
          <div className="flex flex-col gap-0.5">
            <Badge variant={variant}>{r.status}</Badge>
            {r.fechado_em && (
              <span className="text-[10px] text-muted-foreground">
                {format(parseISO(r.fechado_em), "dd/MM/yy HH:mm", { locale: ptBR })}
                {r.assinado_por ? ` · ${r.assinado_por}` : ""}
              </span>
            )}
          </div>
        );
      },
    },
    {
      id: "numero_documental",
      header: "Nº documental",
      cell: ({ row }) => {
        const n = (row.original as unknown as { numero_documental: string | null })
          .numero_documental;
        return n ? (
          <span className="font-mono text-xs">{n}</span>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        );
      },
    },
    {
      id: "efetivo",
      header: "Efetivo",
      cell: ({ row }) => (
        <div className="text-right">{efetivoPorRdo.get(row.original.id) ?? 0}</div>
      ),
    },
    {
      id: "ocorrencias",
      header: "Ocorrências",
      cell: ({ row }) => <div className="text-right">{ocorrPorRdo.get(row.original.id) ?? 0}</div>,
    },
    {
      id: "turnos",
      header: "Turnos",
      cell: ({ row }) => {
        const r = row.original;
        const turnos = [r.trabalhavel_manha, r.trabalhavel_tarde, r.trabalhavel_noite].filter(
          Boolean,
        ).length;
        return `${turnos}/3`;
      },
    },
    {
      id: "acoes",
      header: "",
      enableSorting: false,
      cell: ({ row }) => (
        <Link
          to={`/obras/${row.original.obra_id}?tab=rdo`}
          className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
        >
          abrir <ExternalLink className="h-3 w-3" />
        </Link>
      ),
    },
  ];
}
