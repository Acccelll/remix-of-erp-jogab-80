import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type RecursosStatus = "sem_recursos" | "ok" | "atencao" | "critico" | "concluido";

const CONFIG: Record<
  Exclude<RecursosStatus, "sem_recursos">,
  { label: string; className: string }
> = {
  ok: {
    label: "ok",
    className: "bg-warning/15 text-warning border-warning/40 dark:bg-warning/20",
  },
  atencao: {
    label: "atenção",
    className:
      "bg-orange-500/15 text-orange-600 border-orange-500/40 dark:text-orange-400 dark:bg-orange-500/20",
  },
  critico: {
    label: "crítico",
    className: "bg-destructive/15 text-destructive border-destructive/40 dark:bg-destructive/20",
  },
  concluido: {
    label: "concluído",
    className: "bg-success/15 text-success border-success/40 dark:bg-success/20",
  },
};

export function RecursoStatusBadge({
  status,
  count,
  onClick,
}: {
  status: RecursosStatus;
  count: number;
  onClick?: () => void;
}) {
  const vazio = status === "sem_recursos" || count === 0;
  const cfg = vazio ? null : CONFIG[status as Exclude<RecursosStatus, "sem_recursos">];

  const badge = (
    <Badge
      variant="outline"
      className={cn(
        "text-[10px] px-1.5 py-0 font-medium gap-1",
        vazio ? "border-dashed text-muted-foreground bg-transparent" : cfg!.className,
        onClick && "cursor-pointer hover:opacity-80",
      )}
      title={
        vazio
          ? "Adicionar recurso a esta atividade"
          : `${count} recurso(s) — ${cfg!.label} · clique para abrir`
      }
    >
      {vazio ? (
        <span>+ recurso</span>
      ) : (
        <>
          <span>{count}</span>
          <span>·</span>
          <span>{cfg!.label}</span>
        </>
      )}
    </Badge>
  );
  if (!onClick) return badge;
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
    >
      {badge}
    </button>
  );
}
