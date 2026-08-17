import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import type { Comentario } from "./types";
import { fmtDataLocal } from "@/lib/core/date";

export function ComentariosDialog({
  campo,
  solId,
  comentarios,
  newComment,
  onCommentChange,
  onClose,
  onSend,
}: {
  campo: string | null;
  solId: string | null;
  comentarios: Comentario[];
  newComment: string;
  onCommentChange: (v: string) => void;
  onClose: () => void;
  onSend: () => void;
}) {
  const open = !!campo && !!solId;
  if (!open) return null;
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="font-display">Comentários — {campo}</DialogTitle>
        </DialogHeader>
        <div className="space-y-2 max-h-40 overflow-y-auto">
          {comentarios
            .filter((c) => c.solicitacao_id === solId && c.campo === campo)
            .map((c) => (
              <div key={c.id} className="text-sm bg-muted p-2 rounded">
                <p className="font-medium text-xs text-muted-foreground">
                  {c.autor} — {fmtDataLocal(c.created_at)}
                </p>
                <p>{c.texto}</p>
              </div>
            ))}
        </div>
        <div className="flex gap-2">
          <Input
            value={newComment}
            onChange={(e) => onCommentChange(e.target.value)}
            placeholder="Novo comentário..."
          />
          <Button size="sm" onClick={onSend} disabled={!newComment}>
            Enviar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
