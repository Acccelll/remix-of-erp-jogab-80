// Painel PMBOK — EVM com AC real (TOTVS) + Earned Schedule.
// Mostra índices com semáforo, curva S de 3 linhas (PV/EV/AC), projeções e marcos.
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from "@/components/ui/chart";
import {
  parseISO,
  differenceInCalendarDays,
  eachMonthOfInterval,
  startOfMonth,
  endOfMonth,
  format,
  min as dMin,
  max as dMax,
} from "date-fns";

import {
  AlertTriangle,
  Info,
  TrendingUp,
  TrendingDown,
  CheckCircle2,
  Database,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cronogramaMarcosRepo } from "@/lib/repositories/obraDetalhe";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip as UITooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { EmptyState } from "@/components/obra/EmptyState";
import { brl } from "@/lib/billing";
import { cn } from "@/lib/utils";
import {
  calcularEVM,
  classificarIndice,
  curvaSMensal,
  type EvmItemCrono,
  type FaixaIndice,
} from "@/lib/pmbok/evm";
import { construirAcReal } from "@/lib/pmbok/ac-totvs";
import { ResultadoAcumuladoCard } from "@/components/obra/ResultadoAcumuladoCard";
import type { FinLinha } from "@/lib/financeiro-totvs/agregacoes";

function toneClass(f: FaixaIndice): string {
  if (f === "bom") return "text-success";
  if (f === "alerta") return "text-warning";
  return "text-destructive";
}
function toneBgClass(f: FaixaIndice): string {
  if (f === "bom") return "bg-success/10 border-success/30";
  if (f === "alerta") return "bg-warning/10 border-warning/30";
  return "bg-destructive/10 border-destructive/30";
}

function IndiceCard({
  label,
  valor,
  formato = "indice",
  explicacao,
}: {
  label: string;
  valor: number;
  formato?: "indice" | "meses";
  explicacao: string;
}) {
  const faixa = classificarIndice(valor);
  return (
    <Card className={cn("border", toneBgClass(faixa))}>
      <CardContent className="py-3 px-4">
        <div className="flex items-center justify-between gap-2">
          <div className="text-[11px] uppercase tracking-wide font-medium text-muted-foreground">
            {label}
          </div>
          <TooltipProvider delayDuration={150}>
            <UITooltip>
              <TooltipTrigger asChild>
                <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-[260px] text-xs">
                {explicacao}
              </TooltipContent>
            </UITooltip>
          </TooltipProvider>
        </div>
        <div className={cn("text-xl font-semibold tabular-nums mt-1", toneClass(faixa))}>
          {formato === "meses" ? `${valor.toFixed(2)} m` : valor.toFixed(3)}
        </div>
      </CardContent>
    </Card>
  );
}

function Stat({
  label,
  valor,
  tone,
  explicacao,
}: {
  label: string;
  valor: number;
  tone?: "positive" | "negative" | "muted";
  explicacao?: string;
}) {
  const color =
    tone === "positive"
      ? "text-success"
      : tone === "negative"
        ? "text-destructive"
        : "";
  return (
    <div>
      <div className="text-metric-label flex items-center gap-1">
        <span>{label}</span>
        {explicacao && (
          <TooltipProvider delayDuration={150}>
            <UITooltip>
              <TooltipTrigger asChild>
                <Info className="h-3 w-3 text-muted-foreground cursor-help" />
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-[260px] text-xs normal-case">
                {explicacao}
              </TooltipContent>
            </UITooltip>
          </TooltipProvider>
        )}
      </div>
      <div className={cn("text-metric-sm mt-1", color)}>{brl(valor)}</div>


    </div>
  );
}

// BIZ-001 (Onda 5) — rateio mensal PV/EV/AC centralizado em `lib/pmbok/evm.curvaSMensal`.


