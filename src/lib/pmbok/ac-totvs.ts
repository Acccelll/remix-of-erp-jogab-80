import { round2 } from "@/lib/core/money";
import type { FinLinha } from "@/lib/financeiro-totvs/agregacoes";
import type { EvmAcReal } from "./evm";

const STATUS_CANCELADO = 18;

/**
 * Constrói o AC (Actual Cost) real do EVM a partir das linhas de vw_financeiro_obra.
 */
export function construirAcReal(linhas: FinLinha[] | null | undefined): EvmAcReal {
  if (!linhas?.length) return { porMes: [], total: 0 };
  const porMes = new Map<string, number>();
  let total = 0;
  for (const l of linhas) {
    if (l.status_cod === STATUS_CANCELADO) continue;
    if (l.grupo !== "2") continue;
    const mes = (l.mes_competencia ?? "").slice(0, 7);
    if (!mes) continue;
    const v = Number(l.valor_rateio ?? 0) || 0;
    if (!v) continue;
    porMes.set(mes, (porMes.get(mes) ?? 0) + v);
    total += v;
  }
  const arr = Array.from(porMes.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([mes, valor]) => ({ mes, valor: round2(valor) }));
  return { porMes: arr, total: round2(total) };
}
