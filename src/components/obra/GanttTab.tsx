import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DesktopOnlyHint } from "@/components/common/DesktopOnlyHint";
import { differenceInCalendarDays, format, parseISO, addDays } from "date-fns";

type Item = {
  id: string;
  ordem: number;
  descricao: string | null;
  data_inicio: string;
  data_fim: string;
  data_inicio_baseline: string | null;
  data_fim_baseline: string | null;
  data_inicio_reprog?: string | null;
  data_fim_reprog?: string | null;
  data_inicio_real?: string | null;
  data_fim_real?: string | null;
  percentual_realizado: number;
  critico?: boolean | null;
  caminho_critico?: boolean | null;
  folga_dias: number | null;
  folga_total?: number | null;
  importancia_classe?: "Crítica" | "Alta" | "Média" | "Baixa" | null;
  importancia_score?: number | null;
  folga_livre_dias?: number | null;
  fanout_sucessoras?: number | null;
  marco?: boolean | null;
};

/**
 * Classifica o status de execução da tarefa em relação ao baseline.
 * - `concluido`: fim real preenchido
 * - `atrasado`: data_fim_reprog OU data_fim > baseline_fim
 * - `adiantado`: data_fim_reprog OU data_fim < baseline_fim
 * - `no_prazo`: iguais / sem baseline
 */
function statusItem(i: Item): "concluido" | "atrasado" | "adiantado" | "no_prazo" {
  if (i.data_fim_real) return "concluido";
  if (!i.data_fim_baseline) return "no_prazo";
  const fimAtual = i.data_fim_reprog || i.data_fim;
  const diff = differenceInCalendarDays(parseISO(fimAtual), parseISO(i.data_fim_baseline));
  if (diff > 1) return "atrasado";
  if (diff < -1) return "adiantado";
  return "no_prazo";
}

const STATUS_META: Record<
  ReturnType<typeof statusItem>,
  { label: string; bar: string; badge: string }
> = {
  concluido: { label: "Concluído", bar: "bg-success/80", badge: "bg-success/20 text-success" },
  atrasado: { label: "Atrasado", bar: "bg-destructive/80", badge: "bg-destructive/20 text-destructive" },
  adiantado: { label: "Adiantado", bar: "bg-info/80", badge: "bg-info/20 text-info" },
  no_prazo: { label: "No prazo", bar: "bg-primary/80", badge: "bg-primary/15 text-primary" },
};

export type GanttMarco = {
  id: string;
  nome: string;
  data_prevista: string;
  data_realizado: string | null;
  critico: boolean;
};

export type GanttDep = {
  item_id: string;
  predecessor_item_id: string | null;
  tipo: string; // FS, SS, FF, SF
  lag_dias: number | null;
};

const DAY_PX_BY_ZOOM: Record<string, number> = { d: 14, w: 4, m: 1.2 };

const ROW_H = 36; // h-9
const HEADER_H = 48; // h-12
const BAR_CENTER_Y = 22; // top-3.5 (14px) + h-4 (16px) / 2

// Cores de classe de importância vêm do mapa centralizado.
import { importanciaBgClass, IMPORTANCIA_LEGENDA } from "@/lib/cards/importancia-cores";
function importanciaColor(c: Item["importancia_classe"]): string {
  return importanciaBgClass(c as any);
}

function tipoLegivel(t: string): string {
  switch ((t ?? "FS").toUpperCase()) {
    case "FS":
      return "Término→Início";
    case "SS":
      return "Início→Início";
    case "FF":
      return "Término→Término";
    case "SF":
      return "Início→Término";
    default:
      return t;
  }
}

