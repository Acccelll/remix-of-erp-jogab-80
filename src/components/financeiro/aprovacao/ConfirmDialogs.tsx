import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { Solicitacao } from "./types";
import { formatBRL } from "@/lib/core/currency";

export function ApproveDialog({
  solicitacao,
  approvingId,
  onClose,
  onConfirm,
}: {
  solicitacao: Solicitacao | null;
  approvingId: string | null;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <Dialog open={!!solicitacao} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="font-display">Aprovar Solicitação</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">Autorizar a aquisição via setor de Compras?</p>
        <p className="text-sm font-medium">
          Valor: {solicitacao ? formatBRL(solicitacao.valor) : ""}
        </p>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={!!approvingId}>
            Cancelar
          </Button>
          <Button
            onClick={onConfirm}
            className="bg-success hover:bg-success/90"
            disabled={!!approvingId}
          >
            {approvingId ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : "Aprovar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function RejectDialog({
  solicitacao,
  rejectingId,
  rejectComment,
  onCommentChange,
  onClose,
  onConfirm,
}: {
  solicitacao: Solicitacao | null;
  rejectingId: string | null;
  rejectComment: string;
  onCommentChange: (v: string) => void;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <Dialog open={!!solicitacao} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="font-display">Recusar Solicitação</DialogTitle>
        </DialogHeader>
        <div>
          <Label>Motivo da recusa *</Label>
          <Textarea
            value={rejectComment}
            onChange={(e) => onCommentChange(e.target.value)}
            className="mt-1"
            placeholder="Descreva o motivo..."
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={!!rejectingId}>
            Cancelar
          </Button>
          <Button
            variant="destructive"
            onClick={onConfirm}
            disabled={!rejectComment || !!rejectingId}
          >
            {rejectingId ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : "Recusar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function CancelDialog({
  open,
  cancelingId,
  onClose,
  onConfirm,
}: {
  open: boolean;
  cancelingId: string | null;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="font-display">Cancelar Solicitação</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Tem certeza que deseja cancelar esta solicitação? Esta ação não pode ser desfeita.
        </p>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={cancelingId !== null}>
            Voltar
          </Button>
          <Button variant="destructive" onClick={onConfirm} disabled={cancelingId !== null}>
            {cancelingId ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : "Sim, cancelar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
