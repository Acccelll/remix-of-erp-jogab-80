import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PaginationControls } from "@/components/common/PaginationControls";
import { Filter, X, Building2, UserMinus, History } from "lucide-react";
import { Colaborador, HistoricoEntry, Obra, PeriodoAlocacao } from "@/types";
import CollapsibleSection from "@/components/common/CollapsibleSection";
import { cn } from "@/lib/utils";
import {
  classificarEvento,
  rotuloStatus,
  statusAtualColaborador,
  STATUS_DOT_CLASSES,
  STATUS_TONE_CLASSES,
} from "@/lib/rh/statusHistorico";

const PAGE_SIZE = 20;

interface Props {
  colab: Colaborador;
  /** Períodos fechados vindos da rota `mobilizacoesPeriodos`. */
  mobPeriodos?: PeriodoAlocacao[];
  obras: Obra[];
}

const MESES = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

/** Normaliza para `yyyy-mm-dd`; aceita ISO com hora. Retorna "" se inválido. */
function toISODate(input?: string | null): string {
  if (!input) return "";
  const m = String(input).match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : "";
}

function formatBR(iso: string): string {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso;
}

/**
 * Ordena por data descendente com desempate estável pelo id. O comparador
 * precisa ser total: devolver sempre ±1 para empates (como antes) deixa a ordem
 * de eventos na mesma data à mercê do algoritmo de sort.
 */
function porDataDesc<T extends { data_inicio?: string; data?: string; id: string }>(
  a: T,
  b: T,
): number {
  const da = a.data_inicio ?? a.data ?? "";
  const db = b.data_inicio ?? b.data ?? "";
  if (da !== db) return db.localeCompare(da);
  return b.id.localeCompare(a.id);
}

