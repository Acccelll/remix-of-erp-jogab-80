// Histórico Salarial — evolução do salário base por colaborador e média da empresa.
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
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "@/components/ui/chart";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import ImportHoleriteDialog from "@/components/dp/ImportHoleriteDialog";
import { useDpHolerites } from "@/hooks/dp/useDpHolerites";
import { formatBRLFromNumber } from "@/lib/core/currency";
import { formatCompetencia } from "@/components/dp/DpFilterBar";
import { FileSpreadsheet, TrendingUp, TrendingDown } from "lucide-react";
import { QueryState } from "@/components/common/QueryState";

export default function HistoricoSalarial() {
  const { rows, loading } = useDpHolerites();
  const [cpfSel, setCpfSel] = useState<string>("");

  const colabs = useMemo(() => {
    const m = new Map<string, string>();
    rows.forEach((r) => {
      if (r.salario_base > 0) m.set(r.cpf, r.nome_lido || r.cpf);
    });
    return Array.from(m.entries())
      .map(([cpf, nome]) => ({ cpf, nome }))
      .sort((a, b) => a.nome.localeCompare(b.nome));
  }, [rows]);

  const historico = useMemo(() => {
    if (!cpfSel) return [];
    return rows
      .filter((r) => r.cpf === cpfSel && r.salario_base > 0)
      .sort((a, b) => a.competencia.localeCompare(b.competencia))
      .map((r) => ({
        competencia: r.competencia,
        label: formatCompetencia(r.competencia),
        salario: r.salario_base,
        cargo: r.cargo_lido || "",
      }));
  }, [rows, cpfSel]);

  // Reajustes detectados — distingue reajuste real de retorno após afastamento longo (>60 dias entre competências).
  const reajustes = useMemo(() => {
    const out: Array<{
      competencia: string;
      antes: number;
      depois: number;
      pct: number;
      obs: string;
    }> = [];
    const monthsDiff = (a: string, b: string) => {
      const [ay, am] = a.split("-").map(Number);
      const [by, bm] = b.split("-").map(Number);
      return (by - ay) * 12 + (bm - am);
    };
    for (let i = 1; i < historico.length; i++) {
      const a = historico[i - 1];
      const b = historico[i];
      if (Math.abs(b.salario - a.salario) <= 0.01) continue;
      const pct = ((b.salario - a.salario) / a.salario) * 100;
      const gap = monthsDiff(a.competencia, b.competencia);
      const mes = Number(b.competencia.split("-")[1]);
      let obs: string;
      if (a.cargo && b.cargo && a.cargo !== b.cargo)
        obs = `Mudança de cargo: ${a.cargo} → ${b.cargo}`;
      else if (gap > 2) obs = "Retorno após afastamento";
      else if (pct >= 3 && pct <= 12 && [1, 2, 5].includes(mes)) obs = "Possível dissídio";
      else if (pct < 0) obs = "Redução salarial";
      else obs = "Reajuste";
      out.push({ competencia: b.label, antes: a.salario, depois: b.salario, pct, obs });
    }
    return out.reverse();
  }, [historico]);

  // Média da empresa só considera competências com ao menos 3 colaboradores — evita ruído.
  const mediaEmpresa = useMemo(() => {
    const m = new Map<string, { soma: number; n: number }>();
    rows.forEach((r) => {
      if (r.salario_base <= 0) return;
      const cur = m.get(r.competencia) || { soma: 0, n: 0 };
      cur.soma += r.salario_base;
      cur.n += 1;
      m.set(r.competencia, cur);
    });
    return Array.from(m.entries())
      .filter(([, v]) => v.n >= 3)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([c, v]) => ({ competencia: formatCompetencia(c), media: v.soma / v.n, n: v.n }));
  }, [rows]);

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Histórico Salarial</h1>
          <p className="text-sm text-muted-foreground">
            Evolução salarial individual e média da empreiteira ao longo do tempo.
          </p>
        </div>
        <ImportHoleriteDialog />
      </div>

      <QueryState
        isLoading={loading}
        data={rows}
        isEmpty={(r) => r.length === 0}
        empty={
          <Card>
            <CardContent className="py-12 flex flex-col items-center text-center gap-3">
              <FileSpreadsheet className="h-12 w-12 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                Importe o Holerite para visualizar o histórico salarial.
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
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Selecione um colaborador</CardTitle>
            </CardHeader>
            <CardContent>
              <Select
                value={cpfSel || "_none"}
                onValueChange={(v) => setCpfSel(v === "_none" ? "" : v)}
              >
                <SelectTrigger className="max-w-md">
                  <SelectValue placeholder="Buscar colaborador" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">— selecione —</SelectItem>
                  {colabs.map((c) => (
                    <SelectItem key={c.cpf} value={c.cpf}>
                      {c.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          {cpfSel && historico.length > 0 && (
            <>
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Evolução salarial (rubrica 8781)</CardTitle>
                </CardHeader>
                <CardContent className="h-72">
                  <ResponsiveContainer>
                    <LineChart data={historico}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="label" />
                      <YAxis tickFormatter={(v) => `${(v / 1000).toFixed(1)}k`} />
                      <Tooltip formatter={(v: number) => formatBRLFromNumber(v)} />
                      <Line
                        type="stepAfter"
                        dataKey="salario"
                        stroke="hsl(var(--primary))"
                        strokeWidth={2}
                        dot
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Reajustes detectados</CardTitle>
                </CardHeader>
                <CardContent className="overflow-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Competência</TableHead>
                        <TableHead className="text-right">De</TableHead>
                        <TableHead className="text-right">Para</TableHead>
                        <TableHead className="text-right">Variação</TableHead>
                        <TableHead>Observação</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {reajustes.length === 0 && (
                        <TableRow>
                          <TableCell
                            colSpan={5}
                            className="text-center text-muted-foreground text-sm"
                          >
                            Sem reajustes registrados
                          </TableCell>
                        </TableRow>
                      )}
                      {reajustes.map((r, i) => (
                        <TableRow key={i}>
                          <TableCell>{r.competencia}</TableCell>
                          <TableCell className="text-right">
                            {formatBRLFromNumber(r.antes)}
                          </TableCell>
                          <TableCell className="text-right font-semibold">
                            {formatBRLFromNumber(r.depois)}
                          </TableCell>
                          <TableCell className="text-right">
                            <Badge
                              variant={r.pct >= 0 ? "default" : "destructive"}
                              className="gap-1"
                            >
                              {r.pct >= 0 ? (
                                <TrendingUp className="h-3 w-3" />
                              ) : (
                                <TrendingDown className="h-3 w-3" />
                              )}
                              {r.pct.toFixed(1)}%
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">{r.obs}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Média salarial da empreiteira</CardTitle>
            </CardHeader>
            <CardContent className="h-72">
              <ResponsiveContainer>
                <LineChart data={mediaEmpresa}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="competencia" />
                  <YAxis tickFormatter={(v) => `${(v / 1000).toFixed(1)}k`} />
                  <Tooltip formatter={(v: number) => formatBRLFromNumber(v)} />
                  <Line
                    type="monotone"
                    dataKey="media"
                    stroke="#10b981"
                    strokeWidth={2}
                    name="Média"
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
