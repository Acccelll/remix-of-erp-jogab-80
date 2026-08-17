import { useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Label as ChartLabel,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "@/components/ui/chart";
import { AlertTriangle, Calendar, PieChart as PieIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { brl } from "@/lib/billing";
import { fmtCurtoBRL } from "@/lib/core/money";
import { fmtData } from "@/lib/utils";
import type { PontoSerieTemporal } from "@/lib/financeiro-totvs/evolucao";

interface PontoHistorico {
  label: string;
  data: string;
  valor_vencido: number;
  valor_a_vencer: number;
  total: number;
}

export function prepararHistorico(serie: PontoSerieTemporal[]): PontoHistorico[] {
  return [...serie]
    .sort((a, b) => String(a.data).localeCompare(String(b.data)))
    .map((p) => ({
      label: fmtData(p.data),
      data: p.data,
      valor_vencido: p.valor_vencido,
      valor_a_vencer: p.valor_a_vencer,
      total: p.valor_vencido + p.valor_a_vencer,
    }));
}

function KpiTop({
  icon,
  label,
  valor,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  valor: number;
  tone: "danger" | "info" | "neutral";
}) {
  const toneCls =
    tone === "danger"
      ? "border-destructive/40 bg-destructive/5"
      : tone === "info"
        ? "border-primary/40 bg-primary/5"
        : "border-muted-foreground/30 bg-muted/40";
  const iconCls =
    tone === "danger"
      ? "text-destructive"
      : tone === "info"
        ? "text-primary"
        : "text-muted-foreground";
  const valorCls =
    tone === "danger"
      ? "text-destructive"
      : tone === "info"
        ? "text-primary"
        : "text-foreground";
  return (
    <div className={`flex items-center gap-3 rounded-lg border-2 px-4 py-3 ${toneCls}`}>
      <div
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-background ${iconCls}`}
      >
        {icon}
      </div>
      <div className="min-w-0">
        <div className={`text-xs font-medium ${iconCls}`}>{label}</div>
        <div className={`text-xl font-bold tabular-nums ${valorCls}`}>{fmtCurtoBRL(valor)}</div>
      </div>
    </div>
  );
}

export function EvolucaoEndividamentoCard({ serie }: { serie: PontoSerieTemporal[] }) {
  const historico = useMemo(() => prepararHistorico(serie), [serie]);
  const ultimo = historico[historico.length - 1];
  const totalVencido = ultimo?.valor_vencido ?? 0;
  const totalAVencer = ultimo?.valor_a_vencer ?? 0;
  const totalEndiv = totalVencido + totalAVencer;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Evolução do Endividamento</CardTitle>
        <p className="text-xs text-muted-foreground">
          Vencido × A Vencer — uma posição para cada data de referência importada.
          {ultimo && <> Referência: <strong>{fmtData(ultimo.data)}</strong>.</>}
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <KpiTop
            icon={<AlertTriangle className="h-5 w-5" />}
            label="Total Vencido"
            valor={totalVencido}
            tone="danger"
          />
          <KpiTop
            icon={<Calendar className="h-5 w-5" />}
            label="Total a Vencer"
            valor={totalAVencer}
            tone="info"
          />
          <KpiTop
            icon={<PieIcon className="h-5 w-5" />}
            label="Endividamento Total"
            valor={totalEndiv}
            tone="neutral"
          />
        </div>

        {historico.length === 0 ? (
          <div className="text-sm text-muted-foreground py-8 text-center">
            Sem snapshots suficientes para montar o histórico mensal.
          </div>
        ) : (
          <div className="h-[420px]">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart
                data={historico}
                margin={{ top: 24, right: 24, left: 8, bottom: 8 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="label" stroke="hsl(var(--muted-foreground))" />
                <YAxis
                  stroke="hsl(var(--muted-foreground))"
                  tickFormatter={(v) => fmtCurtoBRL(Number(v))}
                  width={72}
                >
                  <ChartLabel
                    value="R$"
                    position="insideTopLeft"
                    offset={-6}
                    style={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                  />
                </YAxis>
                <Tooltip
                  formatter={(v, name) => [brl(Number(v)), String(name)]}
                  labelFormatter={(x, payload) => {
                    const p = payload?.[0]?.payload as PontoHistorico | undefined;
                    return p ? `Referência: ${fmtData(p.data)}` : String(x);
                  }}
                  contentStyle={{
                    background: "hsl(var(--popover))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: 8,
                  }}
                />
                <Legend />
                <Bar
                  dataKey="valor_vencido"
                  name="Endividamento Vencido"
                  stackId="endiv"
                  fill="hsl(var(--destructive))"
                  radius={[0, 0, 0, 0]}
                />
                <Bar
                  dataKey="valor_a_vencer"
                  name="Endividamento a Vencer"
                  stackId="endiv"
                  fill="hsl(var(--primary))"
                  radius={[6, 6, 0, 0]}
                />
                <Line
                  type="monotone"
                  dataKey="valor_a_vencer"
                  name="A Vencer (linha)"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                />
                <Line
                  type="monotone"
                  dataKey="total"
                  name="Endividamento Total (linha)"
                  stroke="hsl(var(--muted-foreground))"
                  strokeWidth={2}
                  strokeDasharray="4 4"
                  dot={{ r: 3 }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Compat: barchart não usado, mantido para evitar tree-shake reclamando em algumas builds.
void BarChart;