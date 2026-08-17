import React from "react";
import { cn } from "@/lib/utils";
import type { EstadoPin } from "@/lib/logistica/pins";

/**
 * Marcador de colaborador — silhueta de pessoa dentro de uma gota.
 *
 * A forma (e não só a cor) distingue colaborador de obra: quem enxerga mal
 * cores ainda diferencia os dois tipos, e as cores vêm de tokens semânticos
 * para acompanhar o tema claro/escuro.
 */
const CORES: Record<EstadoPin, { fill: string; stroke: string }> = {
  // Ocioso/folga: é quem o usuário está procurando para mobilizar.
  disponivel: { fill: "hsl(var(--success))", stroke: "hsl(var(--success-foreground))" },
  alocado: { fill: "hsl(var(--muted-foreground))", stroke: "hsl(var(--background))" },
  pendente: { fill: "hsl(var(--warning))", stroke: "hsl(var(--warning-foreground))" },
  atencao: { fill: "hsl(var(--destructive))", stroke: "hsl(var(--destructive-foreground))" },
};

export interface PinColaboradorProps {
  estado: EstadoPin;
  /** Realce durante hover ou quando é o candidato selecionado. */
  destacado?: boolean;
  /** Reduz opacidade quando um filtro está ativo e este pin não casa. */
  esmaecido?: boolean;
  arrastando?: boolean;
  className?: string;
}

const PinColaborador: React.FC<PinColaboradorProps> = ({
  estado,
  destacado,
  esmaecido,
  arrastando,
  className,
}) => {
  const { fill, stroke } = CORES[estado];
  return (
    <svg
      width={destacado ? 34 : 28}
      height={destacado ? 41 : 34}
      viewBox="0 0 28 34"
      className={cn(
        "drop-shadow-sm transition-[width,height,opacity] duration-150",
        esmaecido && "opacity-25",
        arrastando && "opacity-60",
        className,
      )}
      aria-hidden="true"
    >
      <path
        d="M14 33.2C14 33.2 26.5 20.9 26.5 13.2C26.5 6.3 20.9 0.8 14 0.8C7.1 0.8 1.5 6.3 1.5 13.2C1.5 20.9 14 33.2 14 33.2Z"
        fill={fill}
        stroke={stroke}
        strokeWidth={destacado ? 2 : 1.4}
      />
      {/* Silhueta de pessoa: cabeça + ombros */}
      <circle cx="14" cy="10" r="3.4" fill={stroke} />
      <path d="M7.8 20.2C7.8 16.6 10.6 14.4 14 14.4C17.4 14.4 20.2 16.6 20.2 20.2Z" fill={stroke} />
    </svg>
  );
};

export default PinColaborador;
