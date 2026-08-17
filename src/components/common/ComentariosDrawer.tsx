// Drawer (Dialog) de comentários encadeados, aberto pelo balãozinho no card
// dos quadros de Equipe, Patrimônios e Contratos. Embrulha ComentariosPanel.
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ComentariosPanel } from "@/components/common/ComentariosPanel";
import type { TipoEntidadeComentario } from "@/hooks/comentarios/useComentariosEntidade";

export function ComentariosDrawer({
  tipo,
  id,
  nome,
  open,
  onOpenChange,
}: {
  tipo: TipoEntidadeComentario;
  id: string | null;
  nome?: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  if (!open || !id) return null;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="font-display">
            Comentários{nome ? ` — ${nome}` : ""}
          </DialogTitle>
        </DialogHeader>
        <ComentariosPanel tipo={tipo} id={id} enabled={open} />
      </DialogContent>
    </Dialog>
  );
}
