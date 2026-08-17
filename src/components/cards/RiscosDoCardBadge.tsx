import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { riscosRepo } from "@/lib/repositories/planejamento";
import { AlertTriangle, ExternalLink } from "lucide-react";
import { SEVERIDADE_BG, SEVERIDADE_LABEL, severidadeDe } from "@/lib/riscos/matriz";

type Props = { cardId: string | null | undefined };

/**
 * Aviso somente-leitura exibido no card quando há riscos ativos vinculados.
 * Mostra o de maior severidade. Linka para a página de Riscos.
 */
export default function RiscosDoCardBadge({ cardId }: Props) {
  const { data } = useQuery({
    enabled: !!cardId,
    queryKey: ["riscos-do-card", cardId],
    staleTime: 60_000,
    queryFn: async () => {
      // TODO(ARC-001/E-01): coluna `card_id` ausente em riscos — migrar schema ou remover badge.
      return await riscosRepo.listAtivosDoCard(cardId!);
    },
  });

  if (!cardId || !data || data.length === 0) return null;

  // pega o de maior severidade para colorir o aviso
  const pior = data.reduce(
    (acc, r) => {
      const s = (r.probabilidade ?? 0) * (r.impacto ?? 0);
      return s > acc.score ? { score: s, r } : acc;
    },
    { score: -1, r: data[0] },
  );
  const sev = severidadeDe(pior.r.probabilidade ?? 0, pior.r.impacto ?? 0);

  return (
    <Link
      to="/planejamento/riscos"
      className={`flex items-start gap-2 rounded-md border-2 px-3 py-2 text-xs transition hover:opacity-90 ${SEVERIDADE_BG[sev]}`}
      title="Abrir Matriz de Riscos"
    >
      <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
      <span className="flex-1">
        <strong>{data.length}</strong> risco{data.length === 1 ? "" : "s"} ativo
        {data.length === 1 ? "" : "s"} vinculado{data.length === 1 ? "" : "s"} a este card (pior:{" "}
        <strong>{SEVERIDADE_LABEL[sev]}</strong>).
      </span>
      <ExternalLink className="h-3 w-3 mt-0.5 shrink-0 opacity-60" />
    </Link>
  );
}
