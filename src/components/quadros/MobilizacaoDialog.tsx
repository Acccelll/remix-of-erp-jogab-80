import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import DatePickerField from "@/components/common/DatePickerField";
import { AlertCircle, Loader2, CalendarOff } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { useValidadorFeriados } from "@/hooks/useValidadorFeriados";

export interface MobilizacaoDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  loading: boolean;
  error: string;
  date: string;
  onDateChange: (d: string) => void;
  colabNames: string[];
  veiculosAfetados?: string[];
  progress?: { done: number; total: number } | null;
  failures?: Array<{ nome: string; motivo: string }>;
}

const MobilizacaoDialog: React.FC<MobilizacaoDialogProps> = ({
  open,
  onClose,
  onConfirm,
  loading,
  error,
  date,
  onDateChange,
  colabNames,
  veiculosAfetados,
  progress,
  failures,
}) => {
  const { isFeriado, nomes: feriadoNomes } = useValidadorFeriados(date);
  return (
    <Dialog open={open} onOpenChange={(v) => !v && !loading && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="font-display text-lg">
            Mobilizar {colabNames.length} colaborador{colabNames.length === 1 ? "" : "es"}
          </DialogTitle>
          <p className="text-xs text-muted-foreground">Quando será a mobilização?</p>
        </DialogHeader>
        {colabNames.length > 1 && (
          <div className="text-xs text-muted-foreground max-h-20 overflow-auto space-y-0.5">
            {colabNames.map((n, i) => (
              <p key={i}>• {n}</p>
            ))}
          </div>
        )}
        {veiculosAfetados && veiculosAfetados.length > 0 && (
          <div className="mt-3 p-2 bg-warning/10 border border-warning/20 rounded-md">
            <p className="text-[10px] font-bold text-warning uppercase mb-1">
              Veículos sincronizados:
            </p>
            <div className="text-[10px] text-warning/80 max-h-16 overflow-auto">
              {veiculosAfetados.map((v, i) => (
                <p key={i}>• {v}</p>
              ))}
            </div>
            <p className="text-[10px] text-warning/70 mt-1 italic">
              Os veículos acima serão movidos para o mesmo destino.
            </p>
          </div>
        )}
        <div>
          <Label className="text-xs">Data da mobilização</Label>
          <DatePickerField value={date} onChange={onDateChange} className="mt-1" />
          {isFeriado && (
            <div className="mt-2 flex items-start gap-2 rounded-md border border-warning/40 bg-warning/10 px-2 py-1.5 text-xs text-warning">
              <CalendarOff className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              <span>
                Atenção: esta data é feriado nacional
                {feriadoNomes.length > 0 ? ` (${feriadoNomes.join(", ")})` : ""}.
              </span>
            </div>
          )}
        </div>
        {loading && progress && progress.total > 1 && (
          <div className="space-y-1">
            <Progress value={(progress.done / progress.total) * 100} className="h-1.5" />
            <p className="text-[10px] text-muted-foreground text-right">
              {progress.done}/{progress.total} concluído{progress.done === 1 ? "" : "s"}
            </p>
          </div>
        )}
        {failures && failures.length > 0 && (
          <Alert variant="destructive" className="py-2">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="text-xs space-y-1">
              <p className="font-medium">
                {failures.length} falha{failures.length === 1 ? "" : "s"} — os demais foram
                mobilizados.
              </p>
              <ul className="max-h-20 overflow-auto list-disc list-inside">
                {failures.map((f, i) => (
                  <li key={i}>
                    <span className="font-medium">{f.nome}</span>: {f.motivo}
                  </li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>
        )}
        {error && (
          <Alert variant="destructive" className="py-2">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="text-xs">{error}</AlertDescription>
          </Alert>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={loading}>
            {failures && failures.length > 0 ? "Fechar" : "Cancelar"}
          </Button>
          <Button
            onClick={onConfirm}
            disabled={
              !date ||
              loading ||
              (failures && failures.length > 0 && failures.length === colabNames.length)
            }
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                {progress && progress.total > 1
                  ? `Mobilizando ${progress.done}/${progress.total}…`
                  : "Mobilizando…"}
              </>
            ) : failures && failures.length > 0 ? (
              "Tentar novamente os que falharam"
            ) : (
              "Confirmar"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default MobilizacaoDialog;
