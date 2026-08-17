import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { QueryState } from "@/components/common/QueryState";
import { useCatalogos } from "@/contexts/catalogos/useCatalogos";
import { ArrowLeft } from "lucide-react";
import { useFeatureFlag } from "@/hooks/useFeatureFlag";
import { Badge } from "@/components/ui/badge";
import { fmtDataLocal } from "@/lib/core/date";
import { formatBRL } from "@/lib/core/currency";


/**
 * H3.3 — Painel de reconciliação de cutover por obra.
 * Mostra as métricas calculadas (ObraFlow) lado a lado com o lugar para
 * o gestor anotar os números esperados do sistema legado (Trello / Prevision).
 */
export default function GMCutover() {
  const { obraId } = useParams<{ obraId: string }>();
  const { obras } = useCatalogos();
  const obra = obras.find((o) => o.id === obraId);

  const trelloFlag = useFeatureFlag("legacy.trello_import", obraId);
  const cronoFlag = useFeatureFlag("legacy.cronograma_import", obraId);
  const finFlag = useFeatureFlag("legacy.financeiro_import", obraId);
  const pontoFlag = useFeatureFlag("legacy.ponto_import", obraId);
  const todosDesligados =
    !trelloFlag.isLoading &&
    !cronoFlag.isLoading &&
    !finFlag.isLoading &&
    !pontoFlag.isLoading &&
    !trelloFlag.enabled &&
    !cronoFlag.enabled &&
    !finFlag.enabled &&
    !pontoFlag.enabled;

  const trelloQ = useQuery({
    queryKey: ["cutover-trello", obraId],
    enabled: !!obraId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vw_cutover_metrics_trello" as never)
        .select(
          "obra_id, cards_ativos, cards_total, listas_distintas, membros_distintos, ultima_atividade",
        )
        .eq("obra_id", obraId!)
        .maybeSingle();
      if (error) throw error;
      return data as Record<string, unknown> | null;
    },
  });

  const cronoQ = useQuery({
    queryKey: ["cutover-crono", obraId],
    enabled: !!obraId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vw_cutover_metrics_cronograma" as never)
        .select(
          "obra_id, linhas_atual, criticas, baselines, pct_medio_realizado, pct_medio_previsto, data_inicio_min, data_fim_max",
        )
        .eq("obra_id", obraId!)
        .maybeSingle();
      if (error) throw error;
      return data as Record<string, unknown> | null;
    },
  });

  const finQ = useQuery({
    queryKey: ["cutover-fin", obraId],
    enabled: !!obraId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vw_cutover_metrics_financeiro" as never)
        .select(
          "obra_id, lancamentos_total, lancamentos_abertos, lancamentos_baixados, fornecedores_distintos, valor_total, valor_aberto, pendentes_natureza, ultima_emissao",
        )
        .eq("obra_id", obraId!)
        .maybeSingle();
      if (error) throw error;
      return data as Record<string, unknown> | null;
    },
  });

  const pontoQ = useQuery({
    queryKey: ["cutover-ponto", obraId],
    enabled: !!obraId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vw_cutover_metrics_ponto" as never)
        .select(
          "obra_id, colaboradores_distintos, registros_total, registros_30d, tratativas, invalidas, ultimo_registro",
        )
        .eq("obra_id", obraId!)
        .maybeSingle();
      if (error) throw error;
      return data as Record<string, unknown> | null;
    },
  });

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Button asChild variant="ghost" size="sm">
          <Link to="/gm">
            <ArrowLeft className="h-4 w-4 mr-1" /> GM
          </Link>
        </Button>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold">Cutover — {obra?.nome ?? obraId}</h1>
            {todosDesligados ? (
              <Badge variant="default" className="bg-success hover:bg-success">
                Legados desligados
              </Badge>
            ) : (
              <Badge variant="outline">Legados ativos</Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            Reconcilie os números desta obra com Trello e Prevision antes de desligar. Critérios
            completos em <code>docs/operacao/H3_playbook_cutover.md</code>.
          </p>
        </div>
      </div>

      <QueryState
        isLoading={trelloQ.isLoading}
        isError={trelloQ.isError}
        error={trelloQ.error}
        data={trelloQ.data}
        onRetry={() => trelloQ.refetch()}
      >
        {(raw) => {
          const data = raw as Record<string, unknown> | null;
          return (
            <Card className="p-4 space-y-2">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold">Trello (cards) — ObraFlow</h2>
                <FlagStatus enabled={trelloFlag.enabled} loading={trelloFlag.isLoading} />
              </div>
              {!data ? (
                <p className="text-sm text-muted-foreground">Sem cards nesta obra.</p>
              ) : (
                <dl className="grid grid-cols-2 md:grid-cols-5 gap-3 text-sm">
                  <Metric label="Cards ativos" value={data.cards_ativos} />
                  <Metric label="Cards totais" value={data.cards_total} />
                  <Metric label="Listas/status" value={data.listas_distintas} />
                  <Metric label="Membros" value={data.membros_distintos} />
                  <Metric label="Última atividade" value={fmtDate(data.ultima_atividade)} />
                </dl>
              )}
              <p className="text-xs text-muted-foreground pt-2">
                Compare com o export Trello da mesma obra. Aceitável: diferença ≤ 2% após excluir
                cards arquivados antigos.
              </p>
            </Card>
          );
        }}
      </QueryState>

      <QueryState
        isLoading={cronoQ.isLoading}
        isError={cronoQ.isError}
        error={cronoQ.error}
        data={cronoQ.data}
        onRetry={() => cronoQ.refetch()}
      >
        {(raw) => {
          const data = raw as Record<string, unknown> | null;
          return (
            <Card className="p-4 space-y-2">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold">Cronograma — ObraFlow</h2>
                <FlagStatus enabled={cronoFlag.enabled} loading={cronoFlag.isLoading} />
              </div>
              {!data ? (
                <p className="text-sm text-muted-foreground">Sem cronograma nesta obra.</p>
              ) : (
                <dl className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                  <Metric label="Linhas ativas" value={data.linhas_atual} />
                  <Metric label="Críticas" value={data.criticas} />
                  <Metric label="Baselines" value={data.baselines} />
                  <Metric label="% médio (real)" value={pct(data.pct_medio_realizado)} />
                  <Metric label="% médio (prev)" value={pct(data.pct_medio_previsto)} />
                  <Metric label="Início" value={fmtDate(data.data_inicio_min)} />
                  <Metric label="Fim" value={fmtDate(data.data_fim_max)} />
                </dl>
              )}
              <p className="text-xs text-muted-foreground pt-2">
                Compare com Prevision: contagem de tarefas, datas-âncora e curva S agregada
                (mensal).
              </p>
            </Card>
          );
        }}
      </QueryState>

      <QueryState
        isLoading={finQ.isLoading}
        isError={finQ.isError}
        error={finQ.error}
        data={finQ.data}
        onRetry={() => finQ.refetch()}
      >
        {(raw) => {
          const data = raw as Record<string, unknown> | null;
          return (
            <Card className="p-4 space-y-2">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold">Financeiro (TOTVS) — ObraFlow</h2>
                <FlagStatus enabled={finFlag.enabled} loading={finFlag.isLoading} />
              </div>
              {!data ? (
                <p className="text-sm text-muted-foreground">
                  Sem lançamentos financeiros nesta obra.
                </p>
              ) : (
                <dl className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                  <Metric label="Lançamentos" value={data.lancamentos_total} />
                  <Metric label="Abertos" value={data.lancamentos_abertos} />
                  <Metric label="Baixados" value={data.lancamentos_baixados} />
                  <Metric label="Fornecedores" value={data.fornecedores_distintos} />
                  <Metric label="Valor total" value={brl(data.valor_total)} />
                  <Metric label="Valor aberto" value={brl(data.valor_aberto)} />
                  <Metric label="Pend. natureza" value={data.pendentes_natureza} />
                  <Metric label="Última emissão" value={fmtDate(data.ultima_emissao)} />
                </dl>
              )}
              <p className="text-xs text-muted-foreground pt-2">
                Compare com o relatório TOTVS da obra (mesma data-base do último snapshot).
                Aceitável: diferença ≤ 0,5% do valor aberto.
              </p>
            </Card>
          );
        }}
      </QueryState>

      <QueryState
        isLoading={pontoQ.isLoading}
        isError={pontoQ.isError}
        error={pontoQ.error}
        data={pontoQ.data}
        onRetry={() => pontoQ.refetch()}
      >
        {(raw) => {
          const data = raw as Record<string, unknown> | null;
          return (
            <Card className="p-4 space-y-2">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold">Ponto — ObraFlow</h2>
                <FlagStatus enabled={pontoFlag.enabled} loading={pontoFlag.isLoading} />
              </div>
              {!data ? (
                <p className="text-sm text-muted-foreground">Sem registros de ponto nesta obra.</p>
              ) : (
                <dl className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                  <Metric label="Colaboradores" value={data.colaboradores_distintos} />
                  <Metric label="Registros" value={data.registros_total} />
                  <Metric label="Registros (30d)" value={data.registros_30d} />
                  <Metric label="Tratativas" value={data.tratativas} />
                  <Metric label="Marcações inválidas" value={data.invalidas} />
                  <Metric label="Último registro" value={fmtDate(data.ultimo_registro)} />
                </dl>
              )}
              <p className="text-xs text-muted-foreground pt-2">
                Antes de desligar o Checklist Fácil: zero marcações inválidas em aberto e tratativas{" "}
                {"="} pendências do legado.
              </p>
            </Card>
          );
        }}
      </QueryState>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: unknown }) {
  return (
    <div className="border border-border rounded p-2">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="font-bold tabular-nums">
        {value === null || value === undefined ? "—" : String(value)}
      </div>
    </div>
  );
}
function FlagStatus({ enabled, loading }: { enabled: boolean; loading: boolean }) {
  if (loading)
    return (
      <Badge variant="outline" className="text-xs">
        …
      </Badge>
    );
  return enabled ? (
    <Badge variant="outline" className="text-xs">
      Importador legado: ON
    </Badge>
  ) : (
    <Badge variant="default" className="bg-success hover:bg-success text-xs">
      Importador legado: OFF
    </Badge>
  );
}
function fmtDate(v: unknown): string {
  if (!v || typeof v !== "string") return "—";
  const d = new Date(v);
  return isNaN(d.getTime()) ? "—" : fmtDataLocal(d);
}
function pct(v: unknown): string {
  if (v === null || v === undefined) return "—";
  const n = Number(v);
  return isNaN(n) ? "—" : `${n.toFixed(1)}%`;
}
function brl(v: unknown): string {
  return formatBRL(v as number | string | null | undefined);
}

