import React from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MapPin, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import type { DeficitFuncao } from "@/lib/logistica/equipes";
import type { PontoObra } from "@/hooks/rh/useLogisticaPontos";

export interface HoverCardObraProps {
  ponto: PontoObra;
  /** Efetivo atual na obra (mesma contagem do Board). */
  efetivo: number;
  deficits: DeficitFuncao[];
  className?: string;
}

/**
 * Card flutuante da obra, exibido no hover do pin.
 *
 * O déficit por função é o dado que motiva a tela toda, então vem em destaque:
 * previsto no Histograma da semana menos efetivo atual.
 */
const HoverCardObra: React.FC<HoverCardObraProps> = ({ ponto, efetivo, deficits, className }) => {
  const o = ponto.obra;
  const totalFaltando = deficits.reduce((soma, d) => soma + d.deficit, 0);

  return (
    <Card className={cn("w-64 p-3 shadow-lg", className)}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate font-display text-sm font-semibold">{o.nome}</p>
          {o.cliente && <p className="truncate text-xs text-muted-foreground">{o.cliente}</p>}
        </div>
        {o.codigo && (
          <Badge variant="outline" className="shrink-0 text-[10px]">
            {o.codigo}
          </Badge>
        )}
      </div>

      <div className="mt-2 space-y-1 text-xs">
        {ponto.rotuloLocal && (
          <p className="flex items-center gap-1.5 text-muted-foreground">
            <MapPin className="h-3 w-3 shrink-0" />
            <span className="truncate">{ponto.rotuloLocal}</span>
            {ponto.origem === "local" && (
              <span className="shrink-0 text-[10px] opacity-70">(do campo Local)</span>
            )}
          </p>
        )}
        <p className="flex items-center gap-1.5">
          <Users className="h-3 w-3 shrink-0 text-muted-foreground" />
          <span>
            {efetivo} colaborador{efetivo === 1 ? "" : "es"} alocado{efetivo === 1 ? "" : "s"}
          </span>
        </p>
      </div>

      {deficits.length > 0 ? (
        <div className="mt-2 rounded-md bg-warning/10 px-2 py-1.5">
          <p className="text-[10px] font-bold uppercase text-warning">
            Faltam {totalFaltando} — previsto no histograma
          </p>
          <ul className="mt-1 max-h-24 space-y-0.5 overflow-auto text-[11px] text-warning/90">
            {deficits.map((d) => (
              <li key={d.funcao} className="flex justify-between gap-2">
                <span className="truncate">{d.funcao}</span>
                <span className="shrink-0 tabular-nums">
                  {d.atual}/{d.previsto}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="mt-2 text-[11px] text-muted-foreground">
          Sem déficit previsto para esta semana.
        </p>
      )}
    </Card>
  );
};

export default HoverCardObra;
