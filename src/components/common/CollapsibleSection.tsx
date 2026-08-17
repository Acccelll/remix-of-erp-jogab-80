import React, { useState, useEffect } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  title: React.ReactNode;
  /** Chave estável para persistir estado aberto/fechado em localStorage. Sem chave → não persiste. */
  storageKey?: string;
  defaultOpen?: boolean;
  /** Conteúdo opcional renderizado à direita do título (badges, contadores, botões). */
  headerExtra?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}

const CollapsibleSection: React.FC<Props> = ({
  title,
  storageKey,
  defaultOpen = true,
  headerExtra,
  className,
  children,
}) => {
  const [open, setOpen] = useState<boolean>(() => {
    if (!storageKey || typeof window === "undefined") return defaultOpen;
    const v = localStorage.getItem(`collapsible:${storageKey}`);
    if (v === null) return defaultOpen;
    return v === "1";
  });

  useEffect(() => {
    if (!storageKey || typeof window === "undefined") return;
    localStorage.setItem(`collapsible:${storageKey}`, open ? "1" : "0");
  }, [open, storageKey]);

  return (
    <div className={cn("rounded-lg border border-border bg-card/40", className)}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-muted/40 rounded-t-lg transition-colors"
      >
        <ChevronDown
          className={cn(
            "h-4 w-4 text-muted-foreground transition-transform shrink-0",
            !open && "-rotate-90",
          )}
        />
        <div className="text-sm font-semibold flex-1 min-w-0">{title}</div>
        {headerExtra && <div className="shrink-0 flex items-center gap-2">{headerExtra}</div>}
      </button>
      {open && <div className="px-3 pb-3 pt-1">{children}</div>}
    </div>
  );
};

export default CollapsibleSection;
