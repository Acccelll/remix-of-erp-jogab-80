import { Link } from "react-router-dom";
import { AlertTriangle } from "lucide-react";
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
import { fmtData } from "@/lib/utils";

interface Props {
  pendentes: any[];
  pendentesView: any[];
  pendenteOnly: boolean;
  onSeeAll: () => void;
}

export function PendentesCard({ pendentes, pendentesView, pendenteOnly, onSeeAll }: Props) {
  return (
    <Card
      className={
        pendentes.length > 0 ? "border-warning/50 bg-warning/40 dark:bg-warning/20" : ""
      }
    >
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-warning" />
          Títulos sem natureza orçamentária ({pendentes.length})
        </CardTitle>
      </CardHeader>
      <CardContent>
        {pendentes.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Todos os títulos do snapshot atual têm correspondência na matriz.
          </p>
        ) : (
          <>
            <p className="text-xs text-muted-foreground mb-3">
              Estes títulos apareceram no relatório mas não estão na matriz orçamentária carregada.
              Atualize a matriz em{" "}
              <Link to="/financeiro/importar" className="text-primary hover:underline">
                Importar TOTVS
              </Link>
              .
            </p>
            <div className="max-h-[420px] overflow-auto border rounded-md">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Ref.</TableHead>
                    <TableHead>Nome</TableHead>
                    <TableHead>Centro</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Vencimento</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pendentesView.map((l: any) => (
                    <TableRow key={l.id}>
                      <TableCell className="font-mono text-xs">{l.ref_lancamento}</TableCell>
                      <TableCell className="max-w-[24ch] truncate">{l.nome ?? "—"}</TableCell>
                      <TableCell title={l.centro_custo ?? ""}>{l.centro_nome}</TableCell>
                      <TableCell>{l.status_label ?? "—"}</TableCell>
                      <TableCell>{fmtData(l.data_vencimento)}</TableCell>
                      <TableCell className="text-right">
                        {brl(Number(l.valor_liquido ?? 0))}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            {!pendenteOnly && pendentes.length > 10 && (
              <div className="mt-3 text-right">
                <button onClick={onSeeAll} className="text-sm text-primary hover:underline">
                  Ver todos os {pendentes.length} pendentes →
                </button>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
