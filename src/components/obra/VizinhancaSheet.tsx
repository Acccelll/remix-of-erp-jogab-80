import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, ArrowUp, ArrowDown, Focus, Inbox } from "lucide-react";
import { supabase as supabaseRaw } from "@/integrations/supabase/client";
const supabase = supabaseRaw as any;
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useObraSelecao } from "@/components/obra/ObraSelecaoContext";

type Item = {
  id: string;
  ordem: number | null;
  descricao: string | null;
  data_inicio: string | null;
  data_fim: string | null;
  critico: boolean | null;
  folga_dias: number | null;
  folga_livre_dias: number | null;
  fanout_sucessoras: number | null;
  importancia_score: number | null;
  importancia_classe: string | null;
};

type Dep = {
  item_id: string;
  predecessor_item_id: string | null;
  predecessor_uid_mpp: string | null;
  tipo: string | null;
  lag_dias: number | null;
};

function classeVariant(c: string | null | undefined) {
  switch (c) {
    case "Crítica":
      return "destructive" as const;
    case "Alta":
      return "default" as const;
    case "Média":
      return "secondary" as const;
    default:
      return "outline" as const;
  }
}

function tipoLegivel(t: string | null | undefined): string {
  switch ((t ?? "FS").toUpperCase()) {
    case "FS":
      return "Término → Início";
    case "SS":
      return "Início → Início";
    case "FF":
      return "Término → Término";
    case "SF":
      return "Início → Término";
    default:
      return t ?? "FS";
  }
}

function fmtData(d: string | null): string {
  if (!d) return "—";
  // YYYY-MM-DD → DD/MM/YYYY
  const [y, m, day] = d.slice(0, 10).split("-");
  if (!y || !m || !day) return d;
  return `${day}/${m}/${y}`;
}

