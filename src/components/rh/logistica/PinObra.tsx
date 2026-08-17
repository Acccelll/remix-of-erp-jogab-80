import React from "react";
import { cn } from "@/lib/utils";

/**
 * Marcador de obra — silhueta de estrutura dentro de um losango.
 *
 * Losango (e não gota) para diferenciar de colaborador pela forma, não só pela
 * cor. O estado reflete a cobertura do efetivo previsto no Histograma.
 */
export type EstadoObra = "completa" | "deficit" | "critica";

const CORES: Record<EstadoObra, { fill: string; stroke: string }> = {
  completa: { fill: "hsl(var(--primary))", stroke: "hsl(var(--primary-foreground))" },
  deficit: { fill: "hsl(var(--warning))", stroke: "hsl(var(--warning-foreground))" },
  critica: { fill: "hsl(var(--destructive))", stroke: "hsl(var(--destructive-foreground))" },
};

export interface PinObraProps {
  estado: EstadoObra;
  destacado?: boolean;
  esmaecido?: boolean;
  /** Realce de alvo válido enquanto um colaborador é arrastado sobre o pin. */
  alvoAtivo?: boolean;
  className?: string;
}

const PinObra: React.FC<PinObraProps> = ({
  estado,
  destacado,
  esmaecido,
  alvoAtivo,
  className,
}) => {
  const { fill, stroke } = CORES[estado];
  const grande = destacado || alvoAtivo;
  return (
    <svg
      width={grande ? 38 : 30}
      height={grande ? 38 : 30}
      viewBox="0 0 30 30"
      className={cn(
        "drop-shadow-sm transition-[width,height,opacity] duration-150",
        esmaecido && "opacity-25",
        className,
      )}
      aria-hidden="true"
    >
      {alvoAtivo && (
        <circle
          cx="15"
          cy="15"
          r="14"
          fill="none"
          stroke={fill}
          strokeWidth="2"
          strokeDasharray="3 2"
        />
      )}
      <path
        d="M15 1.5L28.5 15L15 28.5L1.5 15Z"
        fill={fill}
        stroke={stroke}
        strokeWidth={grande ? 2 : 1.4}
      />
      {/* Silhueta de estrutura: torre + base */}
      <path d="M11 20.5V13.5L15 9.5L19 13.5V20.5Z" fill={stroke} />
      <rect x="9.5" y="20.5" width="11" height="1.8" fill={stroke} />
    </svg>
  );
};

export default PinObra;
