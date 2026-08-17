// Card: curva de resultado acumulado do contrato (banana).
// Faturamento − despesas, real até hoje + projetado de hoje em diante.

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
  ReferenceLine,
} from "@/components/ui/chart";
import { format, parse } from "date-fns";
import { ptBR } from "date-fns/locale";
import { AlertCircle } from "lucide-react";
import { notasFiscaisRepo } from "@/lib/repositories/medicoes";
import { bmsPrevistasRepo } from "@/lib/repositories/obraDetalhe";
import { financeiroRepo } from "@/lib/repositories/financeiro";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { brl } from "@/lib/billing";
import { cn } from "@/lib/utils";
import { calcularCurvaResultado, type PontoCurva } from "@/lib/resultado/curva-resultado";

function formatMes(mes: string): string {
  try {
    return format(parse(mes, "yyyy-MM", new Date()), "MMM/yy", { locale: ptBR });
  } catch {
    return mes;
  }
}

function abreviar(v: number): string {
  const a = Math.abs(v);
  if (a >= 1_000_000) return `R$ ${(v / 1_000_000).toFixed(1).replace(".", ",")}M`;
  if (a >= 1_000) return `R$ ${(v / 1_000).toFixed(0)}k`;
  return brl(v);
}

interface Serie {
  key: keyof Pick<
    Linha,
    | "resultadoReal"
    | "resultadoProjetado"
    | "fatRealAcc"
    | "fatPrevAcc"
    | "despRealAcc"
    | "despAVencerAcc"
  >;
  label: string;
  defaultOn: boolean;
}

interface Linha extends PontoCurva {
  mesLabel: string;
  fatRealAcc: number | null;
  fatPrevAcc: number | null;
  despRealAcc: number | null;
  despAVencerAcc: number | null;
}

const SERIES: Serie[] = [
  { key: "resultadoReal", label: "Resultado realizado", defaultOn: true },
  { key: "resultadoProjetado", label: "Resultado projetado", defaultOn: true },
  { key: "fatRealAcc", label: "Fat. real (acum.)", defaultOn: false },
  { key: "fatPrevAcc", label: "Fat. previsto (acum.)", defaultOn: false },
  { key: "despRealAcc", label: "Desp. real (acum.)", defaultOn: false },
  { key: "despAVencerAcc", label: "Desp. a vencer (acum.)", defaultOn: false },
];

