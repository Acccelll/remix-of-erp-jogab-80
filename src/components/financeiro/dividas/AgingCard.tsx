import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { brl } from "@/lib/billing";
import { EmptyMsg } from "./EmptyMsg";

export function AgingCard({
  titulo,
  aging,
  total,
  empty,
  onSel,
  alerta,
  legenda,
  variantDestaque,
}: {
  titulo: string;
  aging: { faixa: string; ordem: number; titulos: number; valor: number }[];
  total: { titulos: number; valor: number };
  empty: string;
  onSel: (faixa: string) => void;
  alerta?: string | null;
  legenda?: string;
  variantDestaque?: (ordem: number) => boolean;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{titulo}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {aging.every((a) => a.titulos === 0) ? (
          <EmptyMsg>{empty}</EmptyMsg>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Faixa</TableHead>
                  <TableHead className="text-right">Títulos</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {aging.map((a) => {
                  const destaque = variantDestaque?.(a.ordem) ?? false;
                  const variantBadge: "destructive" | "secondary" | "default" = destaque
                    ? "default"
                    : a.ordem >= 4
                      ? "destructive"
                      : "secondary";
                  return (
                    <TableRow
                      key={a.faixa}
                      className={a.titulos > 0 ? "cursor-pointer hover:bg-muted/50" : "opacity-50"}
                      onClick={() => a.titulos > 0 && onSel(a.faixa)}
                    >
                      <TableCell>
                        <Badge variant={variantBadge}>{a.faixa}</Badge>
                      </TableCell>
                      <TableCell className="text-right">{a.titulos}</TableCell>
                      <TableCell className="text-right font-medium">{brl(a.valor)}</TableCell>
                    </TableRow>
                  );
                })}
                <TableRow className="bg-muted/40 font-semibold">
                  <TableCell>Total</TableCell>
                  <TableCell className="text-right">{total.titulos}</TableCell>
                  <TableCell className="text-right">{brl(total.valor)}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
            {(legenda || alerta) && (
              <div className="text-[11px] text-muted-foreground leading-snug space-y-1">
                {legenda && <p>{legenda}</p>}
                {alerta && <p className="text-warning">{alerta}</p>}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
