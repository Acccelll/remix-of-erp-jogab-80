// PRO-019 — Banner de alertas de vencimento/renovação no hub de Contratos (M12).
// PRO-030 slice-02 — emite `contrato_vencendo` para faixas crítica/alta com dedupe.
import { useEffect, useState } from "react";
import { AlertTriangle, BellOff, ChevronDown, ChevronUp } from "lucide-react";
import { useContratosVencendo } from "@/hooks/contratos/useContratosVencendo";
import { useContratoAlertaSilencio } from "@/hooks/contratos/useContratoAlertaSilencio";
import { criarNotificacao } from "@/lib/notificacoes";
import { Badge } from "@/components/ui/badge";
import { fmtDataLocal } from "@/lib/core/date";

function daquiADiasISO(dias: number): string {
  const d = new Date();
  d.setDate(d.getDate() + dias);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function ContratosAlertaBanner() {
  const todos = useContratosVencendo();
  const { filtrar, silenciarAte } = useContratoAlertaSilencio();
  const alertas = filtrar(todos);
  const [aberto, setAberto] = useState(true);

  // PRO-030 — dispara notificação persistente uma vez por alerta (dedupe client-side).
  useEffect(() => {
    for (const a of alertas) {
      if (a.severidade !== "critica" && a.severidade !== "alta") continue;
      const dedupeKey = `contrato:${a.contrato.id}:${a.tipo}:${a.dataAlvo}`;
      const rotulo = a.tipo === "reajuste" ? "Reajuste" : "Vencimento";
      const quando =
        a.situacao === "vencido"
          ? `há ${Math.abs(a.diasRestantes)}d`
          : a.diasRestantes === 0
            ? "hoje"
            : `em ${a.diasRestantes}d`;
      void criarNotificacao({
        tipo: a.tipo === "reajuste" ? "contrato_reajuste" : "contrato_vencendo",
        role_scope: "compras",
        target_id: a.contrato.id,
        titulo: `${rotulo}: ${a.contrato.locacaoServico} (${quando})`,
        mensagem: `${a.contrato.tipo} · data-alvo ${a.dataAlvo}${
          a.origem === "aditivo" ? " (após aditivo)" : ""
        }`,
        dedupeKey,
      });
    }
  }, [alertas]);

  if (alertas.length === 0) return null;

  const criticas = alertas.filter((a) => a.severidade === "critica").length;
  const vencidos = alertas.filter((a) => a.situacao === "vencido").length;
  const hoje = alertas.filter((a) => a.situacao === "hoje").length;
  const proximos = alertas.length - vencidos - hoje;

  return (
    <div className="rounded-lg border border-warning/40 bg-warning/5">
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left"
      >
        <AlertTriangle className="h-4 w-4 text-warning" />
        <span className="font-medium">
          {alertas.length} alerta(s) de contrato
          {criticas > 0 ? ` · ${criticas} crítico(s)` : ""}
        </span>
        <div className="flex items-center gap-1 text-xs">
          {vencidos > 0 && <Badge variant="destructive">{vencidos} vencido(s)</Badge>}
          {hoje > 0 && (
            <Badge className="bg-warning hover:bg-warning text-white">
              {hoje} vence(m) hoje
            </Badge>
          )}
          {proximos > 0 && <Badge variant="secondary">{proximos} próximo(s)</Badge>}
        </div>
        <span className="ml-auto text-muted-foreground">
          {aberto ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </span>
      </button>
      {aberto && (
        <ul className="divide-y divide-warning/20 border-t border-warning/20">
          {alertas.slice(0, 8).map((a) => (
            <li
              key={`${a.contrato.id}:${a.tipo}`}
              className="flex items-center gap-3 px-3 py-1.5 text-sm"
            >
              <div
                className={`w-32 text-xs font-medium tabular-nums ${
                  a.situacao === "vencido"
                    ? "text-destructive"
                    : a.situacao === "hoje"
                      ? "text-warning"
                      : "text-warning"
                }`}
              >
                  {a.tipo === "reajuste"
                    ? a.situacao === "vencido"
                      ? `reajuste ${Math.abs(a.diasRestantes)}d`
                      : a.diasRestantes === 0
                        ? "reajuste hoje"
                        : `reajuste em ${a.diasRestantes}d`
                    : a.situacao === "vencido"
                      ? `vencido ${Math.abs(a.diasRestantes)}d`
                      : a.diasRestantes === 0
                        ? "vence hoje"
                        : `vence em ${a.diasRestantes}d`}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate">{a.contrato.locacaoServico}</div>
                <div className="text-[11px] text-muted-foreground truncate">
                  {a.contrato.tipo} · {a.tipo === "reajuste" ? "reajuste" : "término"} {fmtDataLocal(a.dataAlvo)}
                  {a.origem === "aditivo" ? " (após aditivo)" : ""}
                  {a.contrato.responsavel ? ` · resp.: ${a.contrato.responsavel}` : ""}
                </div>
              </div>
              <button
                type="button"
                onClick={() => silenciarAte(a.contrato.id, a.tipo, daquiADiasISO(7))}
                className="shrink-0 inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] text-muted-foreground hover:bg-warning/10 hover:text-foreground"
                title="Silenciar este alerta por 7 dias"
              >
                <BellOff className="h-3 w-3" /> 7d
              </button>
            </li>
          ))}
          {alertas.length > 8 && (
            <li className="px-3 py-1.5 text-[11px] text-muted-foreground">
              + {alertas.length - 8} outro(s) na aba Lista.
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
