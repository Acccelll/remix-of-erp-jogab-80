import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { restricoesRepo } from "@/lib/repositories/planejamento";
import { ShieldAlert, ExternalLink } from "lucide-react";

type Props = {
  cardId: string | null | undefined;
};

/**
 * Aviso somente-leitura exibido no diálogo do card quando há restrições
 * (Last Planner) abertas vinculadas a ele. Não permite editar — só comunica
 * o bloqueio e linka para a tela de Restrições.
 */
export default function RestricoesDoCardBadge({ cardId }: Props) {
  const { data } = useQuery({
    enabled: !!cardId,
    queryKey: ["restricoes-do-card", cardId],
    staleTime: 60_000,
    queryFn: async () => {
      return await restricoesRepo.listAbertasDoCard(cardId!);
    },
  });

  if (!cardId || !data || data.length === 0) return null;

  const hoje = new Date().toISOString().slice(0, 10);
  const vencidas = data.filter((r) => r.prazo && r.prazo < hoje).length;

  return (
    <Link
      to="/planejamento/restricoes"
      className={`flex items-start gap-2 rounded-md border px-3 py-2 text-xs transition hover:bg-accent ${
        vencidas > 0
          ? "border-destructive/40 bg-destructive/5 text-destructive"
          : "border-warning/40 bg-warning/5 text-warning"
      }`}
      title="Abrir Restrições"
    >
      <ShieldAlert className="h-4 w-4 mt-0.5 shrink-0" />
      <span className="flex-1">
        <strong>{data.length}</strong> restriç{data.length === 1 ? "ão" : "ões"} aberta
        {data.length === 1 ? "" : "s"} vinculada
        {data.length === 1 ? "" : "s"} a este card
        {vencidas > 0 && (
          <>
            {" "}
            (<strong>{vencidas}</strong> vencida{vencidas === 1 ? "" : "s"})
          </>
        )}
        . O pacote correspondente não pode ser comprometido enquanto não forem resolvidas.
      </span>
      <ExternalLink className="h-3 w-3 mt-0.5 shrink-0 opacity-60" />
    </Link>
  );
}
