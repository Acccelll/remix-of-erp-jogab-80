import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { AlertCircle, Loader2 } from "lucide-react";
import type {
  ConfirmarRomaneioFailure,
  ConfirmarRomaneioProgress,
} from "@/hooks/logisticaAtivos/useConfirmarRomaneio";

interface Props {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  loading: boolean;
  error: string;
  progress: ConfirmarRomaneioProgress | null;
  failures: ConfirmarRomaneioFailure[];
}

export default function RomaneioConfirmarDialog({
  open,
  onClose,
  onConfirm,
  loading,
  error,
  progress,
  failures,
}: Props) {
  return (
    <Dialog open={open} onOpenChange={(v) => !v && !loading && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="font-display text-lg">Confirmar romaneio</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            A confirmação baixa o estoque, e em seguida mobiliza os patrimônios e o veículo
            transportador incluídos. Não pode ser desfeita.
          </p>
          {loading && progress && (
            <div className="space-y-1">
              <Progress value={(progress.done / Math.max(progress.total, 1)) * 100} />
              <p className="text-xs text-muted-foreground">
                {progress.done} de {progress.total}
              </p>
            </div>
          )}
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          {failures.length > 0 && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <p className="font-medium">Falhas na mobilização:</p>
                <ul className="list-disc pl-4">
                  {failures.map((f, i) => (
                    <li key={i}>
                      {f.nome}: {f.motivo}
                    </li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          )}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={loading}>
            Fechar
          </Button>
          <Button onClick={onConfirm} disabled={loading} className="gap-2">
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            Confirmar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
