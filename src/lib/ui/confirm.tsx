/** @module-kind io */
/**
 * Fonte única de confirmação (DS-003).
 *
 * API imperativa promise-based para substituir `window.confirm` nativo.
 *
 * Uso:
 *   const ok = await confirmDialog({ title: "Excluir?", description: "..." });
 *   if (!ok) return;
 *
 * Requer que `<ConfirmDialogHost />` esteja montado uma única vez na raiz do app.
 */
import React, { useEffect, useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type ConfirmOptions = {
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "default" | "destructive";
};

type Pending = ConfirmOptions & { resolve: (v: boolean) => void };

let openConfirm: ((opts: ConfirmOptions) => Promise<boolean>) | null = null;

export function confirmDialog(opts: ConfirmOptions): Promise<boolean> {
  if (!openConfirm) {
    // Fallback defensivo caso o host não esteja montado (ex.: testes).
    if (typeof window !== "undefined" && typeof window.confirm === "function") {
      return Promise.resolve(window.confirm(opts.description ?? opts.title));
    }
    return Promise.resolve(false);
  }
  return openConfirm(opts);
}

export const ConfirmDialogHost: React.FC = () => {
  const [pending, setPending] = useState<Pending | null>(null);

  useEffect(() => {
    openConfirm = (opts) =>
      new Promise<boolean>((resolve) => setPending({ ...opts, resolve }));
    return () => {
      openConfirm = null;
    };
  }, []);

  const handle = (value: boolean) => {
    if (!pending) return;
    pending.resolve(value);
    setPending(null);
  };

  const isDestructive = pending?.variant !== "default";

  return (
    <AlertDialog open={!!pending} onOpenChange={(v) => !v && handle(false)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle
            className={isDestructive ? "text-destructive font-display" : "font-display"}
          >
            {pending?.title}
          </AlertDialogTitle>
          {pending?.description && (
            <AlertDialogDescription>{pending.description}</AlertDialogDescription>
          )}
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => handle(false)}>
            {pending?.cancelLabel ?? "Cancelar"}
          </AlertDialogCancel>
          <AlertDialogAction
            className={cn(
              isDestructive &&
                buttonVariants({ variant: "destructive" }),
            )}
            onClick={() => handle(true)}
          >
            {pending?.confirmLabel ?? (isDestructive ? "Excluir" : "Confirmar")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
