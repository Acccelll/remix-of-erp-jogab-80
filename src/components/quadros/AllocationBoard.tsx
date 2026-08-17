import React, { useEffect, useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { ArrowRight, ChevronsUpDown, MoveRight, Search, X } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { toPng } from "html-to-image";
import {
  sortCards,
  groupCards,
  applyExtraFilters,
  type SortDef,
  type ExtraFilter,
} from "@/lib/quadros/sortAndGroup";
import { useBoardHotkeys } from "@/lib/quadros/useBoardHotkeys";
import BoardViewMenu from "@/components/quadros/BoardViewMenu";
import BoardFiltersMenu from "@/components/quadros/BoardFiltersMenu";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { dndAnnouncementsPtBR, dndScreenReaderInstructionsPtBR } from "@/lib/a11y/dndAnnouncements";
import { logger } from "@/lib/core/logger";

export interface BoardColumn {
  id: string | null;
  nome: string;
  icon?: React.ComponentType<{ className?: string }> | null;
  isFixed?: boolean;
}

export interface CardRenderContext {
  columnId: string | null;
  isSelected: boolean;
  isDragging: boolean;
  toggleSelect: () => void;
  startDrag: () => void;
  handleClick: (e: React.MouseEvent) => void;
  density?: "compact" | "comfortable";
}

export interface AllocationBoardProps<T extends { id: string }> {
  /** Banner fixo no topo (ex.: aviso de simulação). */
  banner?: React.ReactNode;
  /** Título mostrado no cabeçalho. */
  title: React.ReactNode;
  /** Botões à direita do cabeçalho (export, snapshot, etc.). */
  headerActions?: React.ReactNode;
  /** Botões/contadores extras na barra contextual de seleção. */
  selectionActions?: (ctx: {
    selectedIds: Set<string>;
    clear: () => void;
    openMove: () => void;
  }) => React.ReactNode;

  columns: BoardColumn[];
  cards: T[];
  positionOf: (card: T) => string | null;

  /** Texto pesquisável (nome, matrícula, função, cidade…). */
  getSearchableText: (card: T) => string;
  /** Função do colaborador (para filtro). Retorne "" se não houver. */
  getFuncao: (card: T) => string;

  canEdit: boolean;

  /** Aplicar o movimento (drop ou diálogo "Mover para…"). */
  onMove: (cardIds: string[], destColId: string | null) => void;

  /** Renderiza o conteúdo principal do card. */
  renderCard: (card: T, ctx: CardRenderContext) => React.ReactNode;
  /** Extras dentro do header de cada coluna (equipamentos expansíveis etc.). */
  renderColumnExtras?: (col: BoardColumn, cards: T[]) => React.ReactNode;
  /** Conteúdo customizado do badge de contagem da coluna (se omitido, mostra o total). */
  renderColumnCount?: (col: BoardColumn, cards: T[]) => React.ReactNode;

  emptyColumnHint?: string;
  /** Mostra esqueletos enquanto os dados carregam. */
  isLoading?: boolean;
  /** Chave para persistir busca/filtro/colunas escondidas em localStorage. */
  storageKey?: string;
  /** Opções de ordenação dos cards dentro de cada coluna. */
  sortOptions?: SortDef<T>[];
  /** Quando true, oferece toggle "Agrupar por função" usando getFuncao. */
  allowGroupByFuncao?: boolean;
  /** Quando true, oferece toggle de densidade compacto/confortável. */
  allowDensityToggle?: boolean;
  /** Quando true, mostra botão "Snapshot PNG" do quadro. */
  allowSnapshot?: boolean;
  /** Filtros extras (chips); persistidos em localStorage se houver storageKey. */
  extraFilters?: ExtraFilter<T>[];
}

export function AllocationBoard<T extends { id: string }>({
  banner,
  title,
  headerActions,
  selectionActions,
  columns,
  cards,
  positionOf,
  getSearchableText,
  getFuncao,
  canEdit,
  onMove,
  renderCard,
  renderColumnExtras,
  renderColumnCount,
  emptyColumnHint = "Arraste colaboradores aqui",
  isLoading = false,
  storageKey,
  sortOptions,
  allowGroupByFuncao = false,
  allowDensityToggle = false,
  allowSnapshot = false,
  extraFilters,
}: AllocationBoardProps<T>) {
  const persisted = useMemo(() => {
    if (!storageKey || typeof window === "undefined") return null;
    try {
      const raw = window.localStorage.getItem(`allocboard:${storageKey}`);
      if (!raw) return null;
      return JSON.parse(raw) as {
        v?: number;
        search?: string;
        funcFilter?: string[];
        hiddenColumns?: string[];
        sortBy?: string;
        groupByFunc?: boolean;
        density?: "compact" | "comfortable";
        extraFilters?: string[];
      };
    } catch {
      return null;
    }
  }, [storageKey]);
  const [search, setSearch] = useState(persisted?.search ?? "");
  const [hiddenColumns, setHiddenColumns] = useState<Set<string>>(
    () => new Set(persisted?.hiddenColumns ?? []),
  );
  const [funcFilter, setFuncFilter] = useState<Set<string>>(
    () => new Set(persisted?.funcFilter ?? []),
  );
  const defaultSortValue = sortOptions?.[0]?.value ?? "";
  const [sortBy, setSortBy] = useState<string>(persisted?.sortBy ?? defaultSortValue);
  const [groupByFunc, setGroupByFunc] = useState<boolean>(persisted?.groupByFunc ?? false);
  const [density, setDensity] = useState<"compact" | "comfortable">(
    persisted?.density ?? "comfortable",
  );
  const [extraFilterKeys, setExtraFilterKeys] = useState<Set<string>>(
    () => new Set(persisted?.extraFilters ?? []),
  );
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  useEffect(() => {
    if (!storageKey || typeof window === "undefined") return;
    try {
      window.localStorage.setItem(
        `allocboard:${storageKey}`,
        JSON.stringify({
          v: 2,
          search,
          funcFilter: Array.from(funcFilter),
          hiddenColumns: Array.from(hiddenColumns),
          sortBy,
          groupByFunc,
          density,
          extraFilters: Array.from(extraFilterKeys),
        }),
      );
    } catch {
      /* ignore quota errors */
    }
  }, [
    storageKey,
    search,
    funcFilter,
    hiddenColumns,
    sortBy,
    groupByFunc,
    density,
    extraFilterKeys,
  ]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [draggedIds, setDraggedIds] = useState<string[]>([]);
  const [jumpOpen, setJumpOpen] = useState(false);
  const [moveDialogOpen, setMoveDialogOpen] = useState(false);
  const [liveMsg, setLiveMsg] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);
  const boardSnapshotRef = useRef<HTMLDivElement>(null);

  const columnRefs = useRef<Map<string, HTMLDivElement | null>>(new Map());

  const availableFuncoes = useMemo(() => {
    const set = new Set<string>();
    for (const c of cards) {
      const f = getFuncao(c);
      if (f) set.add(f);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [cards, getFuncao]);

  const filteredCards = useMemo(() => {
    let list = cards;
    if (search.trim()) {
      const s = search.toLowerCase();
      list = list.filter((c) => getSearchableText(c).toLowerCase().includes(s));
    }
    if (funcFilter.size > 0) {
      list = list.filter((c) => funcFilter.has(getFuncao(c) || ""));
    }
    if (extraFilters && extraFilters.length > 0 && extraFilterKeys.size > 0) {
      list = applyExtraFilters(list, extraFilters, extraFilterKeys);
    }
    return list;
  }, [cards, search, funcFilter, getSearchableText, getFuncao, extraFilters, extraFilterKeys]);

  const activeSort = useMemo(
    () => sortOptions?.find((o) => o.value === sortBy) ?? null,
    [sortOptions, sortBy],
  );

  const cardsByColumn = useMemo(() => {
    const map = new Map<string, T[]>();
    for (const c of filteredCards) {
      const key = positionOf(c) ?? "__none__";
      const arr = map.get(key);
      if (arr) arr.push(c);
      else map.set(key, [c]);
    }
    if (activeSort) {
      for (const [k, arr] of map) map.set(k, sortCards(arr, activeSort));
    }
    return map;
  }, [filteredCards, positionOf, activeSort]);

  const scrollToColumn = (colKey: string) => {
    const el = columnRefs.current.get(colKey);
    if (el) el.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  };

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
    useSensor(KeyboardSensor),
  );

  const handleDragStart = (e: DragStartEvent) => {
    const id = String(e.active.id);
    if (selectedIds.has(id) && selectedIds.size > 1) setDraggedIds(Array.from(selectedIds));
    else setDraggedIds([id]);
  };

  const handleDragEnd = (e: DragEndEvent) => {
    const overId = e.over?.id != null ? String(e.over.id) : null;
    const ids = draggedIds;
    setDraggedIds([]);
    if (!canEdit || ids.length === 0 || overId === null) return;
    const destColId = overId === "__none__" ? null : overId;
    onMove(ids, destColId);
  };

  const handleDragCancel = () => setDraggedIds([]);

  const toggleSelect = (cardId: string) =>
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(cardId)) next.delete(cardId);
      else next.add(cardId);
      return next;
    });

  // Anuncia mudanças de seleção via aria-live (após o primeiro mount).
  const firstRenderRef = useRef(true);
  useEffect(() => {
    if (firstRenderRef.current) {
      firstRenderRef.current = false;
      return;
    }
    if (selectedIds.size === 0) setLiveMsg("Seleção limpa");
    else
      setLiveMsg(
        `${selectedIds.size} colaborador${selectedIds.size === 1 ? "" : "es"} selecionado${selectedIds.size === 1 ? "" : "s"}`,
      );
  }, [selectedIds]);

  useBoardHotkeys({
    onFocusSearch: () => searchInputRef.current?.focus(),
    onClearSelection: () => setSelectedIds(new Set()),
    onSelectAllVisible: () => {
      if (!canEdit) return;
      setSelectedIds(new Set(filteredCards.map((c) => (c as { id: string }).id)));
    },
    onOpenMove: () => {
      if (!canEdit || selectedIds.size === 0) return;
      setMoveDialogOpen(true);
    },
  });

  const toggleAllGroupsCollapsed = (collapseAll: boolean) => {
    if (!collapseAll) {
      setCollapsedGroups(new Set());
      return;
    }
    const keys = new Set<string>();
    for (const [colKey, arr] of cardsByColumn) {
      const grupos = groupCards(arr, groupByFunc ? (c) => getFuncao(c) || "Sem função" : null);
      grupos.forEach((g) => keys.add(`${colKey}::${g.key}`));
    }
    setCollapsedGroups(keys);
  };

  const handleSnapshot = async () => {
    if (!boardSnapshotRef.current) return;
    try {
      const dataUrl = await toPng(boardSnapshotRef.current, {
        backgroundColor: getComputedStyle(document.body).backgroundColor || "#0b0b0b",
        pixelRatio: 1.5,
        cacheBust: true,
      });
      const a = document.createElement("a");
      const today = new Date().toISOString().split("T")[0];
      a.href = dataUrl;
      a.download = `quadro-${today}.png`;
      a.click();
      setLiveMsg("Snapshot PNG gerado");
    } catch (err) {
      logger.error("Snapshot PNG falhou:", err);
      setLiveMsg("Falha ao gerar snapshot PNG");
    }
  };

  const handleCardClick = (cardId: string, e: React.MouseEvent) => {
    if (!canEdit) return;
    if (e.ctrlKey || e.metaKey) toggleSelect(cardId);
  };

  const openMoveDialog = () => setMoveDialogOpen(true);
  const handleMovePick = (destId: string | null) => {
    const ids = selectedIds.size > 0 ? Array.from(selectedIds) : [];
    if (ids.length > 0) onMove(ids, destId);
    setSelectedIds(new Set());
    setMoveDialogOpen(false);
  };

  const visibleColumns = columns
    .filter((col) => !hiddenColumns.has(col.id ?? "__none__"))
    .filter((col) => {
      if (!search.trim() && funcFilter.size === 0 && extraFilterKeys.size === 0) return true;
      const key = col.id ?? "__none__";
      return (cardsByColumn.get(key)?.length ?? 0) > 0;
    });

  const activeExtraFilters = useMemo(
    () => (extraFilters ?? []).filter((f) => extraFilterKeys.has(f.key)),
    [extraFilters, extraFilterKeys],
  );
  const totalActiveFilters = funcFilter.size + extraFilterKeys.size;

  return (
    <DndContext
      sensors={sensors}
      accessibility={{ announcements: dndAnnouncementsPtBR(), screenReaderInstructions: dndScreenReaderInstructionsPtBR }}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <div
        className="flex flex-col"
        onClick={(e) => {
          if (
            !(e.ctrlKey || e.metaKey) &&
            (e.target as HTMLElement).closest(".employee-tag") === null
          ) {
            setSelectedIds(new Set());
          }
        }}
      >
        {banner}

        <div className="flex items-center justify-between mb-4 shrink-0 gap-3 flex-wrap">
          <div className="flex items-center gap-3">{title}</div>
          <div className="flex items-center gap-2 flex-wrap">{headerActions}</div>
        </div>

        <div className="flex items-center gap-2 mb-3 shrink-0 flex-wrap">
          <div className="relative max-w-sm flex-1 min-w-[220px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              ref={searchInputRef}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nome, matrícula, função ou cidade…  (atalho: /)"
              className="pl-9"
            />
          </div>
          {search.trim() && (
            <span className="text-xs text-muted-foreground whitespace-nowrap">
              {filteredCards.length} colaborador{filteredCards.length === 1 ? "" : "es"} encontrado
              {filteredCards.length === 1 ? "" : "s"}
            </span>
          )}

          <Popover open={jumpOpen} onOpenChange={setJumpOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1" aria-label="Ir para uma obra">
                <MoveRight className="h-4 w-4" /> Ir para obra
                <ChevronsUpDown className="h-3 w-3 opacity-60" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-72 p-0" align="start">
              <Command>
                <CommandInput placeholder="Buscar coluna…" />
                <CommandList>
                  <CommandEmpty>Nada encontrado.</CommandEmpty>
                  <CommandGroup>
                    {columns.map((col) => {
                      const colKey = col.id ?? "__none__";
                      const count = cardsByColumn.get(colKey)?.length ?? 0;
                      return (
                        <CommandItem
                          key={colKey}
                          value={col.nome}
                          onSelect={() => {
                            scrollToColumn(colKey);
                            setJumpOpen(false);
                          }}
                        >
                          {col.icon && <col.icon className="h-4 w-4 mr-2 text-muted-foreground" />}
                          <span className="truncate">{col.nome}</span>
                          <span className="ml-auto text-[10px] text-muted-foreground">{count}</span>
                        </CommandItem>
                      );
                    })}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>

          <BoardViewMenu<T>
            sortOptions={sortOptions}
            sortBy={sortBy}
            onSortByChange={setSortBy}
            allowGroupByFuncao={allowGroupByFuncao}
            groupByFunc={groupByFunc}
            onGroupByFuncChange={setGroupByFunc}
            columns={columns.map((c) => ({ id: c.id ?? "__none__", label: c.nome }))}
            hiddenColumns={hiddenColumns}
            onToggleColumn={(id) =>
              setHiddenColumns((prev) => {
                const next = new Set(prev);
                if (next.has(id)) next.delete(id);
                else next.add(id);
                return next;
              })
            }
            onShowAllColumns={() => setHiddenColumns(new Set())}
            allowDensityToggle={allowDensityToggle}
            density={density}
            onDensityChange={setDensity}
            allowSnapshot={allowSnapshot}
            onSnapshot={handleSnapshot}
          />

          {(availableFuncoes.length > 0 || (extraFilters && extraFilters.length > 0)) && (
            <BoardFiltersMenu<T>
              availableFuncoes={availableFuncoes}
              funcFilter={funcFilter}
              onToggleFuncao={(f) =>
                setFuncFilter((prev) => {
                  const next = new Set(prev);
                  if (next.has(f)) next.delete(f);
                  else next.add(f);
                  return next;
                })
              }
              onClearFuncoes={() => setFuncFilter(new Set())}
              extraFilters={extraFilters}
              extraFilterKeys={extraFilterKeys}
              onToggleExtra={(key) =>
                setExtraFilterKeys((prev) => {
                  const next = new Set(prev);
                  if (next.has(key)) next.delete(key);
                  else next.add(key);
                  return next;
                })
              }
              onClearExtras={() => setExtraFilterKeys(new Set())}
            />
          )}

          {groupByFunc && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => toggleAllGroupsCollapsed(collapsedGroups.size === 0)}
              aria-label="Colapsar ou expandir todos os grupos"
            >
              {collapsedGroups.size === 0 ? "Colapsar todos" : "Expandir todos"}
            </Button>
          )}
        </div>

        {totalActiveFilters > 0 && (
          <div className="flex items-center gap-2 flex-wrap mb-3 shrink-0">
            {Array.from(funcFilter).map((f) => (
              <button
                key={`f-${f}`}
                type="button"
                onClick={() =>
                  setFuncFilter((prev) => {
                    const next = new Set(prev);
                    next.delete(f);
                    return next;
                  })
                }
                className="inline-flex items-center gap-1 rounded-full bg-primary/10 text-primary text-[11px] font-medium px-2 py-0.5 hover:bg-primary/20"
              >
                Função: {f} <X className="h-3 w-3" />
              </button>
            ))}
            {activeExtraFilters.map((f) => (
              <button
                key={`x-${f.key}`}
                type="button"
                onClick={() =>
                  setExtraFilterKeys((prev) => {
                    const next = new Set(prev);
                    next.delete(f.key);
                    return next;
                  })
                }
                className="inline-flex items-center gap-1 rounded-full bg-warning/15 text-warning text-[11px] font-medium px-2 py-0.5 hover:bg-warning/25"
              >
                {f.label} <X className="h-3 w-3" />
              </button>
            ))}
            <button
              type="button"
              onClick={() => {
                setFuncFilter(new Set());
                setExtraFilterKeys(new Set());
              }}
              className="text-[11px] text-muted-foreground underline-offset-2 hover:underline ml-1"
            >
              Limpar tudo
            </button>
          </div>
        )}

        <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">
          {liveMsg}
        </div>

        {selectedIds.size > 0 && canEdit && (
          <div className="flex items-center gap-2 mb-3 px-3 py-2 rounded-md border bg-primary/5 border-primary/20 shrink-0">
            <span className="text-sm font-medium text-primary">
              {selectedIds.size} selecionado{selectedIds.size > 1 ? "s" : ""}
            </span>
            <div className="flex-1" />
            {selectionActions ? (
              selectionActions({
                selectedIds,
                clear: () => setSelectedIds(new Set()),
                openMove: openMoveDialog,
              })
            ) : (
              <>
                <Button size="sm" onClick={openMoveDialog}>
                  <ArrowRight className="h-4 w-4 mr-1" /> Mover para…
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setSelectedIds(new Set())}>
                  Limpar seleção
                </Button>
              </>
            )}
          </div>
        )}

        {isLoading && (
          <div className="flex gap-4 pb-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="obra-column space-y-3">
                <div className="h-5 w-3/4 bg-muted rounded animate-pulse" />
                <div className="h-14 w-full bg-muted rounded animate-pulse" />
                <div className="h-14 w-full bg-muted rounded animate-pulse" />
                <div className="h-14 w-full bg-muted rounded animate-pulse" />
              </div>
            ))}
          </div>
        )}

        {!isLoading && (
          <div className="overflow-x-auto pb-4" ref={boardSnapshotRef}>
            <div className="flex gap-4 pb-1 min-w-max items-start">
              {visibleColumns.map((col) => {
                const colKey = col.id ?? "__none__";
                const colCards = cardsByColumn.get(colKey) ?? [];
                const grupos = groupByFunc
                  ? groupCards(colCards, (c) => getFuncao(c) || "Sem função")
                  : [{ key: "__all__", label: "", items: colCards } as const];
                return (
                  <DroppableColumn
                    key={colKey}
                    colKey={colKey}
                    isFixed={!!col.isFixed}
                    hasDrag={draggedIds.length > 0}
                    registerRef={(el) => {
                      if (el) columnRefs.current.set(colKey, el);
                      else columnRefs.current.delete(colKey);
                    }}
                  >
                    <div className="sticky top-0 z-10 -mx-3 px-3 pt-1 pb-2 mb-2 bg-card/95 backdrop-blur-sm border-b border-border/60 flex items-center justify-between gap-2 rounded-t-md">
                      <h3
                        className={cn(
                          "font-display text-sm font-semibold truncate flex items-center gap-1.5",
                          col.isFixed && "text-muted-foreground",
                        )}
                      >
                        {col.icon && <col.icon className="h-3.5 w-3.5 shrink-0" />}
                        {col.nome}
                      </h3>
                      {renderColumnCount ? (
                        renderColumnCount(col, colCards)
                      ) : (
                        <TooltipProvider delayDuration={200}>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="text-xs text-muted-foreground bg-secondary rounded-full px-2 py-0.5 cursor-default">
                                {colCards.length}
                              </span>
                            </TooltipTrigger>
                            <TooltipContent side="top" className="text-xs">
                              {colCards.length === 0 ? (
                                <p>Nenhum colaborador</p>
                              ) : (
                                Object.entries(
                                  colCards.reduce<Record<string, number>>((acc, c) => {
                                    const k = getFuncao(c) || "Sem função";
                                    acc[k] = (acc[k] || 0) + 1;
                                    return acc;
                                  }, {}),
                                ).map(([funcao, count]) => (
                                  <p key={funcao}>
                                    {funcao}: {count}
                                  </p>
                                ))
                              )}
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      )}
                    </div>

                    {renderColumnExtras?.(col, colCards)}

                    <div className="space-y-2">
                      {colCards.length === 0 && (
                        <div className="flex items-center justify-center h-14 rounded-md border border-dashed border-border text-[11px] text-muted-foreground/70">
                          {emptyColumnHint}
                        </div>
                      )}
                      {grupos.map((g) => {
                        const groupKey = `${colKey}::${g.key}`;
                        const collapsed = collapsedGroups.has(groupKey);
                        return (
                          <div key={groupKey} className="space-y-2">
                            {groupByFunc && (
                              <button
                                type="button"
                                onClick={() =>
                                  setCollapsedGroups((prev) => {
                                    const next = new Set(prev);
                                    if (next.has(groupKey)) next.delete(groupKey);
                                    else next.add(groupKey);
                                    return next;
                                  })
                                }
                                className="w-full text-left text-[11px] uppercase tracking-wide text-muted-foreground hover:text-foreground flex items-center justify-between border-b border-dashed border-border/60 pb-0.5 mt-1"
                                aria-expanded={!collapsed}
                              >
                                <span className="truncate">{g.label}</span>
                                <span>{g.items.length}</span>
                              </button>
                            )}
                            {!collapsed &&
                              g.items.map((card) => {
                                const isSelected = selectedIds.has(card.id);
                                const isDragging = draggedIds.includes(card.id);
                                return (
                                  <DraggableCard key={card.id} id={card.id} disabled={!canEdit}>
                                    {renderCard(card, {
                                      columnId: col.id,
                                      isSelected,
                                      isDragging,
                                      toggleSelect: () => toggleSelect(card.id),
                                      startDrag: () => {},
                                      handleClick: (e) => handleCardClick(card.id, e),
                                      density,
                                    })}
                                  </DraggableCard>
                                );
                              })}
                          </div>
                        );
                      })}
                    </div>
                  </DroppableColumn>
                );
              })}
            </div>
          </div>
        )}

        <Dialog open={moveDialogOpen} onOpenChange={setMoveDialogOpen}>
          <DialogContent className="max-w-md p-0">
            <DialogHeader className="px-4 pt-4">
              <DialogTitle className="font-display text-lg">
                Mover {selectedIds.size || 1} colaborador{(selectedIds.size || 1) === 1 ? "" : "es"}{" "}
                para…
              </DialogTitle>
              <DialogDescription className="sr-only">
                Escolha um status ou obra de destino para os colaboradores selecionados.
              </DialogDescription>
            </DialogHeader>
            <Command className="rounded-t-none">
              <CommandInput placeholder="Buscar obra ou status…" autoFocus />
              <CommandList>
                <CommandEmpty>Nada encontrado.</CommandEmpty>
                <CommandGroup heading="Status">
                  {columns
                    .filter((c) => c.id === null || c.isFixed)
                    .map((col) => (
                      <CommandItem
                        key={col.id ?? "__none__"}
                        value={col.nome}
                        onSelect={() => handleMovePick(col.id)}
                      >
                        {col.icon && <col.icon className="h-4 w-4 mr-2 text-muted-foreground" />}
                        <span className="truncate">{col.nome}</span>
                      </CommandItem>
                    ))}
                </CommandGroup>
                <CommandSeparator />
                <CommandGroup heading="Obras">
                  {columns
                    .filter((c) => c.id !== null && !c.isFixed)
                    .map((col) => (
                      <CommandItem
                        key={col.id!}
                        value={col.nome}
                        onSelect={() => handleMovePick(col.id)}
                      >
                        <span className="truncate">{col.nome}</span>
                      </CommandItem>
                    ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </DialogContent>
        </Dialog>
      </div>
      <DragOverlay dropAnimation={null}>
        {draggedIds.length > 0 ? (
          <div className="rounded-md border border-primary/60 bg-primary text-primary-foreground text-xs font-semibold px-3 py-1.5 shadow-lg">
            {draggedIds.length} colaborador{draggedIds.length === 1 ? "" : "es"}
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

function DraggableCard({
  id,
  disabled,
  children,
}: {
  id: string;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id,
    disabled,
  });
  const style: React.CSSProperties = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.4 : undefined,
    touchAction: "manipulation",
  };
  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      {children}
    </div>
  );
}

function DroppableColumn({
  colKey,
  isFixed,
  hasDrag,
  registerRef,
  children,
}: {
  colKey: string;
  isFixed: boolean;
  hasDrag: boolean;
  registerRef: (el: HTMLDivElement | null) => void;
  children: React.ReactNode;
}) {
  const { isOver, setNodeRef } = useDroppable({ id: colKey });
  return (
    <div
      ref={(el) => {
        setNodeRef(el);
        registerRef(el);
      }}
      className={cn(
        "obra-column transition-all",
        isFixed && "border-dashed border-muted-foreground/30",
        hasDrag && isOver && "ring-2 ring-primary/60 bg-primary/5 border-primary/40",
      )}
    >
      {children}
    </div>
  );
}

export default AllocationBoard;
