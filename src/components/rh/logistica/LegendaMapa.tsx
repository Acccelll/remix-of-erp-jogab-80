import React, { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Legenda flutuante do mapa: explica cores dos pins de obra e traçados de rota.
 * Colapsável para não competir com controles do MapLibre em telas pequenas.
 */
const LegendaMapa: React.FC<{ className?: string }> = ({ className }) => {
  const [aberta, setAberta] = useState(true);

  return (
    <div
      className={cn(
        "pointer-events-auto absolute bottom-4 right-4 z-10 rounded-md border bg-background/95 text-[11px] shadow-md backdrop-blur",
        className,
      )}
    >
      <button
        type="button"
        onClick={() => setAberta((v) => !v)}
        className="flex w-full items-center justify-between gap-2 px-2 py-1 font-semibold uppercase tracking-wide text-muted-foreground"
        aria-expanded={aberta}
      >
        Legenda
        {aberta ? <ChevronDown className="h-3 w-3" /> : <ChevronUp className="h-3 w-3" />}
      </button>

      {aberta && (
        <ul className="space-y-1 border-t px-2 py-1.5">
          <li className="flex items-center gap-2">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-emerald-500" />
            Obra completa
          </li>
          <li className="flex items-center gap-2">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-amber-500" />
            Obra em déficit
          </li>
          <li className="flex items-center gap-2">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-red-500" />
            Obra crítica (5+ vagas)
          </li>
          <li className="mt-1 flex items-center gap-2 border-t pt-1">
            <svg width="20" height="6" aria-hidden>
              <line x1="0" y1="3" x2="20" y2="3" stroke="#1d4ed8" strokeWidth="2.5" />
            </svg>
            Rota real (OSRM)
          </li>
          <li className="flex items-center gap-2">
            <svg width="20" height="6" aria-hidden>
              <line
                x1="0"
                y1="3"
                x2="20"
                y2="3"
                stroke="#d97706"
                strokeWidth="2.5"
                strokeDasharray="4 2"
              />
            </svg>
            Rota estimada
          </li>
          <li className="flex items-center gap-2">
            <svg width="20" height="6" aria-hidden>
              <line
                x1="0"
                y1="3"
                x2="20"
                y2="3"
                stroke="#1d4ed8"
                strokeWidth="1.5"
                strokeDasharray="2 2"
                opacity="0.6"
              />
            </svg>
            Raio de deslocamento
          </li>
        </ul>
      )}
    </div>
  );
};

export default LegendaMapa;
