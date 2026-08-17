// CRM — Diálogo de comentários de uma oportunidade, no mesmo padrão visual
// do diálogo de comentários da página "Aprovação Financeira".
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/auth/useAuth";
import { Oportunidade } from "@/types";
import { toast } from "sonner";
import { fmtDataLocal } from "@/lib/core/date";
import { useQueryClient } from "@tanstack/react-query";
import {
  useComentariosDeOportunidade,
  useCreateOportunidadeComentario,
} from "@/hooks/crm/useOportunidadeComentarios";
import { registrarInteracao } from "@/lib/crm/historico";

export function OportunidadeComentariosDrawer({
  oportunidade,
  open,
  onOpenChange,
}: {
  oportunidade: Oportunidade | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const { currentPlayer } = useAuth();
  const qc = useQueryClient();
  const { data: comentarios = [], isError } = useComentariosDeOportunidade(
    oportunidade?.id ?? null,
    open,
  );
  const createComentario = useCreateOportunidadeComentario();
  const [novoTexto, setNovoTexto] = useState("");
  const salvando = createComentario.isPending;

  if (isError) toast.error("Erro ao carregar comentários");

  const handleSend = async () => {
    if (!oportunidade || !novoTexto.trim()) return;
    const texto = novoTexto.trim();
    try {
      await createComentario.mutateAsync({
        oportunidadeId: oportunidade.id,
        texto,
        autor: currentPlayer?.login || "",
      });
      setNovoTexto("");
      // Registra na timeline visível "Histórico de interações".
      const resumo = texto.length > 140 ? `${texto.slice(0, 140)}…` : texto;
      await registrarInteracao({
        oportunidadeId: oportunidade.id,
        tipo: "comentario",
        descricao: resumo,
      });
      qc.invalidateQueries({ queryKey: ["crm-interacoes", oportunidade.id] });
    } catch {
      toast.error("Erro ao adicionar comentário");
    }
  };

  if (!open || !oportunidade) return null;


  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="font-display">Comentários — {oportunidade.nome}</DialogTitle>
        </DialogHeader>
        <div className="space-y-2 max-h-40 overflow-y-auto">
          {comentarios.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              Nenhum comentário ainda.
            </p>
          ) : (
            comentarios.map((c) => (
              <div key={c.id} className="text-sm bg-muted p-2 rounded">
                <p className="font-medium text-xs text-muted-foreground">
                  {c.autor || "—"} — {fmtDataLocal(c.created_at)}
                </p>
                <p>{c.texto}</p>
              </div>
            ))
          )}
        </div>
        <div className="flex gap-2">
          <Input
            value={novoTexto}
            onChange={(e) => setNovoTexto(e.target.value)}
            placeholder="Novo comentário..."
          />
          <Button size="sm" onClick={handleSend} disabled={salvando || !novoTexto.trim()}>
            Enviar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