export function VizinhancaSheet({ obraId }: { obraId: string }) {
  const { selectedItemId, setSelectedItemId } = useObraSelecao();
  const open = !!selectedItemId;

  const { data: itens } = useQuery({
    queryKey: ["viz-itens", obraId],
    enabled: open,
    queryFn: async () => {
      const { data } = await supabase
        .from("cronograma_itens")
        .select(
          "id, ordem, descricao, data_inicio, data_fim, critico, folga_dias, folga_livre_dias, fanout_sucessoras, importancia_score, importancia_classe",
        )
        .eq("obra_id", obraId);
      return (data ?? []) as Item[];
    },
  });

  const { data: deps } = useQuery({
    queryKey: ["viz-deps", obraId],
    enabled: open,
    queryFn: async () => {
      const { data } = await supabase
        .from("cronograma_dependencias")
        .select("item_id, predecessor_item_id, predecessor_uid_mpp, tipo, lag_dias")
        .eq("obra_id", obraId);
      return (data ?? []) as Dep[];
    },
  });

  const byId = useMemo(() => {
    const m = new Map<string, Item>();
    for (const i of itens ?? []) m.set(i.id, i);
    return m;
  }, [itens]);

  const atual = selectedItemId ? (byId.get(selectedItemId) ?? null) : null;

  const preds = useMemo(
    () => (deps ?? []).filter((d) => d.item_id === selectedItemId),
    [deps, selectedItemId],
  );
  const sucs = useMemo(
    () => (deps ?? []).filter((d) => d.predecessor_item_id === selectedItemId),
    [deps, selectedItemId],
  );

  return (
    <Sheet
      open={open}
      onOpenChange={(o) => {
        if (!o) setSelectedItemId(null);
      }}
    >
      <SheetContent side="right" className="w-full sm:max-w-[520px] p-0 flex flex-col">
        <SheetHeader className="px-5 pt-5 pb-3 border-b">
          <SheetTitle className="text-base flex items-start gap-2">
            <span className="text-muted-foreground text-xs tabular-nums shrink-0 mt-0.5">
              #{atual?.ordem ?? "—"}
            </span>
            <span className="flex-1">{atual?.descricao ?? "Item do cronograma"}</span>
          </SheetTitle>
          <SheetDescription asChild>
            <div className="flex flex-wrap gap-2 items-center text-xs mt-1">
              {atual?.critico && (
                <Badge variant="destructive" className="text-[10px]">
                  Crítico
                </Badge>
              )}
              <Badge variant={classeVariant(atual?.importancia_classe)} className="text-[10px]">
                {atual?.importancia_classe ?? "—"}
              </Badge>
              {atual?.importancia_score != null && (
                <span className="text-muted-foreground">Score {atual.importancia_score}</span>
              )}
              <span className="text-muted-foreground">·</span>
              <span className="text-muted-foreground">
                {fmtData(atual?.data_inicio ?? null)} → {fmtData(atual?.data_fim ?? null)}
              </span>
            </div>
          </SheetDescription>
        </SheetHeader>

        <div className="px-5 py-3 grid grid-cols-3 gap-2 text-xs border-b bg-muted/20">
          <div>
            <div className="text-muted-foreground">Folga total</div>
            <div className="tabular-nums font-medium">{atual?.folga_dias ?? "—"} d</div>
          </div>
          <div>
            <div className="text-muted-foreground">Folga livre</div>
            <div className="tabular-nums font-medium">{atual?.folga_livre_dias ?? "—"} d</div>
          </div>
          <div>
            <div className="text-muted-foreground">Fan-out</div>
            <div className="tabular-nums font-medium">{atual?.fanout_sucessoras ?? 0}</div>
          </div>
        </div>

        <ScrollArea className="flex-1">
          <div className="px-5 py-4 space-y-5">
            <Section
              titulo="Predecessoras"
              icone={<ArrowUp className="h-3.5 w-3.5" />}
              ajuda="Itens que precisam ocorrer antes deste."
              vazio="Sem predecessoras — este item pode iniciar livremente."
              deps={preds}
              lookupId={(d) => d.predecessor_item_id}
              fallbackUid={(d) => d.predecessor_uid_mpp}
              byId={byId}
              onSelect={setSelectedItemId}
            />
            <Separator />
            <Section
              titulo="Sucessoras"
              icone={<ArrowDown className="h-3.5 w-3.5" />}
              ajuda="Itens que dependem deste para iniciar ou terminar."
              vazio="Sem sucessoras — nada depende deste item."
              deps={sucs}
              lookupId={(d) => d.item_id}
              fallbackUid={() => null}
              byId={byId}
              onSelect={setSelectedItemId}
            />
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}

function Section({
  titulo,
  icone,
  ajuda,
  vazio,
  deps,
  lookupId,
  fallbackUid,
  byId,
  onSelect,
}: {
  titulo: string;
  icone: React.ReactNode;
  ajuda: string;
  vazio: string;
  deps: Dep[];
  lookupId: (d: Dep) => string | null;
  fallbackUid: (d: Dep) => string | null;
  byId: Map<string, Item>;
  onSelect: (id: string | null) => void;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2 text-sm font-medium">
          {icone} {titulo}
          <span className="text-muted-foreground text-xs">· {deps.length}</span>
        </div>
      </div>
      <p className="text-[11px] text-muted-foreground mb-2">{ajuda}</p>
      {deps.length === 0 ? (
        <div className="flex items-center gap-2 text-xs text-muted-foreground border rounded p-3 bg-muted/20">
          <Inbox className="h-3.5 w-3.5" /> {vazio}
        </div>
      ) : (
        <ul className="space-y-2">
          {deps.map((d, idx) => {
            const id = lookupId(d);
            const it = id ? (byId.get(id) ?? null) : null;
            const lag = d.lag_dias ?? 0;
            return (
              <li key={idx} className="border rounded p-2.5 hover:bg-muted/30 transition-colors">
                <div className="flex items-start gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[10px] tabular-nums text-muted-foreground shrink-0">
                        #{it?.ordem ?? "?"}
                      </span>
                      <span
                        className="text-sm font-medium truncate"
                        title={it?.descricao ?? undefined}
                      >
                        {it?.descricao ??
                          (fallbackUid(d) ? `UID ${fallbackUid(d)}` : "Item desconhecido")}
                      </span>
                      {it?.critico && (
                        <Badge variant="destructive" className="text-[9px] px-1 py-0">
                          crit
                        </Badge>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
                      <Badge variant="outline" className="text-[10px] font-normal">
                        {(d.tipo ?? "FS").toUpperCase()} · {tipoLegivel(d.tipo)}
                      </Badge>
                      {lag !== 0 && (
                        <Badge variant="secondary" className="text-[10px] font-normal">
                          lag {lag > 0 ? `+${lag}` : lag}d
                        </Badge>
                      )}
                      {it?.importancia_classe && (
                        <Badge
                          variant={classeVariant(it.importancia_classe)}
                          className="text-[10px] font-normal"
                        >
                          {it.importancia_classe}
                        </Badge>
                      )}
                      <span className="inline-flex items-center gap-1">
                        {fmtData(it?.data_inicio ?? null)}
                        <ArrowRight className="h-3 w-3" />
                        {fmtData(it?.data_fim ?? null)}
                      </span>
                    </div>
                  </div>
                  {id && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 px-2 shrink-0"
                      onClick={() => onSelect(id)}
                      title="Focar este item"
                    >
                      <Focus className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