export function DesempenhoTab({
  obra,
  crono,
  medicoes,
}: {
  obra: any;
  crono: any[];
  medicoes: any[];
}) {
  const { data: linhasFin } = useQuery({
    queryKey: ["fin_obra_evm", obra.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vw_financeiro_obra")
        .select("grupo, valor_rateio, mes_competencia, status_cod")
        .eq("obra_id", obra.id);
      if (error) throw error;
      return (data ?? []) as unknown as FinLinha[];
    },
  });

  const { data: marcos } = useQuery({
    queryKey: ["cronograma_marcos", obra.id],
    queryFn: async () => await cronogramaMarcosRepo.listPorObra(obra.id),
  });

  const itens = useMemo<EvmItemCrono[]>(
    () =>
      (crono ?? []).map((c) => ({
        custo: Number(c.custo ?? 0),
        custo_baseline: c.custo_baseline != null ? Number(c.custo_baseline) : null,
        percentual_previsto: Number(c.percentual_previsto ?? 0),
        percentual_realizado: Number(c.percentual_realizado ?? 0),
        data_inicio: c.data_inicio,
        data_fim: c.data_fim,
        data_inicio_baseline: c.data_inicio_baseline ?? null,
        data_fim_baseline: c.data_fim_baseline ?? null,
        ativo: c.ativo !== false,
      })),
    [crono],
  );

  const acReal = useMemo(() => construirAcReal(linhasFin), [linhasFin]);

  const dataRef = useMemo(() => new Date(), []);
  const evm = useMemo(
    () =>
      calcularEVM({
        itens,
        dataRef,
        acReal,
        medicoesFallback: (medicoes ?? []).map((m) => ({
          status: String(m.status),
          valor: Number(m.valor ?? 0),
        })),
      }),
    [itens, dataRef, acReal, medicoes],
  );

  const curva = useMemo(
    () => curvaSMensal(itens, acReal.porMes, dataRef),
    [itens, acReal, dataRef],
  );

  if (!itens.length) {
    return (
      <EmptyState
        title="Sem cronograma"
        description="Importe ou cadastre o cronograma para calcular o EVM."
      />
    );
  }

  const sinalVAC = evm.VAC >= 0;
  const cpiTxt = evm.CPI > 0 ? evm.CPI.toFixed(2) : "—";

  return (
    <div className="space-y-6">
      {evm.fonteAC === "estimado_medicoes" && (
        <Alert className="border-warning/40 bg-warning/10">
          <AlertTriangle className="h-4 w-4 text-warning" />
          <AlertTitle>Custo real (AC) estimado a partir do faturamento</AlertTitle>
          <AlertDescription>
            Vincule o Centro de Custo TOTVS no{" "}
            <Link to="/financeiro/centros" className="underline text-primary">
              cadastro da obra
            </Link>{" "}
            para que o AC reflita o custo realmente incorrido.
          </AlertDescription>
        </Alert>
      )}
      {evm.fonteAC === "totvs" && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Database className="h-3.5 w-3.5" /> AC real (TOTVS) · ref. {evm.dataReferencia}
        </div>
      )}

      <section>
        <div className="flex items-center gap-1.5 mb-2">
          <h3 className="text-sm font-semibold">Índices de desempenho</h3>
          <TooltipProvider delayDuration={150}>
            <UITooltip>
              <TooltipTrigger asChild>
                <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" aria-label="Ajuda sobre índices EVM" />
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-[320px] text-xs">
                Método Earned Value Management (PMBOK): compara valor planejado (PV),
                agregado (EV) e custo real (AC). Índices ≥ 1 indicam desempenho no ou
                acima do plano; abaixo de 1 exige ação corretiva.
              </TooltipContent>
            </UITooltip>
          </TooltipProvider>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <IndiceCard
            label="SPI (custo)"
            valor={evm.SPI}
            explicacao="Schedule Performance Index: EV/PV. ≥1 = no prazo. Mede o avanço de custos no tempo."
          />
          <IndiceCard
            label="CPI"
            valor={evm.CPI}
            explicacao="Cost Performance Index: EV/AC. ≥1 = abaixo do orçamento. Eficiência de custo."
          />
          <IndiceCard
            label="SPI(t)"
            valor={evm.SPIt}
            explicacao="Schedule Performance Index baseado em Earned Schedule (tempo). ≥1 = no prazo em meses; mais confiável que SPI no fim do projeto."
          />
          <IndiceCard
            label="TCPI"
            valor={evm.TCPI}
            explicacao="To-Complete Performance Index: eficiência necessária para terminar dentro do BAC. >1 = exige melhora; muito acima de 1 = inviável."
          />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
          <Stat
            label="SV (R$)"
            valor={evm.SV}
            tone={evm.SV >= 0 ? "positive" : "negative"}
            explicacao="Schedule Variance: EV − PV. Positivo = adiantado em valor de trabalho entregue; negativo = atraso."
          />
          <Stat
            label="CV (R$)"
            valor={evm.CV}
            tone={evm.CV >= 0 ? "positive" : "negative"}
            explicacao="Cost Variance: EV − AC. Positivo = abaixo do orçamento para o trabalho realizado; negativo = estouro."
          />
          <Stat
            label="SV(t) (meses)"
            valor={evm.SVt_meses}
            tone={evm.SVt_meses >= 0 ? "positive" : "negative"}
            explicacao="Schedule Variance no tempo (Earned Schedule). Diferença em meses entre onde a obra está e onde deveria estar. Positivo = adiantado."
          />
          <Stat
            label="VAC (R$)"
            valor={evm.VAC}
            tone={sinalVAC ? "positive" : "negative"}
            explicacao="Variance At Completion: BAC − EAC. Diferença projetada entre o orçamento e o custo final estimado. Positivo = sobra; negativo = estouro previsto."
          />
        </div>
      </section>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-1.5">
            <span>Curva S — PV, EV, AC (acumulado)</span>
            <TooltipProvider delayDuration={150}>
              <UITooltip>
                <TooltipTrigger asChild>
                  <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" aria-label="Ajuda sobre a Curva S" />
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-[320px] text-xs font-normal">
                  Curvas acumuladas mês a mês. <b>PV</b> = valor planejado (linha de
                  baseline). <b>EV</b> = valor agregado (trabalho concluído × valor
                  planejado). <b>AC</b> = custo real incorrido. Se EV &lt; PV, atraso; se
                  AC &gt; EV, estouro de custo.
                </TooltipContent>
              </UITooltip>
            </TooltipProvider>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={curva} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis dataKey="mesLabel" tick={{ fontSize: 11 }} />
                <YAxis
                  tick={{ fontSize: 11 }}
                  tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`}
                />
                <Tooltip
                  formatter={(v: any) => (v == null ? "—" : brl(Number(v)))}
                  labelFormatter={(l) => `Mês ${l}`}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Line
                  type="monotone"
                  dataKey="PV"
                  name="PV (planejado)"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  strokeDasharray="5 4"
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="EV"
                  name="EV (executado)"
                  stroke="#16a34a"
                  strokeWidth={2}
                  dot={false}
                  connectNulls={false}
                />
                <Line
                  type="monotone"
                  dataKey="AC"
                  name="AC (custo real)"
                  stroke="#ea580c"
                  strokeWidth={2}
                  dot={false}
                  connectNulls={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <ResultadoAcumuladoCard obraId={obra.id} />

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Projeções</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <Stat label="BAC (orçamento)" valor={evm.BAC} />
            <div>
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">
                EAC (típica)
              </div>
              <div
                className={cn(
                  "text-xl font-semibold tabular-nums mt-0.5",
                  sinalVAC ? "" : "text-destructive",
                )}
              >
                {brl(evm.EAC_cpi)}
              </div>
              <div className="text-[10px] text-muted-foreground mt-1">
                otim. {brl(evm.EAC_otimista)} · pess. {brl(evm.EAC_pessimista)}
              </div>
            </div>
            <Stat label="ETC (a executar)" valor={evm.ETC} />
            <Stat label="VAC" valor={evm.VAC} tone={sinalVAC ? "positive" : "negative"} />
            <div>
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">
                Fonte AC
              </div>
              <Badge variant={evm.fonteAC === "totvs" ? "default" : "secondary"} className="mt-1">
                {evm.fonteAC === "totvs" ? "TOTVS (real)" : "Estimado"}
              </Badge>
            </div>
          </div>
          <div className="text-sm text-muted-foreground border-t pt-3 flex items-start gap-2">
            {sinalVAC ? (
              <CheckCircle2 className="h-4 w-4 mt-0.5 text-success" />
            ) : (
              <TrendingDown className="h-4 w-4 mt-0.5 text-destructive" />
            )}
            <span>
              No ritmo atual de custo (CPI {cpiTxt}), a obra deve custar{" "}
              <strong>{brl(evm.EAC_cpi)}</strong> —{" "}
              {sinalVAC ? "R$ " : <span className="text-destructive">R$ </span>}
              <strong className={sinalVAC ? "" : "text-destructive"}>
                {brl(Math.abs(evm.VAC))}
              </strong>{" "}
              {sinalVAC ? "abaixo" : "acima"} do orçamento (BAC {brl(evm.BAC)}).
            </span>
          </div>
        </CardContent>
      </Card>

      {(marcos ?? []).length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Marcos</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Marco</TableHead>
                  <TableHead>Baseline</TableHead>
                  <TableHead>Previsto</TableHead>
                  <TableHead>Realizado</TableHead>
                  <TableHead className="text-right">Desvio</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(marcos ?? []).map((m: any) => {
                  const base = m.data_baseline ?? m.data_prevista;
                  const real = m.data_realizado;
                  let desvio = 0;
                  if (real && base) {
                    desvio = differenceInCalendarDays(parseISO(real), parseISO(base));
                  } else if (!real && base) {
                    desvio = differenceInCalendarDays(new Date(), parseISO(base));
                  }
                  const atrasado =
                    (!real && base && parseISO(base) < new Date()) ||
                    (real && base && parseISO(real) > parseISO(base));
                  return (
                    <TableRow key={m.id}>
                      <TableCell className="font-medium">
                        {m.nome}{" "}
                        {m.critico && (
                          <Badge variant="outline" className="ml-1 text-[10px]">
                            crítico
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-xs">
                        {m.data_baseline ? format(parseISO(m.data_baseline), "dd/MM/yyyy") : "—"}
                      </TableCell>
                      <TableCell className="text-xs">
                        {m.data_prevista ? format(parseISO(m.data_prevista), "dd/MM/yyyy") : "—"}
                      </TableCell>
                      <TableCell className="text-xs">
                        {real ? format(parseISO(real), "dd/MM/yyyy") : "—"}
                      </TableCell>
                      <TableCell
                        className={cn(
                          "text-right text-xs tabular-nums",
                          atrasado
                            ? "text-destructive font-medium"
                            : real
                              ? "text-success"
                              : "text-muted-foreground",
                        )}
                      >
                        {real || (base && parseISO(base) < new Date())
                          ? `${desvio > 0 ? "+" : ""}${desvio}d`
                          : "—"}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
