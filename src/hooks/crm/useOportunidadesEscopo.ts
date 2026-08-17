// Escopo de visibilidade do CRM.
// Regra: GM enxerga tudo; os demais enxergam as oportunidades dos clientes da
// sua carteira ("Responsável por negociação" no cadastro do cliente) mais
// aquelas em que são o responsável do card. Centralizado aqui para uso em
// Funil, Lista e Dashboard. A regra em si vive em `@/lib/crm/escopo` (pura,
// testável) e é espelhada no `api.php` por `escopoOportunidadesFin()`.
import { useMemo } from "react";
import { useAuth } from "@/contexts/auth/useAuth";
import { usePermissions } from "@/contexts/auth/usePermissions";
import { useClientesStateContext } from "@/contexts/clientes/ClientesStateContext";
import { carteiraDoUsuario, podeVerOportunidade } from "@/lib/crm/escopo";
import type { Oportunidade } from "@/types";

export function useCrmScopeFilter() {
  const { currentPlayer, isGM } = useAuth();
  const { hasAccess } = usePermissions();
  const { clientes } = useClientesStateContext();

  const userId = currentPlayer?.id ?? null;
  // Só o GM tem visão global. Um usuário sem nenhum cliente na carteira ainda
  // enxerga as oportunidades das quais é o responsável.
  const restrito = !isGM;
  const canViewAll = isGM;
  const canEdit = hasAccess("crm", "editar");

  const carteira = useMemo(() => carteiraDoUsuario(clientes, userId), [clientes, userId]);

  const isOwn = useMemo(
    () =>
      (o: Pick<Oportunidade, "clienteId" | "responsavelId">) =>
        podeVerOportunidade(o, { restrito, userId, carteira }),
    [restrito, userId, carteira],
  );

  const filter = useMemo(
    () =>
      <T extends { clienteId?: string | null; responsavelId?: string | null }>(list: T[]): T[] => {
        if (!restrito || !userId) return list;
        return list.filter((o) => podeVerOportunidade(o, { restrito, userId, carteira }));
      },
    [restrito, userId, carteira],
  );

  return { filter, isOwn, restrito, canViewAll, canEdit };
}

export function useOportunidadesEscopo(list: Oportunidade[]): Oportunidade[] {
  const { filter } = useCrmScopeFilter();
  return useMemo(() => filter(list), [filter, list]);
}
