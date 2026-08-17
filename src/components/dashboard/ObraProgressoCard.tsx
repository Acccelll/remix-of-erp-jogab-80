import { Link } from "react-router-dom";
import { AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import { AppTooltip } from "@/components/ui/chart";
import { fmtData } from "@/lib/core/date";
import type { ObraComProgresso } from "@/hooks/obras/useDashboardObras";
import type { StatusItemCrono } from "@/lib/obras/dashboardObras";

const fmtPct = (n: number) => `${n.toFixed(1)}%`;

/**
 * Mapeamento de metadados visuais por status do cronograma.
 */
const STATUS_META: Record<StatusItemCrono, { label: string; fill: string; chip: string }> = {
  concluido: {
    label: "Concluído",
    fill: "hsl(var(--success))",
    chip: "bg-success/10 text-success border-success/20",
  },
  em_andamento: {
    label: "Em andamento",
    fill: "hsl(var(--warning))",
    chip: "bg-warning/10 text-warning border-warning/20",
  },
  nao_iniciado: {
    label: "Não iniciado",
    fill: "hsl(var(--muted-foreground))",
    chip: "bg-muted text-muted-foreground border-border",
  },
};

const SEMAFORO = {
  bom: {
    label: "Saudável",
    cls: "bg-primary/10 text-primary border-primary/20",
    icone: () => null,
  },
  alerta: {
    label: "Alerta",
    cls: "bg-warning/10 text-warning border-warning/20",
    icone: AlertTriangle,
  },
  critico: {
    label: "Crítico",
    cls: "bg-destructive/10 text-destructive border-destructive/20",
    icone: AlertTriangle,
  },
};

export function ObraProgressoCard({
  obra,
  resumo,
  diagnostico,
}: {
  obra: any;
  resumo: any;
  diagnostico: any;
}) {
  const donut = resumo
    ? (Object.entries(resumo.porStatus) as [StatusItemCrono, number][])
        .filter(([_, value]) => value > 0)
        .map(([status, value]) => ({
          name: STATUS_META[status].label,
          status,
          value,
        }))
    : [];

  return (
    <Card className="overflow-hidden hover:shadow-md transition-shadow">
      <Link to={`/obras/${obra.id}`}>
        <CardHeader className="pb-2 space-y-1">
          <div className="flex items-start justify-between gap-2">
            <CardTitle className="text-sm font-bold line-clamp-1">
              <span className="text-muted-foreground mr-1">#{obra.codigo}</span>
              {obra.nome}
            </CardTitle>
            {resumo?.faixaSpi ? <SemaforoBadge faixa={resumo.faixaSpi} spi={resumo.spi} /> : null}
          </div>
          <div className="text-xs text-muted-foreground tabular-nums">
            {fmtData(obra.dataInicio)} → {fmtData(obra.dataPrevisaoTermino ?? obra.dataFim)}
          </div>
        </CardHeader>

        <CardContent className="pt-2">
          {resumo ? (
            <div className="grid grid-cols-2 gap-3 items-center">
              <div className="space-y-1.5">
                {(Object.keys(STATUS_META) as StatusItemCrono[]).map((s) => (
                  <div
                    key={s}
                    className={`flex items-center justify-between rounded-md border px-2 py-1 ${STATUS_META[s].chip}`}
                  >
                    <span className="text-xs font-medium">{STATUS_META[s].label}</span>
                    <span className="text-sm font-bold tabular-nums">{resumo.porStatus[s]}</span>
                  </div>
                ))}
                <div
                  className={`flex items-center justify-between rounded-md border px-2 py-1 ${
                    resumo.atrasados > 0
                      ? "bg-destructive/15 text-destructive border-destructive/40"
                      : "bg-muted/50 text-muted-foreground border-border"
                  }`}
                >
                  <span className="text-xs font-medium">Atrasados</span>
                  <span className="text-sm font-bold tabular-nums">{resumo.atrasados}</span>
                </div>
              </div>

              <div className="relative h-36">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={donut}
                      dataKey="value"
                      nameKey="name"
                      innerRadius="68%"
                      outerRadius="92%"
                      paddingAngle={donut.length > 1 ? 2 : 0}
                      stroke="hsl(var(--card))"
                      strokeWidth={2}
                      isAnimationActive={false}
                    >
                      {donut.map((d) => (
                        <Cell key={d.status} fill={STATUS_META[d.status].fill} />
                      ))}
                    </Pie>
                    <AppTooltip
                      cursor={false}
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const data = payload[0].payload;
                          const total = Number(resumo.totalItens ?? 1);
                          const val = Number(payload[0].value ?? 0);
                          const pct = (val / total) * 100;
                          return (
                            <div className="bg-popover/95 backdrop-blur-sm text-popover-foreground border border-border px-2 py-1.5 rounded shadow-lg text-xs z-50">
                              <p className="font-semibold mb-0.5">{data.name}</p>
                              <p>
                                {payload[0].value} {payload[0].value === 1 ? "item" : "itens"} (
                                {pct.toFixed(1)}%)
                              </p>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-lg font-bold leading-none">
                    {fmtPct(resumo.percFisico)}
                  </span>
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                    físico
                  </span>
                </div>
              </div>

              <div className="col-span-2 flex items-center justify-between text-xs text-muted-foreground mt-2">
                <span className="tabular-nums">
                  {resumo.totalItens} {resumo.totalItens === 1 ? "item" : "itens"} de cronograma ·
                  previsto {fmtPct(resumo.percPrevisto)}
                </span>
                {resumo.atrasados > 0 ? (
                  <span className="text-destructive font-medium tabular-nums">
                    {resumo.atrasados} {resumo.atrasados === 1 ? "atrasado" : "atrasados"}
                  </span>
                ) : null}
              </div>
            </div>
          ) : (
            <div className="py-6 text-center text-sm space-y-1">
              <div className="text-muted-foreground">Sem cronograma pareado.</div>
              {diagnostico.motivoSemCronograma === "sem_flowcast_id" ? (
                <div className="inline-flex items-center gap-1 text-xs text-destructive">
                  <AlertTriangle className="h-3 w-3" />
                  Obra sem vínculo de integração.
                </div>
              ) : (
                <div className="inline-flex items-center gap-1 text-xs text-warning">
                  <AlertTriangle className="h-3 w-3" />
                  Vinculada, mas sem itens importados.
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Link>
    </Card>
  );
}

function SemaforoBadge({ faixa, spi }: { faixa: keyof typeof SEMAFORO; spi: number | null }) {
  const meta = SEMAFORO[faixa as keyof typeof SEMAFORO] || SEMAFORO.alerta;
  const Icone = meta.icone;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium shrink-0 ${meta.cls}`}
      title={spi !== null ? `SPI ${spi.toFixed(2).replace(".", ",")}` : undefined}
    >
      {Icone && <Icone className="h-3 w-3" />}
      {meta.label}
    </span>
  );
}

export default ObraProgressoCard;
