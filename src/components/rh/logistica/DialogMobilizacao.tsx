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
import DatePickerField from "@/components/common/DatePickerField";
import { AlertCircle, ArrowRight, CalendarOff, Loader2, Route } from "lucide-react";
import { useValidadorFeriados } from "@/hooks/useValidadorFeriados";
import { formatarDistancia, formatarDuracao } from "@/lib/logistica/equipes";
import type { Rota } from "@/lib/logistica/osrm";
import type { PontoColaborador, PontoObra } from "@/hooks/rh/useLogisticaPontos";
import type { Obra } from "@/types";

export interface DialogMobilizacaoProps {
  open: boolean;
  colaborador: PontoColaborador | null;
  obra: PontoObra | null;
  /** Obra atual do colaborador — quando presente e diferente do destino, o diálogo vira "Transferir". */
  obraOrigem?: Obra | null;
  rota: Rota | null;
  rotaCarregando: boolean;
  data: string;
  onDataChange: (d: string) => void;
  loading: boolean;
  error: string;
  onClose: () => void;
  onConfirm: () => void;
}

/**
 * Confirmação da mobilização disparada no mapa.
 *
 * Reusa o `DatePickerField` e o `useValidadorFeriados` do Board para que a
 * regra de data seja literalmente a mesma dos dois caminhos de mobilização.
 * A diferença é o contexto geográfico — origem, destino, distância e tempo —
 * que é justamente o que esta tela adiciona à decisão.
 *
 * Quando `obraOrigem` está definida e é diferente do destino, apresenta a
 * ação como **Transferência entre obras** — mesmo backend
 * (`mobilizarColaborador`), rótulos e destaque diferentes.
 */
const DialogMobilizacao: React.FC<DialogMobilizacaoProps> = ({
  open,
  colaborador,
  obra,
  obraOrigem,
  rota,
  rotaCarregando,
  data,
  onDataChange,
  loading,
  error,
  onClose,
  onConfirm,
}) => {
  const { isFeriado, nomes: feriadoNomes } = useValidadorFeriados(data);
  const isTransferencia = !!(obraOrigem && obra && obraOrigem.id !== obra.obra.id);
  const titulo = isTransferencia ? "Transferir entre obras" : "Mobilizar colaborador";
  const rotuloOrigem = isTransferencia
    ? (obraOrigem?.nome ?? "Obra atual")
    : (colaborador?.rotuloLocal ?? "Origem");

  return (
    <Dialog open={open} onOpenChange={(v) => !v && !loading && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="font-display text-lg">{titulo}</DialogTitle>
        </DialogHeader>

        {colaborador && obra && (
          <div className="rounded-md border p-2 text-xs">
            <p className="truncate font-medium">{colaborador.colaborador.nome}</p>
            <p className="truncate text-muted-foreground">
              {colaborador.colaborador.funcao || "Sem função"}
            </p>
            <div className="mt-2 flex items-center gap-1.5 text-muted-foreground">
              <span className="truncate">{rotuloOrigem}</span>
              <ArrowRight className="h-3 w-3 shrink-0" />
              <span className="truncate font-medium text-foreground">{obra.obra.nome}</span>
            </div>
            {obra.rotuloLocal && (
              <p className="truncate text-[11px] text-muted-foreground">{obra.rotuloLocal}</p>
            )}
            {isTransferencia && (
              <p className="mt-2 rounded bg-amber-500/10 px-1.5 py-1 text-[11px] text-amber-700 dark:text-amber-400">
                O colaborador será desmobilizado de <strong>{obraOrigem?.nome}</strong> e mobilizado para a nova obra na data escolhida.
              </p>
            )}
          </div>
        )}

        <div className="flex items-center gap-1.5 text-xs">
          <Route className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          {rotaCarregando ? (
            <span className="text-muted-foreground">Calculando rota…</span>
          ) : rota ? (
            <span>
              {formatarDistancia(rota.distanciaKm)} · {formatarDuracao(rota.duracaoMin)}
              {rota.estimada && (
                <span className="ml-1 text-muted-foreground">(estimado em linha reta)</span>
              )}
            </span>
          ) : (
            <span className="text-muted-foreground">Rota indisponível</span>
          )}
        </div>

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
          <Button onClick={onConfirm} disabled={!data || loading}>
            {loading ? (
              <>
                <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                {isTransferencia ? "Transferindo…" : "Mobilizando…"}
              </>
            ) : isTransferencia ? (
              "Transferir"
            ) : (
              "Confirmar"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default DialogMobilizacao;
