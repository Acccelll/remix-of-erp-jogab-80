/**
 * Mini-timeline horizontal exibindo os marcos da cascata de prazos
 * de uma linha do cronograma (notificações, pedido, início produção,
 * necessidade). Cada marcador é colorido pela severidade.
 *
 * Renderiza inline em ~140-220px de largura para caber dentro da
 * coluna de descrição da árvore do cronograma.
 */

import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { MARCO_LABEL, type CascataLinha, type Marco } from "@/lib/recursos/cascata-marcos";

interface Props {
  linha: CascataLinha;
  className?: string;
  /** Largura em px da barra (default 180). */
  width?: number;
  onClick?: () => void;
}

const SEV_BG: Record<Marco["severidade"], string> = {
  vencido: "bg-destructive",
  urgente: "bg-warning",
  proximo: "bg-primary",
  ok: "bg-success",
};

const SEV_RING: Record<Marco["severidade"], string> = {
  vencido: "ring-destructive/40",
  urgente: "ring-warning/40",
  proximo: "ring-primary/40",
  ok: "ring-success/40",
};

function toMs(iso: string) {
  return new Date(iso + "T00:00:00Z").getTime();
}

function fmt(iso: string) {
  try {
    return format(parseISO(iso), "dd/MM/yyyy", { locale: ptBR });
  } catch {
    return iso;
  }
}

function numeroFonte(fonte: { card_id: string; numero?: string | number | null }) {
  if (fonte.numero !== null && fonte.numero !== undefined && String(fonte.numero).trim()) {
    return `#${fonte.numero}`;
  }
  return `#${fonte.card_id.slice(-6).toUpperCase()}`;
}

function resumoFontes(fontes: Marco["fontes"]) {
  if (!fontes?.length) return "—";
  const nums = fontes.map(numeroFonte);
  if (nums.length <= 3) return nums.join(", ");
  return `${nums.slice(0, 3).join(", ")} +${nums.length - 3}`;
}

export function CascataPrazosBar({ linha, className, width = 180, onClick }: Props) {
  const hojeMs = toMs(linha.hoje);
  const fimMs = toMs(linha.fim);
  // Início da janela = min(hoje, marco mais antigo)
  const minMarcoMs = Math.min(...linha.marcos.map((m) => toMs(m.data)));
  const inicioMs = Math.min(hojeMs, minMarcoMs);
  const total = Math.max(1, fimMs - inicioMs);

  function pct(ms: number) {
    const p = ((ms - inicioMs) / total) * 100;
    return Math.max(0, Math.min(100, p));
  }

  const hojeLeft = pct(hojeMs);

  return (
    <TooltipProvider delayDuration={150}>
      <div
        className={cn("relative inline-block align-middle", onClick && "cursor-pointer", className)}
        style={{ width }}
        onClick={onClick}
        role={onClick ? "button" : undefined}
      >
        {/* Trilho */}
        <div className="relative h-1.5 rounded-full bg-muted">
          {/* Marcador de hoje */}
          {hojeMs >= inicioMs && hojeMs <= fimMs && (
            <Tooltip>
              <TooltipTrigger asChild>
                <div
                  className="absolute top-1/2 -translate-y-1/2 h-3 w-px bg-foreground/60"
                  style={{ left: `${hojeLeft}%` }}
                  aria-label="Hoje"
                />
              </TooltipTrigger>
              <TooltipContent side="top" className="text-xs">
                Hoje · {fmt(linha.hoje)}
              </TooltipContent>
            </Tooltip>
          )}

          {/* Marcadores */}
          {linha.marcos.map((m) => {
            const left = pct(toMs(m.data));
            return (
              <Tooltip key={m.kind}>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    className={cn(
                      "absolute top-1/2 -translate-y-1/2 -translate-x-1/2 h-2.5 w-2.5 rounded-full ring-2 ring-offset-1 ring-offset-background",
                      SEV_BG[m.severidade],
                      SEV_RING[m.severidade],
                    )}
                    style={{ left: `${left}%` }}
                    onClick={(e) => {
                      e.stopPropagation();
                      onClick?.();
                    }}
                    aria-label={`${MARCO_LABEL[m.kind]} · ${fmt(m.data)} · Nº ${resumoFontes(m.fontes)}`}
                  />
                </TooltipTrigger>
                <TooltipContent side="top" className="text-xs">
                  <div className="font-medium">{MARCO_LABEL[m.kind]}</div>
                  <div>{fmt(m.data)}</div>
                  <div>Nº {resumoFontes(m.fontes)}</div>
                  <div className="text-muted-foreground">
                    {m.dias < 0
                      ? `${Math.abs(m.dias)}d em atraso`
                      : m.dias === 0
                        ? "hoje"
                        : `em ${m.dias}d`}
                  </div>
                </TooltipContent>
              </Tooltip>
            );
          })}
        </div>
      </div>
    </TooltipProvider>
  );
}
