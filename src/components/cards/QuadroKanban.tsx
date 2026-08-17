/**
 * Quadro Kanban genérico para Compras e Produção.
 *
 * Lê cards do setor escolhido a partir das tabelas `cards`, `card_setores`
 * e `card_recursos`. Agrupa por `grupo_negociacao_id` (cards sem grupo
 * caem em "Sem negociação"). Colunas vêm do status_setor.
 *
 * Evita render O(n²): agrupamento feito uma vez via useMemo.
 */
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import {
  cardsQueryFns,
  useInsertCardComentario,
  useUpdateCardSetorStatusComSubsetor,
  useUpdateGrupoNegociacaoCards,
} from "@/hooks/quadros/useCards";
import { useCatalogos } from "@/contexts/catalogos/useCatalogos";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import ColumnFilter from "@/components/common/ColumnFilter";
import { CardRecursoDialog } from "@/components/cards/CardRecursoDialog";
import { GrupoNegociacaoSelect } from "@/components/cards/GrupoNegociacaoSelect";
import { useQuadroAutomacoesConfig } from "@/hooks/quadros/useQuadroAutomacoesConfig";
import {
  automacoesMovimentacaoQuadro,
  chaveExecucaoAutomacaoQuadro,
  listarRegrasAutomacaoQuadro,
} from "@/lib/cards/automacoesQuadro";
import { STORAGE_KEYS } from "@/lib/core/storage/keys";
import { cn } from "@/lib/utils";
import { ExternalLink, Search, Settings2, X } from "lucide-react";

type Setor = "Compras" | "Producao";

interface ColunaDef {
  key: string;
  label: string;
}

const COLUNAS_COMPRAS: ColunaDef[] = [
  { key: "identificado", label: "Identificado" },
  { key: "em_cotacao", label: "Em cotação" },
  { key: "pedido_emitido", label: "Pedido emitido" },
  { key: "materia_entregue", label: "Matéria entregue" },
];

const COLUNAS_PRODUCAO: ColunaDef[] = [
  { key: "aguardando_material", label: "Aguardando material" },
  { key: "em_fabricacao", label: "Em fabricação" },
  { key: "produzido", label: "Produzido" },
  { key: "entregue_obra", label: "Entregue à obra" },
];

interface CardRow {
  id: string;
  numero: number;
  titulo: string;
  obra_id: string | null;
  obra_nome: string | null;
  grupo_negociacao_id: string | null;
  status_setor: string;
  subsetor: string | null;
  tipo_recurso: string;
  prazo_pedido: string | null;
  data_necessidade_obra: string | null;
  valor_estimado: number | null;
  valor_oc: number | null;
  grupo_rotulo: string | null;
  compras_status: string | null;
}

function diasAte(iso: string | null): number | null {
  if (!iso) return null;
  const hoje = new Date();
  hoje.setUTCHours(0, 0, 0, 0);
  const d = new Date(iso + "T00:00:00Z");
  return Math.round((d.getTime() - hoje.getTime()) / 86_400_000);
}

function badgePrazo(dias: number | null) {
  if (dias === null) return null;
  let cls = "bg-success/15 text-success border-success/40";
  let label = `${dias}d`;
  if (dias < 0) {
    cls = "bg-destructive/15 text-destructive border-destructive/40";
    label = `${dias}d`;
  } else if (dias <= 3) {
    cls = "bg-destructive/15 text-destructive border-destructive/40";
  } else if (dias <= 7) {
    cls = "bg-orange-500/15 text-orange-600 dark:text-orange-400 border-orange-500/40";
  }
  return (
    <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0", cls)}>
      {label}
    </Badge>
  );
}

function lerAutomacoesExecutadas(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEYS.quadroAutomacoesExecutadas);
    const parsed = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(parsed) ? parsed.filter((v) => typeof v === "string") : []);
  } catch {
    return new Set();
  }
}

function salvarAutomacoesExecutadas(keys: Set<string>) {
  if (typeof window === "undefined") return;
  const compactado = Array.from(keys).slice(-1_000);
  window.localStorage.setItem(STORAGE_KEYS.quadroAutomacoesExecutadas, JSON.stringify(compactado));
}

