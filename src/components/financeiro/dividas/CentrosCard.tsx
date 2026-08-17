import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { SortHeader } from "@/components/ui/sort-header";
import { Table, TableBody, TableCell, TableHeader, TableRow } from "@/components/ui/table";
import { useTableSort } from "@/hooks/useTableSort";
import { brl } from "@/lib/billing";
import { norm } from "@/lib/utils";
import { EmptyMsg } from "./EmptyMsg";
import type { CentroRow } from "./types";

type CentroSortKey = "nome" | "vencido" | "aVencer" | "valor" | "pct" | "titulos";

export function CentrosCard({
  rows,
  onSel,
  escopoUnico,
}: {
  rows: CentroRow[];
  onSel: (c: { codigo: string; nome: string }) => void;
  escopoUnico: boolean;
}) {
  const [q, setQ] = useState("");
  const [verTodos, setVerTodos] = useState(false);
  const filtrados = useMemo(() => {
    const needle = norm(q);
    if (!needle) return rows;
    return rows.filter((r) => norm(r.codigo).includes(needle) || norm(r.nome).includes(needle));
  }, [rows, q]);
  const { sorted, sortKey, sortDir, toggle } = useTableSort<CentroRow, CentroSortKey>(
    filtrados,
    (row, key) => (key === "nome" ? row.nome : (row as any)[key]),
    "valor",
    "desc",
  );
  const view = verTodos ? sorted : sorted.slice(0, 20);
  const totais = useMemo(
    () =>
      filtrados.reduce(
        (acc, r) => ({
          valor: acc.valor + r.valor,
          vencido: acc.vencido + r.vencido,
          aVencer: acc.aVencer + r.aVencer,
          titulos: acc.titulos + r.titulos,
        }),
        { valor: 0, vencido: 0, aVencer: 0, titulos: 0 },
      ),
    [filtrados],
  );
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Centros de custo com mais vencido / a vencer</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {escopoUnico && (
          <div className="text-xs text-warning">Escopo já limita aos centros desta obra.</div>
        )}
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[240px] max-w-md">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar por nome ou código..."
              className="pl-8"
            />
          </div>
          <div className="text-sm text-muted-foreground ml-auto">
            <strong className="text-foreground">{filtrados.length}</strong> centro(s) ·{" "}
            <strong className="text-foreground">{brl(totais.valor)}</strong>
          </div>
        </div>
        {rows.length === 0 ? (
          <EmptyMsg>Sem títulos vencidos ou a vencer no snapshot atual.</EmptyMsg>
        ) : (
          <>
            <div className="max-h-[420px] overflow-auto border rounded-md">
              <Table>
                <TableHeader>
                  <TableRow>
                    <SortHeader sortKey="nome" currentKey={sortKey} dir={sortDir} onToggle={toggle}>
                      Centro de custo
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
                    {!escopoUnico && (
                      <SortHeader
                        sortKey="pct"
                        currentKey={sortKey}
                        dir={sortDir}
                        onToggle={toggle}
                        align="right"
                      >
                        % do total
                      </SortHeader>
                    )}
                    <SortHeader
                      sortKey="titulos"
                      currentKey={sortKey}
                      dir={sortDir}
                      onToggle={toggle}
                      align="right"
                    >
                      Títulos
                    </SortHeader>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {view.map((c) => (
                    <TableRow
                      key={c.codigo}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => onSel({ codigo: c.codigo, nome: c.nome })}
                    >
                      <TableCell title={c.codigo}>
                        <div className="font-medium">{c.nome}</div>
                        <div className="text-xs text-muted-foreground font-mono">{c.codigo}</div>
                      </TableCell>
                      <TableCell className="text-right text-destructive">
                        {brl(c.vencido)}
                      </TableCell>
                      <TableCell className="text-right">{brl(c.aVencer)}</TableCell>
                      <TableCell className="text-right font-medium">{brl(c.valor)}</TableCell>
                      {!escopoUnico && (
                        <TableCell className="text-right text-xs text-muted-foreground">
                          {c.pct.toFixed(1).replace(".", ",")}%
                        </TableCell>
                      )}
                      <TableCell className="text-right">{c.titulos}</TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="bg-muted/40 font-semibold">
                    <TableCell>Total filtrado</TableCell>
                    <TableCell className="text-right">{brl(totais.vencido)}</TableCell>
                    <TableCell className="text-right">{brl(totais.aVencer)}</TableCell>
                    <TableCell className="text-right">{brl(totais.valor)}</TableCell>
                    {!escopoUnico && <TableCell />}
                    <TableCell className="text-right">{totais.titulos}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
            {sorted.length > 20 && (
              <div className="text-right">
                <button
                  type="button"
                  className="text-sm text-primary hover:underline"
                  onClick={() => setVerTodos((v) => !v)}
                >
                  {verTodos ? "Ver apenas top 20" : `Ver todos os ${sorted.length} centros`}
                </button>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
