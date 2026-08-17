import { useUltimoRdoParaCard } from "@/hooks/obras/useRdo";
import { ClipboardList } from "lucide-react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

type Props = { cardId: string | null | undefined };

/**
 * Aviso somente-leitura mostrando a última execução em RDO vinculada
 * ao item de cronograma do card. Aparece apenas se o card está
 * amarrado a um `cronograma_item_id` e existe ao menos uma execução.
 */
export default function UltimoRdoBadge({ cardId }: Props) {
  const { data } = useUltimoRdoParaCard(cardId);


  if (!data) return null;

  return (
    <div
      className="flex items-start gap-2 rounded-md border bg-muted/40 px-3 py-2 text-xs"
      title="Última execução registrada em RDO"
    >
      <ClipboardList className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground" />
      <span className="flex-1">
        Última execução em RDO:{" "}
        <strong>{format(parseISO(data.data), "dd/MM/yyyy", { locale: ptBR })}</strong> —{" "}
        {data.pessoas} pessoa{data.pessoas === 1 ? "" : "s"}
        {data.quantidade > 0 ? ` • qtd ${data.quantidade}` : ""}
      </span>
    </div>
  );
}
