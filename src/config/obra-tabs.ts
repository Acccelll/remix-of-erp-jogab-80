import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard as LayoutDashboardIcon,
  Calendar as CalendarIcon,
  GanttChart as GanttChartIcon,
  FilePlus as FilePlusIcon,
  GitCompare as GitCompareIcon,
  LineChart as LineChartIcon,
  BarChart3 as BarChart3Icon,
  TrendingUp as TrendingUpIcon,
  Ruler as RulerIcon,
  Receipt as ReceiptIcon,
  Banknote as BanknoteIcon,
  Wallet as WalletIcon,
  AlertTriangle as AlertTriangleIcon,
  MessageSquareWarning as MessageSquareWarningIcon,
  History as HistoryIcon,
} from "lucide-react";

export interface ObraTabItem {
  value: string;
  label: string;
  icon: LucideIcon;
  /** Descrição curta exibida como tooltip/hint no rail (UX-003). */
  description?: string;
  /**
   * A aba mostra dados financeiros da obra (medições, notas fiscais,
   * recebimentos, BMs previstas) e por isso exige a PageKey `financeiro`.
   * Quem não tem o módulo continua vendo a aba, mas com o aviso do que falta
   * — some da tela seria pior: o usuário não descobriria que a área existe.
   */
  requerFinanceiro?: boolean;
}

export interface ObraTabSection {
  label: string;
  items: ObraTabItem[];
}

/**
 * Fonte única das abas da obra (rail vertical no desktop + Select no mobile).
 *
 * Fase 1 — Reorganização em 5 seções, na ordem do fluxo
 * (Resumo → Planejamento → Medição & Faturamento → Análise → Riscos & Histórico).
 *
 * Fase 2 — Gantt e Comparar deixam de ser itens do rail e viram VISÕES
 * dentro da aba Cronograma (controladas por `?cView=`). Permanecem em
 * `OBRA_TAB_LABELS` para que breadcrumbs e deep links antigos resolvam o rótulo.
 */
export const OBRA_TAB_SECTIONS: ObraTabSection[] = [
  {
    label: "Resumo",
    items: [{ value: "resumo", label: "Resumo", icon: LayoutDashboardIcon }],
  },
  {
    label: "Planejamento",
    items: [
      { value: "cronograma", label: "Cronograma", icon: CalendarIcon },
      { value: "aditivos", label: "Aditivos", icon: FilePlusIcon },
    ],
  },
  {
    label: "Medição & Faturamento",
    items: [
      { value: "medicoes", label: "Medições", icon: RulerIcon, requerFinanceiro: true },
      { value: "nfs", label: "Faturamento", icon: ReceiptIcon, requerFinanceiro: true },
      { value: "recebimentos", label: "Recebimentos", icon: BanknoteIcon, requerFinanceiro: true },
      { value: "financeiro", label: "Financeiro", icon: WalletIcon, requerFinanceiro: true },
    ],
  },
  {
    label: "Análise",
    items: [
      {
        value: "desempenho",
        label: "Desempenho (EVM)",
        icon: TrendingUpIcon,
        // Earned Value parte do que foi MEDIDO: sem medições, os índices mentem.
        requerFinanceiro: true,
        description: "Curva S PV/EV/AC, índices SPI/CPI e projeções (Earned Value).",
      },
      {
        value: "previsao",
        label: "Previsão de faturamento",
        icon: LineChartIcon,
        requerFinanceiro: true,
        description: "BMS previstas e fluxo de recebimento planejado.",
      },
      {
        value: "analise",
        label: "Físico × Financeiro",
        icon: BarChart3Icon,
        requerFinanceiro: true,
        description: "Confronto entre avanço físico e financeiro por item.",
      },
    ],
  },
  {
    label: "Riscos & Histórico",
    items: [
      { value: "riscos", label: "Riscos", icon: AlertTriangleIcon },
      { value: "ocorrencias", label: "Ocorrências", icon: MessageSquareWarningIcon },
      { value: "historico", label: "Histórico", icon: HistoryIcon },
    ],
  },
];

export const OBRA_TAB_ITEMS: ObraTabItem[] = OBRA_TAB_SECTIONS.flatMap((s) => s.items);

/**
 * Rótulos auxiliares: incluem `gantt`/`comparar` (agora visões internas) e
 * as sub-visões do cronograma, para que breadcrumbs e o ⌘K consigam resolver
 * deep links históricos.
 */
const OBRA_TAB_LABELS: Record<string, string> = (() => {
  const m: Record<string, string> = {};
  for (const it of OBRA_TAB_ITEMS) m[it.value] = it.label;
  m.gantt = "Gantt";
  m.comparar = "Comparar";
  m.principal = "Principal";
  m.caminho = "Caminho crítico";
  m.semanal = "Semanal";
  return m;
})();

export function obraTabLabel(value: string | null | undefined): string | undefined {
  if (!value) return undefined;
  return OBRA_TAB_LABELS[value];
}

/**
 * Fase 2 — visões internas da aba Cronograma. O estado é persistido em
 * `?cView=` para preservar deep links.
 */
export const CRONOGRAMA_VIEW_VALUES = [
  "principal",
  "gantt",
  "caminho",
  "semanal",
  "comparar",
] as const;
export type CronogramaView = (typeof CRONOGRAMA_VIEW_VALUES)[number];

/** Abas que exigem a PageKey `financeiro` (ver `requerFinanceiro`). */
export const OBRA_TABS_FINANCEIRAS: ReadonlySet<string> = new Set(
  OBRA_TAB_ITEMS.filter((i) => i.requerFinanceiro).map((i) => i.value),
);
