import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { financeiroRepo } from "@/lib/repositories/financeiro";
import { brl } from "@/lib/billing";
import { fmtData } from "@/lib/utils";

export function HistoricoTituloDialog({
  open,
  onClose,
  refLancamento,
}: {
  open: boolean;
  onClose: () => void;
  refLancamento: number | string | null;
}) {
  const { data, isLoading } = useQuery({
    queryKey: ["fin_titulo_historico", refLancamento],
    queryFn: () =>
      refLancamento != null
        ? financeiroRepo.getHistoricoLancamento(refLancamento)
        : Promise.resolve([]),
    enabled: open && refLancamento != null,
  });

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Histórico de importações · título {refLancamento ?? "—"}</DialogTitle>
        </DialogHeader>
        <div className="max-h-[60vh] overflow-auto rounded border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Importado em</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Baixado</TableHead>
                <TableHead>Data baixa</TableHead>
                <TableHead>Data pagamento</TableHead>
                <TableHead>Arquivo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-6">
                    Carregando…
                  </TableCell>
                </TableRow>
              )}
              {!isLoading && (data ?? []).length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-6">
                    Sem histórico registrado para este título.
                  </TableCell>
                </TableRow>
              )}
              {(data ?? []).map((h) => (
                <TableRow key={h.id}>
                  <TableCell className="text-xs">
                    {new Date(h.importado_em).toLocaleString("pt-BR")}
                  </TableCell>
                  <TableCell className="text-xs">
                    <div className="font-mono">{h.status_cod ?? "—"}</div>
                    <div className="text-muted-foreground">{h.status_label ?? ""}</div>
                  </TableCell>
                  <TableCell className="text-right text-xs">
                    {h.valor_baixado != null ? brl(Number(h.valor_baixado)) : "—"}
                  </TableCell>
                  <TableCell className="text-xs">{fmtData(h.data_baixa)}</TableCell>
                  <TableCell className="text-xs">{fmtData(h.data_pagamento)}</TableCell>
                  <TableCell
                    className="text-xs max-w-[24ch] truncate"
                    title={h.nome_arquivo ?? ""}
                  >
                    {h.nome_arquivo ?? "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </DialogContent>
    </Dialog>
  );
}
