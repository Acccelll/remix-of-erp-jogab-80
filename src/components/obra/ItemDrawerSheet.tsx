/**
 * Drawer canônico de uma linha do cronograma (EDT).
 *
 * Abre quando o `ObraSelecaoContext` tem um `selectedItemId`. Estado
 * (`?item`, `?dview`) vive na URL via o provider. Substitui o antigo
 * `VizinhancaSheet` movendo predecessoras/sucessoras para a aba
 * "Resumo" e concentrando os recursos da atividade na aba "Recursos".
 *
 * Lógica de CPM/cascata/lead-times é apenas consumida — nada é
 * recalculado aqui.
 */

import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowDown, ArrowRight, ArrowUp, Focus, Inbox, Plus, Package } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useObraSelecao } from "@/components/obra/ObraSelecaoContext";
type ItemDrawerView = string;
import { useObraPermissions } from "@/components/obra/ObraPermissionsContext";
import { RecursoStatusBadge, type RecursosStatus } from "@/components/cards/RecursoStatusBadge";
import { AdicionarRecursoDialog } from "@/components/cards/AdicionarRecursoDialog";
import { CardRecursoDialog } from "@/components/cards/CardRecursoDialog";
import { usePermissions } from "@/contexts/auth/usePermissions";
import { brl } from "@/lib/billing";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

type Item = {
  id: string;
  uid_mpp: string | null;
  ordem: number | null;
  descricao: string | null;
  data_inicio: string | null;
  data_fim: string | null;
  critico: boolean | null;
  percentual_previsto: number | null;
  percentual_realizado: number | null;
  custo: number | null;
  custo_baseline: number | null;
  recursos_status: string | null;
  recursos_count: number | null;
  folga_dias: number | null;
  folga_livre_dias: number | null;
  fanout_sucessoras: number | null;
  importancia_classe: string | null;
  importancia_score: number | null;
};

type Dep = {
  item_id: string;
  predecessor_item_id: string | null;
  predecessor_uid_mpp: string | null;
  tipo: string | null;
  lag_dias: number | null;
};

function fmtData(d?: string | null) {
  if (!d) return "—";
  try {
    return format(parseISO(d), "dd/MM/yyyy", { locale: ptBR });
  } catch {
    return d;
  }
}
function tipoLegivel(t: string | null | undefined) {
  switch ((t ?? "FS").toUpperCase()) {
    case "FS":
      return "Término → Início";
    case "SS":
      return "Início → Início";
    case "FF":
      return "Término → Término";
    case "SF":
      return "Início → Término";
    default:
      return t ?? "FS";
  }
}
function classeVariant(c: string | null | undefined) {
  switch (c) {
    case "Crítica":
      return "destructive" as const;
    case "Alta":
      return "default" as const;
    case "Média":
      return "secondary" as const;
    default:
      return "outline" as const;
  }
}

