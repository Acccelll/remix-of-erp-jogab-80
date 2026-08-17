import { Card, CardContent } from "@/components/ui/card";
import { brl } from "@/lib/billing";
import { cn } from "@/lib/utils";

type Props = {
  valorContratoAtual: number;
  valorContratoOriginal?: number | null;
  faturado: number;
  recebido: number;
  saldoAFaturar: number;
  pctFisicoRealizado: number;
  pctFisicoPrevisto?: number;
  pctFaturado?: number;
};

function Kpi({
  label,
  value,
  sub,
  tone,
  featured,
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "default" | "success" | "warning";
  featured?: boolean;
}) {
  const toneCls =
    tone === "success"
      ? "text-[color:var(--success)]"
      : tone === "warning"
        ? "text-[color:var(--warning-foreground)] dark:text-[color:var(--warning)]"
        : "";
  return (
    <Card className={cn(featured && "border-primary/50 bg-primary/5 shadow-sm")}>
      <CardContent className={cn("pt-5 pb-5", featured && "pt-6 pb-6")}>
        <div
          className={cn(
            "text-[11px] uppercase tracking-wide font-medium",
            featured ? "text-primary" : "text-muted-foreground",
          )}
        >
          {label}
        </div>
        <div
          className={cn(
            "font-semibold mt-1 num tabular-nums",
            featured ? "text-3xl md:text-4xl" : "text-xl",
            !featured && toneCls,
          )}
          style={{ textAlign: "left" }}
        >
          {value}
        </div>
        {sub && (
          <div
            className={cn("text-xs mt-1", featured ? "text-primary/70" : "text-muted-foreground")}
          >
            {sub}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function ResumoExecutivo(p: Props) {
  const pctPrev = Math.min(100, Math.max(0, p.pctFisicoPrevisto ?? 0));
  const pctReal = Math.min(100, Math.max(0, p.pctFisicoRealizado ?? 0));
  const pctFat = Math.min(100, Math.max(0, p.pctFaturado ?? 0));
  const aditivoDelta =
    p.valorContratoOriginal != null ? p.valorContratoAtual - p.valorContratoOriginal : 0;

  return (
    <div className="space-y-3">
      <div className="grid gap-3 grid-cols-1 md:grid-cols-3">
        <div className="md:col-span-1 md:row-span-2">
          <Kpi
            featured
            label="Saldo a faturar"
            value={brl(p.saldoAFaturar)}
            sub={
              p.saldoAFaturar < 0 ? "Acima do contrato" : `${(100 - pctFat).toFixed(1)}% restante`
            }
            tone={p.saldoAFaturar < 0 ? "warning" : "default"}
          />
        </div>
        <div className="grid gap-3 grid-cols-2 md:col-span-2">
          <Kpi
            label="Contrato atual"
            value={brl(p.valorContratoAtual)}
            sub={
              aditivoDelta !== 0 && p.valorContratoOriginal != null
                ? `${aditivoDelta > 0 ? "+" : ""}${brl(aditivoDelta)} aditivos`
                : "Sem aditivos"
            }
          />
          <Kpi label="Faturado" value={brl(p.faturado)} sub={`${pctFat.toFixed(1)}% do contrato`} />
          <Kpi label="Recebido" value={brl(p.recebido)} tone="success" />
          <Kpi
            label="Físico realizado"
            value={`${pctReal.toFixed(1)}%`}
            sub={`Previsto ${pctPrev.toFixed(1)}%`}
          />
        </div>
      </div>

      <Card>
        <CardContent className="pt-4 pb-4 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-medium">Avanço físico — previsto × realizado</span>
            <span className="text-muted-foreground tabular-nums">
              {pctReal.toFixed(1)}% / {pctPrev.toFixed(1)}%
            </span>
          </div>
          <div className="relative h-3 w-full rounded-full bg-muted overflow-hidden">
            <div
              className="absolute inset-y-0 left-0 bg-muted-foreground/30"
              style={{ width: `${pctPrev}%` }}
            />
            <div
              className="absolute inset-y-0 left-0 bg-[color:var(--success)]"
              style={{ width: `${pctReal}%` }}
            />
          </div>
          <div className="flex items-center gap-4 text-[11px] text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <span className="inline-block h-2 w-2 rounded-sm bg-muted-foreground/40" /> Previsto
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="inline-block h-2 w-2 rounded-sm bg-[color:var(--success)]" />{" "}
              Realizado
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
