// @ts-nocheck
import { Fragment, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, parseISO, differenceInCalendarDays } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { brl } from "@/lib/billing";
import { parseDescricao, wbsCompare } from "@/lib/cronograma/crono-tree";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export function RevisaoDetalhes({ revisaoId }: { revisaoId: string }) {
  const [filtro, setFiltro] = useState("");
  const [tipo, setTipo] = useState<string>("todos");

  const { data, isLoading } = useQuery({
    queryKey: ["revisao_detalhes", revisaoId],
    queryFn: async () =>
      (
        await supabase
          .from("cronograma_item_revisoes")
          .select(
            "id, descricao_item, tipo_mudanca, data_inicio_anterior, data_inicio_novo, data_fim_anterior, data_fim_novo, percentual_realizado_anterior, percentual_realizado_novo, custo_anterior, custo_novo",
          )
          .eq("revisao_id", revisaoId)
      ).data ?? [],
  });

  if (isLoading) {
    return <div className="px-4 py-3 text-xs text-muted-foreground">Carregando mudanças…</div>;
  }
  if (!data || data.length === 0) {
    return (
      <div className="px-4 py-3 text-xs text-muted-foreground">
        Nenhuma mudança registrada nesta revisão.
      </div>
    );
  }

  const tipos = Array.from(new Set(data.map((d) => d.tipo_mudanca))).sort();
  const filtradas = data
    .filter((d) => tipo === "todos" || d.tipo_mudanca === tipo)
    .filter(
      (d) => !filtro || (d.descricao_item ?? "").toLowerCase().includes(filtro.toLowerCase()),
    );

  function fmtDate(s?: string | null) {
    if (!s) return "—";
    try {
      return format(parseISO(s), "dd/MM/yy");
    } catch {
      return s;
    }
  }
  function deltaDias(antes?: string | null, depois?: string | null) {
    if (!antes || !depois) return null;
    try {
      return differenceInCalendarDays(parseISO(depois), parseISO(antes));
    } catch {
      return null;
    }
  }
  function antesDepois(d: NonNullable<typeof data>[number]) {
    switch (d.tipo_mudanca) {
      case "novo":
        return {
          antes: "—",
          depois: `${fmtDate(d.data_inicio_novo)} → ${fmtDate(d.data_fim_novo)}`,
        };
      case "removido":
        return { antes: "(ativo)", depois: "(inativo)" };
      case "restaurado":
        return { antes: "(inativo)", depois: "(ativo)" };
      case "data": {
        const d1 = deltaDias(d.data_fim_anterior, d.data_fim_novo);
        return {
          antes: `${fmtDate(d.data_inicio_anterior)} → ${fmtDate(d.data_fim_anterior)}`,
          depois: `${fmtDate(d.data_inicio_novo)} → ${fmtDate(d.data_fim_novo)}`,
          delta: d1,
        };
      }
      case "pct":
        return {
          antes: `${Number(d.percentual_realizado_anterior ?? 0).toFixed(1)}%`,
          depois: `${Number(d.percentual_realizado_novo ?? 0).toFixed(1)}%`,
        };
      case "custo":
        return {
          antes: brl(Number(d.custo_anterior ?? 0)),
          depois: brl(Number(d.custo_novo ?? 0)),
        };
      default:
        return { antes: "—", depois: "—" };
    }
  }
  const tipoCor: Record<string, string> = {
    novo: "bg-primary/15 text-primary",
    data: "bg-warning/15 text-warning",
    pct: "bg-success/15 text-success",
    custo: "bg-purple-500/15 text-purple-700",
    removido: "bg-destructive/15 text-destructive",
    restaurado: "bg-sky-500/15 text-sky-700",
  };

  type DiffNode = {
    wbs: string;
    name: string;
    children: Map<string, DiffNode>;
    diffs: NonNullable<typeof data>;
  };
  const root: DiffNode = { wbs: "", name: "", children: new Map(), diffs: [] };
  const ensureNode = (parent: DiffNode, wbs: string, name: string): DiffNode => {
    let n = parent.children.get(wbs);
    if (!n) {
      n = { wbs, name, children: new Map(), diffs: [] };
      parent.children.set(wbs, n);
    } else if (!n.name && name) {
      n.name = name;
    }
    return n;
  };
  for (const d of filtradas) {
    const { wbs, name, chain } = parseDescricao(String(d.descricao_item ?? ""));
    let cursor = root;
    for (const p of chain) cursor = ensureNode(cursor, p.wbs, p.name);
    const leaf = ensureNode(cursor, wbs || `__${d.id}`, name || "(sem nome)");
    leaf.diffs.push(d);
  }

  const flat: { node: DiffNode; depth: number; isLeaf: boolean }[] = [];
  const walkNode = (n: DiffNode, depth: number) => {
    const children = Array.from(n.children.values()).sort((a, b) => wbsCompare(a.wbs, b.wbs));
    for (const c of children) {
      const isLeaf = c.diffs.length > 0 && c.children.size === 0;
      flat.push({ node: c, depth, isLeaf });
      if (!isLeaf) walkNode(c, depth + 1);
    }
  };
  walkNode(root, 0);

  const countDiffs = (n: DiffNode): number => {
    let s = n.diffs.length;
    for (const c of n.children.values()) s += countDiffs(c);
    return s;
  };

  return (
    <div className="p-4 space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Input
          placeholder="Buscar tarefa…"
          value={filtro}
          onChange={(e) => setFiltro(e.target.value)}
          className="h-8 max-w-xs"
        />
        <Select value={tipo} onValueChange={setTipo}>
          <SelectTrigger className="h-8 w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os tipos</SelectItem>
            {tipos.map((t) => (
              <SelectItem key={t} value={t}>
                {t}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="text-xs text-muted-foreground ml-auto">
          {filtradas.length} de {data.length}
        </span>
      </div>
      <div className="rounded-md border bg-background overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-24">EDT</TableHead>
              <TableHead>Tarefa</TableHead>
              <TableHead className="w-[90px]">Tipo</TableHead>
              <TableHead>Antes</TableHead>
              <TableHead>Depois</TableHead>
              <TableHead className="text-right w-[80px]">Δ</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {flat.map(({ node, depth, isLeaf }) => {
              if (!isLeaf) {
                const totalDiffs = countDiffs(node);
                return (
                  <TableRow key={`g-${node.wbs}`} className="bg-muted/40">
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {node.wbs}
                    </TableCell>
                    <TableCell colSpan={4}>
                      <div
                        className="flex items-center font-semibold"
                        style={{ paddingLeft: `${depth * 18}px` }}
                      >
                        <span className="mr-1 inline-block w-4 text-center text-xs text-muted-foreground">
                          ▾
                        </span>
                        {node.name}
                      </div>
                    </TableCell>
                    <TableCell className="text-right text-xs text-muted-foreground">
                      {totalDiffs}
                    </TableCell>
                  </TableRow>
                );
              }
              return (
                <Fragment key={`leaf-${node.wbs}-${node.diffs[0]?.id}`}>
                  {node.diffs.map((d, i) => {
                    const ad = antesDepois(d);
                    return (
                      <TableRow key={d.id}>
                        <TableCell className="font-mono text-xs text-muted-foreground">
                          {i === 0 && !node.wbs.startsWith("__") ? node.wbs : ""}
                        </TableCell>
                        <TableCell className="max-w-[420px] truncate" title={node.name}>
                          <div
                            className="flex items-center"
                            style={{ paddingLeft: `${depth * 18}px` }}
                          >
                            <span className="mr-1 inline-block w-4 text-center text-xs text-muted-foreground">
                              ·
                            </span>
                            {i === 0 ? node.name : <span className="text-muted-foreground">↳</span>}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge
                            className={
                              (tipoCor[d.tipo_mudanca] ?? "bg-muted text-muted-foreground") +
                              " border-none"
                            }
                          >
                            {d.tipo_mudanca}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs whitespace-nowrap">{ad.antes}</TableCell>
                        <TableCell className="text-xs whitespace-nowrap">{ad.depois}</TableCell>
                        <TableCell className="text-right text-xs">
                          {"delta" in ad && ad.delta != null && ad.delta !== 0 ? (
                            <Badge variant={ad.delta > 0 ? "destructive" : "secondary"}>
                              {ad.delta > 0 ? `+${ad.delta}` : ad.delta}d
                            </Badge>
                          ) : null}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </Fragment>
              );
            })}
            {flat.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-6 text-xs">
                  Nenhuma mudança corresponde aos filtros.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
