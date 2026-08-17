import React from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ScrollArea } from "@/components/ui/scroll-area";
import DatePickerField from "@/components/common/DatePickerField";
import { AlertCircle, ArrowRight, CalendarOff, Loader2 } from "lucide-react";
import { useValidadorFeriados } from "@/hooks/useValidadorFeriados";
import type { PontoColaborador, PontoObra } from "@/hooks/rh/useLogisticaPontos";

export interface DialogMobilizacaoLoteProps {
  open: boolean;
  colaboradores: PontoColaborador[];
  obra: PontoObra | null;
  data: string;
  onDataChange: (d: string) => void;
  loading: boolean;
  progresso: { feitos: number; total: number } | null;
  error: string;
  onClose: () => void;
  onConfirm: () => void;
}

/**
 * Confirmação da mobilização em lote — mesma data para todos os selecionados.
 * O progresso é reportado em tempo real; o botão fecha só depois que o último
 * colaborador termina (ou falha, e aí o erro fica visível).
 */
const DialogMobilizacaoLote: React.FC<DialogMobilizacaoLoteProps> = ({
  open,
  colaboradores,
  obra,
  data,
  onDataChange,
  loading,
  progresso,
  error,
  onClose,
  onConfirm,
}) => {
  const { isFeriado, nomes: feriadoNomes } = useValidadorFeriados(data);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && !loading && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-lg">
            Mobilizar {colaboradores.length} colaboradores
          </DialogTitle>
        </DialogHeader>

        {obra && (
          <div className="flex items-center gap-1.5 rounded-md border p-2 text-xs">
            <span className="text-muted-foreground">Destino</span>
            <ArrowRight className="h-3 w-3 shrink-0 text-muted-foreground" />
            <span className="truncate font-medium">{obra.obra.nome}</span>
          </div>
        )}

        <ScrollArea className="max-h-40 rounded-md border">
          <ul className="divide-y">
            {colaboradores.map((c) => (
              <li key={c.colaborador.id} className="flex items-center justify-between gap-2 p-1.5">
                <span className="truncate text-xs">{c.colaborador.nome}</span>
                <span className="shrink-0 text-[10px] text-muted-foreground">
                  {c.colaborador.funcao || "Sem função"}
                </span>
              </li>
            ))}
          </ul>
        </ScrollArea>

        <div>
          <Label className="text-xs">Data da mobilização</Label>
          <DatePickerField value={data} onChange={onDataChange} className="mt-1" />
          {isFeriado && (
            <div className="mt-2 flex items-start gap-2 rounded-md border border-warning/40 bg-warning/10 px-2 py-1.5 text-xs text-warning">
              <CalendarOff className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>Feriado: {feriadoNomes.join(", ")}</span>
            </div>
          )}
        </div>

        {progresso && loading && (
          <p className="text-xs text-muted-foreground">
            Mobilizando {progresso.feitos}/{progresso.total}…
          </p>
        )}

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="text-xs">{error}</AlertDescription>
          </Alert>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Cancelar
          </Button>
          <Button onClick={onConfirm} disabled={!data || loading || colaboradores.length === 0}>
            {loading ? (
              <>
                <Loader2 className="mr-1 h-4 w-4 animate-spin" /> Mobilizando…
              </>
            ) : (
              `Confirmar (${colaboradores.length})`
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default DialogMobilizacaoLote;
