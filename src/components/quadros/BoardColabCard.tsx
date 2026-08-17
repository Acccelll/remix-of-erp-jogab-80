import React, { useMemo } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ArrowRight, FileWarning, ShieldAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Colaborador, Obra } from "@/types";
import type { CardRenderContext } from "./AllocationBoard";
import { computeDocStatus } from "@/lib/rh/documentos";

export interface BoardColabCardProps {
  colab: Colaborador;
  ctx: CardRenderContext;
  obra: Obra | null;
  canEdit: boolean;
  isGM: boolean;
  selectedCount: number;
  onOpenProfile: (id: string, tab?: string) => void;
  onOpenMove: () => void;
  onCancelPending: (id: string) => void;
  onRequestDelete: (id: string, nome: string) => void;
}

const BoardColabCard: React.FC<BoardColabCardProps> = ({
  colab: c,
  ctx,
  obra,
  canEdit,
  isGM,
  selectedCount,
  onOpenProfile,
  onOpenMove,
  onCancelPending,
  onRequestDelete,
}) => {
  const integracaoPendente =
    !!obra?.requerIntegracao && !c.integracoes.some((i) => i.obraId === obra.id);
  const docStatus = useMemo(() => computeDocStatus(c), [c]);

  const card = (
    <div
      className={cn(
        "employee-tag group relative",
        c.mobilizacaoPendente && "employee-tag-pending",
        ctx.isSelected && "ring-2 ring-primary ring-offset-1 ring-offset-background",
        ctx.isDragging && "is-dragging",
        ctx.density === "compact" && "py-1 px-2 gap-1.5",
      )}
      onClick={ctx.handleClick}
      onDoubleClick={() => onOpenProfile(c.id, "integracoes")}
    >
      {canEdit && (
        <Checkbox
          checked={ctx.isSelected}
          onCheckedChange={ctx.toggleSelect}
          onClick={(e) => e.stopPropagation()}
          aria-label={`Selecionar ${c.nome}`}
          className={cn(
            "shrink-0 transition-opacity",
            ctx.isSelected
              ? "opacity-100"
              : "opacity-0 group-hover:opacity-100 focus-visible:opacity-100",
          )}
        />
      )}
      <div className="matricula-badge">{c.matricula.padStart(4, "0")}</div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium truncate">{c.nome}</p>
        <p className="text-[11px] text-muted-foreground truncate">{c.funcao}</p>
        {(integracaoPendente || docStatus) && (
          <div className="flex items-center gap-1 mt-1 flex-wrap">
            {integracaoPendente && (
              <TooltipProvider delayDuration={200}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span
                      className="inline-flex items-center gap-1 rounded-full bg-warning/15 text-warning text-[10px] font-medium px-1.5 py-0.5 leading-none"
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenProfile(c.id, "integracoes");
                      }}
                    >
                      <ShieldAlert className="h-2.5 w-2.5" />
                      Integração pendente
                    </span>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="text-xs">
                    Sem integração registrada nesta obra
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
            {docStatus && (
              <TooltipProvider delayDuration={200}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span
                      className={cn(
                        "inline-flex items-center gap-1 rounded-full text-[10px] font-medium px-1.5 py-0.5 leading-none",
                        docStatus.kind === "vencido"
                          ? "bg-destructive/15 text-destructive"
                          : "bg-warning/15 text-warning",
                      )}
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenProfile(c.id, "documentos");
                      }}
                    >
                      <FileWarning className="h-2.5 w-2.5" />
                      {docStatus.label}
                    </span>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="text-xs">
                    {docStatus.tooltip}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
        )}
      </div>
      {c.mobilizacaoPendente && (
        <div className="text-[10px] text-accent font-semibold shrink-0 text-right leading-tight">
          <p>→ {c.mobilizacaoPendente.dataMobilizacao}</p>
          <p>{c.mobilizacaoPendente.obraDestinoNome}</p>
        </div>
      )}
    </div>
  );

  const hasMenu = canEdit || isGM;
  if (!hasMenu) return card;

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>{card}</ContextMenuTrigger>
      <ContextMenuContent>
        {canEdit && c.mobilizacaoPendente && (
          <>
            <ContextMenuItem
              className="text-warning font-medium"
              onClick={() => onCancelPending(c.id)}
            >
              Cancelar mobilização pendente
            </ContextMenuItem>
            <ContextMenuSeparator />
          </>
        )}
        {canEdit && (
          <ContextMenuItem onClick={onOpenMove}>
            <ArrowRight className="h-4 w-4 mr-2" />
            Mover{ctx.isSelected && selectedCount > 1 ? ` ${selectedCount} selecionados` : ""} para…
          </ContextMenuItem>
        )}
        {isGM && (
          <>
            <ContextMenuSeparator />
            <ContextMenuItem
              className="text-destructive"
              onClick={() => onRequestDelete(c.id, c.nome)}
            >
              Excluir
            </ContextMenuItem>
          </>
        )}
      </ContextMenuContent>
    </ContextMenu>
  );
};

export default BoardColabCard;
