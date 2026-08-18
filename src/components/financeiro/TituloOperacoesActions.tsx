import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Edit3, Loader2, RotateCcw, XCircle } from "lucide-react";
import { toast } from "sonner";

import { EditarTituloCanonicoDialog } from "@/components/financeiro/EditarTituloCanonicoDialog";
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
import { Button } from "@/components/ui/button";
import {
  cancelarTituloCanonico,
  reabrirTituloCanonico,
} from "@/lib/repositories/financeiro-titulos-operacoes";
import type {
  RateioTituloRow,
  TituloCanonicoResumo,
} from "@/lib/repositories/financeiro-titulos";

interface TituloOperacoesActionsProps {
  titulo: TituloCanonicoResumo;
  rateios: RateioTituloRow[];
  podeOperar: boolean;
  onSuccess: () => void | Promise<void>;
}

type AcaoConfirmacao = "cancelar" | "reabrir" | null;

export function TituloOperacoesActions({
  titulo,
  rateios,
  podeOperar,
  onSuccess,
}: TituloOperacoesActionsProps) {
  const [editarOpen, setEditarOpen] = useState(false);
  const [confirmacao, setConfirmacao] = useState<AcaoConfirmacao>(null);

  const manual = titulo.origem_tipo === "manual";
  const semBaixaAtiva = Math.abs(titulo.valor_baixado) < 0.005;
  const cancelado = titulo.status_calculado === "cancelado" || titulo.status === "cancelado";
  const podeEditar = podeOperar && manual && semBaixaAtiva && !cancelado;
  const podeCancelar = podeOperar && manual && semBaixaAtiva && !cancelado;
  const podeReabrir = podeOperar && manual && semBaixaAtiva && cancelado;

  const mutation = useMutation({
    mutationFn: async (acao: Exclude<AcaoConfirmacao, null>) => {
      if (acao === "cancelar") await cancelarTituloCanonico(titulo.id);
      else await reabrirTituloCanonico(titulo.id);
    },
    onSuccess: async (_, acao) => {
      toast.success(acao === "cancelar" ? "Título cancelado." : "Título reaberto.");
      setConfirmacao(null);
      await onSuccess();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  if (!podeOperar || !manual) return null;

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        {podeEditar && (
          <Button variant="outline" size="sm" onClick={() => setEditarOpen(true)}>
            <Edit3 className="mr-2 h-4 w-4" /> Editar
          </Button>
        )}
        {podeCancelar && (
          <Button variant="outline" size="sm" onClick={() => setConfirmacao("cancelar")}>
            <XCircle className="mr-2 h-4 w-4" /> Cancelar título
          </Button>
        )}
        {podeReabrir && (
          <Button variant="outline" size="sm" onClick={() => setConfirmacao("reabrir")}>
            <RotateCcw className="mr-2 h-4 w-4" /> Reabrir título
          </Button>
        )}
        {!semBaixaAtiva && (
          <p className="text-xs text-muted-foreground">
            Para editar ou cancelar, estorne primeiro as baixas ativas deste título.
          </p>
        )}
      </div>

      <EditarTituloCanonicoDialog
        titulo={titulo}
        rateios={rateios}
        open={editarOpen}
        onOpenChange={setEditarOpen}
        onSuccess={onSuccess}
      />

      <AlertDialog open={confirmacao !== null} onOpenChange={(open) => !open && setConfirmacao(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmacao === "cancelar" ? "Cancelar título?" : "Reabrir título?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmacao === "cancelar"
                ? "O título deixará de compor o saldo operacional. O histórico e os rateios serão preservados e a operação ficará auditada."
                : "O título voltará ao estado em aberto e retornará ao saldo operacional. A reabertura ficará registrada no histórico."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={mutation.isPending}>Voltar</AlertDialogCancel>
            <AlertDialogAction
              disabled={mutation.isPending || confirmacao === null}
              onClick={(event) => {
                event.preventDefault();
                if (confirmacao) mutation.mutate(confirmacao);
              }}
            >
              {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {confirmacao === "cancelar" ? "Confirmar cancelamento" : "Confirmar reabertura"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

export default TituloOperacoesActions;
