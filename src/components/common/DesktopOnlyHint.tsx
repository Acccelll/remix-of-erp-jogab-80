import { Monitor } from "lucide-react";

interface DesktopOnlyHintProps {
  label?: string;
}

export function DesktopOnlyHint({
  label = "Visualização otimizada para desktop.",
}: DesktopOnlyHintProps) {
  return (
    <div className="flex items-start gap-2 rounded-md border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground md:hidden">
      <Monitor className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      <span>{label}</span>
    </div>
  );
}