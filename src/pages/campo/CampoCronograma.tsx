/**
 * Portal de Campo — cronograma, só leitura. `cronogramaRepo.listByObra` já
 * existe e a RLS de SELECT já é obra-scoped (`user_em_obra`); não precisou
 * de nada novo no backend, só esta tela.
 */
import { useSearchParams, useNavigate, Navigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cronogramaRepo } from "@/lib/repositories/cronograma";

function formatarData(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("pt-BR");
}

export default function CampoCronograma() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const obraId = params.get("obra");

  const itensQ = useQuery({
    queryKey: ["campo-cronograma", obraId],
    queryFn: () => cronogramaRepo.listByObra(obraId as string),
    enabled: !!obraId,
  });

  if (!obraId) return <Navigate to="/campo" replace />;

  const itens = (itensQ.data ?? []).filter((i: any) => i.ativo);

  return (
    <div className="space-y-3">
      <Button variant="ghost" size="sm" onClick={() => navigate("/campo")}>
        <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
      </Button>
      <h1 className="text-lg font-semibold">Cronograma</h1>

      {itensQ.isLoading && (
        <div className="space-y-2">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      )}

      {!itensQ.isLoading && itens.length === 0 && (
        <p className="text-sm text-muted-foreground">Nenhuma atividade cadastrada.</p>
      )}

      <div className="space-y-2">
        {itens.map((i: any) => (
          <Card key={i.id}>
            <CardContent className="p-3 space-y-1">
              <div className="flex items-start justify-between gap-2">
                <div className="text-sm font-medium">{i.descricao || "(sem descrição)"}</div>
                {i.critico && (
                  <Badge variant="destructive" className="shrink-0">
                    Crítico
                  </Badge>
                )}
              </div>
              <div className="text-xs text-muted-foreground">
                {formatarData(i.data_inicio)} → {formatarData(i.data_fim)}
              </div>
              <div className="text-xs text-muted-foreground">
                Realizado: {Math.round(Number(i.percentual_realizado ?? 0))}%
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
