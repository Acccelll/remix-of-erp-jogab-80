/**
 * /quadros/meus — board virtual "Meus cards".
 *
 * Pool de cards onde:
 *   - eu sou responsável (cards.responsavel_id = currentPlayer.id), OU
 *   - fui mencionado em algum comentário (texto contém `@<meu_login>`).
 *
 * Como é virtual, não há reordenação por listas. Cards são agrupados
 * por status do card (`aberto`, `concluido`, etc.) só para visualização.
 */
import { useMemo } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/auth/useAuth";
import { getMeusUserIds } from "@/lib/auth/identidade";
import { cardMembrosRepo } from "@/lib/repositories/cardsExtra";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, User } from "lucide-react";
import CardGenericoDialog from "@/components/cards/CardGenericoDialog";
import { useSearchParams } from "react-router-dom";
import { fmtDataLocal } from "@/lib/core/date";

interface MeuCard {
  id: string;
  numero: number;
  titulo: string;
  status: string;
  prazo: string | null;
  origem: ("responsavel" | "membro" | "mencao")[];
}

export default function QuadroMeus() {
  const { currentPlayer } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const cardAberto = searchParams.get("card");
  const setCardAberto = (id: string | null) => {
    const next = new URLSearchParams(searchParams);
    if (id) next.set("card", id);
    else next.delete("card");
    setSearchParams(next, { replace: true });
  };

  const meuId = currentPlayer?.id ?? null;
  const meuLogin = currentPlayer?.login ?? null;

  const q = useQuery({
    enabled: !!meuId,
    queryKey: ["meus-cards", meuId, meuLogin],
    queryFn: async (): Promise<MeuCard[]> => {
      const out = new Map<string, MeuCard>();

      // Ids reais no Supabase Auth (a sessão pode estar numa conta duplicada).
      const userIds = await getMeusUserIds(meuLogin);
      if (!userIds.length) return [];

      const add = (c: any, origem: MeuCard["origem"][number]) => {
        const prev = out.get(c.id);
        if (prev) {
          if (!prev.origem.includes(origem)) prev.origem.push(origem);
          return;
        }
        out.set(c.id, {
          id: c.id,
          numero: c.numero,
          titulo: c.titulo,
          status: c.status,
          prazo: c.prazo,
          origem: [origem],
        });
      };

      // 1) Cards onde sou responsável
      const { data: meus, error: e1 } = await supabase
        .from("cards")
        .select("id,numero,titulo,status,prazo")
        .in("responsavel_id", userIds)
        .order("prazo", { ascending: true, nullsFirst: false });
      if (e1) throw e1;
      for (const c of meus ?? []) add(c, "responsavel");

      // 2) Cards onde sou membro
      const membroIds = await cardMembrosRepo.listCardIdsByUsers(userIds);
      if (membroIds.length) {
        const { data: cs } = await supabase
          .from("cards")
          .select("id,numero,titulo,status,prazo")
          .in("id", membroIds);
        for (const c of cs ?? []) add(c, "membro");
      }

      // 3) Cards mencionados em comentários (@meu_login)
      if (meuLogin) {
        const { data: coments } = await supabase
          .from("card_comentarios")
          .select("card_id,texto")
          .ilike("texto", `%@${meuLogin}%`);
        const ids = Array.from(new Set((coments ?? []).map((c: any) => c.card_id)));
        if (ids.length) {
          const { data: cs } = await supabase
            .from("cards")
            .select("id,numero,titulo,status,prazo")
            .in("id", ids);
          for (const c of cs ?? []) add(c, "mencao");
        }
      }
      return Array.from(out.values());
    },
  });


  const porStatus = useMemo(() => {
    const m = new Map<string, MeuCard[]>();
    for (const c of q.data ?? []) {
      const arr = m.get(c.status) ?? [];
      arr.push(c);
      m.set(c.status, arr);
    }
    return m;
  }, [q.data]);

  if (!meuId) {
    return (
      <div className="p-6 text-center text-sm text-muted-foreground">
        Faça login para ver seus cards.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Button asChild variant="ghost" size="sm">
          <Link to="/quadros">
            <ArrowLeft className="h-4 w-4" /> Quadros
          </Link>
        </Button>
        <h1 className="font-display text-xl font-bold flex items-center gap-2">
          <User className="h-5 w-5 text-primary" /> Meus cards
        </h1>
        <Badge variant="outline" className="text-[10px]">
          virtual
        </Badge>
      </div>

      {q.isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : (q.data?.length ?? 0) === 0 ? (
        <div className="text-sm text-muted-foreground p-8 text-center border rounded-md">
          Nenhum card atribuído ou com menção a @{meuLogin}.
        </div>
      ) : (
        <div className="overflow-x-auto pb-4">
          <div className="flex gap-4 min-w-max items-start">
            {Array.from(porStatus.entries()).map(([status, cards]) => (
              <div key={status} className="obra-column w-72 shrink-0">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-display text-sm font-semibold capitalize">{status}</h3>
                  <span className="text-xs rounded-full px-2 py-0.5 bg-secondary text-muted-foreground">
                    {cards.length}
                  </span>
                </div>
                <div className="flex flex-col gap-3">
                  {cards.map((c) => (
                    <Card
                      key={c.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => setCardAberto(c.id)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          setCardAberto(c.id);
                        }
                      }}
                      className="cursor-pointer hover:border-primary/50 transition-colors"
                    >
                      <CardContent className="p-3 space-y-1.5">
                        <div className="text-xs text-muted-foreground">#{c.numero}</div>
                        <div className="text-sm font-medium">{c.titulo}</div>
                        <div className="flex items-center gap-1.5 flex-wrap pt-1">
                          {c.origem.includes("responsavel") && (
                            <Badge variant="secondary" className="text-[10px]">
                              responsável
                            </Badge>
                          )}
                          {c.origem.includes("membro") && (
                            <Badge variant="secondary" className="text-[10px]">
                              membro
                            </Badge>
                          )}
                          {c.origem.includes("mencao") && (

                            <Badge variant="outline" className="text-[10px]">
                              @menção
                            </Badge>
                          )}
                          {c.prazo && (
                            <span className="text-[10px] text-muted-foreground">
                              prazo: {fmtDataLocal(c.prazo)}
                            </span>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {cardAberto && (
        <CardGenericoDialog
          cardId={cardAberto}
          open={!!cardAberto}
          onOpenChange={(o) => !o && setCardAberto(null)}
        />
      )}
    </div>
  );
}
