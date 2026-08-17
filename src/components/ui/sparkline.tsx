import { cn } from "@/lib/utils";

interface SparklineProps {
  values: number[];
  width?: number;
  height?: number;
  className?: string;
  ariaLabel?: string;
}

/** slice-21 — sparkline SVG minimalista para tendências curtas. */
export function Sparkline({
  values,
  width = 64,
  height = 16,
  className,
  ariaLabel,
}: SparklineProps) {
  if (!values.length) {
    return (
      <span
        className={cn("inline-block text-muted-foreground/60 text-[10px]", className)}
        aria-label={ariaLabel ?? "Sem dados"}
      >
        —
      </span>
    );
  }
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const range = max - min || 1;
  const stepX = values.length > 1 ? width / (values.length - 1) : 0;
  const pad = 1.5;
  const h = height - pad * 2;
  const points = values
    .map((v, i) => {
      const x = values.length === 1 ? width / 2 : i * stepX;
      const y = pad + h - ((v - min) / range) * h;
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");
  const last = values[values.length - 1];
  const lastX = values.length === 1 ? width / 2 : (values.length - 1) * stepX;
  const lastY = pad + h - ((last - min) / range) * h;
  return (
    <svg
      role="img"
      aria-label={ariaLabel ?? `Tendência de ${values.length} pontos`}
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={cn("inline-block align-middle", className)}
    >
      <polyline
        fill="none"
        stroke="currentColor"
        strokeWidth={1.25}
        strokeLinejoin="round"
        strokeLinecap="round"
        points={points}
      />
      <circle cx={lastX} cy={lastY} r={1.75} fill="currentColor" />
    </svg>
  );
}
