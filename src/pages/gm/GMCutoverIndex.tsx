import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { QueryState } from "@/components/common/QueryState";
import { ArrowLeft, ArrowRight, GitBranch } from "lucide-react";
import { useCatalogos } from "@/contexts/catalogos/useCatalogos";
import { Badge } from "@/components/ui/badge";

const LEGACY_FLAGS = [
  "legacy.trello_import",
  "legacy.cronograma_import",
  "legacy.financeiro_import",
  "legacy.ponto_import",
] as const;

/**
 * H3.3 — Índice de cutover: lista as obras e linka para o painel de
 * reconciliação detalhado por obra. Agrega o snapshot rápido das 4 views
 * de cutover para o gestor escolher por onde começar.
 */
export default function GMCutoverIndex() {
  const { obras } = useCatalogos();

  const q = useQuery({
    queryKey: ["cutover-index"],
    queryFn: async () => {
      const [t, c, f, p] = await Promise.all([
        supabase
          .from("vw_cutover_metrics_trello" as never)
          .select("obra_id, cards_total, cards_ativos"),
        supabase
          .from("vw_cutover_metrics_cronograma" as never)
          .select("obra_id, linhas_atual, criticas"),
        supabase
          .from("vw_cutover_metrics_financeiro" as never)
          .select("obra_id, lancamentos_total, lancamentos_abertos"),
        supabase
          .from("vw_cutover_metrics_ponto" as never)
          .select("obra_id, registros_total, invalidas"),
      ]);
      const err = t.error || c.error || f.error || p.error;
      if (err) throw err;
      const byObra: Record<string, Record<string, unknown>> = {};
      for (const row of (t.data ?? []) as Array<Record<string, unknown>>)
        byObra[String(row.obra_id)] = { ...(byObra[String(row.obra_id)] ?? {}), ...row };
      for (const row of (c.data ?? []) as Array<Record<string, unknown>>)
        byObra[String(row.obra_id)] = { ...(byObra[String(row.obra_id)] ?? {}), ...row };
      for (const row of (f.data ?? []) as Array<Record<string, unknown>>)
        byObra[String(row.obra_id)] = { ...(byObra[String(row.obra_id)] ?? {}), ...row };
      for (const row of (p.data ?? []) as Array<Record<string, unknown>>)
        byObra[String(row.obra_id)] = { ...(byObra[String(row.obra_id)] ?? {}), ...row };
      return byObra;
    },
  });

  const flagsQ = useQuery({
    queryKey: ["cutover-index-flags"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cutover_legacy_flags")
        .select("flag_key, obra_id, enabled")
        .in("flag_key", LEGACY_FLAGS as unknown as string[]);
      if (error) throw error;
      return (data ?? []) as Array<{ flag_key: string; obra_id: string | null; enabled: boolean }>;
    },
  });

  function legacyOffForObra(obraId: string): { off: number; total: number } {
    const rows = flagsQ.data ?? [];
    let off = 0;
    for (const key of LEGACY_FLAGS) {
      const obraRow = rows.find((r) => r.flag_key === key && r.obra_id === obraId);
      const globalRow = rows.find((r) => r.flag_key === key && r.obra_id === null);
      const enabled = obraRow ? obraRow.enabled : globalRow ? globalRow.enabled : false;
      if (!enabled) off++;
    }
    return { off, total: LEGACY_FLAGS.length };
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Button asChild variant="ghost" size="sm">
          <Link to="/gm">
            <ArrowLeft className="h-4 w-4 mr-1" /> GM
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <GitBranch className="h-6 w-6" /> Cutover por obra
          </h1>
          <p className="text-sm text-muted-foreground">
            Reconcilie cada obra com os sistemas legados antes do desligamento. Playbook:{" "}
            <code>docs/operacao/H3_playbook_cutover.md</code>.
          </p>
        </div>
      </div>

      <QueryState
        isLoading={q.isLoading}
        isError={q.isError}
        error={q.error}
        data={q.data}
        onRetry={() => q.refetch()}
      >
        {(raw) => {
          const map = raw as Record<string, Record<string, unknown>>;
          const lista = obras.filter((o) => o.ativa);
          if (lista.length === 0)
            return <p className="text-sm text-muted-foreground">Sem obras ativas.</p>;
          return (
            <div className="grid gap-3">
              {lista.map((o) => {
                const m = map[o.id] ?? {};
                return (
                  <Card key={o.id} className="p-4 flex items-center gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="font-semibold truncate">{o.nome}</div>
                        {(() => {
                          const { off, total } = legacyOffForObra(o.id);
                          if (off === total)
                            return (
                              <Badge className="bg-success hover:bg-success text-xs">
                                Legados desligados
                              </Badge>
                            );
                          if (off === 0)
                            return (
                              <Badge variant="outline" className="text-xs">
                                Legados ativos
                              </Badge>
                            );
                          return (
                            <Badge variant="secondary" className="text-xs">
                              Legados {off}/{total} OFF
                            </Badge>
                          );
                        })()}
                      </div>
                      <div className="text-xs text-muted-foreground flex flex-wrap gap-x-4 gap-y-1 mt-1">
                        <span>
                          Trello: <b className="text-foreground">{numOr(m.cards_total)}</b> (
                          {numOr(m.cards_ativos)} ativos)
                        </span>
                        <span>
                          Cronograma: <b className="text-foreground">{numOr(m.linhas_atual)}</b> (
                          {numOr(m.criticas)} críticas)
                        </span>
                        <span>
                          Financeiro:{" "}
                          <b className="text-foreground">{numOr(m.lancamentos_total)}</b> (
                          {numOr(m.lancamentos_abertos)} abertos)
                        </span>
                        <span>
                          Ponto: <b className="text-foreground">{numOr(m.registros_total)}</b> (
                          {numOr(m.invalidas)} inválidas)
                        </span>
                      </div>
                    </div>
                    <Button asChild variant="outline" size="sm">
                      <Link to={`/gm/cutover/${o.id}`}>
                        Abrir <ArrowRight className="h-4 w-4 ml-1" />
                      </Link>
                    </Button>
                  </Card>
                );
              })}
            </div>
          );
        }}
      </QueryState>
    </div>
  );
}

function numOr(v: unknown): string {
  if (v === null || v === undefined) return "—";
  const n = Number(v);
  return isNaN(n) ? "—" : n.toLocaleString("pt-BR");
}
