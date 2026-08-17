import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";

/**
 * slice-32 — Resumo compacto de tendências (piora / estáveis / melhora)
 * extraído de `ContagensCiclicas` para reuso em outras listas com histórico.
 *
 * Contrato:
 *  - UI-only, sem estado próprio.
 *  - O chip "em piora" é opcionalmente clicável (via `onTogglePiora`) e
 *    reflete `piorAtiva` como `aria-pressed`.
 *  - Quando nenhum callback é passado, os três valores são renderizados como
 *    spans informativos.
 */
export type TrendCategoryLabels = {
  piora?: string;
  estavel?: string;
  melhora?: string;
};

export type TrendSummaryProps = {
  piora: number;
  estavel: number;
  melhora: number;
  /** Rótulo do total (default: "com histórico"). */
  totalLabel?: string;
  /** Prefixo (default: "Tendência"). */
  label?: string;
  /** Se fornecido, o chip "em piora" vira toggle. */
  onTogglePiora?: () => void;
  piorAtiva?: boolean;
  className?: string;
  /** slice-35 — renderiza placeholder quando total===0 em vez de null. */
  showWhenEmpty?: boolean;
  /** Texto do placeholder (default: "Sem dados no período"). */
  emptyLabel?: string;
  /** slice-36 — rótulos por categoria (default: "em piora"/"estáveis"/"em melhora"). */
  labels?: TrendCategoryLabels;
};

export function TrendSummary({
  piora,
  estavel,
  melhora,
  totalLabel = "com histórico",
  label = "Tendência",
  onTogglePiora,
  piorAtiva = false,
  className,
  showWhenEmpty = false,
  emptyLabel = "Sem dados no período",
  labels,
}: TrendSummaryProps) {
  const lblPiora = labels?.piora ?? "em piora";
  const lblEstavel = labels?.estavel ?? "estáveis";
  const lblMelhora = labels?.melhora ?? "em melhora";
  const total = piora + estavel + melhora;
  if (total === 0 && !showWhenEmpty) return null;
  if (total === 0) {
    return (
      <div
        className={
          "flex flex-wrap items-center gap-2 text-xs text-muted-foreground" +
          (className ? ` ${className}` : "")
        }
        aria-label="Resumo de tendências (sem dados)"
      >
        <span>{label}:</span>
        <span className="italic opacity-70">{emptyLabel}</span>
      </div>
    );
  }

  const piorClasses =
    "inline-flex items-center gap-1 rounded px-1.5 py-0.5 tabular-nums transition-colors " +
    (piorAtiva
      ? "bg-destructive text-destructive-foreground"
      : "bg-destructive/10 text-destructive") +
    (onTogglePiora ? " hover:bg-destructive/20 disabled:opacity-50 disabled:cursor-not-allowed" : "");

  return (
    <div
      className={
        "flex flex-wrap items-center gap-2 text-xs text-muted-foreground" +
        (className ? ` ${className}` : "")
      }
      aria-label="Resumo de tendências"
    >
      <span>
        {label} ({total} {totalLabel}):
      </span>
      {onTogglePiora ? (
        <button
          type="button"
          onClick={onTogglePiora}
          disabled={piora === 0 && !piorAtiva}
          aria-pressed={piorAtiva}
          title={piorAtiva ? "Remover filtro 'Somente em piora'" : "Filtrar apenas em piora"}
          className={piorClasses}
        >
          <ArrowUp className="h-3 w-3" />
          {piora} {lblPiora}
        </button>
      ) : (
        <span className={piorClasses}>
          <ArrowUp className="h-3 w-3" />
          {piora} {lblPiora}
        </span>
      )}
      <span className="inline-flex items-center gap-1 rounded bg-muted px-1.5 py-0.5 tabular-nums">
        <ArrowUpDown className="h-3 w-3" />
        {estavel} {lblEstavel}
      </span>
      <span className="inline-flex items-center gap-1 rounded bg-success/10 px-1.5 py-0.5 tabular-nums text-success">
        <ArrowDown className="h-3 w-3" />
        {melhora} {lblMelhora}
      </span>
    </div>
  );
}
