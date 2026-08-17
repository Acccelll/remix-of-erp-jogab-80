import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { CheckCircle2, AlertTriangle, XCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/auth/useAuth";
import { ensureCloudSession } from "@/lib/auth/ensureCloudSession";
import { uuidOrNull } from "@/lib/core/uuid";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

export type Sistema = "trello" | "cronograma" | "totvs" | "ponto" | "obras_csv";

export interface ImportValidationData {
  sistema: Sistema;
  obraId?: string | null;
  contagemOrigem: number;
  contagemDestino: number;
  divergencias?: Array<{ campo: string; origem: unknown; destino: unknown; nota?: string }>;
  amostra?: unknown[];
}

/**
 * H3.2 — Relatório de validação de importação.
 * Mostra contagens origem vs destino, divergências, amostra (até 10 itens),
 * e exige aprovação explícita do usuário (registrada em import_validation_runs).
 * Sem aprovação, o import é considerado "pendente validação" e não é fonte de verdade.
 */
export function ImportValidationReport({
  data,
  onApproved,
}: {
  data: ImportValidationData;
  onApproved?: (runId: string) => void;
}) {
  const { currentPlayer } = useAuth();
  const [obs, setObs] = useState("");

  const diff = data.contagemOrigem - data.contagemDestino;
  const diffPerc = data.contagemOrigem > 0 ? (Math.abs(diff) / data.contagemOrigem) * 100 : 0;
  const semDivergencias = (data.divergencias?.length ?? 0) === 0 && diff === 0;
  const amostra = (data.amostra ?? []).slice(0, 10);

  const aprovar = useMutation({
    mutationFn: async (status: "aprovado" | "rejeitado") => {
      if (!currentPlayer?.id) throw new Error("Usuário não identificado");
      await ensureCloudSession(currentPlayer);
      const { data: auth } = await supabase.auth.getUser();
      const uid = uuidOrNull(auth?.user?.id);
      if (!uid)
        throw new Error("Sessão Cloud inválida. Entre novamente para validar a importação.");
      const { data: inserted, error } = await supabase
        .from("import_validation_runs")
        .insert({
          sistema: data.sistema,
          obra_id: data.obraId ?? null,
          contagem_origem: data.contagemOrigem,
          contagem_destino: data.contagemDestino,
          divergencias: (data.divergencias ?? []) as never,
          amostra: amostra as never,
          status,
          aprovado_por: status === "aprovado" ? uid : null,
          aprovado_em: status === "aprovado" ? new Date().toISOString() : null,
          observacoes: obs || null,
          criado_por: uid,
        })
        .select("id")
        .single();
      if (error) throw error;
      return inserted.id as string;
    },
    onSuccess: (id, status) => {
      toast.success(status === "aprovado" ? "Importação aprovada" : "Importação rejeitada", {
        description: `Registro #${id.slice(0, 8)} em import_validation_runs`,
      });
      if (status === "aprovado") onApproved?.(id);
    },
    onError: (e: Error) => toast.error("Erro", { description: e.message }),
  });

  return (
    <div className="space-y-4 border border-border rounded-lg p-4 bg-card">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          {semDivergencias ? (
            <CheckCircle2 className="h-5 w-5 text-success" />
          ) : (
            <AlertTriangle className="h-5 w-5 text-warning" />
          )}
          <h3 className="font-semibold">Validação de importação — {data.sistema}</h3>
        </div>
        <Badge variant={semDivergencias ? "default" : "secondary"}>
          {semDivergencias ? "Sem divergências" : `${data.divergencias?.length ?? 0} divergências`}
        </Badge>
      </div>

      <div className="grid grid-cols-3 gap-3 text-center">
        <div className="border border-border rounded p-3">
          <div className="text-xs text-muted-foreground">Origem</div>
          <div className="text-2xl font-bold">{data.contagemOrigem}</div>
        </div>
        <div className="border border-border rounded p-3">
          <div className="text-xs text-muted-foreground">Destino</div>
          <div className="text-2xl font-bold">{data.contagemDestino}</div>
        </div>
        <div className="border border-border rounded p-3">
          <div className="text-xs text-muted-foreground">Diferença</div>
          <div className={`text-2xl font-bold ${diff === 0 ? "" : "text-warning"}`}>
            {diff > 0 ? `+${diff}` : diff} ({diffPerc.toFixed(1)}%)
          </div>
        </div>
      </div>

      {data.divergencias && data.divergencias.length > 0 && (
        <div className="space-y-1">
          <h4 className="text-sm font-medium">Divergências</h4>
          <div className="max-h-40 overflow-auto border border-border rounded">
            <table className="w-full text-xs">
              <thead className="bg-muted">
                <tr>
                  <th className="text-left p-2">Campo</th>
                  <th className="text-left p-2">Origem</th>
                  <th className="text-left p-2">Destino</th>
                  <th className="text-left p-2">Nota</th>
                </tr>
              </thead>
              <tbody>
                {data.divergencias.map((d, i) => (
                  <tr key={i} className="border-t border-border">
                    <td className="p-2 font-mono">{d.campo}</td>
                    <td className="p-2">{String(d.origem)}</td>
                    <td className="p-2">{String(d.destino)}</td>
                    <td className="p-2 text-muted-foreground">{d.nota}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {amostra.length > 0 && (
        <details className="text-xs">
          <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
            Amostra ({amostra.length} registro{amostra.length === 1 ? "" : "s"})
          </summary>
          <pre className="mt-2 max-h-40 overflow-auto bg-muted p-2 rounded">
            {JSON.stringify(amostra, null, 2)}
          </pre>
        </details>
      )}

      <div>
        <label className="text-sm font-medium">Observações</label>
        <textarea
          value={obs}
          onChange={(e) => setObs(e.target.value)}
          className="w-full border border-border rounded p-2 text-sm bg-background"
          rows={2}
          placeholder="Ex.: 3 cards arquivados há mais de 1 ano não foram importados — ok."
        />
      </div>

      <div className="flex gap-2 justify-end">
        <Button
          variant="outline"
          size="sm"
          onClick={() => aprovar.mutate("rejeitado")}
          disabled={aprovar.isPending}
        >
          <XCircle className="h-4 w-4 mr-1" /> Rejeitar
        </Button>
        <Button size="sm" onClick={() => aprovar.mutate("aprovado")} disabled={aprovar.isPending}>
          <CheckCircle2 className="h-4 w-4 mr-1" /> Aprovar como fonte de verdade
        </Button>
      </div>
    </div>
  );
}