const HistoricoSection: React.FC<Props> = ({ colab, mobPeriodos, obras }) => {
  const [filtroObra, setFiltroObra] = useState<string>("all");
  const [filtroMes, setFiltroMes] = useState<string>("all");
  const [filtroAno, setFiltroAno] = useState<string>("all");
  const [filtroTipo, setFiltroTipo] = useState<string>("all");
  const [pageMob, setPageMob] = useState<number>(1);
  const [pageEventos, setPageEventos] = useState<number>(1);

  // ── Períodos de alocação ──────────────────────────────────────────────
  // Vêm prontos do backend (início, fim e dias calculados em SQL com LEAD).
  // Períodos de status não são períodos de obra: quem está de férias, folga ou
  // afastado não aparece em "Mobilizações".
  const periodos = useMemo<PeriodoAlocacao[]>(() => {
    const lista = Array.isArray(mobPeriodos) ? mobPeriodos : [];
    return lista.filter((p) => !p.substituido).sort(porDataDesc);
  }, [mobPeriodos]);

  const periodosObra = useMemo(() => periodos.filter((p) => p.tipo === "obra"), [periodos]);
  const periodosStatus = useMemo(() => periodos.filter((p) => p.tipo === "status"), [periodos]);

  // ── Eventos ───────────────────────────────────────────────────────────
  // Tudo que não é período: trocas de status, inativação, reativação,
  // cadastro e eventos de texto livre.
  const eventos = useMemo<HistoricoEntry[]>(() => {
    return (colab.historico || [])
      .filter((h) => h.tipo !== "mobilizacao")
      .map((h) => ({ ...h, data: toISODate(h.data) || h.data }))
      .sort(porDataDesc);
  }, [colab.historico]);

  const anosDisponiveis = useMemo(() => {
    const anos = new Set<number>();
    const registra = (d?: string | null) => {
      const iso = toISODate(d);
      if (iso) anos.add(Number(iso.slice(0, 4)));
    };
    periodos.forEach((p) => registra(p.data_inicio));
    eventos.forEach((e) => registra(e.data));
    return Array.from(anos)
      .filter((a) => !Number.isNaN(a))
      .sort((a, b) => b - a);
  }, [periodos, eventos]);

  const obrasNoHistorico = useMemo(() => {
    const ids = new Set<string>();
    periodos.forEach((p) => p.obra_id && ids.add(p.obra_id));
    eventos.forEach((e) => {
      if (e.obraOrigemId) ids.add(e.obraOrigemId);
      if (e.obraDestinoId) ids.add(e.obraDestinoId);
    });
    return obras.filter((o) => ids.has(o.id));
  }, [periodos, eventos, obras]);

  const passaTempo = useCallback(
    (iso: string) => {
      const d = toISODate(iso);
      if (!d) return filtroAno === "all" && filtroMes === "all";
      if (filtroAno !== "all" && Number(d.slice(0, 4)) !== Number(filtroAno)) return false;
      if (filtroMes !== "all" && Number(d.slice(5, 7)) - 1 !== Number(filtroMes)) return false;
      return true;
    },
    [filtroAno, filtroMes],
  );

  const periodosObraFiltrados = useMemo(
    () =>
      periodosObra.filter((p) => {
        if (filtroTipo !== "all" && filtroTipo !== "mobilizacao") return false;
        if (filtroObra !== "all" && p.obra_id !== filtroObra) return false;
        return passaTempo(p.data_inicio);
      }),
    [periodosObra, filtroObra, filtroTipo, passaTempo],
  );

  const periodosStatusFiltrados = useMemo(
    () =>
      periodosStatus.filter((p) => {
        if (filtroTipo !== "all" && filtroTipo !== "status") return false;
        if (filtroObra !== "all") return false; // período de status não tem obra
        return passaTempo(p.data_inicio);
      }),
    [periodosStatus, filtroObra, filtroTipo, passaTempo],
  );

  const eventosFiltrados = useMemo(
    () =>
      eventos.filter((e) => {
        if (filtroTipo !== "all") {
          if (filtroTipo === "status" && e.tipo !== "status") return false;
          if (filtroTipo === "mobilizacao") return false;
          if (filtroTipo === "outro" && e.tipo === "status") return false;
        }
        if (filtroObra !== "all" && e.obraOrigemId !== filtroObra && e.obraDestinoId !== filtroObra)
          return false;
        return passaTempo(e.data);
      }),
    [eventos, filtroObra, filtroTipo, passaTempo],
  );

  // Afastamentos ganham seção própria — antes ela era inalcançável porque nada
  // no sistema produzia o tipo que a alimentava.
  const afastamentos = useMemo(
    () => periodosStatusFiltrados.filter((p) => p.status === "afastamento"),
    [periodosStatusFiltrados],
  );

  useEffect(() => {
    setPageMob(1);
    setPageEventos(1);
  }, [filtroObra, filtroMes, filtroAno, filtroTipo]);

  // Paginação por seção. Fatiar a lista unificada antes de agrupar, como antes,
  // fazia "Outros eventos" aparecer vazio quando as mobilizações enchiam a
  // página — e o card "Mais recente" passava a ser o mais recente da página.
  const totalPagesMob = Math.max(1, Math.ceil(periodosObraFiltrados.length / PAGE_SIZE));
  const pageMobAtual = Math.min(pageMob, totalPagesMob);
  const periodosPagina = periodosObraFiltrados.slice(
    (pageMobAtual - 1) * PAGE_SIZE,
    pageMobAtual * PAGE_SIZE,
  );

  const totalPagesEventos = Math.max(1, Math.ceil(eventosFiltrados.length / PAGE_SIZE));
  const pageEventosAtual = Math.min(pageEventos, totalPagesEventos);
  const eventosPagina = eventosFiltrados.slice(
    (pageEventosAtual - 1) * PAGE_SIZE,
    pageEventosAtual * PAGE_SIZE,
  );

  // Dias em obra e dias em status são grandezas diferentes e não devem somar:
  // antes, férias e folga entravam no mesmo total que os dias trabalhados.
  const diasEmObra = periodosObraFiltrados.reduce((s, p) => s + (p.dias || 0), 0);
  const diasEmStatus = periodosStatusFiltrados.reduce((s, p) => s + (p.dias || 0), 0);

  const clearFilters = () => {
    setFiltroObra("all");
    setFiltroMes("all");
    setFiltroAno("all");
    setFiltroTipo("all");
  };

  const hasFilters =
    filtroObra !== "all" || filtroMes !== "all" || filtroAno !== "all" || filtroTipo !== "all";

  const statusAtual = statusAtualColaborador(colab);
  const vazio =
    periodosObraFiltrados.length === 0 &&
    periodosStatusFiltrados.length === 0 &&
    eventosFiltrados.length === 0;

  const [atual, ...anteriores] = periodosPagina;

  return (
    <div className="space-y-6">
      {/* Situação atual — sempre visível. Antes só aparecia dentro da seção
          "Outros eventos", que é colapsada e condicional. */}
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border bg-muted/20">
        <span className="text-sm text-muted-foreground">Situação atual</span>
        <Badge
          variant="outline"
          className={cn("text-xs font-medium", STATUS_TONE_CLASSES[statusAtual.tone])}
        >
          {statusAtual.label}
        </Badge>
      </div>

      {/* Filtros */}
      <div className="p-3 rounded-lg border border-border bg-muted/30">
        <div className="flex items-center gap-2 mb-3">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-semibold">Filtros</span>
          {hasFilters && (
            <Button
              variant="ghost"
              size="sm"
              className="ml-auto h-7 text-xs"
              onClick={clearFilters}
            >
              <X className="h-3 w-3 mr-1" /> Limpar
            </Button>
          )}
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div>
            <Label className="text-xs">Obra</Label>
            <Select value={filtroObra} onValueChange={setFiltroObra}>
              <SelectTrigger className="mt-1 h-9 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as obras</SelectItem>
                {obrasNoHistorico.map((o) => (
                  <SelectItem key={o.id} value={o.id}>
                    {o.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Mês</Label>
            <Select value={filtroMes} onValueChange={setFiltroMes}>
              <SelectTrigger className="mt-1 h-9 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os meses</SelectItem>
                {MESES.map((m, i) => (
                  <SelectItem key={i} value={String(i)}>
                    {m}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Ano</Label>
            <Select value={filtroAno} onValueChange={setFiltroAno}>
              <SelectTrigger className="mt-1 h-9 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os anos</SelectItem>
                {anosDisponiveis.map((a) => (
                  <SelectItem key={a} value={String(a)}>
                    {a}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Tipo</Label>
            <Select value={filtroTipo} onValueChange={setFiltroTipo}>
              <SelectTrigger className="mt-1 h-9 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os tipos</SelectItem>
                <SelectItem value="mobilizacao">Mobilizações</SelectItem>
                <SelectItem value="status">Férias / folga / afastamento</SelectItem>
                <SelectItem value="outro">Outros eventos</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Mobilizações — apenas períodos em obra */}
      {periodosObraFiltrados.length > 0 && (
        <CollapsibleSection
          storageKey="historico:mobilizacoes"
          title={
            <span className="flex items-center gap-2">
              <Building2 className="h-4 w-4" /> Mobilizações
            </span>
          }
          headerExtra={
            <span className="flex items-center gap-2">
              <Badge variant="secondary" className="text-xs">
                {periodosObraFiltrados.length} período(s) — {diasEmObra} dias em obra
              </Badge>
              {diasEmStatus > 0 && (
                <Badge variant="outline" className="text-[10px]">
                  +{diasEmStatus}d fora de obra
                </Badge>
              )}
            </span>
          }
        >
          <div className="space-y-3">
            {atual && (
              <Card className="border-primary/40">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-muted-foreground flex items-center justify-between">
                    <span>{atual.obra_nome || "Obra"}</span>
                    {pageMobAtual === 1 && (
                      <Badge variant="default" className="text-[10px]">
                        Mais recente
                      </Badge>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold">{atual.dias} dias</p>
                  <p className="text-sm text-muted-foreground">
                    {formatBR(atual.data_inicio)} —{" "}
                    {atual.data_fim ? formatBR(atual.data_fim) : "Atual"}
                  </p>
                </CardContent>
              </Card>
            )}

            {anteriores.length > 0 && (
              <details className="group rounded-md border border-border">
                <summary className="cursor-pointer list-none px-3 py-2 text-xs font-medium text-muted-foreground hover:bg-muted/40 flex items-center justify-between">
                  <span>Ver histórico anterior ({anteriores.length})</span>
                  <span className="transition-transform group-open:rotate-90">›</span>
                </summary>
                <div className="divide-y divide-border">
                  {anteriores.map((p) => (
                    <div
                      key={p.id}
                      className="px-3 py-2 text-xs flex items-center justify-between gap-3"
                    >
                      <span className="font-medium truncate">{p.obra_nome || "Obra"}</span>
                      <span className="text-muted-foreground whitespace-nowrap">
                        {formatBR(p.data_inicio)} — {p.data_fim ? formatBR(p.data_fim) : "Atual"}
                      </span>
                      <span className="tabular-nums text-muted-foreground whitespace-nowrap">
                        {p.dias}d
                      </span>
                    </div>
                  ))}
                </div>
              </details>
            )}
          </div>

          <PaginationControls
            page={pageMobAtual}
            totalItems={periodosObraFiltrados.length}
            pageSize={PAGE_SIZE}
            onPageChange={setPageMob}
            className="pt-2 mt-3 border-t border-border text-xs"
          />
        </CollapsibleSection>
      )}

      {/* Períodos fora de obra */}
      {periodosStatusFiltrados.length > 0 && (
        <CollapsibleSection
          storageKey="historico:status"
          defaultOpen={false}
          title={
            <span className="flex items-center gap-2">
              <UserMinus className="h-4 w-4" /> Férias, folga e afastamento
            </span>
          }
          headerExtra={
            <Badge variant="secondary" className="text-xs">
              {periodosStatusFiltrados.length} período(s) — {diasEmStatus} dias
            </Badge>
          }
        >
          <div className="space-y-2">
            {periodosStatusFiltrados.map((p) => {
              const st = rotuloStatus(p.status ?? "");
              return (
                <div key={p.id} className="flex gap-3 p-3 rounded-lg border border-border">
                  <div
                    className={cn("w-2 h-2 rounded-full mt-1.5 shrink-0", STATUS_DOT_CLASSES[st.tone])}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge
                        variant="outline"
                        className={cn("text-[10px] font-medium", STATUS_TONE_CLASSES[st.tone])}
                      >
                        {st.label}
                      </Badge>
                      <span className="text-sm tabular-nums">{p.dias} dias</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {formatBR(p.data_inicio)} — {p.data_fim ? formatBR(p.data_fim) : "Atual"}
                      {p.usuario_nome && ` — por ${p.usuario_nome}`}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
          {afastamentos.length > 0 && (
            <p className="text-xs text-muted-foreground mt-3">
              {afastamentos.length} afastamento(s) no período filtrado.
            </p>
          )}
        </CollapsibleSection>
      )}

      {/* Outros eventos — trocas de status, inativação, reativação, cadastro */}
      {eventosFiltrados.length > 0 && (
        <CollapsibleSection
          storageKey="historico:outros"
          defaultOpen
          title={
            <span className="flex items-center gap-2">
              <History className="h-4 w-4" /> Outros eventos
            </span>
          }
          headerExtra={
            <Badge variant="secondary" className="text-xs">
              {eventosFiltrados.length}
            </Badge>
          }
        >
          <div className="space-y-2">
            {eventosPagina.map((h) => {
              const st = classificarEvento(h);
              return (
                <div key={h.id} className="flex gap-3 p-3 rounded-lg border border-border">
                  <div
                    className={cn(
                      "w-2 h-2 rounded-full mt-1.5 shrink-0",
                      st ? STATUS_DOT_CLASSES[st.tone] : "bg-primary",
                    )}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      {st && (
                        <Badge
                          variant="outline"
                          className={cn(
                            "text-[10px] font-medium shrink-0",
                            STATUS_TONE_CLASSES[st.tone],
                          )}
                        >
                          {st.label}
                        </Badge>
                      )}
                      {st?.origem && st?.destino ? (
                        <span className="text-sm truncate">
                          {st.origem} <span className="text-muted-foreground">→</span> {st.destino}
                        </span>
                      ) : (
                        <span className="text-sm">{h.observacao || h.descricao}</span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {formatBR(h.data)}
                      {h.usuario && ` — por ${h.usuario}`}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>

          <PaginationControls
            page={pageEventosAtual}
            totalItems={eventosFiltrados.length}
            pageSize={PAGE_SIZE}
            onPageChange={setPageEventos}
            className="pt-2 mt-3 border-t border-border text-xs"
          />
        </CollapsibleSection>
      )}

      {vazio && (
        <p className="text-sm text-muted-foreground text-center py-8">
          Nenhum registro encontrado{hasFilters ? " com os filtros aplicados" : ""}.
        </p>
      )}
    </div>
  );
};

export default HistoricoSection;
