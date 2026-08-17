// EVM consolidado do portfólio — tabela de obras + scatter SPI×CPI + KPIs agregados.
import { useMemo } from "react";
import { Link } from "react-router-dom";
import {
  ResponsiveContainer,
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  ZAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  Cell,
} from "@/components/ui/chart";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Database, AlertTriangle, TrendingUp } from "lucide-react";
import { brl } from "@/lib/billing";
import { cn } from "@/lib/utils";
import {
  calcularEVM,
  classificarIndice,
  type EvmItemCrono,
  type FaixaIndice,
} from "@/lib/pmbok/evm";
import { construirAcReal } from "@/lib/pmbok/ac-totvs";
import type { FinLinha } from "@/lib/financeiro-totvs/agregacoes";

function toneText(f: FaixaIndice) {
  if (f === "bom") return "text-success font-medium";
  if (f === "alerta") return "text-warning font-medium";
  return "text-destructive font-medium";
}
function toneFill(f: FaixaIndice) {
  if (f === "bom") return "#16a34a";
  if (f === "alerta") return "#f59e0b";
  return "#dc2626";
}

type LinhaPortfolio = {
  obra: any;
  evm: ReturnType<typeof calcularEVM>;
};

export function EvmPortfolioCard({
  obras,
  crono,
  finLinhas,
  medicoes,
}: {
  obras: any[];
  crono: any[];
  finLinhas: FinLinha[];
  medicoes: any[];
}) {
  const dataRef = useMemo(() => new Date(), []);

  const linhas = useMemo<LinhaPortfolio[]>(() => {
    const cronoByObra = new Map<string, any[]>();
    for (const c of crono) {
      const arr = cronoByObra.get(c.obra_id) ?? [];
      arr.push(c);
      cronoByObra.set(c.obra_id, arr);
    }
    const finByObra = new Map<string, FinLinha[]>();
    for (const l of finLinhas) {
      if (!l.obra_id) continue;
      const arr = finByObra.get(l.obra_id) ?? [];
      arr.push(l);
      finByObra.set(l.obra_id, arr);
    }
    const medByObra = new Map<string, any[]>();
    for (const m of medicoes) {
      const arr = medByObra.get(m.obra_id) ?? [];
      arr.push(m);
      medByObra.set(m.obra_id, arr);
    }
    return obras
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
        return { obra: o, evm } as LinhaPortfolio;
      })
      .filter((x): x is LinhaPortfolio => x !== null);
  }, [obras, crono, finLinhas, medicoes, dataRef]);

  if (!linhas.length) return null;

  const vacTotal = linhas.reduce((a, l) => a + l.evm.VAC, 0);
  const cpiAbaixo = linhas.filter((l) => l.evm.CPI > 0 && l.evm.CPI < 1).length;
  const spitAbaixo = linhas.filter((l) => l.evm.SPIt > 0 && l.evm.SPIt < 1).length;

  const scatterData = linhas.map((l) => ({
    nome: l.obra.codigo ?? l.obra.nome,
    obra_id: l.obra.id,
    cpi: l.evm.CPI || 0,
    spi: l.evm.SPI || 0,
    bac: l.evm.BAC,
    faixa: classificarIndice(Math.min(l.evm.CPI || 0, l.evm.SPI || 0)),
  }));

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <TrendingUp className="h-4 w-4 text-primary" /> Desempenho EVM do portfólio
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Kpi
            label="VAC total"
            valor={brl(vacTotal)}
            tone={vacTotal >= 0 ? "positive" : "negative"}
          />
          <Kpi
            label="Obras com CPI<1"
            valor={String(cpiAbaixo)}
            tone={cpiAbaixo > 0 ? "warn" : "positive"}
          />
          <Kpi
            label="Obras com SPI(t)<1"
            valor={String(spitAbaixo)}
            tone={spitAbaixo > 0 ? "warn" : "positive"}
          />
          <Kpi label="Obras avaliadas" valor={String(linhas.length)} />
        </div>

        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart margin={{ top: 12, right: 16, left: 0, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
              <XAxis
                type="number"
                dataKey="cpi"
                name="CPI"
                domain={[0.5, 1.5]}
                tick={{ fontSize: 11 }}
                label={{ value: "CPI (custo)", position: "insideBottom", offset: -4, fontSize: 11 }}
              />
              <YAxis
                type="number"
                dataKey="spi"
                name="SPI"
                domain={[0.5, 1.5]}
                tick={{ fontSize: 11 }}
                label={{ value: "SPI (prazo)", angle: -90, position: "insideLeft", fontSize: 11 }}
              />
              <ZAxis type="number" dataKey="bac" range={[60, 400]} name="BAC" />
              <ReferenceLine x={1} stroke="#94a3b8" strokeDasharray="3 3" />
              <ReferenceLine y={1} stroke="#94a3b8" strokeDasharray="3 3" />
              <Tooltip
                cursor={{ strokeDasharray: "3 3" }}
                content={({ active, payload }: any) => {
                  if (!active || !payload?.length) return null;
                  const d = payload[0].payload;
                  return (
                    <div className="rounded-md border bg-popover px-3 py-2 text-xs shadow-md">
                      <div className="font-medium">{d.nome}</div>
                      <div>
                        CPI: {d.cpi.toFixed(2)} · SPI: {d.spi.toFixed(2)}
                      </div>
                      <div className="text-muted-foreground">BAC: {brl(d.bac)}</div>
                    </div>
                  );
                }}
              />
              <Scatter data={scatterData}>
                {scatterData.map((d, i) => (
                  <Cell key={i} fill={toneFill(d.faixa)} fillOpacity={0.75} />
                ))}
              </Scatter>
            </ScatterChart>
          </ResponsiveContainer>
        </div>

        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Obra</TableHead>
                <TableHead className="text-right">SPI</TableHead>
                <TableHead className="text-right">CPI</TableHead>
                <TableHead className="text-right">SV(t) (m)</TableHead>
                <TableHead className="text-right">EAC</TableHead>
                <TableHead className="text-right">VAC</TableHead>
                <TableHead>AC</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {linhas.map(({ obra, evm }) => (
                <TableRow key={obra.id}>
                  <TableCell>
                    <Link to={`/financeiro/obras/${obra.id}`} className="hover:underline">
                      <span className="text-xs text-muted-foreground">{obra.codigo}</span> ·{" "}
                      {obra.nome}
                    </Link>
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
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

function Kpi({
  label,
  valor,
  tone,
}: {
  label: string;
  valor: string;
  tone?: "positive" | "negative" | "warn";
}) {
  const color =
    tone === "positive"
      ? "text-success"
      : tone === "negative"
        ? "text-destructive"
        : tone === "warn"
          ? "text-warning"
          : "";
  return (
    <div className="rounded-md border p-3">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">
        {label}
      </div>
      <div className={cn("text-xl font-semibold tabular-nums mt-0.5", color)}>{valor}</div>
    </div>
  );
}
