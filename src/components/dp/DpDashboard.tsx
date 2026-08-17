import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LineChart,
  Line,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { fetchAllHolerites } from "@/lib/repositories/dpHolerite";
import { brl } from "@/lib/billing";
import { Skeleton } from "@/components/ui/skeleton";

export function DpDashboard() {
  const { data: holerites, isLoading } = useQuery({
    queryKey: ["dp-holerites-consolidado"],
    queryFn: fetchAllHolerites,
  });

  const stats = useMemo(() => {
    if (!holerites || holerites.length === 0) return null;

    const porMes = new Map<
      string,
      { liquido: number; proventos: number; adiantamento: number; total: number; count: number }
    >();

    holerites.forEach((h) => {
      const mes = h.competencia; // YYYY-MM
      if (!porMes.has(mes)) {
        porMes.set(mes, { liquido: 0, proventos: 0, adiantamento: 0, total: 0, count: 0 });
      }
      const acc = porMes.get(mes)!;
      acc.liquido += h.liquido;
      acc.proventos += h.proventos;
      if (h.tipo === "adiantamento") {
        acc.adiantamento += h.liquido;
      }
      acc.total += h.custo_total;
      acc.count += 1;
    });

    const chartData = Array.from(porMes.entries())
      .map(([mes, values]) => ({
        mes,
        liquido: values.liquido,
        salario: values.proventos,
        adiantamento: values.adiantamento,
        custoTotal: values.total,
        mediaLiquido: values.liquido / (values.count || 1),
      }))
      .sort((a, b) => a.mes.localeCompare(b.mes));

    const ultimosMeses = chartData.slice(-12);

    return {
      chartData: ultimosMeses,
      totalColaboradores: new Set(holerites.map((h) => h.cpf)).size,
      custoMedioMensal:
        ultimosMeses.length > 0
          ? ultimosMeses.reduce((acc, curr) => acc + curr.custoTotal, 0) / ultimosMeses.length
          : 0,
    };
  }, [holerites]);

  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-32 w-full" />
        ))}
      </div>
    );
  }

  if (!stats) return null;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground uppercase">
              Custo Médio Mensal (FOPAG)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{brl(stats.custoMedioMensal)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground uppercase">
              Total Colaboradores Ativos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalColaboradores}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground uppercase">
              Média Líquido Pago
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {brl(stats.chartData[stats.chartData.length - 1]?.mediaLiquido ?? 0)}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Evolução de Pagamentos (Mês a Mês)</CardTitle>
          </CardHeader>
          <CardContent className="h-[350px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="mes" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(value) => `R$ ${value / 1000}k`}
                />
                <Tooltip
                  formatter={(value: number) => brl(value)}
                  contentStyle={{
                    borderRadius: "8px",
                    border: "none",
                    boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
                  }}
                />
                <Legend />
                <Bar
                  dataKey="liquido"
                  name="Líquido Total"
                  fill="hsl(var(--primary))"
                  radius={[4, 4, 0, 0]}
                />
                <Bar
                  dataKey="adiantamento"
                  name="Adiantamento"
                  fill="hsl(var(--warning))"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Custo Total Empresa</CardTitle>
          </CardHeader>
          <CardContent className="h-[350px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={stats.chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="mes" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(value) => `R$ ${value / 1000}k`}
                />
                <Tooltip
                  formatter={(value: number) => brl(value)}
                  contentStyle={{
                    borderRadius: "8px",
                    border: "none",
                    boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
                  }}
                />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="custoTotal"
                  name="Custo Total (FOPAG + Encargos)"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  dot={{ r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
