/**
 * BoardAtividadeSidebar — sidebar recolhível com os últimos eventos de
 * `card_atividades` dos cards do quadro atual.
 */
import { useQuery } from "@tanstack/react-query";
import { boardsKeys, boardsQueryFns } from "@/hooks/quadros/useBoards";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Activity, ChevronRight, ChevronLeft } from "lucide-react";
import { cn } from "@/lib/utils";

interface AtividadeRow {
  id: string;
  card_id: string;
  evento: string;
  ator_nome: string | null;
  created_at: string;
  detalhe: unknown;
}

interface Props {
  boardId: string;
  open: boolean;
  onToggle: () => void;
  onOpenCard: (id: string) => void;
}

function tempo(iso: string) {
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (min < 1) return "agora";
  if (min < 60) return `${min}m`;
  const h = Math.round(min / 60);
  if (h < 24) return `${h}h`;
  return `${Math.round(h / 24)}d`;
}

export default function BoardAtividadeSidebar({ boardId, open, onToggle, onOpenCard }: Props) {
  const q = useQuery({
    enabled: open && !!boardId,
    queryKey: boardsKeys.atividades(boardId),
    queryFn: async (): Promise<AtividadeRow[]> => {
      // Carrega cards do board e busca últimas 50 atividades em batch
      const data = await boardsQueryFns.atividadesRecentes(boardId, 50);
      return (data ?? []) as AtividadeRow[];
    },
    refetchInterval: 60_000,
  });

  return (
    <aside
      className={cn("shrink-0 transition-all border-l bg-card", open ? "w-72" : "w-9")}
      aria-label="Atividade do quadro"
    >
      <div className="flex items-center justify-between p-2 border-b">
        {open && (
          <h3 className="text-xs font-semibold flex items-center gap-1.5">
            <Activity className="h-3.5 w-3.5" /> Atividade
          </h3>
        )}
        <Button
          size="icon"
          variant="ghost"
          className="h-7 w-7"
          onClick={onToggle}
          aria-label={open ? "Recolher atividade" : "Expandir atividade"}
        >
          {open ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </Button>
      </div>
      {open && (
        <ScrollArea className="h-[60vh]">
          <div className="p-2 space-y-2">
            {q.isLoading ? (
              <p className="text-[11px] text-muted-foreground">Carregando…</p>
            ) : (q.data ?? []).length === 0 ? (
              <p className="text-[11px] text-muted-foreground italic">Sem atividade recente.</p>
            ) : (
              (q.data ?? []).map((a) => (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => onOpenCard(a.card_id)}
                  className="w-full text-left text-xs p-2 rounded hover:bg-accent border border-transparent hover:border-border"
                >
                  <div className="flex items-center justify-between gap-1">
                    <span className="font-medium truncate">{a.evento}</span>
                    <span className="text-[10px] text-muted-foreground">{tempo(a.created_at)}</span>
                  </div>
                  <div className="text-[10px] text-muted-foreground truncate">
                    por {a.ator_nome ?? "sistema"}
                  </div>
                </button>
              ))
            )}
          </div>
        </ScrollArea>
      )}
    </aside>
  );
}
