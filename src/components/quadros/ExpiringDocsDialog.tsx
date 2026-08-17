import React, { useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Clock } from "lucide-react";
import { fmtDataLocal } from "@/lib/core/date";

export interface ExpiringDoc {
  colaborador: { id: string; nome: string; matricula: string };
  documento: { nome: string; dataVencimento: string };
}

export interface ExpiringDocsDialogProps {
  open: boolean;
  onClose: () => void;
  getDocs: () => ExpiringDoc[];
}

const ExpiringDocsDialog: React.FC<ExpiringDocsDialogProps> = ({ open, onClose, getDocs }) => {
  const docs = useMemo(() => (open ? getDocs() : []), [open, getDocs]);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display flex items-center gap-2">
            <Clock className="h-5 w-5 text-warning" />
            Documentos a vencer
          </DialogTitle>
        </DialogHeader>
        <ScrollArea className="max-h-[400px]">
          {docs.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              Nenhum documento a vencer.
            </p>
          ) : (
            <div className="space-y-1">
              {docs.map((item, i) => {
                const dv = new Date(item.documento.dataVencimento);
                const now = new Date();
                const diffDays = Math.ceil((dv.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
                const cls =
                  diffDays < 0 || diffDays <= 7
                    ? "text-destructive"
                    : diffDays <= 30
                      ? "text-warning"
                      : "text-muted-foreground";
                return (
                  <div
                    key={i}
                    className="flex items-center gap-2 p-2 rounded-md hover:bg-secondary/50 text-sm"
                  >
                    <div className="matricula-badge">
                      {item.colaborador.matricula.padStart(4, "0")}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{item.colaborador.nome}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {item.documento.nome}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xs font-medium">{fmtDataLocal(dv)}</p>
                      <p className={`text-[10px] font-semibold ${cls}`}>
                        {diffDays < 0
                          ? `Vencido há ${Math.abs(diffDays)} dias`
                          : diffDays === 0
                            ? "Vence hoje"
                            : diffDays === 1
                              ? "Amanhã"
                              : `${diffDays} dias`}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ExpiringDocsDialog;
