import type { ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export type KpiTone =
  | "default"
  | "success"
  | "warning"
  | "danger"
  | "muted"
  | "primary";

export type KpiSize = "sm" | "md" | "lg";

export interface KpiProps {
  label: ReactNode;
  value: ReactNode;
  tone?: KpiTone;
  hint?: ReactNode;
  icon?: ReactNode;
  highlight?: boolean;
  size?: KpiSize;
  labelUppercase?: boolean;
  className?: string;
  valueClassName?: string;
  tabularNums?: boolean;
  onClick?: () => void;
  title?: string;
}

const toneColor: Record<KpiTone, string> = {
  default: "",
  success: "text-success",
  warning: "text-warning",
  danger: "text-destructive",
  muted: "text-muted-foreground",
  primary: "text-primary",
};

const sizeCls: Record<KpiSize, string> = {
  sm: "text-lg",
  md: "text-xl",
  lg: "text-2xl",
};

/**
 * Kpi — componente único para os cards de indicadores usados em dashboards.
 * Substitui reimplementações locais (`Kpi`, `KpiCard`, `KpiMini`, `KpiBox`, `Stat`, `StatCard`).
 */
export function Kpi({
  label,
  value,
  tone = "default",
  hint,
  icon,
  highlight,
  size = "md",
  labelUppercase,
  className,
  valueClassName,
  tabularNums = true,
  onClick,
  title,
}: KpiProps) {
  const clickable = !!onClick;
  return (
    <Card
      className={cn(
        highlight && "border-primary/40 bg-primary/5",
        clickable && "cursor-pointer hover:bg-muted/40 transition-colors",
        className,
      )}
      onClick={onClick}
      role={clickable ? "button" : undefined}
      tabIndex={clickable ? 0 : undefined}
      onKeyDown={
        clickable
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onClick?.();
              }
            }
          : undefined
      }
    >
      <CardContent className="p-4">
        <div className="flex items-center justify-between gap-2">
          <div
            className={cn(
              "text-xs text-muted-foreground",
              labelUppercase && "uppercase tracking-wide",
            )}
          >
            {label}
          </div>
          {icon ? <div className="text-muted-foreground shrink-0">{icon}</div> : null}
        </div>
        <div
          className={cn(
            "font-semibold mt-1",
            sizeCls[size],
            tabularNums && "tabular-nums",
            toneColor[tone],
            valueClassName,
          )}
          title={title}
        >
          {value}
        </div>
        {hint ? (
          <div className="text-xs text-muted-foreground mt-1 leading-snug">{hint}</div>
        ) : null}
      </CardContent>
    </Card>
  );
}

export default Kpi;
