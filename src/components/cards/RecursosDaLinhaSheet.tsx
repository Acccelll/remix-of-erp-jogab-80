/**
 * Sheet com a lista de cards de recurso vinculados a uma linha do cronograma.
 * Painel canônico para visualizar E criar recursos da linha.
 */

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Package, Plus } from "lucide-react";

import { cardsKeys, useCardsDaLinha } from "@/hooks/quadros/useCards";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CardRecursoDialog } from "./CardRecursoDialog";
import { AdicionarRecursoDialog } from "./AdicionarRecursoDialog";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  itemId: string;
  itemDescricao?: string;
  itemDataInicio: string;
  obraId: string;
  podeAdicionar: boolean;
}

function fmtDt(iso?: string | null) {
  if (!iso) return "—";
  try {
    return format(parseISO(iso), "dd/MM/yyyy", { locale: ptBR });
  } catch {
    return iso;
  }
}

export function RecursosDaLinhaSheet({
  open,
  onOpenChange,
  itemId,
  itemDescricao,
  itemDataInicio,
  obraId,
  podeAdicionar,
}: Props) {
  const [cardAberto, setCardAberto] = useState<string | null>(null);
  const [criando, setCriando] = useState(false);
  const qc = useQueryClient();

  const { data } = useCardsDaLinha(itemId, { enabled: open });

  const total = data?.length ?? 0;

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right" className="w-[420px] sm:max-w-md flex flex-col p-0">
          <SheetHeader className="px-6 pt-6 pb-4 border-b bg-muted/30">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <SheetTitle className="flex items-center gap-2 text-base">
                  <Package className="h-4 w-4 text-primary" />
                  Recursos da atividade
                  {total > 0 && (
                    <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-[10px]">
                      {total}
                    </Badge>
                  )}
                </SheetTitle>
                <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{itemDescricao}</p>
              </div>
            </div>
            {podeAdicionar && (
              <Button
                size="sm"
                className="mt-3 w-full gap-1.5 shadow-sm"
                onClick={() => setCriando(true)}
              >
                <Plus className="h-4 w-4" /> Adicionar recurso
              </Button>
            )}
          </SheetHeader>

          <ul className="flex-1 overflow-y-auto px-6 py-4 space-y-2">
            {(!data || data.length === 0) && (
              <li className="rounded-lg border-2 border-dashed p-8 text-center space-y-3">
                <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                  <Package className="h-5 w-5 text-muted-foreground" />
                </div>
                <div className="text-sm text-muted-foreground">Nenhum recurso vinculado a esta atividade.</div>
                {podeAdicionar && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setCriando(true)}
                    className="gap-1"
                  >
                    <Plus className="h-4 w-4" /> Adicionar o primeiro recurso
                  </Button>
                )}
              </li>
            )}
            {data?.map((c: any) => {
              const r = Array.isArray(c.card_recursos) ? c.card_recursos[0] : c.card_recursos;
              return (
                <li key={c.id}>
                  <button
                    onClick={() => setCardAberto(c.id)}
                    className="w-full text-left rounded-md border p-2 hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-mono text-muted-foreground">#{c.numero}</span>
                      <Badge variant="outline" className="text-[10px]">
                        {c.status}
                      </Badge>
                    </div>
                    <div className="mt-1 text-sm font-medium line-clamp-1">{c.titulo}</div>
                    {r && (
                      <div className="mt-1 text-xs text-muted-foreground flex flex-wrap gap-x-3">
                        <span>tipo: {r.tipo_recurso}</span>
                        <span>necessidade: {fmtDt(r.data_necessidade_obra)}</span>
                        <span>pedido: {fmtDt(r.prazo_pedido)}</span>
                      </div>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>

        </SheetContent>
      </Sheet>

      {criando && (
        <AdicionarRecursoDialog
          open={criando}
          onOpenChange={(v) => {
            if (!v) {
              setCriando(false);
              qc.invalidateQueries({ queryKey: cardsKeys.daLinha(itemId) });
              qc.invalidateQueries({ queryKey: ["crono", obraId] });
              qc.invalidateQueries({ queryKey: cardsKeys.cascataPorObra(obraId) });
            }
          }}
          obraId={obraId}
          item={{ id: itemId, descricao: itemDescricao, data_inicio: itemDataInicio }}
        />
      )}

      {cardAberto && (
        <CardRecursoDialog
          open={!!cardAberto}
          onOpenChange={(v) => !v && setCardAberto(null)}
          cardId={cardAberto}
        />
      )}
    </>
  );
}
