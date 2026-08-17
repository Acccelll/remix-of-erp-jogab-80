// Dashboard Home ("/") — cartões do usuário logado no kanban.
// Semântica definida pelo produto: união de RESPONSÁVEL ∪ MEMBRO (sem
// menções — diferente da página /quadros/meus, que usa responsável+menção).
import { useQuery } from "@tanstack/react-query";
import { queryKey } from "@/lib/query-keys";
import { cardsRepo } from "@/lib/repositories/cards";
import { cardMembrosRepo } from "@/lib/repositories/cardsExtra";
import { useAuth } from "@/contexts/auth/useAuth";
import { getMeusUserIds } from "@/lib/auth/identidade";


export type OrigemCartao = "responsavel" | "membro";

export interface MeuCartao {
  id: string;
  numero: number | null;
  titulo: string;
  status: string | null;
  prazo: string | null;
  obraId: string | null;
  origem: OrigemCartao[];
}

export const meusCartoesKeys = {
  resumo: (userId: string) => queryKey("meus-cards", "home", userId),
};

function toCartao(row: any, origem: OrigemCartao): MeuCartao {
  return {
    id: String(row.id),
    numero: row.numero ?? null,
    titulo: row.titulo ?? "",
    status: row.status ?? null,
    prazo: row.prazo ?? null,
    obraId: row.obra_id != null ? String(row.obra_id) : null,
    origem: [origem],
  };
}

export function useMeusCartoes() {
  const { currentPlayer } = useAuth();

  return useQuery({
    queryKey: meusCartoesKeys.resumo(currentPlayer?.id ?? ""),
    enabled: !!currentPlayer?.id,
    staleTime: 30_000,
    queryFn: async (): Promise<MeuCartao[]> => {
      // Contas duplicadas (@planifik.local / @obraflow.local) fazem o
      // `auth.uid()` da sessão divergir do `responsavel_id` dos cartões.
      const userIds = await getMeusUserIds(currentPlayer?.login);
      if (!userIds.length) return [];

      const [responsavel, membroIds] = await Promise.all([
        cardsRepo.listMinByResponsavelIn(userIds),
        cardMembrosRepo.listCardIdsByUsers(userIds),
      ]);


      const porId = new Map<string, MeuCartao>();
      for (const row of responsavel) {
        const c = toCartao(row, "responsavel");
        porId.set(c.id, c);
      }

      const faltantes = membroIds.filter((id) => !porId.has(id));
      const comoMembro = await cardsRepo.listMinByIds(faltantes);
      for (const row of comoMembro) {
        const c = toCartao(row, "membro");
        porId.set(c.id, c);
      }
      // Cards onde é responsável E membro: registra as duas origens.
      for (const id of membroIds) {
        const existente = porId.get(id);
        if (existente && !existente.origem.includes("membro")) existente.origem.push("membro");
      }

      // Prazo asc (sem prazo por último); desempate por número.
      return Array.from(porId.values()).sort((a, b) => {
        if (a.prazo && b.prazo) return a.prazo.localeCompare(b.prazo);
        if (a.prazo) return -1;
        if (b.prazo) return 1;
        return (a.numero ?? 0) - (b.numero ?? 0);
      });
    },
  });
}
