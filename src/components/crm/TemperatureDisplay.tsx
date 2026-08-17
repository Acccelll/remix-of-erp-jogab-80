import React from "react";
import { cn } from "@/lib/utils";

type TemperatureLevel = "frio" | "morno" | "quente" | null | undefined;

interface TemperatureDisplayProps {
  value?: TemperatureLevel;
  size?: "sm" | "md";
  /** 'dot' shows only a small colored circle; 'pill' shows label. */
  variant?: "dot" | "pill";
}

const COLORS: Record<
  Exclude<TemperatureLevel, null | undefined>,
  { dot: string; pill: string; label: string }
> = {
  frio: { dot: "bg-blue-600", pill: "bg-blue-100 text-blue-600 border-blue-600/40", label: "Frio" },
  morno: {
    dot: "bg-warning",
    pill: "bg-warning/15 text-warning border-warning/40",
    label: "Morno",
  },
  quente: { dot: "bg-destructive", pill: "bg-destructive/15 text-destructive border-destructive/40", label: "Quente" },
};

export function TemperatureDisplay({
  value,
  size = "sm",
  variant = "pill",
}: TemperatureDisplayProps) {
  if (!value) return null;
  const cfg = COLORS[value as keyof typeof COLORS];
  if (!cfg) return null;

  if (variant === "dot") {
    const dim = size === "md" ? "h-3.5 w-3.5" : "h-2.5 w-2.5";
    return (
      <span
        title={cfg.label}
        aria-label={`Temperatura: ${cfg.label}`}
        className={cn("inline-block rounded-full ring-1 ring-black/10", cfg.dot, dim)}
      />
    );
  }

  const sizeClasses = size === "md" ? "px-3 py-1.5 text-sm" : "px-2 py-1 text-xs";
  return (
    <span className={cn("inline-block rounded-full border font-medium", cfg.pill, sizeClasses)}>
      {cfg.label}
    </span>
  );
}
