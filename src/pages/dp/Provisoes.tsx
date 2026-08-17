// Provisões — passivo trabalhista futuro.
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
import ImportHoleriteDialog from "@/components/dp/ImportHoleriteDialog";
import DpFilterBar, { formatCompetencia, type DpFilters } from "@/components/dp/DpFilterBar";
import { useDpHolerites, defaultFilters, type DpHoleriteRowEnriched } from "@/hooks/dp/useDpHolerites";
import { formatBRLFromNumber } from "@/lib/core/currency";
import { FileSpreadsheet } from "lucide-react";
import { Kpi as KpiCard } from "@/components/common/Kpi";
import { useTableSort } from "@/hooks/useTableSort";
import { SortHeader } from "@/components/ui/sort-header";
import { RESCISAO_MULTA_FGTS } from "@/lib/dp/codigos";
import { QueryState } from "@/components/common/QueryState";

export default function Provisoes() {
  const { rows, loading, competencias, obras, cargos } = useDpHolerites();
  const [filters, setFilters] = useState<DpFilters | null>(null);
  const effective = filters ?? defaultFilters(competencias);

  const escopo = useMemo(() => {
    return rows.filter((r) => {
      if (effective.competencia && r.competencia !== effective.competencia) return false;
      if (effective.obra && r.obraResolvida !== effective.obra) return false;
      if (effective.cargo && r.cargo_lido !== effective.cargo) return false;
      return true;
    });
  }, [rows, effective.competencia, effective.obra, effective.cargo]);

  // FGTS acumulado por CPF até a competência selecionada — base correta para multa 40%.
  // Restringe a CPFs presentes no escopo (mesmas filtragens de obra/cargo).
  const fgtsAcumPorCpf = useMemo(() => {
    const cpfsEscopo = new Set(escopo.map((r) => r.cpf));
    const teto = effective.competencia || "9999-99";
    const m = new Map<string, number>();
    rows.forEach((r) => {
      if (!cpfsEscopo.has(r.cpf)) return;
      if (effective.obra && r.obraResolvida !== effective.obra) return;
      if (effective.cargo && r.cargo_lido !== effective.cargo) return;
      if (r.competencia > teto) return;
      m.set(r.cpf, (m.get(r.cpf) || 0) + r.fgts);
    });
    return m;
  }, [rows, escopo, effective.competencia, effective.obra, effective.cargo]);

  const cards = useMemo(() => {
    const prov13 = escopo.reduce((s, r) => s + r.provisao_13, 0);
    const provFerias = escopo.reduce((s, r) => s + r.provisao_ferias, 0);
    const inssProv = escopo.reduce((s, r) => s + r.inss_provisao_13 + r.inss_provisao_ferias, 0);
    const fgtsProv = escopo.reduce((s, r) => s + r.fgts_provisao_13 + r.fgts_provisao_ferias, 0);
    const fgtsAcum = Array.from(fgtsAcumPorCpf.values()).reduce((s, v) => s + v, 0);
    const multaFgts = fgtsAcum * RESCISAO_MULTA_FGTS;
    const passivo = prov13 + provFerias + inssProv + fgtsProv + multaFgts;
    return { prov13, provFerias, inssProv, fgtsProv, fgtsAcum, multaFgts, passivo };
  }, [escopo, fgtsAcumPorCpf]);

  const serie = useMemo(() => {
    // Série temporal ignora o filtro de competência para mostrar evolução completa.
    const base = rows.filter((r) => {
      if (effective.obra && r.obraResolvida !== effective.obra) return false;
      if (effective.cargo && r.cargo_lido !== effective.cargo) return false;
      return true;
    });
    const m = new Map<string, number>();
    base.forEach((r) => {
      const v =
        r.provisao_13 +
        r.provisao_ferias +
        r.inss_provisao_13 +
        r.inss_provisao_ferias +
        r.fgts_provisao_13 +
        r.fgts_provisao_ferias;
      m.set(r.competencia, (m.get(r.competencia) || 0) + v);
    });
    const sorted = Array.from(m.entries()).sort(([a], [b]) => a.localeCompare(b));
    let acc = 0;
    return sorted.map(([comp, val]) => {
      acc += val;
      return { competencia: formatCompetencia(comp), valor: val, acumulado: acc };
    });
  }, [rows, effective.obra, effective.cargo]);

  const ranking = useMemo(() => {
    const m = new Map<
      string,
      {
        nome: string;
        cargo: string;
        obra: string;
        provisoes: number;
        fgtsAcum: number;
        multa: number;
        rescisao: number;
      }
    >();
    escopo.forEach((r) => {
      const key = r.cpf;
      const cur = m.get(key) || {
        nome: r.nome_lido || "",
        cargo: r.cargo_lido || "",
        obra: r.obraResolvida || "",
        provisoes: 0,
        fgtsAcum: 0,
        multa: 0,
        rescisao: 0,
      };
      const prov =
        r.provisao_13 +
        r.provisao_ferias +
        r.inss_provisao_13 +
        r.inss_provisao_ferias +
        r.fgts_provisao_13 +
        r.fgts_provisao_ferias;
      cur.provisoes += prov;
      m.set(key, cur);
    });
    // Aplica FGTS acumulado uma única vez por CPF.
    m.forEach((v, cpf) => {
      v.fgtsAcum = fgtsAcumPorCpf.get(cpf) || 0;
      v.multa = v.fgtsAcum * RESCISAO_MULTA_FGTS;
      v.rescisao = v.provisoes + v.multa;
    });
    return Array.from(m.values())
      .sort((a, b) => b.rescisao - a.rescisao)
      .slice(0, 30);
  }, [escopo, fgtsAcumPorCpf]);

  type RankK = "nome" | "cargo" | "obra" | "provisoes" | "fgtsAcum" | "multa" | "rescisao";
  const rankSort = useTableSort(ranking, (r, k: RankK) => (r as any)[k], "rescisao", "desc");

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Provisões</h1>
          <p className="text-sm text-muted-foreground">
            Passivo trabalhista acumulado por colaborador e por mês.
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
        showCargo={true}
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
                Importe o Holerite para visualizar as provisões.
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
                  Passivo Trabalhista Acumulado
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-primary">
                  {formatBRLFromNumber(cards.passivo)}
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  Inclui multa FGTS 40% estimada sobre FGTS acumulado.
                </div>
              </CardContent>
            </Card>
            <KpiCard label="Provisão 13°" value={formatBRLFromNumber(cards.prov13)} />
            <KpiCard label="Provisão Férias" value={formatBRLFromNumber(cards.provFerias)} />
            <KpiCard label="INSS sobre provisões" value={formatBRLFromNumber(cards.inssProv)} />
            <KpiCard label="FGTS sobre provisões" value={formatBRLFromNumber(cards.fgtsProv)} />
            <KpiCard label="FGTS acumulado" value={formatBRLFromNumber(cards.fgtsAcum)} />
            <KpiCard label="Multa FGTS 40% (estim.)" value={formatBRLFromNumber(cards.multaFgts)} />
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Evolução do passivo (acumulado)</CardTitle>
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
                    dataKey="acumulado"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                    name="Acumulado"
                  />
                  <Line
                    type="monotone"
                    dataKey="valor"
                    stroke="#10b981"
                    strokeWidth={2}
                    name="No mês"
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Tabela de risco — maior passivo acumulado</CardTitle>
            </CardHeader>
            <CardContent className="overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <SortHeader
                      sortKey="nome"
                      currentKey={rankSort.sortKey}
                      dir={rankSort.sortDir}
                      onToggle={rankSort.toggle}
                    >
                      Colaborador
                    </SortHeader>
                    <SortHeader
                      sortKey="cargo"
                      currentKey={rankSort.sortKey}
                      dir={rankSort.sortDir}
                      onToggle={rankSort.toggle}
                    >
                      Cargo
                    </SortHeader>
                    <SortHeader
                      sortKey="obra"
                      currentKey={rankSort.sortKey}
                      dir={rankSort.sortDir}
                      onToggle={rankSort.toggle}
                    >
                      Obra
                    </SortHeader>
                    <SortHeader
                      sortKey="provisoes"
                      align="right"
                      currentKey={rankSort.sortKey}
                      dir={rankSort.sortDir}
                      onToggle={rankSort.toggle}
                    >
                      Provisões acumuladas
                    </SortHeader>
                    <SortHeader
                      sortKey="fgtsAcum"
                      align="right"
                      currentKey={rankSort.sortKey}
                      dir={rankSort.sortDir}
                      onToggle={rankSort.toggle}
                    >
                      FGTS acumulado
                    </SortHeader>
                    <SortHeader
                      sortKey="multa"
                      align="right"
                      currentKey={rankSort.sortKey}
                      dir={rankSort.sortDir}
                      onToggle={rankSort.toggle}
                    >
                      Multa 40%
                    </SortHeader>
                    <SortHeader
                      sortKey="rescisao"
                      align="right"
                      currentKey={rankSort.sortKey}
                      dir={rankSort.sortDir}
                      onToggle={rankSort.toggle}
                    >
                      Rescisão estimada
                    </SortHeader>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rankSort.sorted.map((r, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-medium">{r.nome}</TableCell>
                      <TableCell className="text-xs">{r.cargo}</TableCell>
                      <TableCell className="text-xs">{r.obra}</TableCell>
                      <TableCell className="text-right">
                        {formatBRLFromNumber(r.provisoes)}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatBRLFromNumber(r.fgtsAcum)}
                      </TableCell>
                      <TableCell className="text-right">{formatBRLFromNumber(r.multa)}</TableCell>
                      <TableCell className="text-right font-semibold text-warning">
                        {formatBRLFromNumber(r.rescisao)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

