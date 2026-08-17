import React, { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { Link } from "react-router-dom";
import { usePermissions } from "@/contexts/auth/usePermissions";
import { useObrasContext } from "@/contexts/ObrasContext";
import { useColaboradoresContext } from "@/contexts/ColaboradoresContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import DatePickerField from "@/components/common/DatePickerField";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
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
import { Checkbox } from "@/components/ui/checkbox";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  ClipboardList,
  Coffee,
  Download,
  ExternalLink,
  History,
  Palmtree,
  Redo2,
  ShieldAlert,
  Trash2,
  Undo2,
  UserX,
} from "lucide-react";
import { cn } from "@/lib/utils";
import * as XLSX from "xlsx";
import { AllocationBoard, BoardColumn } from "@/components/quadros/AllocationBoard";
import type { Colaborador } from "@/types";
import { fmtDataHora, fmtDataLocal } from "@/lib/core/date";
import { STORAGE_KEYS } from "@/lib/core/storage/keys";

interface TempMove {
  id: string;
  colabId: string;
  fromId: string | null;
  toId: string | null;
  timestamp: string;
}

const DRAFT_KEY = STORAGE_KEYS.mobilizacaoProvisoriaDraft;
const MAX_HISTORY = 50;

interface DraftState {
  tempPositions: Record<string, string | null>;
  moves: TempMove[];
  scenarioName: string;
  scenarioDate: string;
}

const loadDraft = (): DraftState => {
  try {
    const raw = sessionStorage.getItem(DRAFT_KEY);
    if (!raw) return { tempPositions: {}, moves: [], scenarioName: "", scenarioDate: "" };
    const parsed = JSON.parse(raw);
    return {
      tempPositions: parsed.tempPositions || {},
      moves: Array.isArray(parsed.moves) ? parsed.moves : [],
      scenarioName: parsed.scenarioName || "",
      scenarioDate: parsed.scenarioDate || "",
    };
  } catch {
    return { tempPositions: {}, moves: [], scenarioName: "", scenarioDate: "" };
  }
};

const FIXED_COLUMNS: BoardColumn[] = [
  { id: "__folga__", nome: "Folga", icon: Coffee, isFixed: true },
  { id: "__afastamento__", nome: "Afastamento", icon: UserX, isFixed: true },
  { id: "__ferias__", nome: "Férias", icon: Palmtree, isFixed: true },
];

type Snapshot = { tempPositions: Record<string, string | null>; moves: TempMove[] };