export function ItemDrawerSheet({ obraId }: { obraId: string }) {
  const { selectedItemId, setSelectedItemId, drawerView, setDrawerView } = useObraSelecao() as any;
  const { canEdit } = useObraPermissions();
  const { hasAccess } = usePermissions();
  const podeAdicionar = canEdit && hasAccess("obras_div", "editar");
  const open = !!selectedItemId;
  const [criando, setCriando] = useState(false);
  const [cardAberto, setCardAberto] = useState<string | null>(null);
  const qc = useQueryClient();

  const { data: itens } = useQuery({
    queryKey: ["drawer-itens", obraId],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cronograma_itens")
        .select(
          "id, uid_mpp, ordem, descricao, data_inicio, data_fim, critico, percentual_previsto, percentual_realizado, custo, custo_baseline, recursos_status, recursos_count, folga_dias, folga_livre_dias, fanout_sucessoras, importancia_classe, importancia_score",
        )
        .eq("obra_id", obraId);
      if (error) throw error;
      return (data ?? []) as unknown as Item[];
    },
  });

  const { data: deps } = useQuery({
    queryKey: ["drawer-deps", obraId],
    enabled: open,
    queryFn: async () => {
      // TODO(ARC-001/E-01): coluna `predecessor_item_id` ausente em cronograma_dependencias (schema tem apenas `predecessor_uid_mpp`).
      const { data } = await (supabase as any)
        .from("cronograma_dependencias")
        .select("item_id, predecessor_item_id, predecessor_uid_mpp, tipo, lag_dias")
        .eq("obra_id", obraId);
      return (data ?? []) as Dep[];
    },
  });

  const { data: cards } = useQuery({
    queryKey: ["drawer-cards", selectedItemId],
    enabled: open && !!selectedItemId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cards")
        .select(
          "id, numero, titulo, status, card_recursos(tipo_recurso, prazo_notif_compras, prazo_pedido, prazo_prod_iniciar, prazo_notif_producao, data_necessidade_obra, valor_oc)",
        )
        .eq("cronograma_item_id", selectedItemId!)
        .eq("arquivado", false)
        .order("numero");
      if (error) throw error;
      return data ?? [];
    },
  });

  const byId = useMemo(() => {
    const m = new Map<string, Item>();
    for (const i of itens ?? []) m.set(i.id, i);
    return m;
  }, [itens]);

  const atual = selectedItemId ? (byId.get(selectedItemId) ?? null) : null;
  const preds = useMemo(
    () => (deps ?? []).filter((d) => d.item_id === selectedItemId),
    [deps, selectedItemId],
  );
  const sucs = useMemo(
    () =>
      (deps ?? []).filter(
        (d) =>
          d.predecessor_item_id === selectedItemId ||
          (!!atual?.uid_mpp && d.predecessor_uid_mpp === atual.uid_mpp),
      ),
    [deps, selectedItemId, atual?.uid_mpp],
  );

  const pctPrev = Number(atual?.percentual_previsto ?? 0);
  const pctReal = Number(atual?.percentual_realizado ?? 0);
  const base = Number(atual?.custo_baseline ?? atual?.custo ?? 0);
  const executado = base > 0 ? (base * pctReal) / 100 : 0;
  const saldo = base > 0 ? base - executado : 0;

  const hoje = new Date().toISOString().slice(0, 10);
  const atrasado = !!atual?.data_fim && atual.data_fim < hoje && pctReal < 100;

  const recursosStatus = (atual?.recursos_status ?? "sem_recursos") as RecursosStatus;
  const recursosCount = Number(atual?.recursos_count ?? 0);

  return (
    <>
      <Sheet
        open={open}
        onOpenChange={(o) => {
          if (!o) setSelectedItemId(null);
        }}
      >
        <SheetContent side="right" className="w-full sm:max-w-[560px] p-0 flex flex-col">
          <SheetHeader className="px-5 pt-5 pb-3 border-b">
            <SheetTitle className="text-base flex items-start gap-2">
              <span className="text-muted-foreground text-xs tabular-nums shrink-0 mt-0.5">
                #{atual?.ordem ?? "—"}
              </span>
              <span className="flex-1">{atual?.descricao ?? "Item do cronograma"}</span>
            </SheetTitle>
            <div className="flex flex-wrap items-center gap-2 mt-1">
              {atual?.critico && (
                <Badge variant="destructive" className="text-[10px]">
                  Crítico
                </Badge>
              )}
              {atual?.importancia_classe && (
                <Badge variant={classeVariant(atual.importancia_classe)} className="text-[10px]">
                  {atual.importancia_classe}
                </Badge>
              )}
              <RecursoStatusBadge status={recursosStatus} count={recursosCount} />
              {atrasado && (
                <Badge
                  variant="outline"
                  className="text-[10px] border-destructive/40 text-destructive"
                >
                  Atrasada
                </Badge>
              )}
            </div>
          </SheetHeader>

          <Tabs
            value={drawerView}
            onValueChange={(v) => setDrawerView(v as ItemDrawerView)}
            className="flex-1 flex flex-col min-h-0"
          >
            <TabsList className="mx-5 mt-3 grid w-[calc(100%-2.5rem)] grid-cols-2">
              <TabsTrigger value="resumo">Resumo</TabsTrigger>
              <TabsTrigger value="recursos" aria-label="Recursos da atividade">
                Recursos
                {recursosCount > 0 && (
                  <span className="ml-1.5 text-[10px] text-muted-foreground tabular-nums">
                    · {recursosCount}
                  </span>
                )}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="resumo" className="flex-1 min-h-0 m-0">
              <ScrollArea className="h-full">
                <div className="px-5 py-4 space-y-5">
                  {/* Datas */}
                  <section aria-label="Datas e progresso">
                    <h4 className="text-xs font-medium text-muted-foreground mb-2">Período</h4>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <Info label="Início" value={fmtData(atual?.data_inicio)} />
                      <Info
                        label="Término"
                        value={fmtData(atual?.data_fim)}
                        valueClassName={atrasado ? "text-destructive font-medium" : undefined}
                      />
                      <Info label="% previsto" value={`${pctPrev.toFixed(2)}%`} />
                      <Info
                        label="% realizado"
                        value={`${pctReal.toFixed(2)}%`}
                        valueClassName={pctReal > 0 ? "text-success font-medium" : undefined}
                      />
                    </div>
                    <div className="mt-3">
                      <div
                        className="relative h-2 w-full rounded bg-muted overflow-hidden"
                        aria-label={`Progresso: ${pctReal.toFixed(0)} por cento de ${pctPrev.toFixed(0)} previsto`}
                      >
                        <div
                          className="absolute inset-y-0 left-0 bg-muted-foreground/30"
                          style={{ width: `${Math.min(100, pctPrev)}%` }}
                        />
                        <div
                          className="absolute inset-y-0 left-0 bg-success"
                          style={{ width: `${Math.min(100, pctReal)}%` }}
                        />
                      </div>
                    </div>
                  </section>

                  {/* Valores */}
                  <section aria-label="Valores">
                    <h4 className="text-xs font-medium text-muted-foreground mb-2">Valores</h4>
                    <div className="grid grid-cols-3 gap-2 text-xs">
                      <Info label="Orçado" value={base > 0 ? brl(base) : "—"} />
                      <Info label="Executado" value={base > 0 ? brl(executado) : "—"} />
                      <Info label="Saldo" value={base > 0 ? brl(saldo) : "—"} />
                    </div>
                  </section>

                  {/* Folgas / Fan-out */}
                  <section aria-label="Folga e fan-out">
                    <h4 className="text-xs font-medium text-muted-foreground mb-2">Rede</h4>
                    <div className="grid grid-cols-3 gap-2 text-xs">
                      <Info label="Folga total" value={`${atual?.folga_dias ?? "—"} d`} />
                      <Info label="Folga livre" value={`${atual?.folga_livre_dias ?? "—"} d`} />
                      <Info label="Fan-out" value={String(atual?.fanout_sucessoras ?? 0)} />
                    </div>
                  </section>

                  <Separator />

                  <DepSection
                    titulo="Predecessoras"
                    icone={<ArrowUp className="h-3.5 w-3.5" aria-hidden />}
                    ajuda="Itens que precisam ocorrer antes deste."
                    vazio="Sem predecessoras — este item pode iniciar livremente."
                    deps={preds}
                    lookupId={(d) => d.predecessor_item_id}
                    fallbackUid={(d) => d.predecessor_uid_mpp}
                    byId={byId}
                    onSelect={setSelectedItemId}
                  />
                  <Separator />
                  <DepSection
                    titulo="Sucessoras"
                    icone={<ArrowDown className="h-3.5 w-3.5" aria-hidden />}
                    ajuda="Itens que dependem deste para iniciar ou terminar."
                    vazio="Sem sucessoras — nada depende deste item."
                    deps={sucs}
                    lookupId={(d) => d.item_id}
                    fallbackUid={() => null}
                    byId={byId}
                    onSelect={setSelectedItemId}
                  />
                </div>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="recursos" className="flex-1 min-h-0 m-0">
              <div className="px-5 pt-3 pb-2 flex items-center justify-between border-b">
                <p className="text-xs text-muted-foreground">
                  {cards?.length ?? 0} recurso(s) vinculado(s) à atividade.
                </p>
                {podeAdicionar && atual?.data_inicio && (
                  <Button
                    size="sm"
                    variant="default"
                    className="gap-1"
                    onClick={() => setCriando(true)}
                  >
                    <Plus className="h-4 w-4" aria-hidden /> Nova solicitação
                  </Button>
                )}
              </div>
              <ScrollArea className="flex-1">
                <ul className="px-5 py-3 space-y-2">
                  {(!cards || cards.length === 0) && (
                    <li className="rounded-md border border-dashed p-6 text-center space-y-3">
                      <Package className="h-6 w-6 mx-auto text-muted-foreground" aria-hidden />
                      <div className="text-sm text-muted-foreground">
                        Nenhum recurso vinculado a esta atividade.
                      </div>
                      {podeAdicionar && atual?.data_inicio && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setCriando(true)}
                          className="gap-1"
                        >
                          <Plus className="h-4 w-4" aria-hidden /> Adicionar o primeiro recurso
                        </Button>
                      )}
                    </li>
                  )}
                  {cards?.map((c: any) => {
                    const r = Array.isArray(c.card_recursos) ? c.card_recursos[0] : c.card_recursos;
                    return (
                      <li key={c.id}>
                        <button
                          onClick={() => setCardAberto(c.id)}
                          className="w-full text-left rounded-md border p-2.5 hover:bg-muted/40 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-mono text-muted-foreground">
                              #{c.numero}
                            </span>
                            <Badge variant="outline" className="text-[10px]">
                              {c.status}
                            </Badge>
                          </div>
                          <div className="mt-1 text-sm font-medium line-clamp-1">{c.titulo}</div>
                          {r && (
                            <div className="mt-1 text-xs text-muted-foreground flex flex-wrap gap-x-3">
                              <span>tipo: {r.tipo_recurso}</span>
                              <span>necessidade: {fmtData(r.data_necessidade_obra)}</span>
                              <span>pedido: {fmtData(r.prazo_pedido)}</span>
                            </div>
                          )}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </ScrollArea>
            </TabsContent>
          </Tabs>
        </SheetContent>
      </Sheet>

      {criando && atual?.data_inicio && (
        <AdicionarRecursoDialog
          {...({} as any)}
          open={criando}
          onOpenChange={(v) => {
            if (!v) {
              setCriando(false);
              qc.invalidateQueries({ queryKey: ["drawer-cards", selectedItemId] });
              qc.invalidateQueries({ queryKey: ["drawer-itens", obraId] });
              qc.invalidateQueries({ queryKey: ["crono", obraId] });
              qc.invalidateQueries({ queryKey: ["cascata-por-item", obraId] });
            }
          }}
          obraId={obraId}
          item={{
            id: atual.id,
            descricao: atual.descricao ?? undefined,
            data_inicio: atual.data_inicio,
          }}
          canCreate={podeAdicionar}
        />
      )}

      {cardAberto && (
        <CardRecursoDialog
          {...({} as any)}
          open={!!cardAberto}
          onOpenChange={(v) => !v && setCardAberto(null)}
          cardId={cardAberto}
          obraCanEdit={canEdit}
        />
      )}
    </>
  );
}

function Info({
  label,
  value,
  valueClassName,
}: {
  label: string;
  value: string;
  valueClassName?: string;
}) {
  const id = `info-${label.replace(/\s+/g, "-").toLowerCase()}`;
  return (
    <div role="group" aria-labelledby={id}>
      <div id={id} className="text-muted-foreground">
        {label}
      </div>
      <div className={`tabular-nums font-medium ${valueClassName ?? ""}`}>{value}</div>
    </div>
  );
}

function DepSection({
  titulo,
  icone,
  ajuda,
  vazio,
  deps,
  lookupId,
  fallbackUid,
  byId,
  onSelect,
}: {
  titulo: string;
  icone: React.ReactNode;
  ajuda: string;
  vazio: string;
  deps: Dep[];
  lookupId: (d: Dep) => string | null;
  fallbackUid: (d: Dep) => string | null;
  byId: Map<string, Item>;
  onSelect: (id: string | null) => void;
}) {
  return (
    <section aria-label={titulo}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2 text-sm font-medium">
          {icone} {titulo}
          <span className="text-muted-foreground text-xs">· {deps.length}</span>
        </div>
      </div>
      <p className="text-[11px] text-muted-foreground mb-2">{ajuda}</p>
      {deps.length === 0 ? (
        <div className="flex items-center gap-2 text-xs text-muted-foreground border rounded p-3 bg-muted/20">
          <Inbox className="h-3.5 w-3.5" aria-hidden /> {vazio}
        </div>
      ) : (
        <ul className="space-y-2">
          {deps.map((d, idx) => {
            const id = lookupId(d);
            const it = id ? (byId.get(id) ?? null) : null;
            const lag = d.lag_dias ?? 0;
            return (
              <li key={idx} className="border rounded p-2.5 hover:bg-muted/30 transition-colors">
                <div className="flex items-start gap-2">
                  <button
                    type="button"
                    onClick={() => id && onSelect(id)}
                    disabled={!id}
                    className="flex-1 min-w-0 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
                    aria-label={`Abrir ${it?.descricao ?? "item vinculado"}`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[10px] tabular-nums text-muted-foreground shrink-0">
                        #{it?.ordem ?? "?"}
                      </span>
                      <span
                        className="text-sm font-medium truncate"
                        title={it?.descricao ?? undefined}
                      >
                        {it?.descricao ??
                          (fallbackUid(d) ? `UID ${fallbackUid(d)}` : "Item desconhecido")}
                      </span>
                      {it?.critico && (
                        <Badge variant="destructive" className="text-[9px] px-1 py-0">
                          crit
                        </Badge>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
                      <Badge variant="outline" className="text-[10px] font-normal">
                        {(d.tipo ?? "FS").toUpperCase()} · {tipoLegivel(d.tipo)}
                      </Badge>
                      {lag !== 0 && (
                        <Badge variant="secondary" className="text-[10px] font-normal">
                          lag {lag > 0 ? `+${lag}` : lag}d
                        </Badge>
                      )}
                      <span className="inline-flex items-center gap-1">
                        {fmtData(it?.data_inicio)}
                        <ArrowRight className="h-3 w-3" aria-hidden />
                        {fmtData(it?.data_fim)}
                      </span>
                    </div>
                  </button>
                  {id && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 px-2 shrink-0"
                      onClick={() => onSelect(id)}
                      aria-label="Focar este item no drawer"
                    >
                      <Focus className="h-3.5 w-3.5" aria-hidden />
                    </Button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
