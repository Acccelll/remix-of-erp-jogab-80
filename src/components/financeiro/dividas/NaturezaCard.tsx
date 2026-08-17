import { useMemo } from "react";
import { Search } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SortHeader } from "@/components/ui/sort-header";
import { Table, TableBody, TableCell, TableHeader, TableRow } from "@/components/ui/table";
import { useTableSort } from "@/hooks/useTableSort";
import { brl } from "@/lib/billing";
import { norm } from "@/lib/utils";
import { EmptyMsg } from "./EmptyMsg";
import type { NatRow } from "./types";

type NatSortKey = "cod" | "desc" | "vencido" | "aVencer" | "valor" | "pct";

export function NaturezaCard({
  rows,
  totalGeral,
  q,
  setQ,
  filtro,
  setFiltro,
  onSel,
}: {
  rows: NatRow[];
  totalGeral: { valor: number; vencido: number; aVencer: number };
  q: string;
  setQ: (v: string) => void;
  filtro: "todos" | "vencido" | "avencer";
  setFiltro: (v: "todos" | "vencido" | "avencer") => void;
  onSel: (n: NatRow) => void;
}) {
  const filtrados = useMemo(() => {
    const needle = norm(q);
    return rows.filter((r) => {
      if (filtro === "vencido" && r.vencido <= 0) return false;
      if (filtro === "avencer" && r.aVencer <= 0) return false;
      if (!needle) return true;
      return norm(r.cod).includes(needle) || norm(r.desc).includes(needle);
    });
  }, [rows, q, filtro]);
  const { sorted, sortKey, sortDir, toggle } = useTableSort<NatRow, NatSortKey>(
    filtrados,
    (row, key) => {
      switch (key) {
        case "cod":
          return row.cod;
        case "desc":
          return row.desc;
        case "vencido":
          return row.vencido;
        case "aVencer":
          return row.aVencer;
        case "valor":
          return row.valor;
        case "pct":
          return row.pct;
        default:
          return "";
      }
    },
    "valor",
    "desc",
  );
  const totais = useMemo(
    () =>
      filtrados.reduce(
        (acc, r) => ({
          valor: acc.valor + r.valor,
          vencido: acc.vencido + r.vencido,
          aVencer: acc.aVencer + r.aVencer,
          pct: acc.pct + r.pct,
        }),
        { valor: 0, vencido: 0, aVencer: 0, pct: 0 },
      ),
    [filtrados],
  );
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Acumulado por natureza orçamentária</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[240px] max-w-md">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar por código ou descrição..."
              className="pl-8"
            />
          </div>
          <Select value={filtro} onValueChange={(v) => setFiltro(v as any)}>
            <SelectTrigger className="w-[200px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              <SelectItem value="vencido">Apenas com vencido</SelectItem>
              <SelectItem value="avencer">Apenas a vencer</SelectItem>
            </SelectContent>
          </Select>
          <div className="text-sm text-muted-foreground ml-auto">
            <strong className="text-foreground">{filtrados.length}</strong> natureza(s) ·{" "}
            <strong className="text-foreground">{brl(totais.valor)}</strong>
            {filtrados.length !== rows.length && (
              <span className="ml-2 text-xs">
                (de {rows.length} · {brl(totalGeral.valor)})
              </span>
            )}
          </div>
        </div>
        {rows.length === 0 ? (
          <EmptyMsg>Sem dados no snapshot atual.</EmptyMsg>
        ) : (
          <div className="max-h-[420px] overflow-auto border rounded-md">
            <Table>
              <TableHeader>
                <TableRow>
                  <SortHeader sortKey="cod" currentKey={sortKey} dir={sortDir} onToggle={toggle}>
                    Código
                  </SortHeader>
                  <SortHeader sortKey="desc" currentKey={sortKey} dir={sortDir} onToggle={toggle}>
                    Descrição
                  </SortHeader>
                  <SortHeader
                    sortKey="vencido"
                    currentKey={sortKey}
                    dir={sortDir}
                    onToggle={toggle}
                    align="right"
                  >
                    Vencido
                  </SortHeader>
                  <SortHeader
                    sortKey="aVencer"
                    currentKey={sortKey}
                    dir={sortDir}
                    onToggle={toggle}
                    align="right"
                  >
                    A vencer
                  </SortHeader>
                  <SortHeader
                    sortKey="valor"
                    currentKey={sortKey}
                    dir={sortDir}
                    onToggle={toggle}
                    align="right"
                  >
                    Total
                  </SortHeader>
                  <SortHeader
                    sortKey="pct"
                    currentKey={sortKey}
                    dir={sortDir}
                    onToggle={toggle}
                    align="right"
                  >
                    % do total
                  </SortHeader>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sorted.map((n) => (
                  <TableRow
                    key={n.cod}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => onSel(n)}
                  >
                    <TableCell className="font-mono text-xs">{n.cod}</TableCell>
                    <TableCell className="max-w-[36ch] truncate" title={n.desc}>
                      {n.desc || "—"}
                    </TableCell>
                    <TableCell className="text-right text-destructive">{brl(n.vencido)}</TableCell>
                    <TableCell className="text-right">{brl(n.aVencer)}</TableCell>
                    <TableCell className="text-right font-medium">{brl(n.valor)}</TableCell>
                    <TableCell className="text-right text-xs text-muted-foreground">
                      {n.pct.toFixed(1).replace(".", ",")}%
                    </TableCell>
                  </TableRow>
                ))}
                {sorted.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className="text-center text-sm text-muted-foreground py-6"
                    >
                      Nenhuma natureza encontrada.
                    </TableCell>
                  </TableRow>
                )}
                <TableRow className="bg-muted/40 font-semibold">
                  <TableCell colSpan={2}>Total filtrado</TableCell>
                  <TableCell className="text-right">{brl(totais.vencido)}</TableCell>
                  <TableCell className="text-right">{brl(totais.aVencer)}</TableCell>
                  <TableCell className="text-right">{brl(totais.valor)}</TableCell>
                  <TableCell className="text-right">
                    {totais.pct.toFixed(1).replace(".", ",")}%
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
