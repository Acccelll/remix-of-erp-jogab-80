// Seção "Meus cartões" do Dashboard Home — lista compacta dos cartões em
// que o usuário logado é responsável ou membro, ordenados por prazo.
// Clique abre o cartão na página Meus cards (?card=id, já suportado lá).
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, LayoutGrid } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/common/EmptyState";
import { bucketPrazo } from "@/lib/cards/filtrosCards";
import { cartaoConcluido } from "@/lib/obras/dashboardObras";
import { fmtDataLocal } from "@/lib/core/date";
import type { MeuCartao } from "@/hooks/quadros/useMeusCartoes";

const MAX_VISIVEIS = 8;

const ORIGEM_LABEL = { responsavel: "responsável", membro: "membro" } as const;

function prazoClasses(prazo: string | null, hoje: Date): string {
  const bucket = bucketPrazo(prazo, hoje);
  if (bucket === "vencido") return "text-destructive font-medium";
  if (bucket === "hoje" || bucket === "semana") return "text-warning font-medium";
  return "text-muted-foreground";
}

export function MeusCartoesSection({ cartoes }: { cartoes: MeuCartao[] }) {
  const navigate = useNavigate();
  const hoje = new Date();

  // Abertos primeiro (já vêm ordenados por prazo asc do hook).
  const visiveis = [
    ...cartoes.filter((c) => !cartaoConcluido(c.status)),
    ...cartoes.filter((c) => cartaoConcluido(c.status)),
  ].slice(0, MAX_VISIVEIS);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <LayoutGrid className="h-4 w-4 text-muted-foreground" />
          Meus cartões
        </CardTitle>
        <Button variant="ghost" size="sm" asChild>
          <Link to="/quadros/meus">
            Ver todos <ArrowRight className="h-3.5 w-3.5 ml-1" />
          </Link>
        </Button>
      </CardHeader>
      <CardContent className="pt-0">
        {visiveis.length === 0 ? (
          <EmptyState title="Nenhum cartão atribuído a você." />
        ) : (
          <ul className="divide-y divide-border">
            {visiveis.map((c) => {
              const concluido = cartaoConcluido(c.status);
              return (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => navigate(`/quadros/meus?card=${c.id}`)}
                    className="w-full flex items-center gap-3 py-2 px-1 text-left rounded-md hover:bg-muted/40 transition-colors"
                  >
                    <span className="text-xs text-muted-foreground tabular-nums shrink-0 w-12">
                      {c.numero != null ? `#${c.numero}` : "—"}
                    </span>
                    <span
                      className={`flex-1 truncate text-sm ${
                        concluido ? "text-muted-foreground line-through" : ""
                      }`}
                      title={c.titulo}
                    >
                      {c.titulo}
                    </span>
                    <span className="hidden sm:flex items-center gap-1 shrink-0">
                      {c.origem.map((o) => (
                        <Badge key={o} variant="secondary" className="text-[10px] font-normal">
                          {ORIGEM_LABEL[o]}
                        </Badge>
                      ))}
                    </span>
                    <span
                      className={`text-xs tabular-nums shrink-0 w-20 text-right ${
                        concluido ? "text-muted-foreground" : prazoClasses(c.prazo, hoje)
                      }`}
                    >
                      {c.prazo ? fmtDataLocal(c.prazo) : "sem prazo"}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

export default MeusCartoesSection;
