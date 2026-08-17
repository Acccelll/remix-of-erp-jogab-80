import React from "react";
import { MessageSquare } from "lucide-react";
import type { Comentario } from "./types";

export const CommentBubble = React.memo(
  ({
    solId,
    campo,
    comentarios,
    onOpen,
  }: {
    solId: string;
    campo: string;
    comentarios: Comentario[];
    onOpen: () => void;
  }) => {
    const count = comentarios.filter((c) => c.solicitacao_id === solId && c.campo === campo).length;
    return (
      <button
        // A linha da fila é clicável (abre a visualização). Sem travar aqui, um
        // clique no balão abriria os dois diálogos de uma vez.
        onClick={(e) => {
          e.stopPropagation();
          onOpen();
        }}
        className="relative ml-1 text-muted-foreground hover:text-foreground"
        title="Comentários"
      >
        <MessageSquare className="h-3.5 w-3.5" />
        {count > 0 && (
          <span className="absolute -top-1 -right-1 bg-primary text-primary-foreground text-[9px] rounded-full w-3.5 h-3.5 flex items-center justify-center">
            {count}
          </span>
        )}
      </button>
    );
  },
);
CommentBubble.displayName = "CommentBubble";
