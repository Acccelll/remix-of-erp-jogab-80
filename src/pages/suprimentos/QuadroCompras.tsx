import { useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { QuadroKanban } from "@/components/cards/QuadroKanban";
import { TabelaConsolidadaCompras } from "@/components/cards/TabelaConsolidadaCompras";
import { useCatalogos } from "@/contexts/catalogos/useCatalogos";

type View = "obra" | "consolidado";

export default function SuprimentosCompras() {
  const { obras } = useCatalogos();
  const [sp, setSp] = useSearchParams();
  const view: View = sp.get("view") === "consolidado" ? "consolidado" : "obra";
  const obraId = sp.get("obra") ?? "";

  const obrasOrdenadas = useMemo(
    () => [...obras].sort((a, b) => a.nome.localeCompare(b.nome)),
    [obras],
  );

  function setView(v: View) {
    const next = new URLSearchParams(sp);
    next.set("view", v);
    setSp(next, { replace: true });
  }
  function setObra(id: string) {
    const next = new URLSearchParams(sp);
    if (id) next.set("obra", id);
    else next.delete("obra");
    setSp(next, { replace: true });
  }

  return (
    <div className="p-6 space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Quadro de Compras</h1>
        <p className="text-sm text-muted-foreground">
          Cards de recurso pendentes para Compras — kanban por obra ou visão consolidada por prazo.
        </p>
      </div>

      <Tabs value={view} onValueChange={(v) => setView(v as View)}>
        <div className="flex flex-wrap items-center gap-3">
          <TabsList>
            <TabsTrigger value="obra">Por obra</TabsTrigger>
            <TabsTrigger value="consolidado">Consolidado</TabsTrigger>
          </TabsList>
          {view === "obra" && (
            <div className="min-w-[260px]">
              <Select
                value={obraId || "_all"}
                onValueChange={(v) => setObra(v === "_all" ? "" : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Todas as obras" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_all">Todas as obras</SelectItem>
                  {obrasOrdenadas.map((o) => (
                    <SelectItem key={o.id} value={o.id}>
                      {o.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        <TabsContent value="obra" className="mt-4">
          <QuadroKanban setor="Compras" obraId={obraId || undefined} />
        </TabsContent>
        <TabsContent value="consolidado" className="mt-4">
          <TabelaConsolidadaCompras />
        </TabsContent>
      </Tabs>
    </div>
  );
}
