import { useMemo, useState } from "react";
import {
  ComposedChart,
  Line,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
  ReferenceLine,
} from "@/components/ui/chart";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { brl } from "@/lib/billing";
import { format, parseISO } from "date-fns";
import { LineChart as LineChartIcon, BarChart3 } from "lucide-react";

const COLOR_PREVISTO = "#2563eb";
const COLOR_REALIZADO = "#16a34a";

type Props = {
  bmsPrev: any[];
  nfs: any[];
  medicoes?: any[];
  valorContrato: number;
};

function realizadoDe(
  bms: any,
  nfs: any[],
  medicoes: any[],
): { valor: number; origem: "nf" | "medicao" | null } {
  if (bms?.nota_fiscal_id) {
    const nf = nfs.find((n) => n.id === bms.nota_fiscal_id);
    if (nf && nf.status !== "cancelada") {
      return { valor: Number(nf.valor_liquido ?? nf.valor ?? 0), origem: "nf" };
    }
  }
  if (bms?.medicao_id) {
    const med = medicoes.find((m) => m.id === bms.medicao_id);
    if (med) return { valor: Number(med.valor || 0), origem: "medicao" };
  }
  return { valor: 0, origem: null };
}

export function PrevistoRealizadoCard({ bmsPrev, nfs, medicoes, valorContrato }: Props) {
  const [modo, setModo] = useState<"acumulado" | "por_bms">("acumulado");

  const { data, kpis, idxAtual } = useMemo(() => {
    const ordenadas = [...(bmsPrev ?? [])].sort((a, b) => {
      const da = a.data_corte ? +parseISO(a.data_corte) : 0;
      const db = b.data_corte ? +parseISO(b.data_corte) : 0;
      if (da !== db) return da - db;
      return Number(a.numero) - Number(b.numero);
    });

    const hoje = new Date();
    let accPrev = 0;
    let accReal = 0;
    let realizadoUltimo = 0;
    let previstoAteHoje = 0;
    let realizadoTotal = 0;
    let idxAtualLocal = -1;

    const rows = ordenadas.map((b, i) => {
      const previsto = Number(b.valor_previsto_inicial ?? b.valor_previsto_dinamico ?? 0);
      const { valor: realizado, origem } = realizadoDe(b, nfs, medicoes ?? []);
      const temReal = origem !== null && realizado > 0;
      accPrev += previsto;
      if (temReal) {
        accReal += realizado;
        realizadoUltimo = accReal;
        realizadoTotal += realizado;
      }
      const corte = b.data_corte ? parseISO(b.data_corte) : null;
      if (corte && corte <= hoje) previstoAteHoje = accPrev;
      if (idxAtualLocal === -1 && corte && corte >= hoje) idxAtualLocal = i;

      return {
        label: Number(b.numero) === 0 ? "Antec." : `${b.numero}`,
        sublabel: corte ? format(corte, "dd/MM/yy") : "",
        previsto,
        realizado: temReal ? realizado : 0,
        prevAcum: accPrev,
        realAcum: temReal ? accReal : realizadoUltimo,
        temReal,
      };
    });

    const delta = realizadoTotal - previstoAteHoje;
    const deltaPct = previstoAteHoje > 0 ? (delta / previstoAteHoje) * 100 : 0;
    const pctExecutado = valorContrato > 0 ? (realizadoTotal / valorContrato) * 100 : 0;

    return {
      data: rows,
      kpis: {
        previstoAteHoje,
        realizadoTotal,
        delta,
        deltaPct,
        pctExecutado,
      },
      idxAtual: idxAtualLocal,
    };
  }, [bmsPrev, nfs, medicoes, valorContrato]);

  if (!data.length) return null;

  const deltaTone =
    Math.abs(kpis.delta) < 0.5
      ? "text-foreground"
      : kpis.delta >= 0
        ? "text-[color:var(--success)]"
        : "text-destructive";

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 flex-wrap">
        <div>
          <CardTitle>Previsto × Realizado</CardTitle>
          <p className="text-xs text-muted-foreground mt-1">
            Realizado = NF emitida vinculada à BMS (ou valor da medição quando ainda não houver NF)
          </p>
        </div>
        <div className="flex items-center gap-1 rounded-md border p-0.5">
          <Button
            size="sm"
            variant={modo === "acumulado" ? "default" : "ghost"}
            className="h-7 px-2"
            onClick={() => setModo("acumulado")}
          >
            <LineChartIcon className="h-3.5 w-3.5 mr-1" /> Curva S
          </Button>
          <Button
            size="sm"
            variant={modo === "por_bms" ? "default" : "ghost"}
            className="h-7 px-2"
            onClick={() => setModo("por_bms")}
          >
            <BarChart3 className="h-3.5 w-3.5 mr-1" /> Por BMS
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <Kpi label="Previsto até hoje" value={brl(kpis.previstoAteHoje)} />
          <Kpi label="Realizado" value={brl(kpis.realizadoTotal)} />
          <Kpi
            label="Δ R$"
            value={`${kpis.delta >= 0 ? "+" : ""}${brl(kpis.delta)}`}
            tone={deltaTone}
          />
          <Kpi
            label="Δ %"
            value={`${kpis.deltaPct >= 0 ? "+" : ""}${kpis.deltaPct.toFixed(1)}%`}
            tone={deltaTone}
          />
          <Kpi label="% executado" value={`${kpis.pctExecutado.toFixed(1)}%`} />
        </div>

        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data} margin={{ top: 8, right: 16, bottom: 8, left: 8 }}>
              <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 11 }}
                tickFormatter={(_, i) => `${data[i]?.label}`}
              />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => brl(Number(v))} width={90} />
              <Tooltip
                formatter={(v: any, name: any) => [brl(Number(v)), name as string]}
                labelFormatter={(label, payload) => {
                  const p = payload?.[0]?.payload;
                  return p ? `BMS ${p.label} · ${p.sublabel}` : String(label);
                }}
                contentStyle={{
                  background: "var(--popover)",
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                  fontSize: 12,
                }}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              {idxAtual >= 0 && (
                <ReferenceLine
                  x={data[idxAtual]?.label}
                  stroke="#94a3b8"
                  strokeDasharray="2 4"
                  label={{ value: "hoje", fontSize: 10, fill: "#94a3b8" }}
                />
              )}
              {modo === "acumulado" ? (
                <>
                  <Line
                    type="monotone"
                    dataKey="prevAcum"
                    name="Previsto acumulado"
                    stroke={COLOR_PREVISTO}
                    strokeWidth={2}
                    dot={{ r: 3, fill: COLOR_PREVISTO }}
                  />
                  <Line
                    type="monotone"
                    dataKey="realAcum"
                    name="Realizado acumulado"
                    stroke={COLOR_REALIZADO}
                    strokeWidth={2}
                    strokeDasharray="4 4"
                    dot={{ r: 3, fill: COLOR_REALIZADO }}
                  />
                </>
              ) : (
                <>
                  <Bar
                    dataKey="previsto"
                    name="Previsto"
                    fill={COLOR_PREVISTO}
                    radius={[3, 3, 0, 0]}
                  />
                  <Bar
                    dataKey="realizado"
                    name="Realizado"
                    fill={COLOR_REALIZADO}
                    radius={[3, 3, 0, 0]}
                  />
                </>
              )}
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

function Kpi({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-md border bg-card p-2">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={`text-sm font-medium num mt-0.5 ${tone ?? ""}`}>{value}</div>
    </div>
  );
}
