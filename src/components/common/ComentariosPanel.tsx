// Núcleo reutilizável de comentários encadeados por entidade (Colaborador,
// Patrimônio, Contrato). Usado tanto no drawer aberto pelo balão do card quanto
// na aba "Histórico" dos dialogs de perfil. Modelado no corpo do
// OportunidadeComentariosDrawer (CRM).
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/auth/useAuth";
import { toast } from "sonner";
import { fmtDataLocal } from "@/lib/core/date";
import {
  hooksPorTipo,
  type TipoEntidadeComentario,
} from "@/hooks/comentarios/useComentariosEntidade";

export function ComentariosPanel({
  tipo,
  id,
  enabled = true,
}: {
  tipo: TipoEntidadeComentario;
  id: string;
  /** Ativa a leitura/polling (passe o estado de "aberto" quando dentro de um drawer). */
  enabled?: boolean;
}) {
  const { currentPlayer } = useAuth();
  const hooks = hooksPorTipo(tipo);
  const { data: comentarios = [], isError } = hooks.useDaEntidade(id, enabled);
  const criar = hooks.useCriar();
  const [novoTexto, setNovoTexto] = useState("");
  const salvando = criar.isPending;

  if (isError) toast.error("Erro ao carregar comentários");

  const handleSend = async () => {
    const texto = novoTexto.trim();
    if (!texto) return;
    try {
      await criar.mutateAsync({
        entidadeId: id,
        texto,
        autor: currentPlayer?.login || "",
      });
      setNovoTexto("");
    } catch {
      toast.error("Erro ao adicionar comentário");
    }
  };

  return (
    <div className="space-y-3">
      <div className="space-y-2 max-h-64 overflow-y-auto">
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
              <p className="whitespace-pre-wrap break-words">{c.texto}</p>
            </div>
          ))
        )}
      </div>
      <div className="flex gap-2">
        <Input
          value={novoTexto}
          onChange={(e) => setNovoTexto(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
          placeholder="Novo comentário..."
        />
        <Button size="sm" onClick={handleSend} disabled={salvando || !novoTexto.trim()}>
          Enviar
        </Button>
      </div>
    </div>
  );
}
