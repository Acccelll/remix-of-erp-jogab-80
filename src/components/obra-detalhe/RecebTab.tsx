import { toast } from "sonner";
import { format, parseISO } from "date-fns";
import { Banknote } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { brl } from "@/lib/billing";
import { StatusBadge as SharedStatusBadge } from "@/components/obra/StatusBadge";
import { useObraPermissions } from "@/components/obra/ObraPermissionsContext";
import { recebimentosRepo } from "@/lib/repositories/medicoes";

export function RecebTab({ receb, onChange }: { receb: any[]; onChange: () => void }) {
  const { canEdit } = useObraPermissions();
  async function marcarPago(r: any) {
    const hoje = new Date().toISOString().slice(0, 10);
    try {
      await recebimentosRepo.marcarPago(r.id, hoje, r.valor_previsto);
    } catch (error) {
      return toast.error(error instanceof Error ? error.message : "Falha ao confirmar recebimento");
    }
    toast.success("Recebimento confirmado");
    onChange();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recebimentos</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Previsto</TableHead>
                <TableHead className="text-right">Valor previsto</TableHead>
                <TableHead>Recebido</TableHead>
                <TableHead>Status</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {receb.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>{format(parseISO(r.data_prevista), "dd/MM/yy")}</TableCell>
                  <TableCell className="num">{brl(r.valor_previsto)}</TableCell>
                  <TableCell>
                    {r.data_recebimento
                      ? `${format(parseISO(r.data_recebimento), "dd/MM/yy")} · ${brl(r.valor_recebido)}`
                      : "—"}
                  </TableCell>
                  <TableCell>
                    <SharedStatusBadge tipo="receb" status={r.status} />
                  </TableCell>
                  <TableCell className="text-right">
                    {!r.data_recebimento && canEdit && (
                      <Button size="sm" variant="outline" onClick={() => marcarPago(r)}>
                        <Banknote className="h-3 w-3 mr-1" />
                        Pago
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {receb.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                    Sem recebimentos lançados
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
