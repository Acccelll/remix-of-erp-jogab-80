import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { RotateCcw, WalletCards } from "lucide-react";

import { EstornarBaixaDialog } from "@/components/financeiro/EstornarBaixaDialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { brl } from "@/lib/billing";
import {
  idsBaixasEstornadas,
  listarMovimentosTitulo,
  type MovimentoTituloRow,
} from "@/lib/repositories/financeiro-titulos-operacoes";
import {
  financeiroTitulosKeys,
  type TituloCanonicoResumo,
} from "@/lib/repositories/financeiro-titulos";

interface MovimentosTituloTabProps {
  titulo: TituloCanonicoResumo;
  podeOperar: boolean;
  onSuccess: () => void | Promise<void>;
}

function formatarData(value: string): string {
  const [ano, mes, dia] = value.slice(0, 10).split("-");
  return ano && mes && dia ? `${dia}/${mes}/${ano}` : value;
}

function valorComSinal(valor: number, movimento: MovimentoTituloRow): number {
  return movimento.tipo_movimento === "estorno" ? -valor : valor;
}

export function MovimentosTituloTab({ titulo, podeOperar, onSuccess }: MovimentosTituloTabProps) {
  const [estornoSelecionado, setEstornoSelecionado] = useState<MovimentoTituloRow | null>(null);

  const query = useQuery({
    queryKey: financeiroTitulosKeys.baixas(titulo.id),
    queryFn: () => listarMovimentosTitulo(titulo.id),
  });

  const estornadas = useMemo(() => idsBaixasEstornadas(query.data ?? []), [query.data]);
  const cancelado = titulo.status_calculado === "cancelado" || titulo.status === "cancelado";

  if (query.isLoading) {
    return <div className="space-y-2"><Skeleton className="h-10 w-full" /><Skeleton className="h-20 w-full" /></div>;
  }

  if (query.isError) {
    return (
      <div className="rounded-md border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
        Não foi possível carregar os movimentos deste título.
      </div>
    );
  }

  const movimentos = query.data ?? [];
  if (movimentos.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-8 text-center">
        <WalletCards className="mx-auto h-8 w-8 text-muted-foreground/50" />
        <p className="mt-2 text-sm font-medium">Nenhuma baixa registrada</p>
        <p className="mt-1 text-xs text-muted-foreground">O ledger deste título ainda não possui movimentações.</p>
      </div>
    );
  }

  return (
    <>
      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tipo</TableHead>
              <TableHead>Data</TableHead>
              <TableHead className="text-right">Principal</TableHead>
              <TableHead className="text-right">Desconto</TableHead>
              <TableHead className="text-right">Juros</TableHead>
              <TableHead className="text-right">Multa</TableHead>
              <TableHead>Forma / Referência</TableHead>
              <TableHead className="w-24"><span className="sr-only">Ações</span></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {movimentos.map((movimento) => {
              const foiEstornada = movimento.tipo_movimento === "baixa" && estornadas.has(movimento.id);
              const podeEstornar =
                podeOperar &&
                !cancelado &&
                movimento.tipo_movimento === "baixa" &&
                !foiEstornada;

              return (
                <TableRow key={movimento.id} className={movimento.tipo_movimento === "estorno" ? "bg-muted/25" : undefined}>
                  <TableCell>
                    <Badge variant={movimento.tipo_movimento === "estorno" ? "secondary" : "outline"}>
                      {movimento.tipo_movimento === "estorno" ? "Estorno" : foiEstornada ? "Baixa estornada" : "Baixa"}
                    </Badge>
                  </TableCell>
                  <TableCell>{formatarData(movimento.data_baixa)}</TableCell>
                  <TableCell className="text-right font-medium tabular-nums">{brl(valorComSinal(movimento.valor_principal, movimento))}</TableCell>
                  <TableCell className="text-right tabular-nums">{brl(valorComSinal(movimento.valor_desconto, movimento))}</TableCell>
                  <TableCell className="text-right tabular-nums">{brl(valorComSinal(movimento.valor_juros, movimento))}</TableCell>
                  <TableCell className="text-right tabular-nums">{brl(valorComSinal(movimento.valor_multa, movimento))}</TableCell>
                  <TableCell>
                    <div className="text-sm">{movimento.forma_pagamento || "—"}</div>
                    <div className="max-w-[18rem] truncate text-xs text-muted-foreground">
                      {movimento.observacao || movimento.referencia || ""}
                    </div>
                  </TableCell>
                  <TableCell>
                    {podeEstornar && (
                      <Button variant="ghost" size="sm" onClick={() => setEstornoSelecionado(movimento)}>
                        <RotateCcw className="mr-1 h-3.5 w-3.5" /> Estornar
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <p className="text-xs text-muted-foreground">
        Estornos são movimentos reversos. A baixa original permanece imutável e visível no ledger.
      </p>

      <EstornarBaixaDialog
        movimento={estornoSelecionado}
        open={estornoSelecionado !== null}
        onOpenChange={(open) => !open && setEstornoSelecionado(null)}
        onSuccess={async () => {
          await query.refetch();
          await onSuccess();
        }}
      />
    </>
  );
}

export default MovimentosTituloTab;
