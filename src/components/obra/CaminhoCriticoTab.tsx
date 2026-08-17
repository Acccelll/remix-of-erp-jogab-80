import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase as supabaseRaw } from "@/integrations/supabase/client";
const supabase = supabaseRaw as any;
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { recalcularCpmObra } from "@/lib/cronograma/recalcular-cpm";
import { RefreshCwIcon } from "lucide-react";
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
  tipo: string;
  lag_dias: number | null;
};

function classeColor(c: string | null) {
  switch (c) {
    case "Crítica":
      return "destructive";
    case "Alta":
      return "default";
    case "Média":
      return "secondary";
    default:
      return "outline";
  }
}

export function CaminhoCriticoTab({ obraId }: { obraId: string }) {
  const { setSelectedItemId } = useObraSelecao();
  const { data: itens, refetch: refItens } = useQuery({
    queryKey: ["crono-cpm", obraId],
    queryFn: async () => {
      const { data } = await supabase
        .from("cronograma_itens")
        .select(
          "id, ordem, descricao, data_inicio, data_fim, critico, folga_dias, folga_livre_dias, fanout_sucessoras, importancia_score, importancia_classe",
        )
        .eq("obra_id", obraId)
        .order("importancia_score", { ascending: false, nullsFirst: false });
      return (data ?? []) as Item[];
    },
  });

  const { data: deps, refetch: refDeps } = useQuery({
    queryKey: ["crono-deps", obraId],
    queryFn: async () => {
      const { data } = await supabase
        .from("cronograma_dependencias")
        .select("item_id, predecessor_item_id, predecessor_uid_mpp, tipo, lag_dias")
        .eq("obra_id", obraId);
      return (data ?? []) as Dep[];
    },
  });

  const nomePorId = useMemo(() => {
    const m = new Map<string, string>();
    for (const i of itens ?? []) m.set(i.id, i.descricao ?? `Item ${i.ordem ?? ""}`);
    return m;
  }, [itens]);

  const predsPorItem = useMemo(() => {
    const m = new Map<string, Dep[]>();
    for (const d of deps ?? []) {
      const arr = m.get(d.item_id) ?? [];
      arr.push(d);
      m.set(d.item_id, arr);
    }
    return m;
  }, [deps]);

  const sucsPorItem = useMemo(() => {
    const m = new Map<string, Dep[]>();
    for (const d of deps ?? []) {
      if (!d.predecessor_item_id) continue;
      const arr = m.get(d.predecessor_item_id) ?? [];
      arr.push(d);
      m.set(d.predecessor_item_id, arr);
    }
    return m;
  }, [deps]);

  const resumo = useMemo(() => {
    const por: Record<string, number> = { Crítica: 0, Alta: 0, Média: 0, Baixa: 0 };
    for (const i of itens ?? []) {
      const c = i.importancia_classe ?? "Baixa";
      por[c] = (por[c] ?? 0) + 1;
    }
    return por;
  }, [itens]);

  async function recalcular() {
    try {
      const r = await recalcularCpmObra(obraId);
      toast.success(`CPM recalculado: ${r.criticas}/${r.itens} críticas`);
      refItens();
      refDeps();
    } catch (e: any) {
      toast.error(e.message ?? "Erro ao recalcular CPM");
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <div>
          <CardTitle>Caminho crítico & importância</CardTitle>
          <div className="mt-2 flex flex-wrap gap-2 text-xs">
            {(["Crítica", "Alta", "Média", "Baixa"] as const).map((c) => (
              <Badge key={c} variant={classeColor(c) as any}>
                {c}: {resumo[c] ?? 0}
              </Badge>
            ))}
          </div>
        </div>
        <Button size="sm" variant="outline" onClick={recalcular}>
          <RefreshCwIcon className="h-4 w-4 mr-1" /> Recalcular
        </Button>
      </CardHeader>
      <CardContent>
        {(itens ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum item cadastrado.</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">#</TableHead>
                  <TableHead>Item</TableHead>
                  <TableHead className="w-24">Classe</TableHead>
                  <TableHead className="w-20 text-right">Score</TableHead>
                  <TableHead className="w-20 text-right">Folga</TableHead>
                  <TableHead className="w-20 text-right">F.Livre</TableHead>
                  <TableHead className="w-20 text-right">Fan-out</TableHead>
                  <TableHead>Predecessoras</TableHead>
                  <TableHead>Sucessoras</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(itens ?? []).map((i) => {
                  const ps = predsPorItem.get(i.id) ?? [];
                  const ss = sucsPorItem.get(i.id) ?? [];
                  return (
                    <TableRow
                      key={i.id}
                      className={`cursor-pointer hover:bg-muted/40 ${i.critico ? "bg-destructive/5" : ""}`}
                      onClick={() => setSelectedItemId(i.id)}
                    >
                      <TableCell className="text-xs tabular-nums text-muted-foreground">
                        {i.ordem}
                      </TableCell>
                      <TableCell
                        className="font-medium text-sm truncate max-w-[260px]"
                        title={i.descricao ?? ""}
                      >
                        {i.descricao}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={classeColor(i.importancia_classe) as any}
                          className="text-[10px]"
                        >
                          {i.importancia_classe ?? "—"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-sm">
                        {i.importancia_score ?? "—"}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-sm">
                        {i.folga_dias ?? "—"}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-sm">
                        {i.folga_livre_dias ?? "—"}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-sm">
                        {i.fanout_sucessoras ?? 0}
                      </TableCell>
                      <TableCell className="text-xs">
                        {ps.length === 0 ? (
                          <span className="text-muted-foreground">—</span>
                        ) : (
                          <div className="flex flex-wrap gap-1">
                            {ps.map((p, idx) => {
                              const nome = p.predecessor_item_id
                                ? nomePorId.get(p.predecessor_item_id)
                                : `UID ${p.predecessor_uid_mpp}`;
                              return (
                                <Badge
                                  key={idx}
                                  variant="outline"
                                  className="text-[10px]"
                                  title={`${p.tipo}${p.lag_dias ? ` +${p.lag_dias}d` : ""}`}
                                >
                                  {nome ?? "?"} <span className="ml-1 opacity-70">{p.tipo}</span>
                                </Badge>
                              );
                            })}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-xs">
                        {ss.length === 0 ? (
                          <span className="text-muted-foreground">—</span>
                        ) : (
                          <div className="flex flex-wrap gap-1">
                            {ss.map((s, idx) => (
                              <Badge
                                key={idx}
                                variant="outline"
                                className="text-[10px]"
                                title={`${s.tipo}${s.lag_dias ? ` +${s.lag_dias}d` : ""}`}
                              >
                                {nomePorId.get(s.item_id) ?? "?"}{" "}
                                <span className="ml-1 opacity-70">{s.tipo}</span>
                              </Badge>
                            ))}
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
