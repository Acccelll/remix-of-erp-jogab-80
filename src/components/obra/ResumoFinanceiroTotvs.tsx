import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Landmark, ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { brl } from "@/lib/billing";
import { kpisObra, type FinLinha } from "@/lib/financeiro-totvs/agregacoes";
import { VW_FINANCEIRO_OBRA_COLS } from "@/lib/financeiro-totvs/colunas";
import { cn } from "@/lib/utils";

function Mini({
  label,
  valor,
  tone,
  subline,
}: {
  label: string;
  valor: number;
  tone?: "positive" | "negative" | "warn" | "primary";
  subline?: string;
}) {
  const color =
    tone === "positive"
      ? "text-[color:var(--success)]"
      : tone === "negative"
        ? "text-destructive"
        : tone === "warn"
          ? "text-warning"
          : tone === "primary"
            ? "text-primary"
            : "";
  return (
    <div className="flex flex-col">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">
        {label}
      </div>
      <div className={cn("text-lg font-semibold tabular-nums mt-0.5", color)}>{brl(valor)}</div>
      {subline && (
        <div className="text-[10px] text-warning mt-0.5">{subline}</div>
      )}
    </div>
  );
}

export function ResumoFinanceiroTotvs({
  obraId,
  centroCustoTotvs,
}: {
  obraId: string;
  centroCustoTotvs?: string | null;
}) {
  const { data: linhas, isLoading } = useQuery<FinLinha[]>({
    queryKey: ["fin_obra_resumo", obraId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vw_financeiro_obra")
        .select(VW_FINANCEIRO_OBRA_COLS)
        .eq("obra_id", obraId);
      if (error) throw error;
      return (data ?? []) as unknown as FinLinha[];
    },
  });

  const kpis = useMemo(() => kpisObra(linhas ?? []), [linhas]);
  const semVinculo = !centroCustoTotvs;
  const semDados = !isLoading && (linhas ?? []).length === 0;

  if (semVinculo || semDados) {
    return (
      <Card className="border-dashed">
        <CardContent className="py-4 flex items-center justify-between gap-3 text-sm">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Landmark className="h-4 w-4" />
            <span>
              {semVinculo
                ? "Centro de custo TOTVS não vinculado a esta obra."
                : "Sem dados financeiros importados para esta obra."}
            </span>
          </div>
          <Link
            to={semVinculo ? "/financeiro/centros" : "/financeiro/importar"}
            className="text-primary hover:underline inline-flex items-center gap-1 whitespace-nowrap"
          >
            {semVinculo ? "Cadastrar CC" : "Importar"} <ArrowRight className="h-3 w-3" />
          </Link>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="py-4">
        <div className="flex items-center justify-between mb-3">
          <div className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium">
            Financeiro (TOTVS)
          </div>
          <div className="text-[10px] text-muted-foreground">CC {centroCustoTotvs}</div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          <Mini label="Receita recebida" valor={kpis.receitaBaixada} tone="positive" />
          <Mini label="Despesa paga" valor={kpis.despesaPaga} tone="negative" />
          <Mini label="A receber" valor={kpis.receitaAReceber} />
          <Mini
            label="A pagar"
            valor={kpis.despesaAPagar}
            subline={kpis.despesaVencida > 0 ? `${brl(kpis.despesaVencida)} vencido` : undefined}
            tone={kpis.despesaVencida > 0 ? "warn" : undefined}
          />
          <Mini
            label="Saldo realizado"
            valor={kpis.saldoRealizado}
            tone={kpis.saldoRealizado >= 0 ? "primary" : "negative"}
          />
        </div>
      </CardContent>
    </Card>
  );
}
