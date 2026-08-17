/**
 * Casca padrão para diálogos de importação — Achado DS-012.
 *
 * Substitui o boilerplate repetido (`Dialog` + `DialogTrigger` + `DialogContent`
 * + `DialogHeader` + `DialogTitle` + `DialogDescription`) presente nos diálogos
 * de importação. O corpo customizado do formulário é passado como `children`.
 *
 * Uso mínimo:
 *   <ImportDialogShell
 *     open={open}
 *     onOpenChange={setOpen}
 *     title="Importar planilha…"
 *     description="Lê a aba X e faz upsert por chave Y."
 *     trigger={<Button variant="outline">Importar</Button>}
 *   >
 *     {corpoDoFormulario}
 *   </ImportDialogShell>
 */
import type { ReactNode } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

interface ImportDialogShellProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  /** Elemento de disparo (Button). Se omitido, o Dialog é controlado por `open`. */
  trigger?: ReactNode;
  /** Largura máxima do conteúdo. Default: `max-w-2xl`. */
  size?: "max-w-lg" | "max-w-xl" | "max-w-2xl" | "max-w-3xl" | "max-w-4xl";
  /** Corpo do formulário/preview. */
  children: ReactNode;
  contentClassName?: string;
}

export function ImportDialogShell({
  open,
  onOpenChange,
  title,
  description,
  trigger,
  size = "max-w-2xl",
  children,
  contentClassName,
}: ImportDialogShellProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent className={cn(size, "max-h-[90vh] overflow-y-auto", contentClassName)}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <div className="space-y-4">{children}</div>
      </DialogContent>
    </Dialog>
  );
}
