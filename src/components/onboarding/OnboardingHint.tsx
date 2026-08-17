import { useEffect, useState } from "react";
import { X, Lightbulb } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { swallow } from "@/lib/core/errors";

/**
 * Dica contextual dispensável, persistida por usuário no localStorage.
 * Use uma `storageKey` única por dica para não reaparecer após dispensada.
 */
export function OnboardingHint({
  storageKey,
  title,
  children,
  className,
}: {
  storageKey: string;
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  const fullKey = `lovable.onboarding.${storageKey}`;
  const [open, setOpen] = useState(false);

  useEffect(() => {
    try {
      setOpen(localStorage.getItem(fullKey) !== "dismissed");
    } catch {
      setOpen(true);
    }
  }, [fullKey]);

  if (!open) return null;

  const dismiss = () => {
    try {
      localStorage.setItem(fullKey, "dismissed");
    } catch (err) {
      swallow("onboarding.hint.dismiss", err, "localStorage indisponível");
    }
    setOpen(false);
  };

  return (
    <div className={cn("relative flex gap-3 rounded-lg border bg-muted/40 p-3 text-sm", className)}>
      <Lightbulb className="h-4 w-4 mt-0.5 text-warning shrink-0" />
      <div className="flex-1 space-y-1 pr-6">
        <div className="font-medium">{title}</div>
        <div className="text-muted-foreground leading-relaxed">{children}</div>
      </div>
      <Button
        variant="ghost"
        size="icon"
        className="absolute right-1 top-1 h-6 w-6"
        onClick={dismiss}
        aria-label="Dispensar dica"
      >
        <X className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}