export function QuadroKanban({
  setor,
  obraId,
  subsetor,
}: {
  setor: Setor;
  obraId?: string;
  subsetor?: string;
}) {
  const { obras } = useCatalogos();
  const qc = useQueryClient();
  const atribuirGrupoMut = useUpdateGrupoNegociacaoCards();
  const updateSetorStatusMut = useUpdateCardSetorStatusComSubsetor();
  const insertCardComentarioMut = useInsertCardComentario();
  const { regrasDesativadas, setRegraAtiva } = useQuadroAutomacoesConfig();
  const [cardAberto, setCardAberto] = useState<string | null>(null);
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const [draggedIds, setDraggedIds] = useState<string[]>([]);
  const [dragOverCol, setDragOverCol] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [hiddenColumns, setHiddenColumns] = useState<Set<string>>(new Set());

  function toggleSel(id: string) {
    setSelecionados((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function moverCardUnico(
    cardId: string,
    novoStatus: string,
    statusAtual: string,
    row: CardRow,
  ): Promise<boolean> {
    if (novoStatus === statusAtual) return false;
    // Regra: card manufaturado em Produção só pode avançar se Compras já entregou.
    if (
      setor === "Producao" &&
      row.tipo_recurso === "manufaturado" &&
      row.compras_status !== "materia_entregue"
    ) {
      const ordem = ["aguardando_material", "em_fabricacao", "produzido", "entregue_obra"];
      if (ordem.indexOf(novoStatus) > ordem.indexOf(statusAtual)) {
        toast.warning("Compras ainda não entregou a matéria-prima.", {
          action: {
            label: "Solicitar ao Compras",
            onClick: async () => {
              const { error } = await insertCardComentarioMut.mutateAsync({
                cardId,
                payload: {
                  card_id: cardId,
                  autor: "",
                  texto: `Produção solicita atualização de status ao Compras — aguardando avanço (status atual: ${row.compras_status ?? "—"}).`,
                },
              });
              if (error) toast.error(error.message);
              else toast.success("Solicitação enviada ao Compras");
            },
          },
        });
        return false;
      }
    }
    const { error } = await updateSetorStatusMut.mutateAsync({
      cardId,
      setor,
      subsetor: row.subsetor ?? null,
      statusSetor: novoStatus,
    });
    if (error) {
      toast.error("Falha ao mover card");
      return false;
    }
    await executarAutomacoesMovimentacao(row, novoStatus);
    qc.invalidateQueries({ queryKey: ["card-detail", cardId] });
    return true;
  }

  async function executarAutomacoesMovimentacao(row: CardRow, novoStatus: string) {
    const acoes = automacoesMovimentacaoQuadro({
      cardId: row.id,
      numero: row.numero,
      titulo: row.titulo,
      setor,
      deStatus: row.status_setor,
      paraStatus: novoStatus,
      tipoRecurso: row.tipo_recurso,
    }, {
      regrasDesativadas,
    });
    if (acoes.length === 0) return;

    const executadas = lerAutomacoesExecutadas();
    let aplicadas = 0;

    for (const acao of acoes) {
      const chave = chaveExecucaoAutomacaoQuadro(
        { cardId: row.id, setor, paraStatus: novoStatus },
        acao.id,
      );
      if (executadas.has(chave)) continue;

      const { error } = await insertCardComentarioMut.mutateAsync({
        cardId: row.id,
        payload: {
          card_id: row.id,
          autor: "Automação",
          texto: acao.texto,
        },
      });
      if (error) {
        toast.warning("Card movido, mas a automação não foi registrada.");
        continue;
      }
      executadas.add(chave);
      aplicadas += 1;
    }

    if (aplicadas > 0) {
      salvarAutomacoesExecutadas(executadas);
      toast.info(aplicadas === 1 ? "Automação aplicada" : `${aplicadas} automações aplicadas`);
    }
  }

  async function moverCards(cardIds: string[], novoStatus: string) {
    const rows = (data ?? []).filter(
      (r) => cardIds.includes(r.id) && r.status_setor !== novoStatus,
    );
    if (rows.length === 0) return;
    let ok = 0;
    for (const r of rows) {
      const moved = await moverCardUnico(r.id, novoStatus, r.status_setor, r);
      if (moved) ok++;
    }
    if (ok > 0) {
      toast.success(ok === 1 ? "Card movido" : `${ok} cards movidos`);
      qc.invalidateQueries({ queryKey: ["kanban-cards"] });
    }
  }

  async function atribuirGrupo(grupoId: string | null) {
    if (selecionados.size === 0) return;
    try {
      await atribuirGrupoMut.mutateAsync({ ids: [...selecionados], grupoId });
    } catch {
      return;
    }
    toast.success(
      grupoId
        ? `${selecionados.size} card(s) atribuído(s) ao grupo`
        : `${selecionados.size} card(s) removido(s) do grupo`,
    );
    setSelecionados(new Set());
  }

  async function moverSelecionadosPara(novoStatus: string) {
    if (selecionados.size === 0) return;
    const ids = [...selecionados];
    await moverCards(ids, novoStatus);
    setSelecionados(new Set());
  }

  const obraNome = useMemo(() => {
    const m = new Map<string, string>();
    for (const o of obras) m.set(o.id, o.nome);
    return m;
  }, [obras]);

  const { data, isLoading } = useQuery({
    queryKey: ["kanban-cards", setor, obraId ?? "_all", subsetor ?? "_all"],
    queryFn: async (): Promise<CardRow[]> => {
      const { data: setores, error } = await cardsQueryFns.listSetoresBySetor(setor, subsetor);
      if (error) throw error;
      const ids = (setores ?? []).map((s: any) => s.card_id);
      if (ids.length === 0) return [];
      const [
        { data: cards, error: e1 },
        { data: recs, error: e2 },
        { data: grupos, error: e3 },
        { data: comprasTrilhos, error: e4 },
      ] = await Promise.all([
        cardsQueryFns.listKanbanByIds(ids, obraId),
        cardsQueryFns.listKanbanRecursosPorCards(ids),
        cardsQueryFns.listGruposNegociacao(),
        setor === "Producao"
          ? cardsQueryFns.listStatusSetoresPorCardsESetor(ids, "Compras")
          : Promise.resolve({ data: [] as any[], error: null }),
      ]);
      if (e1) throw e1;
      if (e2) throw e2;
      if (e3) throw e3;
      if (e4) throw e4;
      const recMap = new Map((recs ?? []).map((r: any) => [r.card_id, r]));
      const grupoMap = new Map((grupos ?? []).map((g: any) => [g.id, g.rotulo]));
      const setMap = new Map((setores ?? []).map((s: any) => [s.card_id, s]));
      const comprasMap = new Map(
        ((comprasTrilhos ?? []) as any[]).map((c: any) => [c.card_id, c.status_setor]),
      );
      return (cards ?? []).map((c: any) => {
        const s = setMap.get(c.id) as any;
        const r = recMap.get(c.id) as any;
        return {
          id: c.id,
          numero: c.numero,
          titulo: c.titulo,
          obra_id: c.obra_id,
          obra_nome: c.obras?.nome ?? null,
          grupo_negociacao_id: c.grupo_negociacao_id,
          status_setor: s?.status_setor ?? "",
          subsetor: s?.subsetor ?? null,
          tipo_recurso: r?.tipo_recurso ?? "",
          prazo_pedido: r?.prazo_pedido ?? null,
          data_necessidade_obra: r?.data_necessidade_obra ?? null,
          valor_estimado: r?.valor_estimado ?? null,
          valor_oc: r?.valor_oc ?? null,
          grupo_rotulo: c.grupo_negociacao_id
            ? ((grupoMap.get(c.grupo_negociacao_id) as string | null) ?? null)
            : null,
          compras_status: comprasMap.get(c.id) ?? null,
        };
      });
    },
  });

  const colunas = setor === "Compras" ? COLUNAS_COMPRAS : COLUNAS_PRODUCAO;
  const regrasAutomacao = useMemo(() => listarRegrasAutomacaoQuadro(setor), [setor]);

  const porColuna = useMemo(() => {
    const s = search.trim().toLowerCase();
    const m = new Map<string, CardRow[]>();
    for (const col of colunas) m.set(col.key, []);
    for (const row of data ?? []) {
      if (s) {
        const hay =
          `${row.numero} ${row.titulo} ${row.obra_nome ?? ""} ${row.grupo_rotulo ?? ""} ${row.tipo_recurso}`.toLowerCase();
        if (!hay.includes(s)) continue;
      }
      const arr = m.get(row.status_setor);
      if (arr) arr.push(row);
    }
    return m;
  }, [data, colunas, search]);

  if (isLoading) {
    return (
      <div className="overflow-x-auto pb-4">
        <div className="flex gap-4 pb-1 min-w-max items-start">
          {colunas.map((c) => (
            <div key={c.key} className="obra-column space-y-3">
              <Skeleton className="h-5 w-3/4" />
              <Skeleton className="h-14 w-full" />
              <Skeleton className="h-14 w-full" />
              <Skeleton className="h-14 w-full" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <>
      {selecionados.size > 0 && (
        <div className="sticky top-0 z-20 mb-3 flex flex-wrap items-center gap-3 rounded-md border bg-card p-3 shadow-sm">
          <span className="text-sm font-medium">{selecionados.size} card(s) selecionado(s)</span>
          <div className="min-w-[240px] flex-1 max-w-md">
            <GrupoNegociacaoSelect value={null} onChange={(id) => atribuirGrupo(id)} />
          </div>
          <Select onValueChange={(v) => moverSelecionadosPara(v)}>
            <SelectTrigger className="w-[220px]" aria-label="Mover selecionados para">
              <SelectValue placeholder="Mover em massa para..." />
            </SelectTrigger>
            <SelectContent>
              {colunas.map((c) => (
                <SelectItem key={c.key} value={c.key}>
                  {c.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button size="sm" variant="ghost" onClick={() => setSelecionados(new Set())}>
            <X className="h-4 w-4" /> Cancelar
          </Button>
        </div>
      )}
      <div className="flex items-center gap-2 mb-4 shrink-0">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por número, título, obra ou grupo..."
            className="pl-9"
          />
        </div>
        <ColumnFilter
          columns={colunas.map((c) => ({ id: c.key, label: c.label }))}
          hiddenColumns={hiddenColumns}
          onToggle={(id) =>
            setHiddenColumns((prev) => {
              const next = new Set(prev);
              if (next.has(id)) next.delete(id);
              else next.add(id);
              return next;
            })
          }
        />
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2">
              <Settings2 className="h-4 w-4" />
              Automações
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-80 p-3">
            <div className="space-y-3">
              <div className="text-sm font-medium">Regras do quadro</div>
              <div className="space-y-2">
                {regrasAutomacao.map((regra) => {
                  const ativa = !regrasDesativadas.has(regra.id);
                  return (
                    <div
                      key={regra.id}
                      className="flex items-start justify-between gap-3 rounded-md border p-2"
                    >
                      <div className="min-w-0 space-y-0.5">
                        <div className="text-sm font-medium truncate">{regra.titulo}</div>
                        <div className="text-xs text-muted-foreground leading-snug">
                          {regra.descricao}
                        </div>
                      </div>
                      <Switch
                        checked={ativa}
                        onCheckedChange={(checked) => setRegraAtiva(regra.id, checked)}
                        aria-label={`Alternar automação ${regra.titulo}`}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          </PopoverContent>
        </Popover>
      </div>
      <ScrollArea className="flex-1 min-h-0">
        <div className="flex gap-4 pb-4 min-w-max items-start">
          {colunas
            .filter((c) => !hiddenColumns.has(c.key))
            .map((col) => {
              const cards = porColuna.get(col.key) ?? [];
              // agrupa por negociação dentro da coluna
              const grupos = new Map<string, { rotulo: string; cards: CardRow[] }>();
              for (const c of cards) {
                const key = c.grupo_negociacao_id ?? "_sem";
                const rotulo = c.grupo_rotulo ?? "Sem negociação";
                if (!grupos.has(key)) grupos.set(key, { rotulo, cards: [] });
                grupos.get(key)!.cards.push(c);
              }
              return (
                <div
                  key={col.key}
                  className={cn(
                    "obra-column transition-all",
                    dragOverCol === col.key &&
                      draggedIds.length > 0 &&
                      "ring-2 ring-primary/60 bg-primary/5 border-primary/40",
                  )}
                  onDragOver={(e) => {
                    if (draggedIds.length === 0) return;
                    e.preventDefault();
                    if (dragOverCol !== col.key) setDragOverCol(col.key);
                  }}
                  onDragLeave={(e) => {
                    const rt = e.relatedTarget as Node | null;
                    if (!rt || !(e.currentTarget as Node).contains(rt)) {
                      setDragOverCol((cur) => (cur === col.key ? null : cur));
                    }
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDragOverCol(null);
                    if (draggedIds.length === 0) return;
                    void moverCards(draggedIds, col.key);
                    setDraggedIds([]);
                  }}
                >
                  <div className="flex items-center justify-between mb-3 gap-2">
                    <h3 className="font-display text-sm font-semibold truncate">{col.label}</h3>
                    <span className="text-xs text-muted-foreground bg-secondary rounded-full px-2 py-0.5">
                      {cards.length}
                    </span>
                  </div>
                  <div className="flex flex-col gap-3">
                    {[...grupos.entries()].map(([gKey, g]) => (
                      <div key={gKey} className="space-y-1">
                        {g.cards.length > 0 && (
                          <div className="text-[10px] text-muted-foreground uppercase tracking-wide px-1">
                            {g.rotulo}
                          </div>
                        )}
                        {g.cards.map((c) => {
                          const dias = diasAte(c.data_necessidade_obra);
                          const sel = selecionados.has(c.id);
                          const dragging = draggedIds.includes(c.id);
                          return (
                            <ContextMenu key={c.id}>
                              <ContextMenuTrigger asChild>
                                <Card
                                  draggable
                                  onDragStart={(e) => {
                                    const ids =
                                      sel && selecionados.size > 0
                                        ? Array.from(selecionados)
                                        : [c.id];
                                    setDraggedIds(ids);
                                    e.dataTransfer.effectAllowed = "move";
                                  }}
                                  onDragEnd={() => {
                                    setDraggedIds([]);
                                    setDragOverCol(null);
                                  }}
                                  className={cn(
                                    "cursor-grab active:cursor-grabbing hover:border-primary/50 transition-colors",
                                    sel && "border-primary ring-1 ring-primary",
                                    dragging && "opacity-50",
                                  )}
                                  onClick={(e) => {
                                    if (e.ctrlKey || e.metaKey) {
                                      e.preventDefault();
                                      toggleSel(c.id);
                                      return;
                                    }
                                    setCardAberto(c.id);
                                  }}
                                >
                                  <CardContent className="p-3 space-y-1.5">
                                    <div className="flex items-start justify-between gap-2">
                                      <div className="flex items-start gap-2 flex-1 min-w-0">
                                        <Checkbox
                                          checked={sel}
                                          onCheckedChange={() => toggleSel(c.id)}
                                          onClick={(e) => e.stopPropagation()}
                                          className="mt-0.5"
                                        />
                                        <div className="flex-1 min-w-0">
                                          <div className="text-xs text-muted-foreground">
                                            #{c.numero}
                                          </div>
                                          <div className="text-sm font-medium truncate">
                                            {c.titulo}
                                          </div>
                                        </div>
                                      </div>
                                      {badgePrazo(dias)}
                                    </div>
                                    {c.obra_id && (
                                      <Link
                                        to={`/obras/${c.obra_id}`}
                                        onClick={(e) => e.stopPropagation()}
                                        title={c.obra_nome ?? obraNome.get(c.obra_id) ?? "Obra"}
                                        className="text-[11px] text-muted-foreground hover:text-primary inline-flex items-center gap-1 max-w-full truncate"
                                      >
                                        <ExternalLink className="h-3 w-3 shrink-0" />
                                        <span className="truncate">
                                          {c.obra_nome ?? obraNome.get(c.obra_id) ?? "Obra"}
                                        </span>
                                      </Link>
                                    )}
                                    <div className="flex items-center gap-1 flex-wrap">
                                      <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                                        {c.tipo_recurso}
                                      </Badge>
                                      {c.subsetor && (
                                        <Badge
                                          variant="outline"
                                          className="text-[10px] px-1.5 py-0"
                                        >
                                          {c.subsetor}
                                        </Badge>
                                      )}
                                    </div>
                                  </CardContent>
                                </Card>
                              </ContextMenuTrigger>
                              <ContextMenuContent>
                                <ContextMenuItem onSelect={() => setCardAberto(c.id)}>
                                  Abrir card
                                </ContextMenuItem>
                                <ContextMenuItem onSelect={() => toggleSel(c.id)}>
                                  {sel ? "Remover da seleção" : "Adicionar à seleção"}
                                </ContextMenuItem>
                                <ContextMenuSeparator />
                                {colunas
                                  .filter((destino) => destino.key !== c.status_setor)
                                  .map((destino) => (
                                    <ContextMenuItem
                                      key={destino.key}
                                      onSelect={() => {
                                        const ids =
                                          sel && selecionados.size > 0
                                            ? Array.from(selecionados)
                                            : [c.id];
                                        void moverCards(ids, destino.key);
                                      }}
                                    >
                                      Mover para “{destino.label}”
                                    </ContextMenuItem>
                                  ))}
                              </ContextMenuContent>
                            </ContextMenu>
                          );
                        })}
                      </div>
                    ))}
                    {cards.length === 0 && (
                      <div className="text-xs text-muted-foreground text-center py-4">Vazio</div>
                    )}
                  </div>
                </div>
              );
            })}
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
      {cardAberto && (
        <CardRecursoDialog
          cardId={cardAberto}
          open={!!cardAberto}
          onOpenChange={(o) => !o && setCardAberto(null)}
        />
      )}
    </>
  );
}