export function GanttTab({
  itens,
  marcos = [],
  deps = [],
  onItemSelect,
}: {
  itens: Item[];
  marcos?: GanttMarco[];
  deps?: GanttDep[];
  onItemSelect?: (id: string) => void;
}) {
  const [zoom, setZoom] = useState<"d" | "w" | "m">("w");
  const [criticosOnly, setCriticosOnly] = useState(false);
  const [showDeps, setShowDeps] = useState(true);
  const [focusId, setFocusId] = useState<string | null>(null);
  const [pinned, setPinned] = useState(false);

  const itensNormalizados = useMemo(
    () =>
      itens.map((item) => ({
        ...item,
        critico: Boolean(item.critico ?? item.caminho_critico),
        folga_dias: item.folga_dias ?? item.folga_total ?? null,
      })),
    [itens],
  );
  const totalCriticos = useMemo(
    () => itensNormalizados.filter((item) => item.critico).length,
    [itensNormalizados],
  );

  const data = useMemo(
    () => (criticosOnly ? itensNormalizados.filter((i) => i.critico) : itensNormalizados),
    [itensNormalizados, criticosOnly],
  );
  const visibleIds = useMemo(() => new Set(data.map((i) => i.id)), [data]);

  const { related, isFocused } = useMemo(() => {
    if (!focusId) return { related: null as Set<string> | null, isFocused: false };
    const r = new Set<string>([focusId]);
    for (const d of deps) {
      if (d.item_id === focusId && d.predecessor_item_id) r.add(d.predecessor_item_id);
      if (d.predecessor_item_id === focusId) r.add(d.item_id);
    }
    return { related: r, isFocused: true };
  }, [focusId, deps]);

  const { min, max } = useMemo(() => {
    const allDates: number[] = [];
    for (const i of data) {
      [i.data_inicio, i.data_fim, i.data_inicio_baseline, i.data_fim_baseline].forEach((d) => {
        if (d) allDates.push(parseISO(d).getTime());
      });
    }
    for (const m of marcos) {
      [m.data_prevista, m.data_realizado].forEach((d) => {
        if (d) allDates.push(parseISO(d).getTime());
      });
    }
    if (allDates.length === 0) return { min: new Date(), max: addDays(new Date(), 30) };
    return { min: new Date(Math.min(...allDates)), max: new Date(Math.max(...allDates)) };
  }, [data, marcos]);

  const dayPx = DAY_PX_BY_ZOOM[zoom];
  const totalDays = Math.max(1, differenceInCalendarDays(max, min) + 1);
  const width = totalDays * dayPx;

  const today = new Date();
  const todayOffset = differenceInCalendarDays(today, min) * dayPx;

  const months: { label: string; offset: number }[] = [];
  let cursor = new Date(min.getFullYear(), min.getMonth(), 1);
  while (cursor <= max) {
    months.push({
      label: format(cursor, "MMM/yy"),
      offset: differenceInCalendarDays(cursor, min) * dayPx,
    });
    cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
  }

  const opacityFor = (id: string) => (isFocused && !related!.has(id) ? 0.25 : 1);

  return (
    <div className="space-y-2">
      <DesktopOnlyHint label="Gantt otimizado para desktop." />
      <Card>
      <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <CardTitle>Gantt — baseline × atual</CardTitle>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant={criticosOnly ? "default" : "outline"}
            onClick={() => setCriticosOnly((v) => !v)}
            title={
              totalCriticos > 0
                ? `${totalCriticos} tarefa(s) crítica(s) calculada(s)`
                : "Nenhuma tarefa crítica calculada ainda"
            }
          >
            Caminho crítico{totalCriticos > 0 ? ` (${totalCriticos})` : ""}
          </Button>
          <Button
            size="sm"
            variant={showDeps ? "default" : "outline"}
            onClick={() => setShowDeps((v) => !v)}
          >
            Dependências
          </Button>
          <div className="flex gap-1">
            {(["d", "w", "m"] as const).map((z) => (
              <Button
                key={z}
                size="sm"
                variant={zoom === z ? "default" : "outline"}
                onClick={() => setZoom(z)}
              >
                {z === "d" ? "Dia" : z === "w" ? "Semana" : "Mês"}
              </Button>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-muted-foreground mb-2">
          <span className="flex items-center gap-1">
            <span className="inline-block w-3 h-1.5 rounded bg-muted-foreground/30" />
            Baseline
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block w-3 h-3 rounded bg-primary/80" /> No prazo
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block w-3 h-3 rounded bg-destructive/80" /> Atrasado
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block w-3 h-3 rounded bg-info/80" /> Adiantado
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block w-3 h-3 rounded bg-success/80" /> Concluído
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block w-3 h-3 rounded ring-1 ring-warning/60" /> Reprogramado
          </span>
        </div>
        {data.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {criticosOnly && totalCriticos === 0
              ? "Nenhuma tarefa crítica calculada. Recalcule o caminho crítico após importar o cronograma."
              : "Nenhum item para exibir."}
          </p>
        ) : (
          <div
            className="overflow-x-auto border rounded touch-pan-x"
            onMouseLeave={() => {
              if (!pinned) setFocusId(null);
            }}
          >
            <div className="flex">
              <div className="shrink-0 w-44 sm:w-72 border-r bg-muted/30">
                <div className="h-12 border-b px-2 flex items-center text-xs font-medium text-muted-foreground">
                  Item
                </div>
                {data.map((i) => {
                  const isFocus = focusId === i.id;
                  const op = opacityFor(i.id);
                  const status = statusItem(i);
                  const meta = STATUS_META[status];
                  const desvio =
                    i.data_fim_baseline
                      ? differenceInCalendarDays(
                          parseISO(i.data_fim_reprog || i.data_fim),
                          parseISO(i.data_fim_baseline),
                        )
                      : null;
                  const title = `${i.descricao ?? ""}\nStatus: ${meta.label}${desvio != null ? ` (${desvio > 0 ? "+" : ""}${desvio}d)` : ""}\nImportância: ${i.importancia_classe ?? "—"} (${i.importancia_score ?? "—"})\nFolga total ${i.folga_dias ?? "—"}d · livre ${i.folga_livre_dias ?? "—"}d · trava ${i.fanout_sucessoras ?? 0} sucessoras`;
                  const togglePin = () => {
                    if (pinned && focusId === i.id) {
                      setPinned(false);
                      setFocusId(null);
                    } else {
                      setPinned(true);
                      setFocusId(i.id);
                    }
                  };
                  return (
                    <div
                      key={i.id}
                      className={`h-9 border-b px-2 flex items-center text-xs gap-1 truncate cursor-pointer ${isFocus ? "bg-muted" : ""}`}
                      style={{ opacity: op }}
                      onMouseEnter={() => {
                        if (!pinned) setFocusId(i.id);
                      }}
                      onClick={() => {
                        togglePin();
                        onItemSelect?.(i.id);
                      }}
                      title={title}
                    >
                      <span className="text-muted-foreground tabular-nums w-8 shrink-0">
                        {i.ordem}
                      </span>
                      <span
                        className={`inline-block w-2 h-2 rounded-sm shrink-0 ${importanciaColor(i.importancia_classe)}`}
                        aria-label={i.importancia_classe ?? "Importância"}
                      />
                      <span className="truncate flex-1">{i.descricao}</span>
                      <span
                        className={`shrink-0 text-[9px] px-1 py-0 rounded ${meta.badge}`}
                        title={meta.label}
                      >
                        {status === "atrasado" && desvio != null
                          ? `+${desvio}d`
                          : status === "adiantado" && desvio != null
                            ? `${desvio}d`
                            : meta.label[0]}
                      </span>
                      {i.critico && (
                        <Badge
                          variant="destructive"
                          className="shrink-0 text-[10px] px-1 py-0"
                        >
                          crit
                        </Badge>
                      )}
                    </div>
                  );
                })}
              </div>
              <div className="relative overflow-x-auto flex-1 min-w-0">
                <div style={{ width, position: "relative" }}>
                  <div className="h-12 border-b relative bg-muted/20">
                    {months.map((m, idx) => (
                      <div
                        key={idx}
                        className="absolute top-0 h-full border-l text-[10px] text-muted-foreground pl-1"
                        style={{ left: m.offset }}
                      >
                        {m.label}
                      </div>
                    ))}
                    {marcos.map((mk) => {
                      const off = differenceInCalendarDays(parseISO(mk.data_prevista), min) * dayPx;
                      const realizado = !!mk.data_realizado;
                      return (
                        <div
                          key={mk.id}
                          className="absolute"
                          style={{ left: off - 6, top: 22 }}
                          title={`${mk.nome} · prev ${mk.data_prevista}${realizado ? ` · real ${mk.data_realizado}` : ""}`}
                        >
                          <div
                            className={`w-3 h-3 rotate-45 ${realizado ? "bg-success" : mk.critico ? "bg-destructive" : "bg-warning"} shadow`}
                          />
                        </div>
                      );
                    })}
                  </div>
                  {marcos.map((mk) => {
                    const off = differenceInCalendarDays(parseISO(mk.data_prevista), min) * dayPx;
                    if (off < 0 || off > width) return null;
                    return (
                      <div
                        key={`line-${mk.id}`}
                        className={`absolute top-0 bottom-0 w-px ${mk.critico ? "bg-destructive/40" : "bg-warning/40"} pointer-events-none`}
                        style={{ left: off }}
                      />
                    );
                  })}
                  {todayOffset >= 0 && todayOffset <= width && (
                    <div
                      className="absolute top-0 bottom-0 w-px bg-destructive/60 z-10 pointer-events-none"
                      style={{ left: todayOffset }}
                      title={`Hoje: ${format(today, "dd/MM/yyyy")}`}
                    />
                  )}
                  {data.map((i) => {
                    const bsStart = i.data_inicio_baseline
                      ? differenceInCalendarDays(parseISO(i.data_inicio_baseline), min) * dayPx
                      : null;
                    const bsEnd = i.data_fim_baseline
                      ? differenceInCalendarDays(parseISO(i.data_fim_baseline), min) * dayPx
                      : null;
                    // Barra "atual" prioriza datas reprogramadas quando existirem
                    const iniAtual = i.data_inicio_reprog || i.data_inicio;
                    const fimAtual = i.data_fim_reprog || i.data_fim;
                    const acStart = differenceInCalendarDays(parseISO(iniAtual), min) * dayPx;
                    const acEnd = differenceInCalendarDays(parseISO(fimAtual), min) * dayPx;
                    const acWidth = Math.max(2, acEnd - acStart);
                    const pct = Math.max(0, Math.min(100, Number(i.percentual_realizado || 0)));
                    const op = opacityFor(i.id);
                    const status = statusItem(i);
                    const meta = STATUS_META[status];
                    const barColor = i.critico ? "bg-destructive/80" : meta.bar;
                    const desvio =
                      i.data_fim_baseline
                        ? differenceInCalendarDays(parseISO(fimAtual), parseISO(i.data_fim_baseline))
                        : null;
                    const reprogramado = !!(i.data_inicio_reprog || i.data_fim_reprog);
                    const tooltip = [
                      `${i.descricao ?? ""}`,
                      `${iniAtual} → ${fimAtual} (${pct.toFixed(0)}%)`,
                      `Status: ${meta.label}${desvio != null ? ` · desvio ${desvio > 0 ? "+" : ""}${desvio}d` : ""}`,
                      i.critico ? "⚠ Caminho crítico" : null,
                      `Importância: ${i.importancia_classe ?? "—"}${i.importancia_score != null ? ` (score ${i.importancia_score})` : ""}`,
                      `Folga total ${i.folga_dias ?? "—"}d · livre ${i.folga_livre_dias ?? "—"}d`,
                      `Trava ${i.fanout_sucessoras ?? 0} sucessora(s)`,
                      reprogramado ? "Reprogramado" : null,
                      i.data_fim_real ? `Real: ${i.data_inicio_real ?? "—"} → ${i.data_fim_real}` : null,
                    ]
                      .filter(Boolean)
                      .join("\n");
                    return (
                      <div
                        key={i.id}
                        className={`h-9 border-b relative cursor-pointer ${i.critico ? "bg-destructive/5" : ""}`}
                        onMouseEnter={() => {
                          if (!pinned) setFocusId(i.id);
                        }}
                        onClick={() => {
                          if (pinned && focusId === i.id) {
                            setPinned(false);
                            setFocusId(null);
                          } else {
                            setPinned(true);
                            setFocusId(i.id);
                          }
                          onItemSelect?.(i.id);
                        }}
                        style={{ opacity: op }}
                      >
                        {bsStart != null && bsEnd != null && (
                          <div
                            className="absolute top-1 h-1.5 rounded bg-muted-foreground/30"
                            style={{ left: bsStart, width: Math.max(2, bsEnd - bsStart) }}
                            title={`Baseline: ${i.data_inicio_baseline} → ${i.data_fim_baseline}`}
                          />
                        )}
                        <div
                          className={`absolute top-3.5 h-4 rounded ${barColor} ${i.critico ? "ring-2 ring-destructive shadow-sm shadow-destructive/40" : reprogramado ? "ring-1 ring-warning/60" : ""}`}
                          style={{ left: acStart, width: acWidth }}
                          title={tooltip}
                        >
                          <div
                            className="h-full rounded bg-foreground/30"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                  {showDeps &&
                    deps.length > 0 &&
                    (() => {
                      const rowById = new Map<string, number>();
                      const itemById = new Map<string, Item>();
                      data.forEach((it, idx) => {
                        rowById.set(it.id, idx);
                        itemById.set(it.id, it);
                      });
                      const pos = (id: string) => {
                        const it = itemById.get(id);
                        if (!it) return null;
                        const s = differenceInCalendarDays(parseISO(it.data_inicio), min) * dayPx;
                        const e = differenceInCalendarDays(parseISO(it.data_fim), min) * dayPx;
                        const row = rowById.get(id) ?? 0;
                        const yCenter = HEADER_H + row * ROW_H + BAR_CENTER_Y;
                        return { s, e, yCenter, row, critico: it.critico };
                      };
                      const totalHeight = HEADER_H + data.length * ROW_H;
                      const STUB = 8;
                      return (
                        <svg
                          className="absolute top-0 left-0 pointer-events-none"
                          width={width}
                          height={totalHeight}
                          style={{ overflow: "visible" }}
                        >
                          <defs>
                            <marker
                              id="gantt-arrow"
                              viewBox="0 0 10 10"
                              refX="9"
                              refY="5"
                              markerWidth="6"
                              markerHeight="6"
                              orient="auto-start-reverse"
                            >
                              <path d="M 0 0 L 10 5 L 0 10 z" fill="hsl(var(--muted-foreground))" />
                            </marker>
                            <marker
                              id="gantt-arrow-crit"
                              viewBox="0 0 10 10"
                              refX="9"
                              refY="5"
                              markerWidth="6"
                              markerHeight="6"
                              orient="auto-start-reverse"
                            >
                              <path d="M 0 0 L 10 5 L 0 10 z" fill="hsl(var(--destructive))" />
                            </marker>
                            <marker
                              id="gantt-arrow-focus"
                              viewBox="0 0 10 10"
                              refX="9"
                              refY="5"
                              markerWidth="6"
                              markerHeight="6"
                              orient="auto-start-reverse"
                            >
                              <path d="M 0 0 L 10 5 L 0 10 z" fill="hsl(var(--primary))" />
                            </marker>
                          </defs>
                          {deps.map((d, idx) => {
                            if (!d.predecessor_item_id) return null;
                            if (
                              !visibleIds.has(d.predecessor_item_id) ||
                              !visibleIds.has(d.item_id)
                            )
                              return null;
                            const p = pos(d.predecessor_item_id);
                            const c = pos(d.item_id);
                            if (!p || !c) return null;
                            const tipo = (d.tipo ?? "FS").toUpperCase();
                            const px = tipo === "SS" || tipo === "SF" ? p.s : p.e;
                            const cx = tipo === "FF" || tipo === "SF" ? c.e : c.s;

                            // Orthogonal routing — detour when arrival is left of departure+stub
                            let path: string;
                            if (cx >= px + STUB) {
                              const midX = px + STUB;
                              path = `M ${px} ${p.yCenter} L ${midX} ${p.yCenter} L ${midX} ${c.yCenter} L ${cx} ${c.yCenter}`;
                            } else {
                              const outX = px + STUB;
                              const backX = cx - STUB;
                              const detourY =
                                p.yCenter < c.yCenter
                                  ? HEADER_H + (p.row + 1) * ROW_H - 4
                                  : HEADER_H + p.row * ROW_H + 4;
                              path = `M ${px} ${p.yCenter} L ${outX} ${p.yCenter} L ${outX} ${detourY} L ${backX} ${detourY} L ${backX} ${c.yCenter} L ${cx} ${c.yCenter}`;
                            }

                            const bothCrit = p.critico && c.critico;
                            const touchesFocus =
                              isFocused &&
                              (d.predecessor_item_id === focusId || d.item_id === focusId);

                            let stroke = "hsl(var(--muted-foreground))";
                            let strokeWidth = 1;
                            let opacity = 0.5;
                            let marker = "url(#gantt-arrow)";

                            if (bothCrit) {
                              stroke = "hsl(var(--destructive))";
                              strokeWidth = 1.5;
                              opacity = 0.7;
                              marker = "url(#gantt-arrow-crit)";
                            }
                            if (isFocused) {
                              if (touchesFocus) {
                                stroke = "hsl(var(--primary))";
                                strokeWidth = 2;
                                opacity = 1;
                                marker = "url(#gantt-arrow-focus)";
                              } else {
                                opacity = 0.1;
                              }
                            }

                            const lagTxt = d.lag_dias && d.lag_dias > 0 ? ` +${d.lag_dias}d` : "";
                            const tip = `${tipo} · ${tipoLegivel(tipo)}${lagTxt}`;

                            return (
                              <g key={idx}>
                                <path
                                  d={path}
                                  fill="none"
                                  stroke="transparent"
                                  strokeWidth={8}
                                  style={{ pointerEvents: "auto" }}
                                >
                                  <title>{tip}</title>
                                </path>
                                <path
                                  d={path}
                                  fill="none"
                                  stroke={stroke}
                                  strokeWidth={strokeWidth}
                                  strokeOpacity={opacity}
                                  markerEnd={marker}
                                  style={{ pointerEvents: "auto" }}
                                >
                                  <title>{tip}</title>
                                </path>
                              </g>
                            );
                          })}
                        </svg>
                      );
                    })()}
                </div>
              </div>
            </div>
          </div>
        )}
        <div className="flex flex-wrap gap-4 mt-3 text-xs text-muted-foreground items-center">
          <span className="inline-flex items-center gap-1">
            <span className="inline-block w-3 h-1.5 bg-muted-foreground/60 rounded" /> Baseline
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="inline-block w-3 h-2 bg-primary rounded" /> Atual
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="inline-block w-3 h-2 bg-destructive rounded" /> Crítico
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="inline-block w-2 h-3 bg-destructive" /> Hoje
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="inline-block w-2 h-2 bg-warning rotate-45" /> Marco previsto
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="inline-block w-2 h-2 bg-success rotate-45" /> Marco realizado
          </span>
          <span className="inline-flex items-center gap-1">
            <svg width="20" height="6">
              <line x1="0" y1="3" x2="20" y2="3" stroke="var(--muted-foreground)" strokeWidth="1" />
            </svg>{" "}
            Dependência
          </span>
          <span className="inline-flex items-center gap-1">
            <svg width="20" height="6">
              <line x1="0" y1="3" x2="20" y2="3" stroke="var(--destructive)" strokeWidth="1.5" />
            </svg>{" "}
            Dep. crítica
          </span>
          <span className="inline-flex items-center gap-2 ml-2">
            {IMPORTANCIA_LEGENDA.map((it) => (
              <span key={it.label} className="inline-flex items-center gap-1">
                <span className={`inline-block w-2 h-2 rounded-sm ${it.bg}`} /> {it.label}
              </span>
            ))}
          </span>
        </div>
      </CardContent>
      </Card>
    </div>
  );
}
