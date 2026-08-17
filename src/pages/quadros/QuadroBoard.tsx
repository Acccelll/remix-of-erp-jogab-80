/**
 * /quadros/:boardId — board view (Trello-like) consumindo `card_board_posicao`.
 *
 * Lista colunas via `board_listas` (ordenadas), cards via posicoes do board.
 * Mover entre listas atualiza somente a entrada do board atual — posição
 * nos outros boards intactos (pool único).
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, Link, useNavigate, useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  DndContext,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  useDroppable,
  pointerWithin,
  rectIntersection,
  DragOverlay,
  type CollisionDetection,
  type DragEndEvent,
  type DragStartEvent,
  type DragOverEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  horizontalListSortingStrategy,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { dndAnnouncementsPtBR, dndScreenReaderInstructionsPtBR } from "@/lib/a11y/dndAnnouncements";
import {
  boardsKeys,
  boardsQueryFns,
  useCreateBoardLista,
  useSetBoardListaArquivada,
  useSetBoardListaCor,
  useSetBoardListaNome,
  useSetBoardListaWip,
  useUpdateBoardListaPosicao,
} from "@/hooks/quadros/useBoards";
import {
  useCriarCardBoardAtomico,
  useUpdateCardBoardPosicaoPosicao,
  useUpdateCardBoardPosicaoListaEPosicao,
  useReordenarCardsNaLista,
  useUpdateCardById,
} from "@/hooks/quadros/useCards";
import { useDragScroll } from "@/hooks/useDragScroll";
import { statusDaLista } from "@/lib/cards/generico";


import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  ArrowLeft,
  LayoutGrid,
  MoreHorizontal,
  Plus,
  GripVertical,
  Archive,
  Pencil,
  Gauge,
  Search,
  X,
  Calendar as CalendarIcon,
  Rows3,
  Settings,
  Zap,
  ChevronsLeftRight,
  ChevronsRightLeft,
} from "lucide-react";
import { cn } from "@/lib/utils";
import CardGenericoDialog from "@/components/cards/CardGenericoDialog";
import { quadrosDoCard, type QuadroRef, type CardRef } from "@/lib/quadros/quadrosDoCard";
import { useCardCovers } from "@/hooks/quadros/useCardCovers";
import QuadroCalendarView from "@/components/cards/QuadroCalendarView";
import QuadroTabelaView from "@/components/cards/QuadroTabelaView";
import FiltrosCardsPanel from "@/components/cards/FiltrosCardsPanel";
import QuadroViewsSalvas, { type FiltrosView } from "@/components/cards/QuadroViewsSalvas";
import BoardConfigDialog from "@/components/cards/BoardConfigDialog";
import BoardAutomacoesDialog from "@/components/quadros/BoardAutomacoesDialog";
import { runOnVencimento } from "@/lib/quadros/automacoes";
import { toAutomacao, useBoardAutomacoes } from "@/hooks/quadros/useBoardAutomacoes";

import BoardAtividadeSidebar from "@/components/cards/BoardAtividadeSidebar";
import { DesktopOnlyHint } from "@/components/common/DesktopOnlyHint";
import {
  aplicaFiltros,
  decodeFiltros,
  encodeFiltros,
  type CardFiltravel,
  type FiltrosCards,
} from "@/lib/cards/filtrosCards";
import { useAuth } from "@/contexts/auth/useAuth";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CORES_PALETA, hexToRgba, isHexCor } from "@/lib/cards/cores";
import { Palette } from "lucide-react";

interface Lista {
  id: string;
  nome: string;
  posicao: number;
  wip_limite: number | null;
  arquivada: boolean;
  cor: string | null;
}
interface BoardInfo {
  id: string;
  nome: string;
  tipo: "setor" | "obra" | "custom";
  setor: string | null;
  obra_id: string | null;
}
interface CardItem {
  card_id: string;
  lista_id: string;
  posicao: number;
  card: {
    id: string;
    numero: number;
    titulo: string;
    obra_id: string | null;
    setores: string[];
    capa_cor: string | null;
    capa_url: string | null;
    prazo: string | null;
    responsavel_id: string | null;
    responsavel: { login: string | null } | null;
    labels: { id: string; nome: string; cor: string }[];
    checklistTotal: number;
    checklistConcluido: number;
  };
}

interface BoardItemResumoRow {
  card_id: string;
  lista_id: string;
  posicao: number;
  id: string;
  numero: number;
  titulo: string;
  obra_id: string | null;
  capa_cor: string | null;
  capa_url: string | null;
  prazo: string | null;
  responsavel_id: string | null;
  responsavel_login: string | null;
  setores: string[] | null;
  labels: { id: string; nome: string; cor: string }[] | null;
  checklist_total: number | null;
  checklist_concluido: number | null;
}

function CardVisual({
  item,
  otherBoards,
  coverFallback,
  dragging,
  onOpen,
  dragHandleProps,
}: {
  item: CardItem;
  otherBoards: QuadroRef[];
  coverFallback?: string;
  dragging?: boolean;
  onOpen?: () => void;
  dragHandleProps?: React.HTMLAttributes<HTMLDivElement>;
}) {
  const coverImg = item.card.capa_url || coverFallback;
  const dndKeyDown = dragHandleProps?.onKeyDown;
  return (
    <Card
      {...dragHandleProps}
      role="button"
      tabIndex={0}
      aria-label={`Card #${item.card.numero}: ${item.card.titulo}`}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen?.();
          return;
        }
        dndKeyDown?.(e);
      }}
      className={cn(
        "cursor-grab active:cursor-grabbing hover:border-primary/50 transition-colors overflow-hidden",
        dragging && "opacity-40",
      )}
    >
      {coverImg ? (
        <img src={coverImg} alt="" className="w-full h-20 object-cover bg-muted" />
      ) : item.card.capa_cor ? (
        // A paleta grava hex (#ef4444). Usar isso como classe do Tailwind não
        // pinta nada — por isso hex vai por `style` e só tokens legados viram classe.
        <div
          className={cn("w-full h-3", !isHexCor(item.card.capa_cor) && item.card.capa_cor)}
          style={isHexCor(item.card.capa_cor) ? { backgroundColor: item.card.capa_cor } : undefined}
          aria-hidden
        />

      ) : null}
      <CardContent className="p-3 space-y-1.5">
        <div className="text-xs text-muted-foreground">#{item.card.numero}</div>
        <div className="text-sm font-medium">{item.card.titulo}</div>
        {otherBoards.length > 0 && (
          <div className="flex items-center gap-1 flex-wrap pt-1">
            <span className="text-[10px] text-muted-foreground">também em:</span>
            {otherBoards.slice(0, 3).map((b) => (
              <Badge key={b.id} variant="outline" className="text-[10px] px-1.5 py-0">
                {b.nome.replace(/^(Setor|Obra): /, "")}
              </Badge>
            ))}
            {otherBoards.length > 3 && (
              <span className="text-[10px] text-muted-foreground">+{otherBoards.length - 3}</span>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function SortableCard({
  item,
  onOpen,
  otherBoards,
  coverFallback,
}: {
  item: CardItem;
  onOpen: () => void;
  otherBoards: QuadroRef[];
  coverFallback?: string;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.card_id,
    data: { type: "card", listaId: item.lista_id },
  });
  const style: React.CSSProperties = {
    transform: CSS.Translate.toString(transform),
    transition,
  };
  return (
    <div ref={setNodeRef} style={style}>
      <CardVisual
        item={item}
        otherBoards={otherBoards}
        coverFallback={coverFallback}
        dragging={isDragging}
        onOpen={onOpen}
        dragHandleProps={{ ...attributes, ...listeners } as React.HTMLAttributes<HTMLDivElement>}
      />
    </div>
  );
}

function ColunaLista({
  lista,
  count,
  wipExcedido,
  isCardOver,
  onRenomear,
  onArquivar,
  onSetWip,
  onSetCor,
  quickAddOpen,
  quickAddTitle,
  setQuickAddTitle,
  onOpenQuickAdd,
  onCloseQuickAdd,
  onCreate,
  criando,
  collapsed,
  onToggleCollapsed,
  children,
}: {
  lista: Lista;
  count: number;
  wipExcedido: boolean;
  isCardOver: boolean;
  onRenomear: () => void;
  onArquivar: () => void;
  onSetWip: () => void;
  onSetCor: (cor: string | null) => void;
  quickAddOpen: boolean;
  quickAddTitle: string;
  setQuickAddTitle: (v: string) => void;
  onOpenQuickAdd: () => void;
  onCloseQuickAdd: () => void;
  onCreate: () => void;
  criando: boolean;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  children: React.ReactNode;
}) {
  // Sortable horizontal — habilita reorder das listas via "handle"
  const sortable = useSortable({ id: `lista-sort:${lista.id}` });
  const {
    attributes,
    listeners,
    setNodeRef: setSortRef,
    transform,
    transition,
    isDragging,
  } = sortable;
  // Droppable separado para receber cards
  const drop = useDroppable({ id: `lista:${lista.id}` });

  const setRefs = (node: HTMLDivElement | null) => {
    setSortRef(node);
    drop.setNodeRef(node);
  };

  const corValida = isHexCor(lista.cor) ? lista.cor : null;
  // Tinta suave para preservar contraste do texto/cards.
  const tintedStyle: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    ...(corValida
      ? {
          backgroundColor: hexToRgba(corValida, 0.14),
          borderColor: hexToRgba(corValida, 0.45),
        }
      : {}),
  };

  if (collapsed) {
    return (
      <div
        ref={setRefs}
        style={tintedStyle}
        className={cn(
          "obra-column is-collapsed transition-all relative flex flex-col items-center py-2 gap-2 cursor-pointer",
          isCardOver && "ring-2 ring-primary bg-primary/10 shadow-lg",
          isDragging && "opacity-60",
        )}
        aria-label={`Lista ${lista.nome} (recolhida)`}
        onClick={(e) => {
          if ((e.target as HTMLElement).closest("[data-collapse-handle]")) return;
          onToggleCollapsed();
        }}
      >
        {corValida && (
          <div
            aria-hidden
            className="absolute inset-x-0 top-0 h-1 rounded-t-xl"
            style={{ backgroundColor: corValida }}
          />
        )}
        <button
          {...attributes}
          {...listeners}
          data-collapse-handle
          className="text-muted-foreground hover:text-foreground cursor-grab active:cursor-grabbing"
          aria-label="Mover lista"
          onClick={(e) => e.stopPropagation()}
        >
          <GripVertical className="h-4 w-4" />
        </button>
        <Button
          size="icon"
          variant="ghost"
          className="h-6 w-6"
          data-collapse-handle
          onClick={(e) => {
            e.stopPropagation();
            onToggleCollapsed();
          }}
          aria-label="Expandir lista"
          title="Expandir lista"
        >
          <ChevronsLeftRight className="h-4 w-4" />
        </Button>
        <div className="flex-1 flex items-center justify-center">
          <div
            className="[writing-mode:vertical-rl] rotate-180 font-display text-xs font-semibold uppercase tracking-wide"
            title={lista.nome}
          >
            {lista.nome}
          </div>
        </div>
        <span
          className={cn(
            "text-xs rounded-full px-2 py-0.5",
            wipExcedido ? "bg-warning/20 text-warning" : "bg-secondary text-muted-foreground",
          )}
        >
          {lista.wip_limite ? `${count}/${lista.wip_limite}` : count}
        </span>
      </div>
    );
  }

  return (
    <div
      ref={setRefs}
      style={tintedStyle}
      className={cn(
        "obra-column transition-all w-72 shrink-0 relative",
        isCardOver && "ring-2 ring-primary bg-primary/10 shadow-lg scale-[1.01]",
        isDragging && "opacity-60",
      )}
      aria-label={`Lista ${lista.nome}`}
    >
      {corValida && (
        <div
          aria-hidden
          className="absolute inset-x-0 top-0 h-1 rounded-t-xl"
          style={{ backgroundColor: corValida }}
        />
      )}
      {isCardOver && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-2 top-1 h-0.5 rounded-full bg-primary/70"
        />
      )}
      <div className="flex items-center justify-between mb-3 gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <button
            {...attributes}
            {...listeners}
            className="text-muted-foreground hover:text-foreground cursor-grab active:cursor-grabbing"
            aria-label="Mover lista"
          >
            <GripVertical className="h-4 w-4" />
          </button>
          <h3 className="font-display text-sm font-semibold truncate">{lista.nome}</h3>
        </div>
        <div className="flex items-center gap-1">
          <span
            className={cn(
              "text-xs rounded-full px-2 py-0.5",
              wipExcedido ? "bg-warning/20 text-warning" : "bg-secondary text-muted-foreground",
            )}
          >
            {lista.wip_limite ? `${count}/${lista.wip_limite}` : count}
          </span>
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7"
            onClick={onToggleCollapsed}
            aria-label="Recolher lista"
            title="Recolher lista"
          >
            <ChevronsRightLeft className="h-4 w-4" />
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="icon" variant="ghost" aria-label="Ações do quadro" className="h-7 w-7">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onRenomear}>
                <Pencil className="h-4 w-4" /> Renomear
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onSetWip}>
                <Gauge className="h-4 w-4" /> Limite WIP
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onToggleCollapsed}>
                <ChevronsRightLeft className="h-4 w-4" /> Recolher lista
              </DropdownMenuItem>
              <div className="px-2 py-1.5">
                <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1.5">
                  <Palette className="h-3.5 w-3.5" /> Cor da lista
                </div>
                <div className="grid grid-cols-6 gap-1">
                  {CORES_PALETA.map((c) => {
                    const selected = lista.cor === c.value;
                    return (
                      <button
                        key={c.value}
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          onSetCor(c.value);
                        }}
                        aria-label={`Cor ${c.label}`}
                        title={c.label}
                        style={{ backgroundColor: c.value }}
                        className={cn(
                          "h-6 w-6 rounded border border-border/60",
                          selected && "ring-2 ring-ring",
                        )}
                      />
                    );
                  })}
                </div>
                {lista.cor && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      onSetCor(null);
                    }}
                    className="mt-2 w-full h-7 rounded border border-border/60 text-[11px] hover:bg-muted"
                  >
                    Remover cor
                  </button>
                )}
              </div>
              <DropdownMenuItem onClick={onArquivar} className="text-destructive">
                <Archive className="h-4 w-4" /> Arquivar
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      <div className="flex flex-col gap-3">{children}</div>
      {/* Quick-add */}
      <div className="mt-2">
        {quickAddOpen ? (
          <div className="space-y-2 rounded-md border bg-card p-2">
            <Input
              autoFocus
              placeholder="Título do card…"
              value={quickAddTitle}
              onChange={(e) => setQuickAddTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") onCreate();
                if (e.key === "Escape") onCloseQuickAdd();
              }}
            />
            <div className="flex items-center gap-2">
              <Button size="sm" onClick={onCreate} disabled={criando || !quickAddTitle.trim()}>
                Adicionar
              </Button>
              <Button size="sm" variant="ghost" onClick={onCloseQuickAdd}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ) : (
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start text-muted-foreground"
            onClick={onOpenQuickAdd}
          >
            <Plus className="h-4 w-4" /> Adicionar card
          </Button>
        )}
      </div>
    </div>
  );
}

