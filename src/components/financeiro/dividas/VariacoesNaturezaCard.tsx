import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { brl } from "@/lib/billing";
import { EmptyMsg } from "@/components/financeiro/dividas/EmptyMsg";

interface Variacao {
  grupo: string | null;
  cod_natureza: string | null;
  desc_natureza: string | null;
  anterior: number;
  atual: number;
  delta: number;
  pct: number | null;
}

export function VariacoesNaturezaCard({ varNat }: { varNat: Variacao[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Naturezas que mais variaram</CardTitle>
      </CardHeader>
      <CardContent>
        {varNat.length === 0 ? (
          <EmptyMsg>
            Precisa de pelo menos dois snapshots para calcular variação por natureza.
          </EmptyMsg>
        ) : (
          <div className="max-h-[360px] overflow-auto border rounded-md">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Natureza</TableHead>
                  <TableHead className="text-right">Anterior</TableHead>
                  <TableHead className="text-right">Atual</TableHead>
                  <TableHead className="text-right">Δ</TableHead>
                  <TableHead className="text-right">%</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {varNat.slice(0, 20).map((v) => (
                  <TableRow key={`${v.grupo}|${v.cod_natureza}`}>
                    <TableCell>
                      <div className="font-mono text-xs">{v.cod_natureza}</div>
                      <div className="text-xs text-muted-foreground truncate max-w-[36ch]">
                        {v.desc_natureza ?? "—"}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">{brl(v.anterior)}</TableCell>
                    <TableCell className="text-right">{brl(v.atual)}</TableCell>
                    <TableCell
                      className={`text-right font-medium ${
                        v.delta > 0 ? "text-destructive" : v.delta < 0 ? "text-success" : ""
                      }`}
                    >
                      {v.delta > 0 ? "+" : ""}
                      {brl(v.delta)}
                    </TableCell>
                    <TableCell className="text-right text-xs text-muted-foreground">
                      {v.pct == null ? "—" : `${v.pct > 0 ? "+" : ""}${v.pct}%`}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
