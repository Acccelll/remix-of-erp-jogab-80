/**
 * OrigemBadge — exibe a origem de um lançamento financeiro (TOTVS vs Sistema).
 * Decisão 2: diferenciação visual obrigatória em todas as listagens.
 */
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type OrigemLancamento = "totvs" | "sistema";

interface OrigemBadgeProps {
  origem: OrigemLancamento | string;
  className?: string;
  size?: "sm" | "default";
}

const config: Record<string, { label: string; className: string }> = {
  totvs: {
    label: "TOTVS",
    className: "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300",
  },
  sistema: {
    label: "Sistema",
    className:
      "bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-900/30 dark:text-purple-300",
  },
};

export function OrigemBadge({ origem, className, size = "default" }: OrigemBadgeProps) {
  const cfg = config[origem] ?? {
    label: String(origem),
    className: "bg-muted text-muted-foreground",
  };

  return (
    <Badge
      variant="outline"
      className={cn(
        "font-medium border",
        size === "sm" && "text-[10px] px-1.5 py-0",
        cfg.className,
        className,
      )}
    >
      {cfg.label}
    </Badge>
  );
}

/**
 * OrigemFilter — selector de filtro por origem para usar em listagens.
 */
interface OrigemFilterProps {
  value: OrigemLancamento | "todos";
  onChange: (v: OrigemLancamento | "todos") => void;
}

export function OrigemFilter({ value, onChange }: OrigemFilterProps) {
  const opts: { value: OrigemLancamento | "todos"; label: string }[] = [
    { value: "todos", label: "Todas as origens" },
    { value: "totvs", label: "TOTVS" },
    { value: "sistema", label: "Sistema" },
  ];

  return (
    <div className="flex gap-1">
      {opts.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            "text-xs px-2.5 py-1 rounded-md border transition-colors",
            value === o.value
              ? o.value === "totvs"
                ? "bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-900/40"
                : o.value === "sistema"
                  ? "bg-purple-100 text-purple-800 border-purple-300 dark:bg-purple-900/40"
                  : "bg-primary text-primary-foreground border-primary"
              : "bg-background text-muted-foreground border-border hover:bg-accent",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
