/**
 * Sino de alertas de prazo dos cards de recurso. Separado do
 * NotificationBell de documentos (escopo diferente).
 *
 * Badge mostra (vencidos + urgentes). Popover lista top 8 e tem
 * link para a página /suprimentos/alertas.
 */
import { useState } from "react";
import { Link } from "react-router-dom";
import { Bell, ExternalLink } from "lucide-react";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { usePermissions } from "@/contexts/auth/usePermissions";
import { useAlertasPrazo } from "@/hooks/quadros/useAlertasPrazo";
import { contarPorSeveridade, type AlertaSaida } from "@/lib/recursos/alertas-prazo";
import { CardRecursoDialog } from "@/components/cards/CardRecursoDialog";
import { cn } from "@/lib/utils";

function corSev(sev: AlertaSaida["severidade"]) {
  if (sev === "vencido") return "bg-destructive/15 text-destructive border-destructive/40";
  if (sev === "urgente") return "bg-destructive/15 text-destructive border-destructive/40";
  if (sev === "proximo")
    return "bg-orange-500/15 text-orange-600 dark:text-orange-400 border-orange-500/40";
  return "bg-muted text-muted-foreground";
}

export function AlertasPrazoBell() {
  const { hasAccess } = usePermissions();
  const [open, setOpen] = useState(false);
  const [cardAberto, setCardAberto] = useState<string | null>(null);

  // mesmo gate provisório por obras_div (TODO(perm))
  const podeVer = hasAccess("obras_div", "visualizar");
  const { data, isLoading } = useAlertasPrazo();

  if (!podeVer) return null;

  const cnt = data ? contarPorSeveridade(data) : { vencido: 0, urgente: 0, proximo: 0, ok: 0 };
  const total = cnt.vencido + cnt.urgente;
  const lista = (data ?? []).filter((a) => a.severidade !== "ok").slice(0, 8);

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="icon" className="relative" title="Alertas de prazo" aria-label="Alertas de prazo">
            <Bell className="h-5 w-5" />
            {total > 0 && (
              <span className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground rounded-full text-[10px] h-4 min-w-4 px-1 flex items-center justify-center">
                {total > 99 ? "99+" : total}
              </span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-96 p-0" align="end">
          <div className="p-3 border-b">
            <div className="flex items-center justify-between gap-2">
              <h4 className="font-semibold text-sm">Alertas de prazo</h4>
              <Link
                to="/suprimentos/alertas"
                className="text-xs text-primary hover:underline inline-flex items-center gap-1"
                onClick={() => setOpen(false)}
              >
                ver todos <ExternalLink className="h-3 w-3" />
              </Link>
            </div>
            <div className="flex gap-1 mt-2 flex-wrap">
              <Badge variant="outline" className={cn("text-[10px]", corSev("vencido"))}>
                {cnt.vencido} vencido(s)
              </Badge>
              <Badge variant="outline" className={cn("text-[10px]", corSev("urgente"))}>
                {cnt.urgente} urgente(s)
              </Badge>
              <Badge variant="outline" className={cn("text-[10px]", corSev("proximo"))}>
                {cnt.proximo} próximo(s)
              </Badge>
            </div>
          </div>
          <ScrollArea className="max-h-80">
            {isLoading ? (
              <div className="p-3 space-y-2">
                <Skeleton className="h-12" />
                <Skeleton className="h-12" />
              </div>
            ) : lista.length === 0 ? (
              <div className="p-6 text-center text-xs text-muted-foreground">
                Nenhum alerta pendente.
              </div>
            ) : (
              <ul className="divide-y">
                {lista.map((a) => (
                  <li key={`${a.card_id}-${a.trilho}`}>
                    <button
                      type="button"
                      className="w-full text-left p-3 hover:bg-accent/40 transition-colors"
                      onClick={() => {
                        setCardAberto(a.card_id);
                        setOpen(false);
                      }}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="text-xs text-muted-foreground">
                            #{a.numero} · {a.trilho}
                          </div>
                          <div className="text-sm font-medium truncate">{a.titulo}</div>
                        </div>
                        <Badge
                          variant="outline"
                          className={cn("text-[10px]", corSev(a.severidade))}
                        >
                          {a.dias < 0 ? `${a.dias}d` : `${a.dias}d`}
                        </Badge>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </ScrollArea>
        </PopoverContent>
      </Popover>
      {cardAberto && (
        <CardRecursoDialog
          cardId={cardAberto}
          open={!!cardAberto}
          onOpenChange={(o) => !o && setCardAberto(null)}
        />
      )}
    </>
  );
}
