/** @module-kind io */
// ARC-003 — acesso a dados delegado a `financeiroTotvsRepo`.
import { useQuery } from "@tanstack/react-query";
import { financeiroTotvsRepo } from "@/lib/repositories/financeiro";

/**
 * Carrega o plano de contas e devolve um helper para rotular códigos
 * de grupo/subgrupo/natureza com a descrição cadastrada.
 */
export function usePlanoContasLabels() {
  const { data } = useQuery({
    queryKey: ["plano_contas_labels"],
    staleTime: 5 * 60 * 1000,
    queryFn: () => financeiroTotvsRepo.listPlanoContasLabels(),
  });

  const map = new Map<string, string>();
  for (const n of data ?? []) map.set(n.cod_natureza, n.descricao);

  function label(cod: string | null | undefined, fallback?: string | null) {
    if (!cod) return fallback ?? "—";
    const d = map.get(cod);
    return d ? `${cod} - ${d}` : fallback ? `${cod} - ${fallback}` : cod;
  }

  return { label, map };
}
