/**
 * Banner global de sincronização offline (OFF.2 + H1.B4).
 *
 * Renderiza apenas quando offline, há itens pendentes ou há erro recente —
 * fora disso o componente retorna null para não poluir o header.
 *
 * Clique abre popover listando itens travados (tabela, último erro, attempts)
 * — visibilidade do que está preso na fila sem precisar de devtools.
 */
import { useEffect, useState } from "react";
import { CloudOff, RefreshCw, AlertCircle, Cloud } from "lucide-react";
import { useSyncQueueStatus } from "@/hooks/useSyncQueueStatus";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { listQueue } from "@/lib/offline/sync-queue";
import type { SyncQueueItem } from "@/lib/offline/db";
import { cn } from "@/lib/utils";

export function SyncStatusBanner() {
  const { online, total, syncing, lastError, flushNow } = useSyncQueueStatus();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<SyncQueueItem[]>([]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const load = async () => {
      try {
        const list = await listQueue();
        if (!cancelled) setItems(list);
      } catch {
        if (!cancelled) setItems([]);
      }
    };
    void load();
    const id = window.setInterval(load, 2000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [open]);

  // Sem nada a exibir → fica oculto.
  if (online && total === 0 && !lastError) return null;

  let icon = <Cloud className="h-3.5 w-3.5" />;
  let label = "Sincronizado";
  let tone = "bg-muted text-muted-foreground";

  if (!online) {
    icon = <CloudOff className="h-3.5 w-3.5" />;
    label = total > 0 ? `Offline — ${total} pendente${total > 1 ? "s" : ""}` : "Offline";
    tone = "bg-warning/15 text-warning";
  } else if (syncing) {
    icon = <RefreshCw className="h-3.5 w-3.5 animate-spin" />;
    label = `Sincronizando${total > 0 ? ` (${total})` : ""}…`;
    tone = "bg-primary/10 text-primary";
  } else if (lastError) {
    icon = <AlertCircle className="h-3.5 w-3.5" />;
    label = `Erro ao enviar — ${total} aguardando`;
    tone = "bg-destructive/15 text-destructive";
  } else if (total > 0) {
    icon = <RefreshCw className="h-3.5 w-3.5" />;
    label = `${total} pendente${total > 1 ? "s" : ""}`;
    tone = "bg-primary/10 text-primary";
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "flex items-center gap-2 px-2.5 py-1 rounded-md text-xs font-medium hover:opacity-80 transition-opacity",
            tone,
          )}
          aria-label="Detalhes da fila de sincronização"
          title={lastError ?? label}
        >
          {icon}
          <span className="hidden sm:inline">{label}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-96 p-0" align="end">
        <div className="border-b px-3 py-2 flex items-center justify-between">
          <div className="space-y-0.5">
            <div className="text-sm font-medium">Fila de sincronização</div>
            <div className="text-xs text-muted-foreground">
              {online ? "Online" : "Offline"} · {total} item{total === 1 ? "" : "ns"}
            </div>
          </div>
          {online && total > 0 && (
            <Button size="sm" variant="outline" disabled={syncing} onClick={() => void flushNow()}>
              {syncing ? "Enviando…" : "Tentar agora"}
            </Button>
          )}
        </div>
        <div className="max-h-72 overflow-auto">
          {items.length === 0 ? (
            <div className="px-3 py-6 text-center text-sm text-muted-foreground">
              Nenhum item pendente.
            </div>
          ) : (
            <ul className="divide-y">
              {items.map((it) => (
                <li key={it.id} className="px-3 py-2 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono font-medium truncate">{it.table}</span>
                    <span className="text-muted-foreground shrink-0">
                      {it.op} · {it.attempts} tent.
                    </span>
                  </div>
                  <div className="text-muted-foreground truncate" title={it.id}>
                    {it.id}
                  </div>
                  {it.lastError && (
                    <div className="text-destructive mt-1 break-words">{it.lastError}</div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
