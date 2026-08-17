import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Scale } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
  montarConfronto,
  type BmsPrevistaLite,
  type RecebimentoLite,
  type NotaFiscalLite,
} from "@/lib/financeiro-totvs/confronto";
import type { FinLinha } from "@/lib/financeiro-totvs/agregacoes";
import { VW_FINANCEIRO_OBRA_COLS } from "@/lib/financeiro-totvs/colunas";
import { cn } from "@/lib/utils";

export function ConfrontoOperacionalCard({
  obraId,
  bmsPrev,
  receb,
  nfs,
  meses = 6,
  onVerAnalise,
}: {
  obraId: string;
  bmsPrev: any[];
  receb: any[];
  nfs: any[];
  meses?: number;
  onVerAnalise?: () => void;
}) {
  const { data: linhas } = useQuery<FinLinha[]>({
    queryKey: ["fin_obra_confronto", obraId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vw_financeiro_obra")
        .select(VW_FINANCEIRO_OBRA_COLS)
        .eq("obra_id", obraId);
      if (error) throw error;
      return (data ?? []) as unknown as FinLinha[];
    },
  });

  const linhasConfronto = useMemo(() => {
    const bms: BmsPrevistaLite[] = (bmsPrev ?? []).map((b: any) => ({
      data_corte: b.data_corte,
      valor_previsto_dinamico: Number(b.valor_previsto_dinamico ?? 0),
    }));
    const recs: RecebimentoLite[] = (receb ?? []).map((r: any) => ({
      data_prevista: r.data_prevista,
      data_recebimento: r.data_recebimento ?? null,
      valor_previsto: Number(r.valor_previsto ?? 0),
      valor_recebido: r.valor_recebido != null ? Number(r.valor_recebido) : null,
    }));
    const nfsLite: NotaFiscalLite[] = (nfs ?? []).map((f: any) => ({
      competencia: f.competencia ?? null,
      data_emissao: f.data_emissao ?? null,
      valor: Number(f.valor ?? 0),
      status: f.status ?? "",
    }));
    const all = montarConfronto({ linhas: linhas ?? [], bms, receb: recs, nfs: nfsLite });
    const ativos = all.filter(
      (r) =>
        r.despesaPrevistaBms !== 0 ||
        r.despesaRealizadaTotvs !== 0 ||
        r.receitaTotvs !== 0 ||
        r.receitaNfsEmitidas !== 0,
    );
    return ativos.slice(-meses);
  }, [linhas, bmsPrev, receb, nfs, meses]);

  if (linhasConfronto.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="py-4 flex items-center gap-2 text-sm text-muted-foreground">
          <Scale className="h-4 w-4" />
          <span>
            Sem dados suficientes para confronto operacional (BMS previstas × realizado TOTVS).
          </span>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Scale className="h-4 w-4 text-muted-foreground" />
          Confronto operacional
          <span className="text-xs font-normal text-muted-foreground">
            — últimos {linhasConfronto.length} mês(es)
          </span>
        </CardTitle>
        {onVerAnalise && (
          <Button
            variant="ghost"
            size="sm"
            className="text-xs text-primary hover:text-primary"
            onClick={onVerAnalise}
          >
            Ver análise <ArrowRight className="h-3 w-3 ml-1" />
          </Button>
        )}
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Mês</TableHead>
              <TableHead className="text-right">Despesa prevista (BMS)</TableHead>
              <TableHead className="text-right">Despesa realizada (TOTVS)</TableHead>
              <TableHead className="text-right">Desvio</TableHead>
              <TableHead className="text-right">Receita NFs</TableHead>
              <TableHead className="text-right">Receita TOTVS</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {linhasConfronto.map((r) => (
              <TableRow key={r.mes}>
                <TableCell className="font-medium">{r.mes}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {brl(r.despesaPrevistaBms)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {brl(r.despesaRealizadaTotvs)}
                </TableCell>
                <TableCell
                  className={cn(
                    "text-right tabular-nums font-medium",
                    r.desvioDespesa >= 0 ? "text-[color:var(--success)]" : "text-destructive",
                  )}
                >
                  {r.desvioDespesa >= 0 ? "+" : ""}
                  {brl(r.desvioDespesa)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {brl(r.receitaNfsEmitidas)}
                </TableCell>
                <TableCell className="text-right tabular-nums text-muted-foreground">
                  {brl(r.receitaTotvs)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
