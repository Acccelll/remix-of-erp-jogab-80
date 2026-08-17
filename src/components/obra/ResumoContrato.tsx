import { ArrowRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { brl } from "@/lib/billing";
import { cn } from "@/lib/utils";

type Props = {
  valorContratoAtual: number;
  valorContratoOriginal?: number | null;
  faturado: number;
  recebido: number;
  previstoReceber: number;
  saldoAFaturar: number;
  pctFisicoRealizado: number;
  pctFisicoPrevisto?: number;
  pctFaturado?: number;
  onIrCronograma?: () => void;
};

export function ResumoContrato(p: Props) {
  const pctPrev = Math.min(100, Math.max(0, p.pctFisicoPrevisto ?? 0));
  const pctReal = Math.min(100, Math.max(0, p.pctFisicoRealizado ?? 0));
  const pctFat = Math.min(100, Math.max(0, p.pctFaturado ?? 0));
  const aditivoDelta =
    p.valorContratoOriginal != null ? p.valorContratoAtual - p.valorContratoOriginal : 0;
  const aReceber = Math.max(0, p.previstoReceber - p.recebido);

  return (
    <div className="grid gap-3 grid-cols-1 md:grid-cols-3 min-w-0">
      {/* Card 1 — Saldo do contrato */}
      <Card className="border-primary/50 bg-primary/5 shadow-sm">
        <CardContent className="pt-6 pb-6">
          <div className="text-[11px] uppercase tracking-wide font-medium text-primary">
            Contrato atual
          </div>
          <div
            className="font-semibold mt-1 num tabular-nums text-2xl md:text-3xl text-left overflow-hidden text-ellipsis whitespace-nowrap"
            title={brl(p.valorContratoAtual)}
          >
            {brl(p.valorContratoAtual)}
          </div>
          <div className="text-xs mt-1 text-primary/70">
            {pctFat.toFixed(1)}% faturado
            {aditivoDelta !== 0 && p.valorContratoOriginal != null && (
              <>
                {" "}
                · {aditivoDelta > 0 ? "+" : ""}
                {brl(aditivoDelta)} aditivos
              </>
            )}
          </div>
          <div className="text-[11px] mt-2 text-muted-foreground">
            Saldo do contrato:{" "}
            <span
              className={cn(
                "tabular-nums font-medium",
                p.saldoAFaturar < 0 &&
                  "text-[color:var(--warning-foreground)] dark:text-[color:var(--warning)]",
              )}
              title={brl(p.saldoAFaturar)}
            >
              {brl(p.saldoAFaturar)}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Card 2 — Faturado / Recebido */}
      <Card>
        <CardContent className="pt-6 pb-6">
          <div className="text-[11px] uppercase tracking-wide font-medium text-muted-foreground">
            Faturado / Recebido (TOTVS)
          </div>
          <div className="mt-1 flex items-baseline gap-2 flex-wrap">
            <span className="text-xl md:text-2xl font-semibold tabular-nums">
              {brl(p.faturado)}
            </span>
            <span className="text-muted-foreground">/</span>
            <span className="text-lg md:text-xl font-semibold tabular-nums text-[color:var(--success)]">
              {brl(p.recebido)}
            </span>
          </div>
          <div className="text-xs mt-1 text-muted-foreground">
            {pctFat.toFixed(1)}% faturado total
          </div>
          {aReceber > 0 && (
            <div className="text-[11px] mt-2 text-muted-foreground">
              A receber: <span className="tabular-nums">{brl(aReceber)}</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Card 3 — Físico realizado */}
      <Card>
        <CardContent className="pt-6 pb-6">
          <div className="flex items-start justify-between gap-2">
            <div className="text-[11px] uppercase tracking-wide font-medium text-muted-foreground">
              Físico realizado
            </div>
            {p.onIrCronograma && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-6 px-2 -mt-1 -mr-2 text-xs text-primary hover:text-primary"
                onClick={p.onIrCronograma}
              >
                Cronograma <ArrowRight className="h-3 w-3 ml-1" />
              </Button>
            )}
          </div>
          <div className="font-semibold mt-1 tabular-nums text-xl md:text-2xl text-left">
            {pctReal.toFixed(1)}%
          </div>
          <div className="text-xs mt-1 text-muted-foreground">Previsto {pctPrev.toFixed(1)}%</div>
          <div className="relative h-2 w-full rounded-full bg-muted overflow-hidden mt-3">
            <div
              className="absolute inset-y-0 left-0 bg-muted-foreground/30"
              style={{ width: `${pctPrev}%` }}
            />
            <div
              className="absolute inset-y-0 left-0 bg-[color:var(--success)]"
              style={{ width: `${pctReal}%` }}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