export function ResultadoAcumuladoCard({ obraId }: { obraId: string }) {
  const hoje = useMemo(() => new Date(), []);
  const hojeMes = format(hoje, "yyyy-MM");

  const nfsQ = useQuery({
    queryKey: ["resultado-nfs", obraId],
    queryFn: async () => {
      return await notasFiscaisRepo.listCurvaByObra(obraId);
    },
  });

  const bmsQ = useQuery({
    queryKey: ["resultado-bms", obraId],
    queryFn: async () => {
      return await bmsPrevistasRepo.listCurvaByObra(obraId);
    },
  });

  const finQ = useQuery({
    queryKey: ["resultado-fin", obraId],
    queryFn: async () => {
      return await financeiroRepo.vwCurvaByObra(obraId);
    },
  });

  const [visiveis, setVisiveis] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(SERIES.map((s) => [s.key, s.defaultOn])),
  );

  const pontos = useMemo<PontoCurva[]>(() => {
    if (!nfsQ.data && !bmsQ.data && !finQ.data) return [];
    return calcularCurvaResultado({
      nfs: (nfsQ.data ?? []) as any,
      bms: (bmsQ.data ?? []) as any,
      fin: (finQ.data ?? []) as any,
      hoje,
    });
  }, [nfsQ.data, bmsQ.data, finQ.data, hoje]);

  const linhas = useMemo<Linha[]>(() => {
    let frAcc = 0;
    let drAcc = 0;
    let fpAcc = 0;
    let dvAcc = 0;
    let fpStarted = false;
    let dvStarted = false;
    return pontos.map((p) => {
      const isPast = p.mes <= hojeMes;
      if (isPast) {
        frAcc += p.fatReal;
        drAcc += p.despReal;
      }
      // Acumulados projetados ancorados em hoje
      if (p.mes === hojeMes) {
        fpAcc = frAcc;
        dvAcc = drAcc;
        fpStarted = true;
        dvStarted = true;
      } else if (p.mes > hojeMes) {
        if (!fpStarted) {
          fpAcc = frAcc;
          fpStarted = true;
        }
        if (!dvStarted) {
          dvAcc = drAcc;
          dvStarted = true;
        }
        fpAcc += p.fatPrevisto;
        dvAcc += p.despAVencer;
      }
      return {
        ...p,
        mesLabel: formatMes(p.mes),
        fatRealAcc: isPast ? frAcc : null,
        fatPrevAcc: p.mes >= hojeMes ? fpAcc : null,
        despRealAcc: isPast ? drAcc : null,
        despAVencerAcc: p.mes >= hojeMes ? dvAcc : null,
      };
    });
  }, [pontos, hojeMes]);

  const kpis = useMemo(() => {
    const reais = linhas.filter((l) => l.resultadoReal != null);
    const projs = linhas.filter((l) => l.resultadoProjetado != null);
    const atual = reais.length ? reais[reais.length - 1].resultadoReal! : 0;
    const final = projs.length ? projs[projs.length - 1].resultadoProjetado! : atual;
    const futuras = projs.filter((l) => l.mes > hojeMes);
    const virada = futuras.find((l) => (l.resultadoProjetado ?? -Infinity) >= 0)?.mes ?? null;
    const todos = linhas.flatMap(
      (l) => [l.resultadoReal, l.resultadoProjetado].filter((v) => v != null) as number[],
    );
    const exposicao = todos.length ? Math.min(...todos) : 0;
    return { atual, final, virada, exposicao };
  }, [linhas, hojeMes]);

  const loading = nfsQ.isLoading || bmsQ.isLoading || finQ.isLoading;
  const semDespesas = !finQ.isLoading && (finQ.data?.length ?? 0) === 0;

  const mesAtualLabel = formatMes(hojeMes);

  function toggle(k: string) {
    setVisiveis((prev) => ({ ...prev, [k]: !prev[k] }));
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Resultado acumulado (caixa do contrato)</CardTitle>
        <CardDescription>Faturamento − despesas, realizado e projetado</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <Skeleton className="h-72 w-full" />
        ) : linhas.length === 0 ? (
          <div className="h-72 flex items-center justify-center text-sm text-muted-foreground">
            Sem dados suficientes para montar a curva.
          </div>
        ) : (
          <>
            {semDespesas && (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Despesas TOTVS não disponíveis — vincule o centro de custo da obra.
                </AlertDescription>
              </Alert>
            )}

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <KpiBox
                label="Resultado atual"
                valor={kpis.atual}
                tone={kpis.atual >= 0 ? "positive" : "negative"}
              />
              <KpiBox
                label="Resultado projetado final"
                valor={kpis.final}
                tone={kpis.final >= 0 ? "positive" : "negative"}
              />
              <div>
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">
                  Ponto de virada
                </div>
                <div
                  className={cn(
                    "text-base font-semibold tabular-nums mt-0.5",
                    kpis.virada ? "" : "text-destructive",
                  )}
                >
                  {kpis.virada ? formatMes(kpis.virada) : "—"}
                </div>
              </div>
              <KpiBox label="Exposição máxima" valor={kpis.exposicao} tone="negative" />
            </div>

            <div className="flex flex-wrap gap-x-4 gap-y-2">
              {SERIES.map((s) => (
                <div key={s.key} className="flex items-center gap-2">
                  <Checkbox
                    id={`s-${s.key}`}
                    checked={!!visiveis[s.key]}
                    onCheckedChange={() => toggle(s.key)}
                  />
                  <Label htmlFor={`s-${s.key}`} className="text-xs cursor-pointer">
                    {s.label}
                  </Label>
                </div>
              ))}
            </div>

            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={linhas} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                  <XAxis dataKey="mesLabel" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={abreviar} />
                  <Tooltip
                    formatter={(v: any, name: any) =>
                      v == null ? ["—", name] : [brl(Number(v)), name]
                    }
                    labelFormatter={(l) => `Mês ${l}`}
                  />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <ReferenceLine y={0} stroke="hsl(var(--muted-foreground))" strokeOpacity={0.6} />
                  <ReferenceLine
                    x={mesAtualLabel}
                    stroke="hsl(var(--muted-foreground))"
                    strokeDasharray="2 2"
                    label={{
                      value: "hoje",
                      position: "top",
                      fontSize: 10,
                      fill: "hsl(var(--muted-foreground))",
                    }}
                  />

                  {visiveis.fatRealAcc && (
                    <Line
                      type="monotone"
                      dataKey="fatRealAcc"
                      name="Fat. real (acum.)"
                      stroke="#10b981"
                      strokeWidth={1}
                      dot={false}
                      connectNulls={false}
                    />
                  )}
                  {visiveis.fatPrevAcc && (
                    <Line
                      type="monotone"
                      dataKey="fatPrevAcc"
                      name="Fat. previsto (acum.)"
                      stroke="#10b981"
                      strokeOpacity={0.6}
                      strokeDasharray="4 3"
                      strokeWidth={1}
                      dot={false}
                      connectNulls={false}
                    />
                  )}
                  {visiveis.despRealAcc && (
                    <Line
                      type="monotone"
                      dataKey="despRealAcc"
                      name="Desp. real (acum.)"
                      stroke="#f59e0b"
                      strokeWidth={1}
                      dot={false}
                      connectNulls={false}
                    />
                  )}
                  {visiveis.despAVencerAcc && (
                    <Line
                      type="monotone"
                      dataKey="despAVencerAcc"
                      name="Desp. a vencer (acum.)"
                      stroke="#f59e0b"
                      strokeOpacity={0.6}
                      strokeDasharray="4 3"
                      strokeWidth={1}
                      dot={false}
                      connectNulls={false}
                    />
                  )}
                  {visiveis.resultadoReal && (
                    <Line
                      type="monotone"
                      dataKey="resultadoReal"
                      name="Resultado realizado"
                      stroke="#3b82f6"
                      strokeWidth={2}
                      dot={false}
                      connectNulls={false}
                    />
                  )}
                  {visiveis.resultadoProjetado && (
                    <Line
                      type="monotone"
                      dataKey="resultadoProjetado"
                      name="Resultado projetado"
                      stroke="#ef4444"
                      strokeWidth={2}
                      strokeDasharray="5 4"
                      dot={false}
                      connectNulls={false}
                    />
                  )}
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function KpiBox({
  label,
  valor,
  tone,
}: {
  label: string;
  valor: number;
  tone: "positive" | "negative";
}) {
  const color = tone === "positive" ? "text-success" : "text-destructive";
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">
        {label}
      </div>
      <div className={cn("text-base font-semibold tabular-nums mt-0.5", color)}>{brl(valor)}</div>
    </div>
  );
}
