import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Wrench } from "lucide-react";
import { frotaAbastecimentosRepo, frotaManutencoesRepo } from "@/lib/repositories/frotas";
import { statusPreventiva, type StatusPreventivaResult } from "@/lib/frotas/preventiva";

/**
 * PRO-024 · slice-02 — Badge visual do status de manutenção preventiva.
 *
 * Busca a última manutenção conhecida (com `proxima_preventiva_*`) e o
 * último abastecimento (fonte do horímetro/odômetro atuais) do ativo e
 * aplica `statusPreventiva`. Só renderiza quando há veredicto útil
 * (proxima ou vencida) — silencia nos casos `ok` e `desconhecido` para
 * não poluir a UI.
 */
export function PreventivaBadge({
  ativoId,
  idCol = "veiculo_id",
}: {
  ativoId: string;
  idCol?: "veiculo_id" | "patrimonio_id";
}) {
  const [res, setRes] = useState<StatusPreventivaResult | null>(null);

  useEffect(() => {
    let cancel = false;
    (async () => {
      try {
        const [manuts, abasts] = await Promise.all([
          frotaManutencoesRepo.listByAtivo(idCol, ativoId, 1),
          frotaAbastecimentosRepo.listByAtivo(idCol, ativoId, 1),
        ]);
        if (cancel) return;
        const ultimaManut = manuts[0] ?? null;
        const ultimoAbast = abasts[0] ?? null;
        const hojeIso = new Date().toISOString().slice(0, 10);
        const r = statusPreventiva(ultimaManut, {
          hojeIso,
          horimetroAtual: ultimoAbast?.horimetro ?? ultimaManut?.horimetro ?? null,
          odometroAtual: ultimoAbast?.odometro ?? ultimaManut?.odometro ?? null,
        });
        setRes(r);
      } catch {
        // Silencioso — badge é informativa, nunca bloqueia.
      }
    })();
    return () => {
      cancel = true;
    };
  }, [ativoId, idCol]);

  if (!res || res.status === "ok" || res.status === "desconhecido") return null;

  const isVencida = res.status === "vencida";
  const label = isVencida ? "Preventiva vencida" : "Preventiva próxima";
  const classes = isVencida
    ? "border-destructive/50 bg-destructive/10 text-destructive"
    : "border-warning/50 bg-warning/10 text-warning";

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge variant="outline" className={`gap-1 text-[10px] ${classes}`}>
            <Wrench className="h-3 w-3" aria-hidden="true" />
            {label}
          </Badge>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs">
          <ul className="text-xs space-y-0.5">
            {res.motivos.map((m, i) => (
              <li key={i}>• {m}</li>
            ))}
          </ul>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
