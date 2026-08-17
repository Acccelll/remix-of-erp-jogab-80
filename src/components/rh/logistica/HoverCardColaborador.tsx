import React from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, FileWarning, MapPin, ShieldAlert } from "lucide-react";
import { computeDocStatus } from "@/lib/rh/documentos";
import { formatarDistancia } from "@/lib/logistica/equipes";
import { cn } from "@/lib/utils";
import type { PontoColaborador } from "@/hooks/rh/useLogisticaPontos";
import type { Obra } from "@/types";

export interface HoverCardColaboradorProps {
  ponto: PontoColaborador;
  /** Obra em que está alocado, quando houver. */
  obraAtual: Obra | null;
  /** Distância até a obra em foco, se houver uma selecionada. */
  distanciaKm?: number | null;
  className?: string;
}

/**
 * Card flutuante do colaborador, exibido no hover do pin.
 *
 * Mostra o que decide uma mobilização: função, onde está, se está livre e se
 * há documento impedindo. Mesmo indicador de documento do card do Board
 * (`computeDocStatus`), para que as duas telas nunca discordem.
 */
const HoverCardColaborador: React.FC<HoverCardColaboradorProps> = ({
  ponto,
  obraAtual,
  distanciaKm,
  className,
}) => {
  const c = ponto.colaborador;
  const docStatus = computeDocStatus(c);
  const emStatusEspecial = !!c.statusEspecial;

  return (
    <Card className={cn("w-64 p-3 shadow-lg", className)}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate font-display text-sm font-semibold">{c.nome}</p>
          <p className="truncate text-xs text-muted-foreground">{c.funcao || "Sem função"}</p>
        </div>
        {c.matricula && (
          <Badge variant="outline" className="shrink-0 text-[10px]">
            {c.matricula}
          </Badge>
        )}
      </div>

      <div className="mt-2 space-y-1 text-xs">
        {ponto.rotuloLocal && (
          <p className="flex items-center gap-1.5 text-muted-foreground">
            <MapPin className="h-3 w-3 shrink-0" />
            <span className="truncate">{ponto.rotuloLocal}</span>
            {ponto.origem === "exata" && (
              <span className="shrink-0 text-[10px] opacity-70">(posição exata)</span>
            )}
          </p>
        )}

        <p className="truncate">
          <span className="text-muted-foreground">Situação: </span>
          {c.mobilizacaoPendente ? (
            <span className="text-warning">
              mobilização pendente → {c.mobilizacaoPendente.obraDestinoNome}
            </span>
          ) : emStatusEspecial ? (
            <span className="capitalize">{String(c.statusEspecial).replace(/^__|__$/g, "")}</span>
          ) : obraAtual ? (
            <span>{obraAtual.nome}</span>
          ) : (
            <span className="text-success">disponível</span>
          )}
        </p>

        {typeof distanciaKm === "number" && (
          <p className="flex items-center gap-1.5">
            <ArrowRight className="h-3 w-3 shrink-0 text-muted-foreground" />
            <span>{formatarDistancia(distanciaKm)} até a obra selecionada</span>
          </p>
        )}
      </div>

      {docStatus && (
        <div
          className={cn(
            "mt-2 flex items-start gap-1.5 rounded-md px-2 py-1.5 text-[11px]",
            docStatus.kind === "vencido"
              ? "bg-destructive/10 text-destructive"
              : "bg-warning/10 text-warning",
          )}
          title={docStatus.tooltip}
        >
          {docStatus.kind === "vencido" ? (
            <ShieldAlert className="mt-px h-3 w-3 shrink-0" />
          ) : (
            <FileWarning className="mt-px h-3 w-3 shrink-0" />
          )}
          <span className="leading-tight">{docStatus.tooltip}</span>
        </div>
      )}
    </Card>
  );
};

export default HoverCardColaborador;
