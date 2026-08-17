import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, ChevronUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { GanttTab } from "@/components/obra/GanttTab";
import { MarcosTab, useMarcos } from "@/components/obra/MarcosTab";
import { useObraSelecao } from "@/components/obra/ObraSelecaoContext";

export function GanttTabWithMarcos({ obraId, crono }: { obraId: string; crono: any[] }) {
  const { setSelectedItemId } = useObraSelecao();
  const { data: marcos } = useMarcos(obraId);
  const { data: deps } = useQuery({
    queryKey: ["crono-deps", obraId],
    queryFn: async () => {
      const { data } = await supabase
        .from("cronograma_dependencias")
        .select("item_id, predecessor_item_id, tipo, lag_dias")
        .eq("obra_id", obraId);
      return data ?? [];
    },
  });
  const [openMarcos, setOpenMarcos] = useState(false);
  return (
    <div className="space-y-4">
      <GanttTab
        itens={crono}
        marcos={(marcos ?? []).map((m) => ({
          id: m.id,
          nome: m.nome,
          data_prevista: m.data_prevista,
          data_realizado: m.data_realizado,
          critico: m.critico,
        }))}
        deps={(deps ?? []) as any}
        onItemSelect={(id) => setSelectedItemId(id)}
      />
      <Card>
        <Collapsible open={openMarcos} onOpenChange={setOpenMarcos}>
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer hover:bg-muted/30 transition-colors py-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">
                  Marcos do cronograma{" "}
                  {marcos?.length ? (
                    <span className="text-muted-foreground font-normal">· {marcos.length}</span>
                  ) : null}
                </CardTitle>
                {openMarcos ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </div>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent>
              <MarcosTab obraId={obraId} />
            </CardContent>
          </CollapsibleContent>
        </Collapsible>
      </Card>
    </div>
  );
}
