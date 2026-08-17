import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "@/components/ui/chart";
import { addMonths, format, startOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { brl } from "@/lib/billing";

import {
  STATUS_OBRA_LABEL as STATUS_LABELS,
  STATUS_OBRA_COLOR as STATUS_COLORS,
} from "@/lib/status";

const BMS_FECHADA = new Set(["fechada", "faturada", "paga", "cancelada"]);
const bmsAberta = (b: any) => !BMS_FECHADA.has(String(b.status));

export function PortfolioOverview({
  obras,
  recebimentos,
  nfs,
  bms = [],
}: {
  obras: any[];
  recebimentos: any[];
  nfs: any[];
  bms?: any[];
}) {
  const statusDist = useMemo(() => {
    const map = new Map<string, { count: number; valor: number }>();
    for (const o of obras) {
      const s = o.status ?? "em_andamento";
      const cur = map.get(s) ?? { count: 0, valor: 0 };
      cur.count += 1;
      cur.valor += Number(o.valor_contrato || 0);
      map.set(s, cur);
    }
    return [...map.entries()].map(([k, v]) => ({ status: STATUS_LABELS[k] ?? k, key: k, ...v }));
  }, [obras]);

  const projecao = useMemo(() => {
    const base = startOfMonth(new Date());
    const obrasComBms = new Set(bms.map((b: any) => b.obra_id));
    const meses: { mes: string; previsto: number; recebido: number }[] = [];
    for (let i = 0; i < 12; i++) {
      const ini = addMonths(base, i);
      const fim = addMonths(base, i + 1);
      // Previsto: BMS abertas (fonte nova) + recebimentos legados de obras sem BMS
      const previstoBms = bms
        .filter(
          (b: any) =>
            bmsAberta(b) &&
            b.data_pagamento_prevista &&
            new Date(b.data_pagamento_prevista) >= ini &&
            new Date(b.data_pagamento_prevista) < fim,
        )
        .reduce((a: number, b: any) => a + Number(b.valor_previsto_dinamico || 0), 0);
      const previstoLegado = recebimentos
        .filter(
          (r) =>
            !obrasComBms.has(r.obra_id) &&
            !r.data_recebimento &&
            new Date(r.data_prevista) >= ini &&
            new Date(r.data_prevista) < fim,
        )
        .reduce((a, r) => a + Number(r.valor_previsto || 0), 0);
      const previsto = previstoBms + previstoLegado;
      const recebido = recebimentos
        .filter(
          (r) =>
            r.data_recebimento &&
            new Date(r.data_recebimento) >= ini &&
            new Date(r.data_recebimento) < fim,
        )
        .reduce((a, r) => a + Number(r.valor_recebido || r.valor_previsto || 0), 0);
      meses.push({ mes: format(ini, "MMM/yy", { locale: ptBR }), previsto, recebido });
    }
    return meses;
  }, [recebimentos, bms]);

  const topObras = useMemo(() => {
    const fatMap = new Map<string, number>();
    for (const n of nfs) fatMap.set(n.obra_id, (fatMap.get(n.obra_id) ?? 0) + Number(n.valor || 0));
    return [...obras]
      .map((o) => ({
        ...o,
        faturado: fatMap.get(o.id) ?? 0,
        pct: o.valor_contrato ? ((fatMap.get(o.id) ?? 0) / Number(o.valor_contrato)) * 100 : 0,
      }))
      .sort((a, b) => Number(b.valor_contrato || 0) - Number(a.valor_contrato || 0))
      .slice(0, 5);
  }, [obras, nfs]);

  if (obras.length === 0) return null;

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Distribuição por status</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie
                data={statusDist}
                dataKey="valor"
                nameKey="status"
                outerRadius={80}
                label={(d: any) => d.status}
              >
                {statusDist.map((d) => (
                  <Cell key={d.key} fill={STATUS_COLORS[d.key] ?? "#64748b"} />
                ))}
              </Pie>
              <Tooltip formatter={(v: any) => brl(Number(v))} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Top 5 obras por valor</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-3 text-sm">
            {topObras.map((o) => (
              <li key={o.id}>
                <div className="flex justify-between mb-1">
                  <span className="font-medium truncate pr-2">
                    {o.codigo} · {o.nome}
                  </span>
                  <span className="text-muted-foreground tabular-nums">{o.pct.toFixed(0)}%</span>
                </div>
                <div className="h-2 bg-muted rounded overflow-hidden">
                  <div
                    className="h-full bg-primary"
                    style={{ width: `${Math.min(100, o.pct)}%` }}
                  />
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  {brl(o.faturado)} / {brl(o.valor_contrato)}
                </div>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle className="text-base">Projeção financeira — próximos 12 meses</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={projecao}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--muted-foreground) / 0.2)" />
              <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
              <YAxis
                tick={{ fontSize: 11 }}
                tickFormatter={(v) => brl(Number(v)).replace("R$", "").trim()}
              />
              <Tooltip formatter={(v: any) => brl(Number(v))} />
              <Legend />
              <Bar dataKey="previsto" name="Previsto" fill="#3b82f6" />
              <Bar dataKey="recebido" name="Recebido" fill="#16a34a" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
