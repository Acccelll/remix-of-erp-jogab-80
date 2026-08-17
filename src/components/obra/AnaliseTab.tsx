import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { brl } from "@/lib/billing";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
} from "@/components/ui/chart";
import {
  HierarquiaTree,
  HierarquiaTreeControls,
  buildTree,
  type CronoNode,
} from "@/lib/cronograma/crono-tree";
// BIZ-001 (Onda 5) — engine EVM/Curva-S centralizada em lib/pmbok.
import { calcularEVM, curvaPVMensal, type EvmItemCrono } from "@/lib/pmbok/evm";

type CronoItem = {
  id: string;
  descricao: string | null;
  custo: number | null;
  custo_baseline: number | null;
  percentual_previsto: number | null;
  percentual_realizado: number | null;
  data_inicio: string;
  data_fim: string;
  ativo: boolean;
};
type ItemMed = {
  medicao_id: string;
  cronograma_item_id: string;
  percentual_atual: number;
  valor_atual: number;
};
type Medicao = { id: string; data_corte: string; valor: number; status: string };
type Nf = { data_emissao: string | null; valor: number; valor_liquido: number | null };

export function AnaliseTab({
  obra,
  crono,
  medicoes,
  itensMedicao,
  nfs,
}: {
  obra: any;
  crono: CronoItem[];
  medicoes: Medicao[];
  itensMedicao: ItemMed[];
  nfs: Nf[];
}) {
  const ativos = useMemo(() => crono.filter((c) => c.ativo !== false), [crono]);
  const valorContrato = Number(obra?.valor_contrato || 0);

  // BIZ-001 — adapta CronoItem local ao contrato EvmItemCrono da engine central.
  const itensEvm = useMemo<EvmItemCrono[]>(
    () =>
      ativos.map((c) => ({
        custo: c.custo,
        custo_baseline: c.custo_baseline,
        percentual_previsto: c.percentual_previsto,
        percentual_realizado: c.percentual_realizado,
        data_inicio: c.data_inicio,
        data_fim: c.data_fim,
        data_inicio_baseline: null,
        data_fim_baseline: null,
        ativo: c.ativo,
      })),
    [ativos],
  );

  // === EVM (central, lib/pmbok) ===
  const evm = useMemo(() => {
    const medicoesFallback = medicoes.map((m) => ({ status: m.status, valor: m.valor }));
    return calcularEVM({ itens: itensEvm, medicoesFallback });
  }, [itensEvm, medicoes]);

  // === Curva S por mês ===
  // Previsto: usa `curvaPVMensal` (lib/pmbok). Realizado/Faturado: agregação local
  // (não são EVM puros — vêm de medições físicas e NFs).
  const curva = useMemo(() => {
    const previsto = curvaPVMensal(itensEvm);
    if (!previsto.length) return [];

    const realizadoMes = new Map<string, number>();
    const medById = new Map(medicoes.map((m) => [m.id, m]));
    for (const im of itensMedicao) {
      const m = medById.get(im.medicao_id);
      if (!m) continue;
      try {
        const key = format(parseISO(m.data_corte), "yyyy-MM");
        realizadoMes.set(key, (realizadoMes.get(key) ?? 0) + Number(im.valor_atual ?? 0));
      } catch {
        /* data inválida */
      }
    }

    const faturadoMes = new Map<string, number>();
    for (const n of nfs) {
      if (!n.data_emissao) continue;
      try {
        const key = format(parseISO(n.data_emissao), "yyyy-MM");
        faturadoMes.set(key, (faturadoMes.get(key) ?? 0) + Number(n.valor ?? 0));
      } catch {
        /* data inválida */
      }
    }

    let accR = 0;
    let accF = 0;
    return previsto.map(({ mes, pvAcum }) => {
      accR += realizadoMes.get(mes) ?? 0;
      accF += faturadoMes.get(mes) ?? 0;
      return {
        mes: format(parseISO(mes + "-01"), "MMM/yy", { locale: ptBR }),
        previsto: Math.round(pvAcum),
        realizado: Math.round(accR),
        faturado: Math.round(accF),
      };
    });
  }, [itensEvm, medicoes, itensMedicao, nfs]);

  // === Valor medido (real) por cronograma_item_id ===
  const valorPorItem = useMemo(() => {
    const m = new Map<string, number>();
    for (const im of itensMedicao) {
      m.set(
        im.cronograma_item_id,
        (m.get(im.cronograma_item_id) ?? 0) + Number(im.valor_atual ?? 0),
      );
    }
    return m;
  }, [itensMedicao]);

  const roots = useMemo(() => buildTree(ativos), [ativos]);

  // Soma do "valor medido" agregada por nó (folha = lookup, pai = soma dos filhos)
  const sumValorMedido = (node: CronoNode): number => {
    if (node.children.length === 0 && node.item) return valorPorItem.get(node.item.id) ?? 0;
    let s = 0;
    for (const c of node.children) s += sumValorMedido(c);
    if (node.item) s += valorPorItem.get(node.item.id) ?? 0;
    return s;
  };

  const valorContratoTree = valorContrato || evm.BAC || 1;

  return (
    <div className="space-y-6 pt-4">
      <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
        <KpiMini label="BAC" v={brl(evm.BAC)} hint="Orçamento total" />
        <KpiMini label="PV (planejado)" v={brl(evm.PV)} hint="até hoje, linear" />
        <KpiMini label="EV (executado)" v={brl(evm.EV)} hint="% real × custo" />
        <KpiMini label="AC (medido)" v={brl(evm.AC)} hint="medições aprovadas" />
        <KpiMini
          label="SV"
          v={brl(evm.SV)}
          tone={evm.SV >= 0 ? "good" : "bad"}
          hint="cronograma (EV-PV)"
        />
        <KpiMini
          label="CV"
          v={brl(evm.CV)}
          tone={evm.CV >= 0 ? "good" : "bad"}
          hint="custo (EV-AC)"
        />
        <KpiMini
          label="SPI"
          v={evm.SPI.toFixed(2)}
          tone={evm.SPI >= 1 ? "good" : "bad"}
          hint="≥1 no prazo"
        />
        <KpiMini
          label="CPI"
          v={evm.CPI.toFixed(2)}
          tone={evm.CPI >= 1 ? "good" : "bad"}
          hint="≥1 dentro do custo"
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Curva S — acumulado</CardTitle>
        </CardHeader>
        <CardContent>
          {curva.length === 0 ? (
            <div className="text-sm text-muted-foreground text-center py-8">
              Sem cronograma para gerar a curva.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={curva} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(v: any) => brl(Number(v))} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Area
                  type="monotone"
                  dataKey="previsto"
                  name="Previsto"
                  stroke="#3b82f6"
                  fill="#3b82f6"
                  fillOpacity={0.15}
                  strokeWidth={2}
                />
                <Area
                  type="monotone"
                  dataKey="realizado"
                  name="Realizado (físico)"
                  stroke="#10b981"
                  fill="#10b981"
                  fillOpacity={0.15}
                  strokeWidth={2}
                />
                <Area
                  type="monotone"
                  dataKey="faturado"
                  name="Faturado"
                  stroke="#f59e0b"
                  fill="#f59e0b"
                  fillOpacity={0.15}
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Progresso por item — físico × financeiro</CardTitle>
          <HierarquiaTreeControls roots={roots} />
        </CardHeader>
        <CardContent>
          {ativos.length === 0 ? (
            <div className="text-sm text-muted-foreground text-center py-8">Sem itens.</div>
          ) : (
            <div className="max-h-[500px] overflow-auto">
              <HierarquiaTree
                roots={roots}
                valorContrato={valorContratoTree}
                columns={[
                  {
                    key: "custo",
                    header: <span className="text-right block">Custo</span>,
                    align: "right",
                    showOnParents: true,
                    render: ({ agg }) => (
                      <span className="tabular-nums text-xs">{brl(agg.base)}</span>
                    ),
                  },
                  {
                    key: "pctprev",
                    header: "% Previsto",
                    width: "w-[160px]",
                    showOnParents: true,
                    render: ({ agg, isLeaf, node }) => {
                      const v = isLeaf ? Number(node.item?.percentual_previsto || 0) : agg.pct;
                      return <PctCell v={v} />;
                    },
                  },
                  {
                    key: "pctreal",
                    header: "% Realizado",
                    width: "w-[160px]",
                    showOnParents: true,
                    render: ({ agg, isLeaf, node }) => {
                      const prev = isLeaf ? Number(node.item?.percentual_previsto || 0) : agg.pct;
                      const real = isLeaf
                        ? Number(node.item?.percentual_realizado || 0)
                        : agg.base > 0
                          ? (agg.executado / agg.base) * 100
                          : 0;
                      return <PctCell v={real} tone={real + 0.001 < prev ? "bad" : "good"} />;
                    },
                  },
                  {
                    key: "pctfin",
                    header: "% Financeiro",
                    width: "w-[160px]",
                    showOnParents: true,
                    render: ({ agg, node }) => {
                      const valor = sumValorMedido(node);
                      const v = agg.base > 0 ? (valor / agg.base) * 100 : 0;
                      return <PctCell v={v} />;
                    },
                  },
                ]}
              />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function KpiMini({
  label,
  v,
  hint,
  tone,
}: {
  label: string;
  v: string;
  hint?: string;
  tone?: "good" | "bad";
}) {
  const cls =
    tone === "good"
      ? "text-success"
      : tone === "bad"
        ? "text-destructive"
        : "";
  return (
    <Card>
      <CardContent className="pt-4 pb-3">
        <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
        <div className={`text-lg font-semibold mt-1 ${cls}`}>{v}</div>
        {hint && <div className="text-[10px] text-muted-foreground mt-0.5">{hint}</div>}
      </CardContent>
    </Card>
  );
}

function PctCell({ v, tone }: { v: number; tone?: "good" | "bad" }) {
  const color =
    tone === "bad"
      ? "text-destructive"
      : tone === "good"
        ? "text-success"
        : "";
  return (
    <div className="flex items-center gap-2">
      <Progress value={Math.min(100, Math.max(0, v))} className="h-2 flex-1" />
      <span className={`text-xs tabular-nums w-12 text-right ${color}`}>{v.toFixed(1)}%</span>
    </div>
  );
}
