import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Spinner de página inteira padronizado (DS-004).
 * Uso: `if (loading) return <PageLoading />;`
 * Acessível: role=status + aria-label.
 */
export function PageLoading({
  label = "Carregando…",
  className,
  compact,
}: {
  label?: string;
  className?: string;
  compact?: boolean;
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={label}
      className={cn(
        "flex items-center justify-center text-muted-foreground",
        compact ? "py-4 gap-2" : "py-12 gap-3",
        className,
      )}
    >
      <Loader2 className={cn("animate-spin", compact ? "h-4 w-4" : "h-6 w-6")} />
      <span className={cn(compact ? "text-sm" : "text-sm")}>{label}</span>
    </div>
  );
}
