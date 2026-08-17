/**
 * Módulo único de gráficos — Achado DS-008.
 *
 * Padroniza o consumo de Recharts no aplicativo:
 *  - Fonte única de import (`@/components/ui/chart`), evitando o import cru de `recharts` espalhado.
 *  - Paleta de cores por token semântico (`CHART_COLORS`) alinhada ao design-system.
 *  - Estilo de tooltip padrão (`AppTooltip`) usando tokens de superfície/borda.
 *
 * Uso mínimo:
 *   import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, AppTooltip, CHART_COLORS } from "@/components/ui/chart";
 *
 * Nada aqui altera comportamento — apenas centraliza o ponto de adoção.
 */
export * from "recharts";

import { Tooltip, type TooltipProps } from "recharts";

/** Paleta canônica — usa variáveis CSS já definidas no design-system. */
export const CHART_COLORS = {
  primary: "hsl(var(--primary))",
  secondary: "hsl(var(--secondary))",
  accent: "hsl(var(--accent))",
  muted: "hsl(var(--muted-foreground))",
  destructive: "hsl(var(--destructive))",
  success: "hsl(var(--success, var(--primary)))",
  warning: "hsl(var(--warning, var(--accent)))",
  series: [
    "hsl(var(--primary))",
    "hsl(var(--accent))",
    "hsl(var(--secondary))",
    "hsl(var(--destructive))",
    "hsl(var(--muted-foreground))",
  ] as const,
  /**
   * Paleta CATEGÓRICA — use quando as séries precisam ser distinguidas entre si
   * (fatias de uma composição, faixas de um empilhado). `series` acima mistura
   * tokens de marca e de status e não garante separação; esta garante.
   *
   * Consuma sempre na ordem, do slot 1 em diante, e nunca cicle para uma 7ª
   * série: agrupe o excedente em "Outros". Ver `--chart-N` em index.css.
   */
  categorical: [
    "hsl(var(--chart-1))",
    "hsl(var(--chart-2))",
    "hsl(var(--chart-3))",
    "hsl(var(--chart-4))",
    "hsl(var(--chart-5))",
    "hsl(var(--chart-6))",
  ] as const,
} as const;

/** Estilo base para <Tooltip /> do Recharts alinhado aos tokens do tema. */
export const APP_TOOLTIP_STYLE: Partial<TooltipProps<number, string>> = {
  contentStyle: {
    background: "hsl(var(--popover))",
    color: "hsl(var(--popover-foreground))",
    border: "1px solid hsl(var(--border))",
    borderRadius: "var(--radius)",
    fontSize: 12,
  },
  labelStyle: { color: "hsl(var(--popover-foreground))", fontWeight: 500 },
  itemStyle: { color: "hsl(var(--popover-foreground))" },
  cursor: { fill: "hsl(var(--muted) / 0.35)" },
};

/** Tooltip padronizado — substitui `<Tooltip />` cru para garantir tema consistente. */
export function AppTooltip(props: TooltipProps<number, string>) {
  return <Tooltip<number, string> {...APP_TOOLTIP_STYLE} {...props} />;
}