export default function QuadroBoard() {
  const { boardId = "" } = useParams<{ boardId: string }>();
  const nav = useNavigate();
  const qc = useQueryClient();
  const { currentPlayer } = useAuth();
  const updateCardBoardPosicaoPosicaoMut = useUpdateCardBoardPosicaoPosicao();
  const updateCardBoardPosicaoListaEPosicaoMut = useUpdateCardBoardPosicaoListaEPosicao();
  const reordenarCardsMut = useReordenarCardsNaLista();
  const updateCardByIdMut = useUpdateCardById();
  const criarCardBoardAtomicoMut = useCriarCardBoardAtomico();
  const createBoardListaMut = useCreateBoardLista();
  const setBoardListaNomeMut = useSetBoardListaNome();
  const setBoardListaWipMut = useSetBoardListaWip();
  const setBoardListaCorMut = useSetBoardListaCor();
  const setBoardListaArquivadaMut = useSetBoardListaArquivada();
  const updateBoardListaPosicaoMut = useUpdateBoardListaPosicao();
  const scrollRef = useDragScroll<HTMLDivElement>();
  const [searchParams, setSearchParams] = useSearchParams();
  const cardAberto = searchParams.get("card");
  const setCardAberto = (id: string | null) => {
    const next = new URLSearchParams(searchParams);
    if (id) next.set("card", id);
    else next.delete("card");
    setSearchParams(next, { replace: true });
  };
  // URL state extra: ?view=&q=
  const view = (searchParams.get("view") as "kanban" | "calendar" | "tabela") || "kanban";
  const setView = (v: "kanban" | "calendar" | "tabela") => {
    const next = new URLSearchParams(searchParams);
    if (v === "kanban") next.delete("view");
    else next.set("view", v);
    setSearchParams(next, { replace: true });
  };
  const buscaUrl = searchParams.get("q") ?? "";
  const [busca, setBusca] = useState(buscaUrl);
  const buscaRef = useRef<HTMLInputElement | null>(null);
  useEffect(() => {
    const t = setTimeout(() => {
      const next = new URLSearchParams(searchParams);
      if (busca) next.set("q", busca);
      else next.delete("q");
      setSearchParams(next, { replace: true });
    }, 250);
    return () => clearTimeout(t);
  }, [busca, searchParams, setSearchParams]);

  // Filtros avançados (etiqueta, responsável, prazo, setor, sem-resp, checklist).
  const filtros = useMemo<FiltrosCards>(
    () => decodeFiltros(searchParams.get("filters")),
    [searchParams],
  );
  const setFiltros = (next: FiltrosCards) => {
    const sp = new URLSearchParams(searchParams);
    const s = encodeFiltros(next);
    if (s) sp.set("filters", s);
    else sp.delete("filters");
    setSearchParams(sp, { replace: true });
  };

  const [dndAnnounce, setDndAnnounce] = useState("");
  const [activeCardId, setActiveCardId] = useState<string | null>(null);
  const [overListaId, setOverListaId] = useState<string | null>(null);
  const [novaListaNome, setNovaListaNome] = useState("");
  const [novaListaOpen, setNovaListaOpen] = useState(false);
  const [editandoLista, setEditandoLista] = useState<Lista | null>(null);
  const [editNome, setEditNome] = useState("");
  const [wipDialog, setWipDialog] = useState<Lista | null>(null);
  const [wipValor, setWipValor] = useState<string>("");
  const [listaParaArquivar, setListaParaArquivar] = useState<Lista | null>(null);
  // Quick-add por lista
  const [quickAddOpen, setQuickAddOpen] = useState<string | null>(null);
  const [quickAddTitle, setQuickAddTitle] = useState("");
  const [criando, setCriando] = useState(false);
  // H5: dialog de config + sidebar de atividade
  const [configOpen, setConfigOpen] = useState(false);
  const [automacoesOpen, setAutomacoesOpen] = useState(false);
  const [editandoNome, setEditandoNome] = useState(false);
  const [nomeRascunho, setNomeRascunho] = useState("");
  async function salvarNomeBoard(id: string, nomeAtual: string) {
    const novo = nomeRascunho.trim();
    setEditandoNome(false);
    if (!novo || novo === nomeAtual) return;
    try {
      const { boardsRepo } = await import("@/lib/repositories/boards");
      await boardsRepo.setNome(id, novo);
      toast.success("Quadro renomeado");
      qc.invalidateQueries({ queryKey: boardsKeys.detail(id) });
      qc.invalidateQueries({ queryKey: boardsKeys.index });
      qc.invalidateQueries({ queryKey: ["breadcrumb-board", id] });
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao renomear");
    }
  }

  const [atividadeAberta, setAtividadeAberta] = useState(false);

  // Recolher listas horizontalmente (persistido por board)
  const collapsedKey = `kanban-collapsed:${boardId}`;
  const [collapsedListas, setCollapsedListas] = useState<Set<string>>(() => {
    if (typeof window === "undefined") return new Set();
    try {
      const raw = window.localStorage.getItem(collapsedKey);
      return new Set<string>(raw ? (JSON.parse(raw) as string[]) : []);
    } catch {
      return new Set<string>();
    }
  });
  const toggleCollapsedLista = (id: string) => {
    setCollapsedListas((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      try {
        window.localStorage.setItem(collapsedKey, JSON.stringify(Array.from(next)));
      } catch {
        /* ignore */
      }
      return next;
    });
  };

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const board = useQuery({
    queryKey: boardsKeys.detail(boardId ?? ""),
    queryFn: async (): Promise<{ board: BoardInfo; listas: Lista[] }> => {
      const [b, ls] = await Promise.all([
        boardsQueryFns.getBoardInfo(boardId!),
        boardsQueryFns.listListasAtivas(boardId!),
      ]);
      return { board: b as BoardInfo, listas: (ls ?? []) as Lista[] };
    },
    enabled: !!boardId,
  });

  const items = useQuery({
    queryKey: boardsKeys.items(boardId ?? ""),
    queryFn: async (): Promise<CardItem[]> => {
      const data = await boardsQueryFns.itemsResumo(boardId!);
      return ((data ?? []) as BoardItemResumoRow[]).map((p) => ({
        card_id: p.card_id,
        lista_id: p.lista_id,
        posicao: p.posicao,
        card: {
          id: p.id ?? p.card_id,
          numero: Number(p.numero ?? 0),
          titulo: p.titulo ?? "(sem título)",
          obra_id: p.obra_id ?? null,
          setores: p.setores ?? [],
          capa_cor: p.capa_cor ?? null,
          capa_url: p.capa_url ?? null,
          prazo: p.prazo ?? null,
          responsavel_id: p.responsavel_id ?? null,
          responsavel: p.responsavel_login ? { login: p.responsavel_login } : null,
          labels: p.labels ?? [],
          checklistTotal: Number(p.checklist_total ?? 0),
          checklistConcluido: Number(p.checklist_concluido ?? 0),
        },
      }));
    },
    enabled: !!boardId,
  });

  // Capa fallback (1º anexo de imagem) para cards sem capa explícita.
  const cardIdsSemCapa = useMemo(
    () =>
      (items.data ?? [])
        .filter((it) => !it.card.capa_url && !it.card.capa_cor)
        .map((it) => it.card_id),
    [items.data],
  );
  const covers = useCardCovers(cardIdsSemCapa);

  // Realtime — invalida ao mudar listas/posições/cards relacionadas a este board.
  useEffect(() => {
    if (!boardId) return;
    return boardsQueryFns.subscribeBoardChanges(
      boardId,
      () => qc.invalidateQueries({ queryKey: ["board-items", boardId] }),
      () => qc.invalidateQueries({ queryKey: ["board", boardId] }),
    );
  }, [boardId, qc]);

  // Todos os boards (para indicador "também em")
  const allBoards = useQuery({
    queryKey: boardsKeys.allRefs,
    queryFn: async (): Promise<QuadroRef[]> => {
      return (await boardsQueryFns.listAllRefs()) as QuadroRef[];
    },
    staleTime: 60_000,
  });

  const porLista = useMemo(() => {
    const m = new Map<string, CardItem[]>();
    const q = busca.trim().toLowerCase();
    const baseAll = items.data ?? [];
    // Aplica filtros avançados primeiro
    const filtraveis: CardFiltravel[] = baseAll.map((it) => ({
      responsavelId: it.card.responsavel_id,
      setores: it.card.setores,
      labelIds: it.card.labels.map((l) => l.id),
      prazo: it.card.prazo,
      checklistTotal: it.card.checklistTotal,
      checklistConcluido: it.card.checklistConcluido,
    }));
    const filtrados = aplicaFiltros(filtraveis, filtros);
    const allowSet = new Set<string>();
    for (let i = 0; i < filtraveis.length; i++) {
      if (filtrados.includes(filtraveis[i])) allowSet.add(baseAll[i].card_id);
    }
    for (const it of baseAll) {
      if (!allowSet.has(it.card_id)) continue;
      if (q) {
        const hay =
          `#${it.card.numero} ${it.card.titulo} ${it.card.responsavel?.login ?? ""}`.toLowerCase();
        if (!hay.includes(q)) continue;
      }
      const arr = m.get(it.lista_id) ?? [];
      arr.push(it);
      m.set(it.lista_id, arr);
    }
    return m;
  }, [items.data, busca, filtros]);

  // Opções dos filtros derivadas dos cards atualmente carregados.
  const opcoesFiltro = useMemo(() => {
    const labels = new Map<string, { id: string; nome: string; cor: string }>();
    const resps = new Map<string, string>();
    const setores = new Set<string>();
    for (const it of items.data ?? []) {
      for (const l of it.card.labels) labels.set(l.id, l);
      if (it.card.responsavel_id) {
        resps.set(it.card.responsavel_id, it.card.responsavel?.login ?? "(sem nome)");
      }
      for (const s of it.card.setores) setores.add(s);
    }
    return {
      labels: Array.from(labels.values()).sort((a, b) => a.nome.localeCompare(b.nome)),
      responsaveis: Array.from(resps.entries())
        .map(([id, nome]) => ({ id, nome }))
        .sort((a, b) => a.nome.localeCompare(b.nome)),
      setores: Array.from(setores).sort(),
    };
  }, [items.data]);

  // Lista achatada (já filtrada por busca) para Calendar/Tabela.
  const itemsFiltrados = useMemo(() => {
    const out: CardItem[] = [];
    for (const arr of porLista.values()) out.push(...arr);
    return out;
  }, [porLista]);

  // PRO-027.slice-04 · dispara automações `card_vencendo` uma vez por
  // sessão para cada (regra, card). Best-effort: falhas não travam o board.
  const automacoesQuery = useBoardAutomacoes(boardId);
  const vencidosFiredRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (!items.data) return;
    try {
      const regras = (automacoesQuery.data ?? []).map(toAutomacao);
      if (!regras.length) return;
      const cards = itemsFiltrados.map((it) => ({
        id: it.card.id,
        titulo: it.card.titulo,
        data_fim: it.card.prazo,
      }));
      const hoje = new Date().toISOString().slice(0, 10);
      const agendadas = runOnVencimento(regras, cards, { boardId, hoje });
      for (const ag of agendadas) {
        const chave = `${ag.regraId}:${ag.cardId}`;
        if (vencidosFiredRef.current.has(chave)) continue;
        vencidosFiredRef.current.add(chave);
        if (ag.acao.tipo === "notificar") toast.message(ag.acao.mensagem);
      }
    } catch {
      /* automações são best-effort */
    }
  }, [boardId, items.data, itemsFiltrados, automacoesQuery.data]);

  // Para droppables sobrepostos (sortable da lista + droppable de cards no mesmo nó),
  // pointerWithin é mais previsível que closestCenter; rectIntersection cobre o caso
  // do ponteiro fora dos rects (drop em borda).
  const collisionDetection: CollisionDetection = (args) => {
    const pw = pointerWithin(args);
    return pw.length > 0 ? pw : rectIntersection(args);
  };

  async function onDragEnd(e: DragEndEvent) {
    const activeId = String(e.active.id);
    const overId = e.over?.id ? String(e.over.id) : null;
    setActiveCardId(null);
    setOverListaId(null);
    if (!overId) {
      setDndAnnounce("Movimentação cancelada.");
      return;
    }

    // ---- Reorder de listas
    if (activeId.startsWith("lista-sort:")) {
      if (!overId.startsWith("lista-sort:")) return;
      const fromId = activeId.slice("lista-sort:".length);
      const toId = overId.slice("lista-sort:".length);
      if (fromId === toId) return;
      const atuais = board.data?.listas ?? [];
      const oldIdx = atuais.findIndex((l) => l.id === fromId);
      const newIdx = atuais.findIndex((l) => l.id === toId);
      if (oldIdx < 0 || newIdx < 0) return;
      const reord = arrayMove(atuais, oldIdx, newIdx);
      // grava todas as posicoes (simples + idempotente)
      const updates = reord.map((l, i) =>
        updateBoardListaPosicaoMut.mutateAsync({ id: l.id, posicao: i }),
      );
      const res = await Promise.allSettled(updates);
      const erro = res.find((r) => r.status === "rejected");
      if (erro && erro.status === "rejected") return toast.error("Erro ao reordenar listas.");
      qc.invalidateQueries({ queryKey: ["board", boardId] });
      setDndAnnounce("Listas reordenadas.");
      return;
    }

    // ---- Card sortável (Trello-like): destino pode ser uma lista ou um card-alvo.
    const cardId = activeId;
    const all = items.data ?? [];
    const origem = all.find((i) => i.card_id === cardId);
    if (!origem) return;

    // Resolve lista destino e índice destino.
    let destListaId: string | null = null;
    let destIndex: number | null = null;
    if (overId.startsWith("lista:")) {
      destListaId = overId.slice("lista:".length);
      destIndex = (porLista.get(destListaId) ?? []).length;
    } else if (overId.startsWith("lista-sort:")) {
      destListaId = overId.slice("lista-sort:".length);
      destIndex = (porLista.get(destListaId) ?? []).length;
    } else {
      // overId é id de outro card → inserir naquela posição
      const alvo = all.find((i) => i.card_id === overId);
      if (!alvo) return;
      destListaId = alvo.lista_id;
      const arr = porLista.get(destListaId) ?? [];
      destIndex = arr.findIndex((c) => c.card_id === overId);
      if (destIndex < 0) destIndex = arr.length;
    }
    if (!destListaId || destIndex === null) return;

    const origemListaId = origem.lista_id;
    const mesmaLista = origemListaId === destListaId;

    // Reconstrói arrays origem e destino, persiste posições afetadas.
    const updates: Promise<unknown>[] = [];
    if (mesmaLista) {
      const arr = [...(porLista.get(origemListaId) ?? [])];
      const fromIdx = arr.findIndex((c) => c.card_id === cardId);
      if (fromIdx < 0 || fromIdx === destIndex) return;
      const reord = arrayMove(arr, fromIdx, destIndex);

      const newCardIds = reord.map((c) => c.card_id);

      // Persistência Atômica (Sprint 3 / P1-6)
      try {
        await reordenarCardsMut.mutateAsync({
          boardId: boardId!,
          listaId: destListaId,
          cardIds: newCardIds,
        });
      } catch (e) {
        toast.error("Erro ao reordenar cartões");
        return;
      }
    } else {
      const arrOrig = (porLista.get(origemListaId) ?? []).filter((c) => c.card_id !== cardId);
      const arrDest = [...(porLista.get(destListaId) ?? [])];
      const insertAt = Math.min(destIndex, arrDest.length);
      arrDest.splice(insertAt, 0, origem);
      arrOrig.forEach((c, i) => {
        if (c.posicao !== i) {
          updates.push(
            updateCardBoardPosicaoPosicaoMut.mutateAsync({
              cardId: c.card_id,
              boardId: boardId!,
              posicao: i,
            }),
          );
        }
      });
      arrDest.forEach((c, i) => {
        if (c.card_id === cardId) {
          updates.push(
            updateCardBoardPosicaoListaEPosicaoMut.mutateAsync({
              cardId,
              boardId: boardId!,
              listaId: destListaId,
              posicao: i,
            }),
          );
        } else if (c.posicao !== i) {
          updates.push(
            updateCardBoardPosicaoPosicaoMut.mutateAsync({
              cardId: c.card_id,
              boardId: boardId!,
              posicao: i,
            }),
          );
        }
      });
    }
    if (updates.length === 0) return;
    const res = await Promise.allSettled(updates);
    const erro = res.find((r) => r.status === "rejected");
    if (erro) {
      toast.error("Falha ao mover card");
      return;
    }
    const destino = (board.data?.listas ?? []).find((l) => l.id === destListaId);
    setDndAnnounce(
      mesmaLista ? "Card reordenado." : `Card movido para ${destino?.nome ?? "outra lista"}.`,
    );
    // Sincroniza o status do card com a coluna de destino.
    if (!mesmaLista && destino) {
      const novoStatus = statusDaLista(destino);
      if (novoStatus) {
        try {
          await updateCardByIdMut.mutateAsync({
            cardId,
            patch: { status: novoStatus },
          });
        } catch {
          toast.error("Card movido, mas falhou ao atualizar o status.");
        }
      }
    }
    qc.invalidateQueries({ queryKey: ["board-items", boardId] });
    qc.invalidateQueries({ queryKey: ["card", cardId] });
  }

  async function criarLista() {
    const nome = novaListaNome.trim();
    if (!nome) return;
    const pos = (board.data?.listas ?? []).length;
    try {
      await createBoardListaMut.mutateAsync({ board_id: boardId, nome, posicao: pos });
    } catch (e: any) {
      return toast.error(e?.message ?? "Falha ao criar lista");
    }
    setNovaListaNome("");
    setNovaListaOpen(false);
    qc.invalidateQueries({ queryKey: ["board", boardId] });
  }

  async function salvarRenome() {
    if (!editandoLista) return;
    const nome = editNome.trim();
    if (!nome) return;
    try {
      await setBoardListaNomeMut.mutateAsync({ id: editandoLista.id, nome, boardId });
    } catch (e: any) {
      return toast.error(e?.message ?? "Falha");
    }
    setEditandoLista(null);
    qc.invalidateQueries({ queryKey: ["board", boardId] });
  }

  async function salvarWip() {
    if (!wipDialog) return;
    const v = wipValor.trim();
    const num = v === "" ? null : Math.max(1, parseInt(v, 10));
    if (v !== "" && Number.isNaN(num as number)) return toast.error("Valor inválido");
    try {
      await setBoardListaWipMut.mutateAsync({ id: wipDialog.id, wip_limite: num, boardId });
    } catch (e: any) {
      return toast.error(e?.message ?? "Falha");
    }
    setWipDialog(null);
    qc.invalidateQueries({ queryKey: ["board", boardId] });
  }

  async function arquivarLista(l: Lista) {
    try {
      await setBoardListaArquivadaMut.mutateAsync({ id: l.id, arquivada: true, boardId });
    } catch (e: any) {
      return toast.error(e?.message ?? "Falha");
    }
    qc.invalidateQueries({ queryKey: ["board", boardId] });
  }

  // Quick-add: cria card já posicionado na lista escolhida.
  async function criarCardNaLista(listaId: string) {
    if (criando) return;
    const titulo = quickAddTitle.trim();
    if (!titulo) return;
    setCriando(true);
    try {
      const result = await criarCardBoardAtomicoMut.mutateAsync({
        p_board_id: boardId!,
        p_lista_id: listaId,
        p_titulo: titulo,
        p_criado_por: currentPlayer?.login ?? "sistema",
      });

      // O RPC retorna { data: { card_id, numero } }
      const novo = (result as any)?.data;
      if (!novo || !novo.card_id) {
        throw new Error("O servidor não retornou os dados do novo card.");
      }

      setQuickAddTitle("");
      setQuickAddOpen(null);
      toast.success("Card criado");
      // Invalidar board items e config
      qc.invalidateQueries({ queryKey: boardsKeys.items(boardId) });
      qc.invalidateQueries({ queryKey: boardsKeys.detail(boardId) });
    } catch (e: any) {
      console.error("Erro ao criar card:", e);
      toast.error(e?.message ?? "Falha ao criar card. Verifique suas permissões.");
    } finally {
      setCriando(false);
    }
  }

  // Atalhos de teclado: "/" foca busca, "n" abre quick-add na 1ª lista, "Esc" fecha.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      const editando =
        !!t &&
        (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || (t as HTMLElement).isContentEditable);
      if (editando) {
        if (e.key === "Escape" && quickAddOpen) {
          setQuickAddOpen(null);
          setQuickAddTitle("");
        }
        return;
      }
      if (e.key === "/") {
        e.preventDefault();
        buscaRef.current?.focus();
      } else if (e.key.toLowerCase() === "n") {
        const primeira = board.data?.listas[0];
        if (primeira) {
          e.preventDefault();
          setQuickAddOpen(primeira.id);
          setQuickAddTitle("");
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [board.data, quickAddOpen]);

  if (board.isLoading) {
    return <Skeleton className="h-[60vh] w-full" />;
  }
  if (board.isError || !board.data) {
    return (
      <div className="p-6 text-center text-sm text-muted-foreground">
        Quadro não encontrado.{" "}
        <Button variant="link" onClick={() => nav("/quadros")}>
          Voltar
        </Button>
      </div>
    );
  }

  const { board: b, listas } = board.data;
  const boardsList = allBoards.data ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2 min-w-0">
          <Button asChild variant="ghost" size="sm">
            <Link to="/quadros">
              <ArrowLeft className="h-4 w-4" /> Kanban
            </Link>
          </Button>
          <h1 className="font-display text-xl font-bold flex items-center gap-2 min-w-0">
            <LayoutGrid className="h-5 w-5 text-primary shrink-0" />
            {editandoNome ? (
              <Input
                autoFocus
                value={nomeRascunho}
                onChange={(e) => setNomeRascunho(e.target.value)}
                onBlur={() => salvarNomeBoard(b.id, b.nome)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                  if (e.key === "Escape") {
                    setEditandoNome(false);
                    setNomeRascunho(b.nome);
                  }
                }}
                className="h-8 w-[280px]"
              />
            ) : (
              <button
                type="button"
                className="truncate hover:text-primary text-left"
                title="Renomear quadro"
                onClick={() => {
                  setNomeRascunho(b.nome);
                  setEditandoNome(true);
                }}
              >
                {b.nome}
              </button>
            )}
          </h1>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            title="Renomear quadro"
            onClick={() => {
              setNomeRascunho(b.nome);
              setEditandoNome(true);
            }}
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Badge variant="outline" className="text-[10px]">
            {b.tipo}
          </Badge>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              ref={buscaRef}
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar (/ foca)"
              className="pl-8 h-9 w-[220px]"
              aria-label="Buscar cards"
            />
            {busca && (
              <button
                type="button"
                onClick={() => setBusca("")}
                aria-label="Limpar busca"
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          <ToggleGroup
            type="single"
            value={view}
            onValueChange={(v) => v && setView(v as "kanban" | "calendar" | "tabela")}
            size="sm"
            variant="outline"
            aria-label="Modo de visualização"
          >
            <ToggleGroupItem value="kanban" aria-label="Kanban">
              <LayoutGrid className="h-4 w-4" />
            </ToggleGroupItem>
            <ToggleGroupItem value="calendar" aria-label="Calendário">
              <CalendarIcon className="h-4 w-4" />
            </ToggleGroupItem>
            <ToggleGroupItem value="tabela" aria-label="Tabela">
              <Rows3 className="h-4 w-4" />
            </ToggleGroupItem>
          </ToggleGroup>
          <FiltrosCardsPanel
            value={filtros}
            onChange={setFiltros}
            labelsDisponiveis={opcoesFiltro.labels}
            responsaveisDisponiveis={opcoesFiltro.responsaveis}
            setoresDisponiveis={opcoesFiltro.setores}
          />
          <QuadroViewsSalvas
            meusSetores={b.setor ? [b.setor] : []}
            isGM={true}
            filtrosAtuais={filtros as unknown as FiltrosView}
            onAplicar={(f) => setFiltros(f as unknown as FiltrosCards)}
          />
          <Button
            variant="outline"
            size="sm"
            onClick={() => setAutomacoesOpen(true)}
            title="Automações do quadro"
          >
            <Zap className="h-4 w-4 md:mr-1" />
            <span className="hidden md:inline">Automações</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setConfigOpen(true)}
            title="Configurar quadro"
          >
            <Settings className="h-4 w-4 md:mr-1" />
            <span className="hidden md:inline">Config</span>
          </Button>
        </div>
      </div>

      {view === "calendar" && (
        <QuadroCalendarView
          cards={itemsFiltrados.map((it) => {
            const lista = listas.find((l) => l.id === it.lista_id);
            return {
              id: it.card.id,
              numero: it.card.numero,
              titulo: it.card.titulo,
              status: lista?.nome ?? "—",
              prazo: it.card.prazo,
            };
          })}
          onOpenCard={(id) => setCardAberto(id)}
        />
      )}

      {view === "tabela" && (
        <QuadroTabelaView
          cards={itemsFiltrados.map((it) => {
            const lista = listas.find((l) => l.id === it.lista_id);
            return {
              id: it.card.id,
              numero: it.card.numero,
              titulo: it.card.titulo,
              status: lista?.nome ?? "—",
              prazo: it.card.prazo,
              responsavel: it.card.responsavel,
              card_setores: it.card.setores.map((s) => ({ setor: s })),
              card_label_links: it.card.labels.map((l) => ({ card_labels: l })),
            };
          })}
          onOpenCard={(id) => setCardAberto(id)}
        />
      )}

      {view === "kanban" && (
        <div className="space-y-2">
          <DesktopOnlyHint label="Kanban otimizado para desktop." />
          <div className="flex gap-2 items-start">
            <DndContext
              sensors={sensors}
              accessibility={{
                announcements: dndAnnouncementsPtBR(),
                screenReaderInstructions: dndScreenReaderInstructionsPtBR,
              }}
              collisionDetection={collisionDetection}
              onDragStart={(e: DragStartEvent) => {
                const id = String(e.active.id);
                if (!id.startsWith("lista-sort:")) setActiveCardId(id);
              }}
              onDragOver={(e: DragOverEvent) => {
                if (!activeCardId) return;
                const overId = e.over?.id ? String(e.over.id) : null;
                if (!overId) {
                  setOverListaId(null);
                  return;
                }
                if (overId.startsWith("lista:")) setOverListaId(overId.slice("lista:".length));
                else if (overId.startsWith("lista-sort:"))
                  setOverListaId(overId.slice("lista-sort:".length));
                else {
                  const alvo = (items.data ?? []).find((i) => i.card_id === overId);
                  setOverListaId(alvo?.lista_id ?? null);
                }
              }}
              onDragCancel={() => {
                setActiveCardId(null);
                setOverListaId(null);
              }}
              onDragEnd={onDragEnd}
            >
              <div aria-live="polite" role="status" className="sr-only">
                {dndAnnounce}
              </div>
              <div ref={scrollRef} className="board-scroll-x pb-4 flex-1 min-w-0">
                <div className="flex gap-4 pb-1 min-w-max items-start">
                  <SortableContext
                    items={listas.map((l) => `lista-sort:${l.id}`)}
                    strategy={horizontalListSortingStrategy}
                  >
                    {listas.map((lista) => {
                      const cards = porLista.get(lista.id) ?? [];
                      const wipExcedido = !!lista.wip_limite && cards.length > lista.wip_limite;
                      return (
                        <ColunaLista
                          key={lista.id}
                          lista={lista}
                          collapsed={collapsedListas.has(lista.id)}
                          onToggleCollapsed={() => toggleCollapsedLista(lista.id)}
                          count={cards.length}
                          wipExcedido={wipExcedido}
                          isCardOver={!!activeCardId && overListaId === lista.id}
                          onRenomear={() => {
                            setEditandoLista(lista);
                            setEditNome(lista.nome);
                          }}
                          onArquivar={() => setListaParaArquivar(lista)}
                          onSetWip={() => {
                            setWipDialog(lista);
                            setWipValor(lista.wip_limite?.toString() ?? "");
                          }}
                          onSetCor={async (cor) => {
                            try {
                              await setBoardListaCorMut.mutateAsync({ id: lista.id, cor, boardId });
                            } catch (e: any) {
                              return toast.error(e?.message ?? "Falha");
                            }
                            qc.invalidateQueries({ queryKey: ["board", boardId] });
                          }}
                          quickAddOpen={quickAddOpen === lista.id}
                          quickAddTitle={quickAddOpen === lista.id ? quickAddTitle : ""}
                          setQuickAddTitle={setQuickAddTitle}
                          onOpenQuickAdd={() => {
                            setQuickAddOpen(lista.id);
                            setQuickAddTitle("");
                          }}
                          onCloseQuickAdd={() => {
                            setQuickAddOpen(null);
                            setQuickAddTitle("");
                          }}
                          onCreate={() => criarCardNaLista(lista.id)}
                          criando={criando}
                        >
                          <SortableContext
                            items={cards.map((c) => c.card_id)}
                            strategy={verticalListSortingStrategy}
                          >
                            {cards.map((it) => {
                              const cardRef: CardRef = {
                                id: it.card.id,
                                obra_id: it.card.obra_id,
                                setores: it.card.setores,
                              };
                              const others = quadrosDoCard(cardRef, boardsList).filter(
                                (x) => x.id !== boardId,
                              );
                              return (
                                <SortableCard
                                  key={it.card_id}
                                  item={it}
                                  onOpen={() => setCardAberto(it.card_id)}
                                  otherBoards={others}
                                  coverFallback={covers.data?.[it.card_id]}
                                />
                              );
                            })}
                          </SortableContext>
                          {cards.length === 0 && (
                            <div className="text-xs text-muted-foreground text-center py-4">
                              Vazio
                            </div>
                          )}
                        </ColunaLista>
                      );
                    })}
                  </SortableContext>
                  {listas.length === 0 && (
                    <div className="text-sm text-muted-foreground p-8">
                      Este quadro não tem listas ainda.
                    </div>
                  )}
                  {/* Adicionar lista */}
                  <div className="w-72 shrink-0">
                    <Button
                      variant="outline"
                      className="w-full justify-start"
                      onClick={() => setNovaListaOpen(true)}
                    >
                      <Plus className="h-4 w-4" /> Adicionar lista
                    </Button>
                  </div>
                </div>
              </div>
              <DragOverlay dropAnimation={{ duration: 180 }}>
                {activeCardId
                  ? (() => {
                      const it = (items.data ?? []).find((x) => x.card_id === activeCardId);
                      if (!it) return null;
                      const cardRef: CardRef = {
                        id: it.card.id,
                        obra_id: it.card.obra_id,
                        setores: it.card.setores,
                      };
                      const others = quadrosDoCard(cardRef, boardsList).filter(
                        (x) => x.id !== boardId,
                      );
                      return (
                        <div className="w-72 rotate-2 shadow-2xl">
                          <CardVisual
                            item={it}
                            otherBoards={others}
                            coverFallback={covers.data?.[it.card_id]}
                          />
                        </div>
                      );
                    })()
                  : null}
              </DragOverlay>
            </DndContext>
            <BoardAtividadeSidebar
              boardId={boardId}
              open={atividadeAberta}
              onToggle={() => setAtividadeAberta((v) => !v)}
              onOpenCard={(id) => setCardAberto(id)}
            />
          </div>
        </div>
      )}

      {cardAberto && (
        <CardGenericoDialog
          cardId={cardAberto}
          open={!!cardAberto}
          onOpenChange={(o) => !o && setCardAberto(null)}
          boardAtualId={boardId}
        />
      )}

      <BoardConfigDialog boardId={boardId} open={configOpen} onOpenChange={setConfigOpen} />

      <BoardAutomacoesDialog
        boardId={boardId}
        listas={listas.map((l) => ({ id: l.id, nome: l.nome }))}
        templateId={b.tipo === "obra" ? "obras" : "generico"}
        open={automacoesOpen}
        onOpenChange={setAutomacoesOpen}
      />

      {/* Nova lista */}
      <Dialog open={novaListaOpen} onOpenChange={setNovaListaOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova lista</DialogTitle>
          </DialogHeader>
          <Input
            autoFocus
            placeholder="Nome da lista"
            value={novaListaNome}
            onChange={(e) => setNovaListaNome(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && criarLista()}
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setNovaListaOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={criarLista} disabled={!novaListaNome.trim()}>
              Criar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Renomear lista */}
      <Dialog open={!!editandoLista} onOpenChange={(o) => !o && setEditandoLista(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Renomear lista</DialogTitle>
          </DialogHeader>
          <Input
            autoFocus
            value={editNome}
            onChange={(e) => setEditNome(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && salvarRenome()}
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditandoLista(null)}>
              Cancelar
            </Button>
            <Button onClick={salvarRenome} disabled={!editNome.trim()}>
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* WIP */}
      <Dialog open={!!wipDialog} onOpenChange={(o) => !o && setWipDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Limite WIP</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="wip-valor">Máximo de cards (vazio = sem limite)</Label>
            <Input
              id="wip-valor"
              type="number"
              min={1}
              autoFocus
              value={wipValor}
              onChange={(e) => setWipValor(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && salvarWip()}
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setWipDialog(null)}>
              Cancelar
            </Button>
            <Button onClick={salvarWip}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Arquivar lista */}
      <AlertDialog
        open={!!listaParaArquivar}
        onOpenChange={(o) => !o && setListaParaArquivar(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Arquivar lista</AlertDialogTitle>
            <AlertDialogDescription>
              {listaParaArquivar && (
                <>
                  A lista <strong>{listaParaArquivar.nome}</strong> será arquivada. Os cards
                  permanecem no pool, mas a coluna some deste quadro.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                const l = listaParaArquivar;
                setListaParaArquivar(null);
                if (l) await arquivarLista(l);
              }}
            >
              Arquivar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
