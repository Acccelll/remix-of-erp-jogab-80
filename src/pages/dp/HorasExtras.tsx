// Horas Extras — eficiência operacional.
import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertTriangle, FileSpreadsheet } from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "@/components/ui/chart";
import ImportHoleriteDialog from "@/components/dp/ImportHoleriteDialog";
import DpFilterBar, { formatCompetencia, type DpFilters } from "@/components/dp/DpFilterBar";
import { useDpHolerites, applyFilters, defaultFilters } from "@/hooks/dp/useDpHolerites";
import { formatBRLFromNumber } from "@/lib/core/currency";
import { useTableSort } from "@/hooks/useTableSort";
import { SortHeader } from "@/components/ui/sort-header";
import { DSR_HE_CODIGOS, LIMITE_HE_FOLHA_PCT } from "@/lib/dp/codigos";
import { Kpi as KpiCard } from "@/components/common/Kpi";
import { QueryState } from "@/components/common/QueryState";

export default function HorasExtras() {
  const { rows, loading, competencias, obras, cargos } = useDpHolerites();
  const [filters, setFilters] = useState<DpFilters | null>(null);
  const effective = filters ?? defaultFilters(competencias);
  const filtered = useMemo(() => applyFilters(rows, effective), [rows, effective]);

  const cards = useMemo(() => {
    const totalHE = filtered.reduce((s, r) => s + r.horas_extras_valor, 0);
    const folha = filtered.reduce((s, r) => s + r.proventos, 0);
    const dsr = filtered.reduce(
      (s, r) =>
        s + r.verbas.filter((v) => DSR_HE_CODIGOS.has(v.codigo)).reduce((a, v) => a + v.valor, 0),
      0,
    );
    const colabsComHE = filtered.filter((r) => r.horas_extras_valor > 0).length;
    return { totalHE, folha, dsr, colabsComHE, pct: folha ? (totalHE / folha) * 100 : 0 };
  }, [filtered]);

  const serie = useMemo(() => {
    const scope = rows.filter((r) => {
      if (effective.obra && r.obraResolvida !== effective.obra) return false;
      if (effective.cargo && r.cargo_lido !== effective.cargo) return false;
      return true;
    });
    const m = new Map<string, number>();
    scope.forEach((r) => m.set(r.competencia, (m.get(r.competencia) || 0) + r.horas_extras_valor));
    return Array.from(m.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([c, v]) => ({ competencia: formatCompetencia(c), valor: v }));
  }, [rows, effective.obra, effective.cargo]);

  const topColabs = useMemo(() => {
    return [...filtered]
      .filter((r) => r.horas_extras_valor > 0)
      .sort((a, b) => b.horas_extras_valor - a.horas_extras_valor)
      .slice(0, 5);
  }, [filtered]);

  type ColabK = "nome" | "cargo" | "obra" | "he";
  const colabSort = useTableSort(
    topColabs,
    (r, k: ColabK) => {
      if (k === "nome") return r.nome_lido || "";
      if (k === "cargo") return r.cargo_lido || "";
      if (k === "obra") return r.obraResolvida || "";
      return r.horas_extras_valor;
    },
    "he",
    "desc",
  );

  const topCargos = useMemo(() => {
    const m = new Map<string, { cargo: string; n: number; total: number; medio: number }>();
    filtered.forEach((r) => {
      if (r.horas_extras_valor <= 0) return;
      const k = r.cargo_lido || "—";
      const cur = m.get(k) || { cargo: k, n: 0, total: 0, medio: 0 };
      cur.n += 1;
      cur.total += r.horas_extras_valor;
      m.set(k, cur);
    });
    return Array.from(m.values())
      .map((c) => ({ ...c, medio: c.n ? c.total / c.n : 0 }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);
  }, [filtered]);

  type CargoK = "cargo" | "n" | "total" | "medio";
  const cargoSort = useTableSort(topCargos, (r, k: CargoK) => (r as any)[k], "total", "desc");

  const obrasAlerta = useMemo(() => {
    const m = new Map<string, { he: number; folha: number }>();
    filtered.forEach((r) => {
      const k = r.obraResolvida || "—";
      const cur = m.get(k) || { he: 0, folha: 0 };
      cur.he += r.horas_extras_valor;
      cur.folha += r.proventos;
      m.set(k, cur);
    });
    return Array.from(m.entries())
      .map(([obra, v]) => ({ obra, pct: v.folha ? (v.he / v.folha) * 100 : 0 }))
      .filter((x) => x.pct > LIMITE_HE_FOLHA_PCT);
  }, [filtered]);

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Horas Extras</h1>
          <p className="text-sm text-muted-foreground">
            Custo e tendência de horas extras — indica gargalos de cronograma e equipes
            subdimensionadas.
          </p>
        </div>
        <ImportHoleriteDialog />
      </div>

      <DpFilterBar
        filters={effective}
        setFilters={setFilters}
        competencias={competencias}
        obras={obras}
        cargos={cargos}
      />

      <QueryState
        isLoading={loading}
        data={rows}
        isEmpty={(r) => r.length === 0}
        empty={
          <Card>
            <CardContent className="py-12 flex flex-col items-center text-center gap-3">
              <FileSpreadsheet className="h-12 w-12 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                Importe o Holerite para visualizar as horas extras.
              </p>
              <ImportHoleriteDialog />
            </CardContent>
          </Card>
        }
      >
        {() => null}
      </QueryState>

      {!loading && rows.length > 0 && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <Card className="md:col-span-2 bg-primary/5 border-primary/30">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">
                  Total em Horas Extras no mês
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-primary">
                  {formatBRLFromNumber(cards.totalHE)}
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  {cards.pct.toFixed(1)}% sobre o total da folha · {cards.colabsComHE}{" "}
                  colaborador(es) com HE
                </div>
              </CardContent>
            </Card>
            <KpiCard label="Custo DSR (250 + 854)" value={formatBRLFromNumber(cards.dsr)} />
            <KpiCard label="Folha total (proventos)" value={formatBRLFromNumber(cards.folha)} />
          </div>

          {obrasAlerta.length > 0 && (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Obras com HE acima de {LIMITE_HE_FOLHA_PCT}% da folha</AlertTitle>
              <AlertDescription>
                <ul className="list-disc pl-5 text-sm">
                  {obrasAlerta.map((o) => (
                    <li key={o.obra}>
                      {o.obra} — <strong>{o.pct.toFixed(1)}%</strong>
                    </li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Tendência de horas extras</CardTitle>
            </CardHeader>
            <CardContent className="h-72">
              <ResponsiveContainer>
                <LineChart data={serie}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="competencia" />
                  <YAxis tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={(v: number) => formatBRLFromNumber(v)} />
                  <Line
                    type="monotone"
                    dataKey="valor"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                    name="HE no mês"
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Top 5 colaboradores</CardTitle>
              </CardHeader>
              <CardContent className="overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <SortHeader
                        sortKey="nome"
                        currentKey={colabSort.sortKey}
                        dir={colabSort.sortDir}
                        onToggle={colabSort.toggle}
                      >
                        Nome
                      </SortHeader>
                      <SortHeader
                        sortKey="cargo"
                        currentKey={colabSort.sortKey}
                        dir={colabSort.sortDir}
                        onToggle={colabSort.toggle}
                      >
                        Cargo
                      </SortHeader>
                      <SortHeader
                        sortKey="obra"
                        currentKey={colabSort.sortKey}
                        dir={colabSort.sortDir}
                        onToggle={colabSort.toggle}
                      >
                        Obra
                      </SortHeader>
                      <SortHeader
                        sortKey="he"
                        align="right"
                        currentKey={colabSort.sortKey}
                        dir={colabSort.sortDir}
                        onToggle={colabSort.toggle}
                      >
                        Valor HE
                      </SortHeader>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {colabSort.sorted.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell className="font-medium">{r.nome_lido}</TableCell>
                        <TableCell className="text-xs">{r.cargo_lido}</TableCell>
                        <TableCell className="text-xs">{r.obraResolvida}</TableCell>
                        <TableCell className="text-right font-semibold">
                          {formatBRLFromNumber(r.horas_extras_valor)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Top 5 cargos</CardTitle>
              </CardHeader>
              <CardContent className="overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <SortHeader
                        sortKey="cargo"
                        currentKey={cargoSort.sortKey}
                        dir={cargoSort.sortDir}
                        onToggle={cargoSort.toggle}
                      >
                        Cargo
                      </SortHeader>
                      <SortHeader
                        sortKey="n"
                        align="right"
                        currentKey={cargoSort.sortKey}
                        dir={cargoSort.sortDir}
                        onToggle={cargoSort.toggle}
                      >
                        Pessoas c/ HE
                      </SortHeader>
                      <SortHeader
                        sortKey="total"
                        align="right"
                        currentKey={cargoSort.sortKey}
                        dir={cargoSort.sortDir}
                        onToggle={cargoSort.toggle}
                      >
                        Total HE
                      </SortHeader>
                      <SortHeader
                        sortKey="medio"
                        align="right"
                        currentKey={cargoSort.sortKey}
                        dir={cargoSort.sortDir}
                        onToggle={cargoSort.toggle}
                      >
                        Médio
                      </SortHeader>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {cargoSort.sorted.map((c) => (
                      <TableRow key={c.cargo}>
                        <TableCell className="font-medium">{c.cargo}</TableCell>
                        <TableCell className="text-right">{c.n}</TableCell>
                        <TableCell className="text-right">{formatBRLFromNumber(c.total)}</TableCell>
                        <TableCell className="text-right">{formatBRLFromNumber(c.medio)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}

