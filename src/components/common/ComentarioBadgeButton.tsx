// Balãozinho de comentários exibido nos cards dos quadros. Mostra o ícone e a
// contagem; UM clique abre o painel de comentários (stopPropagation para não
// disparar seleção/duplo-clique do card). Espelha o balão do Funil de Vendas.
import { MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";

export function ComentarioBadgeButton({
  count,
  onClick,
  className,
}: {
  count: number;
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      onDoubleClick={(e) => e.stopPropagation()}
      className={cn(
        "inline-flex items-center gap-0.5 rounded-full bg-primary/15 px-1.5 py-0.5 text-[10px] font-medium text-primary hover:bg-primary/25 transition-colors shrink-0",
        className,
      )}
      title={count > 0 ? `${count} comentário(s) — clique para abrir` : "Adicionar comentário"}
      aria-label="Comentários"
    >
      <MessageSquare className="h-3 w-3" />
      {count > 0 && <span>{count}</span>}
    </button>
  );
}
