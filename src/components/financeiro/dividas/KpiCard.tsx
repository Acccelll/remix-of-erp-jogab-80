import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { brl } from "@/lib/billing";
import type { Tone } from "./types";

export function KpiCard({
  label,
  valor,
  tone,
  variacao,
  footer,
  onClick,
}: {
  label: string;
  valor: number;
  tone: Tone;
  variacao: { delta: number; pct: number | null } | null;
  footer?: string;
  onClick?: () => void;
}) {
  const toneClass =
    tone === "danger" ? "text-destructive" : tone === "warn" ? "text-warning" : "text-foreground";
  const Icon =
    !variacao || variacao.delta === 0 ? Minus : variacao.delta > 0 ? ArrowUpRight : ArrowDownRight;
  const deltaColor =
    !variacao || variacao.delta === 0
      ? "text-muted-foreground"
      : variacao.delta > 0
        ? "text-destructive"
        : "text-success";
  return (
    <Card
      className={onClick ? "cursor-pointer hover:bg-muted/40 transition-colors" : ""}
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onClick();
              }
            }
          : undefined
      }
    >
      <CardContent className="py-4">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className={`text-2xl font-semibold mt-1 ${toneClass}`}>{brl(valor)}</div>
        {variacao && (
          <div
            className={`mt-1 flex items-center gap-1 text-xs ${deltaColor}`}
            title={
              variacao.pct == null
                ? "Sem ponto anterior comparável"
                : `Variação vs. snapshot anterior`
            }
          >
            <Icon className="h-3.5 w-3.5" />
            {variacao.delta > 0 ? "+" : ""}
            {brl(variacao.delta)}
            {variacao.pct != null && (
              <span className="text-muted-foreground">
                ({variacao.pct > 0 ? "+" : ""}
                {variacao.pct}%)
              </span>
            )}
          </div>
        )}
        {footer && (
          <div className="mt-2 text-[11px] text-muted-foreground leading-snug">{footer}</div>
        )}
      </CardContent>
    </Card>
  );
}
