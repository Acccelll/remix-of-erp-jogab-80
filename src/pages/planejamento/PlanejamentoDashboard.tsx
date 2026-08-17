// Dashboard de Planejamento — visão multi-obra do portfólio.
//
// Substitui o painel de acompanhamento do Prevision: cada obra rodada pelo
// engine `calcularEVM`, ordenadas por pior desvio (menor min(SPI,CPI) no topo),
// com curva S consolidada (PV/EV/AC somados por mês) e cartões/tabela de KPIs.

import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
  ReferenceLine,
} from "@/components/ui/chart";
import { Database, AlertTriangle, TrendingUp } from "lucide-react";
import { brl } from "@/lib/billing";
import { cn } from "@/lib/utils";
import {
  calcularEVM,
  curvaPVMensal,
  classificarIndice,
  type EvmItemCrono,
  type FaixaIndice,
} from "@/lib/pmbok/evm";
import { construirAcReal } from "@/lib/pmbok/ac-totvs";
import type { FinLinha } from "@/lib/financeiro-totvs/agregacoes";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

function toneText(f: FaixaIndice) {
  if (f === "bom") return "text-success font-medium";
  if (f === "alerta") return "text-warning font-medium";
  return "text-destructive font-medium";
}

export default function PlanejamentoDashboard() {
  const { data, isLoading } = useQuery({
    queryKey: ["planejamento-dashboard"],
    queryFn: async () => {
      const obras = await supabase
        .from("vw_obra_dashboard")
        .select(
          "obra_id, codigo, nome, valor_contrato, status, data_previsao_termino, data_fim, cronograma_itens_total",
        )
        .neq("status", "cancelada")
        .gt("cronograma_itens_total", 0);
      if (obras.error) throw obras.error;

      const obraIds = (obras.data ?? [])
        .map((o) => o.obra_id)
        .filter((id): id is string => Boolean(id));
      if (obraIds.length === 0) {
        return { obras: [], crono: [], fin: [], medicoes: [] };
      }

      const [crono, fin, medicoes] = await Promise.all([
        supabase
          .from("cronograma_itens")
          .select(
            "id, obra_id, custo, custo_baseline, percentual_previsto, percentual_realizado, data_inicio, data_fim, data_inicio_baseline, data_fim_baseline, ativo",
          )
          .in("obra_id", obraIds),
        supabase
          .from("vw_financeiro_obra")
          .select("obra_id, grupo, valor_rateio, mes_competencia, status_cod")
          .in("obra_id", obraIds),
        supabase
          .from("medicoes")
          .select("id, obra_id, data_corte, valor, status")
          .in("obra_id", obraIds),
      ]);
      if (crono.error) throw crono.error;
      if (fin.error) throw fin.error;
      if (medicoes.error) throw medicoes.error;
      return {
        obras: (obras.data ?? [])
          .filter((o): o is typeof o & { obra_id: string } => Boolean(o.obra_id))
          .map((o) => ({
            id: o.obra_id,
            codigo: o.codigo,
            nome: o.nome,
            valor_contrato: o.valor_contrato,
            status: o.status,
            data_previsao_termino: o.data_previsao_termino,
            data_fim: o.data_fim,
          })),
        crono: crono.data ?? [],
        fin: (fin.data ?? []) as unknown as FinLinha[],
        medicoes: medicoes.data ?? [],
      };
    },
    staleTime: 60_000,
  });

  const [busca, setBusca] = useState("");
  const [ordenacao, setOrdenacao] = useState<"desvio" | "spi" | "cpi" | "vac" | "nome">("desvio");

  const linhas = useMemo(() => {
    if (!data) return [];
    const cronoByObra = new Map<string, any[]>();
    for (const c of data.crono) {
      const arr = cronoByObra.get(c.obra_id) ?? [];
      arr.push(c);
      cronoByObra.set(c.obra_id, arr);
    }
    const finByObra = new Map<string, FinLinha[]>();
    for (const l of data.fin) {
      if (!l.obra_id) continue;
      const arr = finByObra.get(l.obra_id) ?? [];
      arr.push(l);
      finByObra.set(l.obra_id, arr);
    }
    const medByObra = new Map<string, any[]>();
    for (const m of data.medicoes) {
      const arr = medByObra.get(m.obra_id) ?? [];
      arr.push(m);
      medByObra.set(m.obra_id, arr);
    }
    const dataRef = new Date();
    return data.obras
      .map((o) => {
        const cItens = cronoByObra.get(o.id) ?? [];
        if (!cItens.length) return null;
        const itens: EvmItemCrono[] = cItens.map((c) => ({
          custo: Number(c.custo ?? 0),
          custo_baseline: c.custo_baseline != null ? Number(c.custo_baseline) : null,
          percentual_previsto: Number(c.percentual_previsto ?? 0),
          percentual_realizado: Number(c.percentual_realizado ?? 0),
          data_inicio: c.data_inicio,
          data_fim: c.data_fim,
          data_inicio_baseline: c.data_inicio_baseline ?? null,
          data_fim_baseline: c.data_fim_baseline ?? null,
          ativo: c.ativo !== false,
        }));
        const acReal = construirAcReal(finByObra.get(o.id));
        const evm = calcularEVM({
          itens,
          dataRef,
          acReal,
          medicoesFallback: (medByObra.get(o.id) ?? []).map((m) => ({
            status: String(m.status),
            valor: Number(m.valor ?? 0),
          })),
        });
        return { obra: o, evm, itens, acReal, medicoes: medByObra.get(o.id) ?? [] };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);
  }, [data]);

  const filtradas = useMemo(() => {
    const q = busca.trim().toLowerCase();
    const arr = q
      ? linhas.filter((l) =>
          `${l.obra.codigo ?? ""} ${l.obra.nome ?? ""}`.toLowerCase().includes(q),
        )
      : [...linhas];
    arr.sort((a, b) => {
      if (ordenacao === "nome") return String(a.obra.nome).localeCompare(String(b.obra.nome));
      if (ordenacao === "spi") return (a.evm.SPI || 99) - (b.evm.SPI || 99);
      if (ordenacao === "cpi") return (a.evm.CPI || 99) - (b.evm.CPI || 99);
      if (ordenacao === "vac") return a.evm.VAC - b.evm.VAC;
      // desvio: pior min(SPI,CPI) primeiro (índices=0 vão para o fim)
      const ma = Math.min(a.evm.SPI || 99, a.evm.CPI || 99);
      const mb = Math.min(b.evm.SPI || 99, b.evm.CPI || 99);
      return ma - mb;
    });
    return arr;
  }, [linhas, busca, ordenacao]);

  // Curva S consolidada da carteira: PV via curvaPVMensal por obra, somados.
  const curvaCarteira = useMemo(() => {
    if (!filtradas.length) return [];
    const pvMes = new Map<string, number>();
    const evMes = new Map<string, number>();
    const acMes = new Map<string, number>();
    const dataRef = new Date();
    for (const l of filtradas) {
      const curva = curvaPVMensal(l.itens);
      // PV: incremental por mês (curva é acumulada → diferença)
      let prev = 0;
      for (const p of curva) {
        const inc = p.pvAcum - prev;
        prev = p.pvAcum;
        pvMes.set(p.mes, (pvMes.get(p.mes) ?? 0) + inc);
      }
      // EV: usa percentual_realizado de cada item alocado linearmente na duração
      // Simplificação: imputamos ao mês de data_fim (item dado por concluído lá);
      // suficiente para visão executiva.
      for (const it of l.itens) {
        const custo = Number(it.custo_baseline ?? it.custo ?? 0);
        const pctReal = Number(it.percentual_realizado ?? 0) / 100;
        if (!custo || !pctReal) continue;
        try {
          const key = format(parseISO(it.data_fim_baseline ?? it.data_fim), "yyyy-MM");
          evMes.set(key, (evMes.get(key) ?? 0) + custo * pctReal);
        } catch (err) { swallow("PlanejamentoDashboard.pvMes", err, "data baseline inválida"); }
      }
      // AC: TOTVS quando há; senão medições aprovadas por data_corte
      if (l.evm.fonteAC === "totvs") {
        for (const r of l.acReal.porMes) acMes.set(r.mes, (acMes.get(r.mes) ?? 0) + r.valor);
      } else {
        for (const m of l.medicoes) {
          if (!["aprovada", "faturada", "enviada"].includes(String(m.status))) continue;
          try {
            const key = format(parseISO(m.data_corte), "yyyy-MM");
            acMes.set(key, (acMes.get(key) ?? 0) + Number(m.valor ?? 0));
          } catch (err) { swallow("PlanejamentoDashboard.acMes", err, "data_corte inválida"); }
        }
      }
    }
    const todos = new Set<string>([...pvMes.keys(), ...evMes.keys(), ...acMes.keys()]);
    const mesesOrd = Array.from(todos).sort();
    let accPV = 0,
      accEV = 0,
      accAC = 0;
    const hojeKey = format(dataRef, "yyyy-MM");
    return mesesOrd.map((k) => {
      accPV += pvMes.get(k) ?? 0;
      accEV += evMes.get(k) ?? 0;
      accAC += acMes.get(k) ?? 0;
      const d = parseISO(k + "-01");
      return {
        mes: format(d, "MMM/yy", { locale: ptBR }),
        mesKey: k,
        pv: Math.round(accPV),
        ev: Math.round(accEV),
        ac: Math.round(accAC),
        isHoje: k === hojeKey,
      };
    });
  }, [filtradas]);

  const hojeMesLabel = curvaCarteira.find((x) => x.isHoje)?.mes;

  if (isLoading) {
    return (
      <div className="p-6 lg:p-8 space-y-6">
        <Skeleton className="h-8 w-72" />
        <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-lg" />
          ))}
        </div>
        <Skeleton className="h-72 rounded-lg" />
        <Skeleton className="h-96 rounded-lg" />
      </div>
    );
  }

  const totalBAC = filtradas.reduce((a, l) => a + l.evm.BAC, 0);
  const totalEAC = filtradas.reduce((a, l) => a + l.evm.EAC_cpi, 0);
  const totalVAC = filtradas.reduce((a, l) => a + l.evm.VAC, 0);
  const cpiAbaixo = filtradas.filter((l) => l.evm.CPI > 0 && l.evm.CPI < 1).length;
  const spiAbaixo = filtradas.filter((l) => l.evm.SPI > 0 && l.evm.SPI < 1).length;

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <header>
        <h1 className="text-2xl font-semibold flex items-center gap-2">
          <TrendingUp className="h-6 w-6 text-primary" /> Dashboard de Planejamento
        </h1>
        <p className="text-sm text-muted-foreground">
          Visão consolidada do portfólio — EVM por obra, curva S da carteira e ranking de desvios.
        </p>
      </header>

      <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
        <Kpi label="Obras avaliadas" v={String(filtradas.length)} />
        <Kpi label="BAC total" v={brl(totalBAC)} />
        <Kpi label="EAC total" v={brl(totalEAC)} tone={totalEAC > totalBAC ? "bad" : "good"} />
        <Kpi label="VAC total" v={brl(totalVAC)} tone={totalVAC >= 0 ? "good" : "bad"} />
        <Kpi label="Obras CPI < 1" v={String(cpiAbaixo)} tone={cpiAbaixo > 0 ? "warn" : "good"} />
        <Kpi label="Obras SPI < 1" v={String(spiAbaixo)} tone={spiAbaixo > 0 ? "warn" : "good"} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Curva S da carteira — PV × EV × AC</CardTitle>
        </CardHeader>
        <CardContent>
          {curvaCarteira.length === 0 ? (
            <div className="text-sm text-muted-foreground text-center py-8">
              Sem dados de cronograma para consolidar.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={320}>
              <AreaChart data={curvaCarteira} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(v: any) => brl(Number(v))} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                {hojeMesLabel && (
                  <ReferenceLine
                    x={hojeMesLabel}
                    stroke="#64748b"
                    strokeDasharray="2 4"
                    label={{ value: "hoje", fontSize: 10, position: "insideTopRight" }}
                  />
                )}
                <Area
                  type="monotone"
                  dataKey="pv"
                  name="PV (planejado)"
                  stroke="#3b82f6"
                  fill="#3b82f6"
                  fillOpacity={0.15}
                  strokeWidth={2}
                />
                <Area
                  type="monotone"
                  dataKey="ev"
                  name="EV (executado)"
                  stroke="#10b981"
                  fill="#10b981"
                  fillOpacity={0.15}
                  strokeWidth={2}
                />
                <Area
                  type="monotone"
                  dataKey="ac"
                  name="AC (real)"
                  stroke="#ef4444"
                  fill="#ef4444"
                  fillOpacity={0.1}
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Ranking por desvio</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Input
              placeholder="Buscar obra..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="max-w-xs h-9"
            />
            <Select value={ordenacao} onValueChange={(v: any) => setOrdenacao(v)}>
              <SelectTrigger className="w-56 h-9 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="desvio">Pior desvio (min SPI/CPI)</SelectItem>
                <SelectItem value="spi">Menor SPI</SelectItem>
                <SelectItem value="cpi">Menor CPI</SelectItem>
                <SelectItem value="vac">Menor VAC</SelectItem>
                <SelectItem value="nome">Nome (A→Z)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Obra</TableHead>
                  <TableHead className="text-right">BAC</TableHead>
                  <TableHead className="text-right">SPI</TableHead>
                  <TableHead className="text-right">CPI</TableHead>
                  <TableHead className="text-right">SV(t) (m)</TableHead>
                  <TableHead className="text-right">EAC</TableHead>
                  <TableHead className="text-right">VAC</TableHead>
                  <TableHead>AC</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtradas.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={8}
                      className="text-center text-sm text-muted-foreground py-8"
                    >
                      Nenhuma obra com cronograma.
                    </TableCell>
                  </TableRow>
                ) : (
                  filtradas.map(({ obra, evm }) => (
                    <TableRow key={obra.id}>
                      <TableCell>
                        <Link to={`/obras/${obra.id}?tab=analise`} className="hover:underline">
                          <span className="text-xs text-muted-foreground">{obra.codigo}</span> ·{" "}
                          {obra.nome}
                        </Link>
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-sm">
                        {brl(evm.BAC)}
                      </TableCell>
                      <TableCell
                        className={cn(
                          "text-right tabular-nums text-sm",
                          toneText(classificarIndice(evm.SPI)),
                        )}
                      >
                        {evm.SPI ? evm.SPI.toFixed(2) : "—"}
                      </TableCell>
                      <TableCell
                        className={cn(
                          "text-right tabular-nums text-sm",
                          toneText(classificarIndice(evm.CPI)),
                        )}
                      >
                        {evm.CPI ? evm.CPI.toFixed(2) : "—"}
                      </TableCell>
                      <TableCell
                        className={cn(
                          "text-right tabular-nums text-sm",
                          evm.SVt_meses >= 0 ? "text-success" : "text-destructive",
                        )}
                      >
                        {evm.SVt_meses.toFixed(1)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-sm">
                        {brl(evm.EAC_cpi)}
                      </TableCell>
                      <TableCell
                        className={cn(
                          "text-right tabular-nums text-sm font-medium",
                          evm.VAC >= 0 ? "text-success" : "text-destructive",
                        )}
                      >
                        {brl(evm.VAC)}
                      </TableCell>
                      <TableCell>
                        {evm.fonteAC === "totvs" ? (
                          <Badge variant="outline" className="gap-1 text-[10px]">
                            <Database className="h-3 w-3" /> real
                          </Badge>
                        ) : (
                          <Badge
                            variant="outline"
                            className="gap-1 text-[10px] border-warning/40 text-warning"
                          >
                            <AlertTriangle className="h-3 w-3" /> estimado
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

import { Kpi as KpiBase, type KpiTone } from "@/components/common/Kpi";
import { swallow } from "@/lib/core/errors";
function Kpi({ label, v, tone }: { label: string; v: string; tone?: "good" | "bad" | "warn" }) {
  const kpiTone: KpiTone =
    tone === "good" ? "success" : tone === "bad" ? "danger" : tone === "warn" ? "warning" : "default";
  return <KpiBase label={label} value={v} tone={kpiTone} labelUppercase />;
}
