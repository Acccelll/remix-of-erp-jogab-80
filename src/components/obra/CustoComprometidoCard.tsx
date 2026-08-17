/**
 * Card "Custo Comprometido" exibido na aba Financeiro da obra.
 *
 * Lê os card_recursos da obra (via join com cards) e usa a função pura
 * calcularCustoComprometido — não toca em billing.ts / recalculo.ts.
 */
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase as supabaseRaw } from "@/integrations/supabase/client";
const supabase = supabaseRaw as any;
import { brl } from "@/lib/billing";
import { calcularCustoComprometido, type RecursoCusto } from "@/lib/recursos/committed-cost";
import { Skeleton } from "@/components/ui/skeleton";
import { PackageIcon } from "lucide-react";

const TIPO_LABEL: Record<string, string> = {
  material_pronto: "Material pronto",
  manufaturado: "Manufaturado",
  equipamento: "Equipamento",
  servico: "Serviço",
};

export function CustoComprometidoCard({ obraId }: { obraId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["custo-comprometido", obraId],
    queryFn: async (): Promise<RecursoCusto[]> => {
      const { data: cards, error: e1 } = await supabase
        .from("cards")
        .select("id")
        .eq("obra_id", obraId)
        .eq("arquivado", false);
      if (e1) throw e1;
      const ids = (cards ?? []).map((c) => c.id);
      if (ids.length === 0) return [];
      const { data: recs, error: e2 } = await supabase
        .from("card_recursos")
        .select("tipo_recurso,valor_estimado,valor_oc")
        .in("card_id", ids);
      if (e2) throw e2;
      return (recs ?? []) as RecursoCusto[];
    },
  });

  if (isLoading) return <Skeleton className="h-32" />;

  const c = calcularCustoComprometido(data ?? []);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
          <PackageIcon className="h-4 w-4" />
          Custo comprometido (cards)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="flex items-baseline gap-2 flex-wrap">
          <div className="text-2xl font-semibold" title={brl(c.total)}>
            {brl(c.total)}
          </div>
          <Badge variant="outline" className="text-[10px]">
            {c.qtdCards} card(s)
          </Badge>
        </div>
        <div className="text-xs text-muted-foreground">
          OC emitida: <span className="font-medium text-foreground">{brl(c.totalComOc)}</span>
          {" · "}
          Estimado: <span className="font-medium text-foreground">{brl(c.totalEstimado)}</span>
        </div>
        {Object.keys(c.porTipo).length > 0 && (
          <div className="pt-1 space-y-0.5">
            {Object.entries(c.porTipo)
              .sort((a, b) => b[1] - a[1])
              .map(([tipo, v]) => (
                <div key={tipo} className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">{TIPO_LABEL[tipo] ?? tipo}</span>
                  <span>{brl(v)}</span>
                </div>
              ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
