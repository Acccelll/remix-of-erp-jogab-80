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
import { StatusChips } from "@/components/financeiro/common/StatusChips";
import { brl } from "@/lib/billing";
import { EmptyMsg } from "./EmptyMsg";
import { PGTO_BUCKETS, PGTO_BUCKET_LABEL, PGTO_LABEL, type PgtoBucket } from "./types";

export function PgtoCard({
  stats,
  onSel,
  bucketsSel,
  setBucketsSel,
}: {
  stats: {
    avista: { titulos: number; valor: number };
    aprazo: { titulos: number; valor: number };
    indef: { titulos: number; valor: number };
    total: { titulos: number; valor: number };
  };
  onSel: (k: "avista" | "aprazo" | "indef") => void;
  bucketsSel: Set<PgtoBucket>;
  setBucketsSel: (next: Set<PgtoBucket>) => void;
}) {
  const rows: Array<{ key: "avista" | "aprazo" | "indef"; titulos: number; valor: number }> = [
    { key: "avista", ...stats.avista },
    { key: "aprazo", ...stats.aprazo },
    { key: "indef", ...stats.indef },
  ];
  const totalValor = stats.total.valor;
  const incluiPagos = bucketsSel.has("pago");
  const incluiAberto =
    bucketsSel.has("vencido") || bucketsSel.has("hoje") || bucketsSel.has("avencer");
  const labelValor =
    incluiPagos && incluiAberto ? "Valor" : incluiPagos ? "Valor pago" : "Valor em aberto";

  return (
    <Card>
      <CardHeader className="space-y-3">
        <div>
          <CardTitle className="text-base">À vista × A prazo</CardTitle>
          <p className="text-xs text-muted-foreground mt-1">
            Combine os status abaixo para variar a visualização. Arraste a faixa para ver todos.
          </p>
        </div>
        <StatusChips
          ariaLabel="Status dos títulos"
          options={PGTO_BUCKETS.map((b) => ({ value: b, label: PGTO_BUCKET_LABEL[b] }))}
          selected={bucketsSel}
          onChange={setBucketsSel}
        />
      </CardHeader>

      <CardContent className="space-y-3">
        {stats.total.titulos === 0 ? (
          <EmptyMsg>Nenhum título no escopo selecionado.</EmptyMsg>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Classificação</TableHead>
                  <TableHead className="text-right">Títulos</TableHead>
                  <TableHead className="text-right">{labelValor}</TableHead>
                  <TableHead className="text-right">%</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => {
                  const pct = totalValor > 0 ? (r.valor / totalValor) * 100 : 0;
                  const variant: "default" | "secondary" | "outline" =
                    r.key === "avista" ? "default" : r.key === "aprazo" ? "secondary" : "outline";
                  return (
                    <TableRow
                      key={r.key}
                      className={r.titulos > 0 ? "cursor-pointer hover:bg-muted/50" : "opacity-50"}
                      onClick={() => r.titulos > 0 && onSel(r.key)}
                    >
                      <TableCell>
                        <Badge variant={variant}>{PGTO_LABEL[r.key]}</Badge>
                      </TableCell>
                      <TableCell className="text-right">{r.titulos}</TableCell>
                      <TableCell className="text-right font-medium">{brl(r.valor)}</TableCell>
                      <TableCell className="text-right text-xs text-muted-foreground">
                        {pct.toFixed(1)}%
                      </TableCell>
                    </TableRow>
                  );
                })}
                <TableRow className="bg-muted/40 font-semibold">
                  <TableCell>Total</TableCell>
                  <TableCell className="text-right">{stats.total.titulos}</TableCell>
                  <TableCell className="text-right">{brl(stats.total.valor)}</TableCell>
                  <TableCell />
                </TableRow>
              </TableBody>
            </Table>
            <p className="text-[11px] text-muted-foreground leading-snug">
              Classificação por (data de vencimento − data de emissão): até 2 dias = à vista, acima
              = a prazo. Para títulos pagos, o valor exibido é o valor baixado.
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}