const MobilizacaoProvisoria = () => {
  const { hasAccess } = usePermissions();
  const { obras } = useObrasContext();
  const { colaboradores } = useColaboradoresContext();
  const canEdit = hasAccess("obras_div", "editar");
  const activeObras = obras.filter((o) => o.ativa);
  const isLoading = colaboradores.length === 0 && obras.length === 0;

  const initial = useRef<DraftState>(loadDraft());
  const [tempPositions, setTempPositions] = useState<Record<string, string | null>>(
    initial.current.tempPositions,
  );
  const [moves, setMoves] = useState<TempMove[]>(initial.current.moves);
  const [scenarioName, setScenarioName] = useState(initial.current.scenarioName);
  const [scenarioDate, setScenarioDate] = useState(initial.current.scenarioDate);

  // Histórico para undo/redo (snapshots de tempPositions + moves)
  const [past, setPast] = useState<Snapshot[]>([]);
  const [future, setFuture] = useState<Snapshot[]>([]);

  const [changesOpen, setChangesOpen] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);

  const hasDraft =
    Object.keys(tempPositions).length > 0 ||
    moves.length > 0 ||
    scenarioName.trim() !== "" ||
    scenarioDate !== "";

  // Persistência
  useEffect(() => {
    try {
      if (hasDraft) {
        sessionStorage.setItem(
          DRAFT_KEY,
          JSON.stringify({ tempPositions, moves, scenarioName, scenarioDate }),
        );
      } else {
        sessionStorage.removeItem(DRAFT_KEY);
      }
    } catch {
      /* storage indisponível */
    }
  }, [tempPositions, moves, scenarioName, scenarioDate, hasDraft]);

  // Guarda de fechamento
  useEffect(() => {
    if (!hasDraft) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [hasDraft]);

  // Atalhos de teclado: Ctrl/Cmd+Z, Ctrl/Cmd+Shift+Z (ou Ctrl+Y)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)
      )
        return;
      const mod = e.ctrlKey || e.metaKey;
      if (!mod) return;
      if (e.key.toLowerCase() === "z" && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if ((e.key.toLowerCase() === "z" && e.shiftKey) || e.key.toLowerCase() === "y") {
        e.preventDefault();
        redo();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [past, future, tempPositions, moves]);

  const activeColabs = useMemo(() => colaboradores.filter((c) => c.ativo), [colaboradores]);

  const getOriginalPosition = (colabId: string): string | null => {
    const c = colaboradores.find((x) => x.id === colabId);
    return c?.statusEspecial || c?.obraAtualId || null;
  };

  const getColabPosition = (colabId: string): string | null => {
    if (colabId in tempPositions) return tempPositions[colabId];
    return getOriginalPosition(colabId);
  };

  const getColumnName = (id: string | null): string => {
    if (!id) return "Sem alocação";
    const specialNames: Record<string, string> = {
      __folga__: "Folga",
      __afastamento__: "Afastamento",
      __ferias__: "Férias",
    };
    if (specialNames[id]) return specialNames[id];
    return obras.find((o) => o.id === id)?.nome || "Sem alocação";
  };

  const columns: BoardColumn[] = useMemo(
    () => [
      { id: null, nome: "Sem alocação" },
      ...FIXED_COLUMNS,
      ...activeObras
        .slice()
        .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"))
        .map<BoardColumn>((o) => ({ id: o.id, nome: o.nome })),
    ],
    [activeObras],
  );

  const pushHistory = useCallback(() => {
    setPast((prev) => {
      const next = [...prev, { tempPositions: { ...tempPositions }, moves: [...moves] }];
      return next.length > MAX_HISTORY ? next.slice(next.length - MAX_HISTORY) : next;
    });
    setFuture([]);
  }, [tempPositions, moves]);

  const moveColabs = (ids: string[], destId: string | null) => {
    const now = new Date().toISOString();
    const newPositions = { ...tempPositions };
    const newMoves: TempMove[] = [];
    ids.forEach((id) => {
      const fromId = getColabPosition(id);
      if (fromId === destId) return;
      const original = getOriginalPosition(id);
      if (destId === original) delete newPositions[id];
      else newPositions[id] = destId;
      newMoves.push({ id: crypto.randomUUID(), colabId: id, fromId, toId: destId, timestamp: now });
    });
    if (newMoves.length === 0) return;
    pushHistory();
    setTempPositions(newPositions);
    setMoves((prev) => [...prev, ...newMoves]);
  };

  const revertColab = (colabId: string) => {
    if (!(colabId in tempPositions)) return;
    pushHistory();
    setTempPositions((prev) => {
      const next = { ...prev };
      delete next[colabId];
      return next;
    });
    setMoves((prev) => prev.filter((m) => m.colabId !== colabId));
  };

  const clearAll = () => {
    if (hasDraft) pushHistory();
    setTempPositions({});
    setMoves([]);
    setConfirmClear(false);
  };

  const undo = () => {
    setPast((prev) => {
      if (prev.length === 0) return prev;
      const last = prev[prev.length - 1];
      setFuture((f) => [...f, { tempPositions: { ...tempPositions }, moves: [...moves] }]);
      setTempPositions(last.tempPositions);
      setMoves(last.moves);
      return prev.slice(0, -1);
    });
  };

  const redo = () => {
    setFuture((prev) => {
      if (prev.length === 0) return prev;
      const next = prev[prev.length - 1];
      setPast((p) => [...p, { tempPositions: { ...tempPositions }, moves: [...moves] }]);
      setTempPositions(next.tempPositions);
      setMoves(next.moves);
      return prev.slice(0, -1);
    });
  };

  const scenarioBaseName = () => {
    const slug = (scenarioName.trim() || "cenario")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "");
    const date = scenarioDate || new Date().toISOString().slice(0, 10);
    return `${slug}_${date}`;
  };

  // Exporta o LOG de movimentações do cenário
  const handleExportMoves = () => {
    const today = new Date();
    const todayStr = scenarioDate ? fmtDataLocal(scenarioDate + "T00:00:00") : fmtDataLocal(today);
    const rows = moves.map((m) => {
      const colab = colaboradores.find((c) => c.id === m.colabId);
      return {
        Cenário: scenarioName || "—",
        "Data alvo": todayStr,
        Matrícula: colab?.matricula || "",
        Nome: colab?.nome || "",
        Função: colab?.funcao || "",
        De: getColumnName(m.fromId),
        Para: getColumnName(m.toId),
        "Registrado em": fmtDataHora(m.timestamp),
      };
    });
    if (rows.length === 0) {
      rows.push({
        Cenário: scenarioName || "—",
        "Data alvo": todayStr,
        Matrícula: "",
        Nome: "Nenhuma movimentação",
        Função: "",
        De: "",
        Para: "",
        "Registrado em": "",
      });
    }
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Movimentações");
    XLSX.writeFile(wb, `mob_prov_movimentacoes_${scenarioBaseName()}.xlsx`);
  };

  // Exporta o SNAPSHOT resultante (estado final simulado, 1 linha por colaborador)
  const handleSnapshotExport = () => {
    const rows = activeColabs
      .map((c) => {
        const pos = getColabPosition(c.id);
        const original = getOriginalPosition(c.id);
        const moved = c.id in tempPositions;
        return {
          Cenário: scenarioName || "—",
          "Data alvo": scenarioDate ? fmtDataLocal(scenarioDate + "T00:00:00") : "",
          Matrícula: c.matricula.padStart(4, "0"),
          Nome: c.nome,
          Função: c.funcao,
          "Coluna atual (real)": getColumnName(original),
          "Coluna simulada": getColumnName(pos),
          Alterado: moved ? "Sim" : "Não",
        };
      })
      .sort((a, b) => a["Coluna simulada"].localeCompare(b["Coluna simulada"], "pt-BR"));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Snapshot");
    XLSX.writeFile(wb, `mob_prov_snapshot_${scenarioBaseName()}.xlsx`);
  };

  const effectiveChanges = useMemo(() => {
    return Object.keys(tempPositions).map((colabId) => {
      const colab = colaboradores.find((c) => c.id === colabId);
      return {
        colabId,
        nome: colab?.nome || "—",
        matricula: colab?.matricula || "",
        fromName: getColumnName(getOriginalPosition(colabId)),
        toName: getColumnName(tempPositions[colabId]),
      };
    });
  }, [tempPositions, colaboradores, obras]);

  const canUndo = past.length > 0;
  const canRedo = future.length > 0;

  // Banner de simulação
  const banner = (
    <div className="flex items-center gap-2 mb-3 px-3 py-2 rounded-md border border-warning/40 bg-warning/15 text-foreground dark:bg-warning/25 shrink-0 flex-wrap">
      <AlertTriangle className="h-4 w-4 text-warning shrink-0" />
      <span className="text-xs font-medium text-foreground">
        Simulação — as alterações não são salvas na realidade.
      </span>
      <Link
        to="/rh/equipes"
        className="text-xs underline underline-offset-2 inline-flex items-center gap-1 text-foreground hover:text-primary ml-1"
      >
        ver Gestão de Equipe <ExternalLink className="h-3 w-3" />
      </Link>
      <div className="flex-1" />
      {hasDraft && (
        <span className="text-[11px] bg-warning/20 text-warning px-2 py-0.5 rounded-full font-medium">
          rascunho ativo
        </span>
      )}
    </div>
  );

  const headerActions = (
    <>
      <div className="flex items-center gap-1.5">
        <Input
          value={scenarioName}
          onChange={(e) => setScenarioName(e.target.value)}
          placeholder="Nome do cenário"
          className="h-8 w-40 text-xs"
        />
        <DatePickerField
          value={scenarioDate}
          onChange={(v) => setScenarioDate(v)}
          className="w-36"
          inputClassName="h-8 text-xs"
          title="Data alvo do cenário"
        />
      </div>
      <TooltipProvider delayDuration={300}>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="outline" size="sm" onClick={undo} disabled={!canUndo} className="px-2">
              <Undo2 className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Desfazer (Ctrl+Z)</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="outline" size="sm" onClick={redo} disabled={!canRedo} className="px-2">
              <Redo2 className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Refazer (Ctrl+Shift+Z)</TooltipContent>
        </Tooltip>
      </TooltipProvider>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setChangesOpen((o) => !o)}
        disabled={effectiveChanges.length === 0}
        className="gap-1"
      >
        <History className="h-4 w-4" />
        {effectiveChanges.length} mov.
        {changesOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setConfirmClear(true)}
        disabled={!hasDraft}
        className="text-destructive hover:text-destructive"
      >
        <Trash2 className="h-4 w-4 mr-1" /> Limpar
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={handleSnapshotExport}
        title="Exportar estado final simulado"
      >
        <Download className="h-4 w-4 mr-1" /> Snapshot
      </Button>
    </>
  );

  return (
    <>
      <AllocationBoard<Colaborador>
        banner={
          <>
            {banner}
            {changesOpen && effectiveChanges.length > 0 && (
              <div className="mb-3 border rounded-md bg-card shrink-0 max-h-48 overflow-auto">
                <ul className="divide-y divide-border text-xs">
                  {effectiveChanges.map((ch) => (
                    <li key={ch.colabId} className="flex items-center gap-2 px-3 py-2">
                      <span className="font-mono text-[10px] text-muted-foreground w-10 shrink-0">
                        {ch.matricula.padStart(4, "0")}
                      </span>
                      <span className="font-medium truncate flex-1 min-w-0">{ch.nome}</span>
                      <span className="text-muted-foreground truncate">
                        {ch.fromName} <span className="text-foreground">→</span> {ch.toName}
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2 text-xs"
                        onClick={() => revertColab(ch.colabId)}
                      >
                        <Undo2 className="h-3 w-3 mr-1" /> Reverter
                      </Button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        }
        title={
          <h2 className="font-display text-2xl font-bold flex items-center gap-2">
            <ClipboardList className="h-6 w-6" /> Mobilização Provisória
          </h2>
        }
        headerActions={headerActions}
        columns={columns}
        cards={activeColabs}
        positionOf={(c) => getColabPosition(c.id)}
        getSearchableText={(c) => `${c.nome} ${c.matricula} ${c.funcao} ${c.localNascimento || ""}`}
        getFuncao={(c) => c.funcao || ""}
        canEdit={canEdit}
        onMove={moveColabs}
        isLoading={isLoading}
        renderCard={(c, ctx) => {
          const wasMoved = c.id in tempPositions;
          const destId = ctx.columnId;
          const destObra = destId ? obras.find((o) => o.id === destId) : null;
          const integracaoPendente =
            !!destObra?.requerIntegracao && !c.integracoes.some((i) => i.obraId === destId);
          const card = (
            <div
              className={cn(
                "employee-tag group relative",
                wasMoved && "ring-1 ring-accent/50",
                ctx.isSelected && "ring-2 ring-primary ring-offset-1 ring-offset-background",
              )}
              onClick={ctx.handleClick}
            >
              {canEdit && (
                <Checkbox
                  checked={ctx.isSelected}
                  onCheckedChange={ctx.toggleSelect}
                  onClick={(e) => e.stopPropagation()}
                  aria-label={`Selecionar ${c.nome}`}
                  className={cn(
                    "shrink-0 transition-opacity",
                    ctx.isSelected
                      ? "opacity-100"
                      : "opacity-0 group-hover:opacity-100 focus-visible:opacity-100",
                  )}
                />
              )}
              <div className="matricula-badge">{c.matricula.padStart(4, "0")}</div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate">{c.nome}</p>
                <p className="text-[11px] text-muted-foreground truncate">{c.funcao}</p>
              </div>
              {integracaoPendente && (
                <TooltipProvider delayDuration={200}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="inline-flex items-center gap-0.5 rounded-full bg-warning/15 text-warning text-[10px] font-medium px-1.5 py-0.5 shrink-0">
                        <ShieldAlert className="h-3 w-3" />
                      </span>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="text-xs">
                      Integração pendente para esta obra
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </div>
          );
          if (!canEdit || !wasMoved) return card;
          return (
            <ContextMenu>
              <ContextMenuTrigger asChild>{card}</ContextMenuTrigger>
              <ContextMenuContent>
                <ContextMenuItem onClick={() => revertColab(c.id)} className="text-warning">
                  <Undo2 className="h-3.5 w-3.5 mr-2" /> Voltar ao original (
                  {getColumnName(getOriginalPosition(c.id))})
                </ContextMenuItem>
              </ContextMenuContent>
            </ContextMenu>
          );
        }}
      />

      <AlertDialog open={confirmClear} onOpenChange={setConfirmClear}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Limpar a simulação?</AlertDialogTitle>
            <AlertDialogDescription>
              Os {effectiveChanges.length} movimento{effectiveChanges.length === 1 ? "" : "s"}{" "}
              provisóri{effectiveChanges.length === 1 ? "o" : "os"} serão descartados. Esta ação
              pode ser desfeita com Ctrl+Z.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={clearAll}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Descartar tudo
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default MobilizacaoProvisoria;
