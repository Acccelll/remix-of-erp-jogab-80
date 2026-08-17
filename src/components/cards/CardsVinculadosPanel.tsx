/**
 * ETAPA 2 · Navegação inversa — cards vinculados a uma entidade do ERP.
 * Componente genérico, reutilizável por qualquer módulo (obras, cronograma…).
 */
import { Link } from "react-router-dom";

import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useCardsPorEntidade } from "@/hooks/quadros/useExtensoes";

interface Props {
  entityType: string;
  entityId: string | null | undefined;
  titulo?: string;
}

export default function CardsVinculadosPanel({
  entityType,
  entityId,
  titulo = "Cards vinculados",
}: Props) {
  const { data = [], isLoading, isError } = useCardsPorEntidade(entityType, entityId);

  if (!entityId) return null;

  return (
    <section className="space-y-2">
      <h3 className="text-sm font-semibold">{titulo}</h3>
      {isLoading && <Skeleton className="h-16 w-full" />}
      {isError && (
        <p className="text-sm text-muted-foreground">Não foi possível carregar os cards.</p>
      )}
      {!isLoading && data.length === 0 && (
        <p className="text-sm text-muted-foreground">Nenhum card vinculado.</p>
      )}
      <ul className="space-y-1">
        {data.map((c: any) => (
          <li key={c.card_id} className="rounded border px-2 py-1 text-sm">
            <Link
              to={c.board_id ? `/quadros/${c.board_id}?card=${c.card_id}` : "#"}
              className="flex items-center justify-between gap-2 hover:underline"
            >
              <span className="truncate">
                {c.numero ? `#${c.numero} · ` : ""}
                {c.titulo ?? "Card"}
              </span>
              {c.is_primary && <Badge variant="outline">principal</Badge>}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
