import React, { useState, useMemo } from "react";
import { usePermissions } from "@/contexts/auth/usePermissions";
import { useContratosContext } from "@/contexts/ContratosContext";
import { useObrasContext } from "@/contexts/ObrasContext";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertCircle, Download, Loader2, FileSignature, Search, Coffee } from "lucide-react";
import ColumnFilter from "@/components/common/ColumnFilter";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import DeleteConfirmDialog from "@/components/common/DeleteConfirmDialog";
import MaskedDateInput from "@/components/common/MaskedDateInput";
import { Alert, AlertDescription } from "@/components/ui/alert";
import ContratoProfileDialog, {
  STATUS_CONTRATO,
} from "@/components/contratos/ContratoProfileDialog";
import { ComentarioBadgeButton } from "@/components/common/ComentarioBadgeButton";
import { ComentariosDrawer } from "@/components/common/ComentariosDrawer";
import { comentariosContrato } from "@/hooks/comentarios/useComentariosEntidade";
import { Badge } from "@/components/ui/badge";
import * as XLSX from "xlsx";
import { fmtDataLocal } from "@/lib/core/date";

const QuadroContratos = () => {
  const { contratos, mobilizarContrato, deleteContrato, updateContrato } = useContratosContext();
  const { hasAccess, currentPlayer } = usePermissions();
  const { obras } = useObrasContext();
  const canEdit = hasAccess("contratos", "editar");
  const isGM = currentPlayer?.isGM;
  const activeObras = obras.filter((o) => o.ativa);

  const [search, setSearch] = useState("");
  const [hiddenColumns, setHiddenColumns] = useState<Set<string>>(new Set());
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [draggedIds, setDraggedIds] = useState<string[]>([]);
  const [dragOverCol, setDragOverCol] = useState<string | null | undefined>(undefined);
  const [mobDialog, setMobDialog] = useState<{
    ids: string[];
    obraDestinoId: string | null;
  } | null>(null);
  const [mobDate, setMobDate] = useState("");
  const [mobLoading, setMobLoading] = useState(false);
  const [mobError, setMobError] = useState("");

  const [profileOpen, setProfileOpen] = useState(false);
  const [profileId, setProfileId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; nome: string } | null>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [exportDateFrom, setExportDateFrom] = useState("");
  const [exportDateTo, setExportDateTo] = useState("");

  // Comentários encadeados por contrato (balão no card → drawer).
  const { data: comentariosCount } = comentariosContrato.useContagem();
  const [comentando, setComentando] = useState<{ id: string; nome: string } | null>(null);

  const OCIOSO_ID = "__ocioso__";

  const activeContratos = useMemo(() => {
    let list = contratos.filter((c) => c.ativo);
    if (search) {
      const s = search.toLowerCase();
      list = list.filter(
        (c) =>
          c.locacaoServico.toLowerCase().includes(s) ||
          c.tipo.toLowerCase().includes(s) ||
          c.responsavel.toLowerCase().includes(s),
      );
    }
    return list;
  }, [contratos, search]);

  const toggleSelection = (id: string) => {
    if (!canEdit) return;
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleCardClick = (id: string, e: React.MouseEvent) => {
    if (!canEdit) return;
    if (e.ctrlKey || e.metaKey) {
      toggleSelection(id);
    }
  };

  const handleDragStart = (id: string) => {
    if (selectedIds.has(id) && selectedIds.size > 1) setDraggedIds(Array.from(selectedIds));
    else setDraggedIds([id]);
  };

  const getColumnContratoBucket = (c: (typeof contratos)[0]): string | null => {
    if (c.ocioso) return OCIOSO_ID;
    return c.obraAtualId;
  };

  const handleDrop = (colId: string | null, e: React.DragEvent) => {
    e.preventDefault();
    if (draggedIds.length === 0 || !canEdit) return;
    const idsToMove = draggedIds.filter((id) => {
      const c = contratos.find((x) => x.id === id);
      return c && getColumnContratoBucket(c) !== colId;
    });
    if (idsToMove.length === 0) {
      setDraggedIds([]);
      return;
    }

    if (colId === OCIOSO_ID) {
      // Marca como ocioso direto, sem dialog de data
      idsToMove.forEach((id) => {
        const c = contratos.find((x) => x.id === id);
        if (!c) return;
        updateContrato(id, {
          obraAtualId: null,
          ocioso: true,
          historico: [
            ...c.historico,
            {
              id: crypto.randomUUID(),
              tipo: "mobilizacao" as const,
              descricao: `Mobilizado de "${c.obraAtualId ? obras.find((o) => o.id === c.obraAtualId)?.nome || "Sem Alocação" : c.ocioso ? "Ocioso" : "Sem Alocação"}" para "Ocioso" em ${fmtDataLocal(new Date())}`,
              data: new Date().toISOString(),
              usuario: currentPlayer?.login || "Sistema",
            },
          ],
        });
      });
      setSelectedIds(new Set());
      setDraggedIds([]);
      return;
    }

    setMobDialog({ ids: idsToMove, obraDestinoId: colId });
    setMobDate("");
    setMobError("");
    setDraggedIds([]);
  };

  const confirmMobilization = async () => {
    if (!mobDialog || !mobDate) return;
    const parts = mobDate.split("-");
    if (parts.length !== 3) return;
    const ano = parseInt(parts[0]),
      mes = parseInt(parts[1]),
      dia = parseInt(parts[2]);
    setMobLoading(true);
    setMobError("");
    try {
      for (const id of mobDialog.ids) {
        await mobilizarContrato(id, mobDialog.obraDestinoId, dia, mes, ano);
        // Garante que sai de "ocioso" ao mover para uma obra
        const c = contratos.find((x) => x.id === id);
        if (c?.ocioso) updateContrato(id, { ocioso: false });
      }
      setMobDialog(null);
      setSelectedIds(new Set());
    } catch {
      setMobError("Falha ao mobilizar contrato(s). Tente novamente.");
    } finally {
      setMobLoading(false);
    }
  };

  const handleContextMove = (id: string, colId: string | null) => {
    const c = contratos.find((x) => x.id === id);
    if (!c) return;
    if (colId === OCIOSO_ID) {
      handleDrop(OCIOSO_ID, { preventDefault: () => {} } as any);
      setDraggedIds([id]);
      handleDrop(OCIOSO_ID, { preventDefault: () => {} } as any);
      return;
    }
    const idsToMove =
      selectedIds.has(id) && selectedIds.size > 1
        ? Array.from(selectedIds).filter((sid) => {
            const cc = contratos.find((x) => x.id === sid);
            return cc && getColumnContratoBucket(cc) !== colId;
          })
        : [id];
    if (idsToMove.length === 0) return;
    setMobDialog({ ids: idsToMove, obraDestinoId: colId });
    setMobDate("");
    setMobError("");
  };

  const FIXED_COLUMNS = [{ id: OCIOSO_ID as string | null, nome: "Ocioso", icon: Coffee }];

  const columns = [
    { id: null as string | null, nome: "Sem Alocação", icon: null as any },
    ...activeObras
      .slice()
      .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"))
      .map((o) => ({ id: o.id as string | null, nome: o.nome, icon: null as any })),
    ...FIXED_COLUMNS,
  ];

  const mobNames = mobDialog
    ? mobDialog.ids.map((id) => contratos.find((c) => c.id === id)?.locacaoServico).filter(Boolean)
    : [];

  const handleExport = () => {
    if (!exportDateFrom || !exportDateTo) return;
    const from = new Date(exportDateFrom);
    const to = new Date(exportDateTo);
    to.setHours(23, 59, 59, 999);

    const rows: any[] = [];
    contratos.forEach((c) => {
      c.historico
        .filter((h) => h.tipo === "mobilizacao")
        .forEach((h) => {
          const hDate = new Date(h.data);
          if (hDate >= from && hDate <= to) {
            const m = h.descricao.match(/de "(.+?)" para "(.+?)"(?: em (\S+))?/);
            rows.push({
              "Locação/Serviços": c.locacaoServico,
              Tipo: c.tipo,
              De: m?.[1] || "",
              Para: m?.[2] || "",
              "Data do Movimento": fmtDataLocal(h.data),
              "Data de Mobilização": m?.[3] || "",
              Usuário: h.usuario,
            });
          }
        });
    });

    if (rows.length === 0)
      rows.push({
        "Locação/Serviços": "Nenhuma movimentação no período",
        Tipo: "",
        De: "",
        Para: "",
        "Data do Movimento": "",
        "Data de Mobilização": "",
        Usuário: "",
      });
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Movimentações");
    XLSX.writeFile(wb, `movimentacoes_contratos_${exportDateFrom}_a_${exportDateTo}.xlsx`);
    setExportOpen(false);
  };

  return (
    <div
      className="flex flex-col h-[calc(100vh-7rem)]"
      onClick={(e) => {
        if (
          !(e.ctrlKey || e.metaKey) &&
          (e.target as HTMLElement).closest(".patrimonio-tag") === null
        ) {
          setSelectedIds(new Set());
        }
      }}
    >
      <div className="flex items-center justify-between mb-4 shrink-0">
        <div className="flex items-center gap-3">
          <h2 className="font-display text-2xl font-bold flex items-center gap-2">
            <FileSignature className="h-6 w-6" /> Gestão de Contratos
          </h2>
          {selectedIds.size > 0 && (
            <span className="text-xs bg-primary/10 text-primary font-medium px-2 py-1 rounded-full">
              {selectedIds.size} selecionado{selectedIds.size > 1 ? "s" : ""}
            </span>
          )}
        </div>
        <Button variant="outline" size="sm" onClick={() => setExportOpen(true)}>
          <Download className="h-4 w-4 mr-1" /> Exportar movimentações
        </Button>
      </div>

      <div className="flex items-center gap-2 mb-4 shrink-0">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por locação, tipo ou responsável..."
            className="pl-9"
          />
        </div>
        <ColumnFilter
          columns={columns.map((c) => ({ id: c.id ?? "__none__", label: c.nome }))}
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
      </div>

      <ScrollArea className="flex-1 min-h-0">
        <div className="flex gap-4 pb-4 min-w-max">
          {columns
            .filter((col) => !hiddenColumns.has(col.id ?? "__none__"))
            .filter((col) => {
              if (!search.trim()) return true;
              return activeContratos.some((c) => getColumnContratoBucket(c) === col.id);
            })
            .map((col) => {
              const isFixed = col.id === OCIOSO_ID;
              const isDragOver = dragOverCol === col.id;
              const colItems = activeContratos.filter((c) => getColumnContratoBucket(c) === col.id);

              return (
                <div
                  key={col.id ?? "none"}
                  className={`obra-column transition-all duration-200 ${isFixed ? "border-dashed border-muted-foreground/30" : ""} ${isDragOver ? "ring-2 ring-primary ring-inset bg-primary/5 rounded-lg" : ""}`}
                  onDragEnter={(e) => {
                    e.preventDefault();
                    setDragOverCol(col.id);
                  }}
                  onDragOver={(e) => e.preventDefault()}
                  onDragLeave={(e) => {
                    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                      setDragOverCol(undefined);
                    }
                  }}
                  onDrop={(e) => {
                    setDragOverCol(undefined);
                    handleDrop(col.id, e);
                  }}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h3
                        className={`font-display text-sm font-semibold truncate flex items-center gap-1.5 ${isFixed ? "text-muted-foreground" : ""}`}
                      >
                        {col.icon && <col.icon className="h-3.5 w-3.5 shrink-0" />}
                        {col.nome}
                      </h3>
                    </div>
                    <TooltipProvider delayDuration={200}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="text-xs text-muted-foreground bg-secondary rounded-full px-2 py-0.5 cursor-default">
                            {colItems.length}
                          </span>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="text-xs">
                          {colItems.length === 0 ? (
                            <p>Nenhum contrato</p>
                          ) : (
                            <p>
                              {colItems.length} contrato{colItems.length > 1 ? "s" : ""}
                            </p>
                          )}
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                  <div className="space-y-2 min-h-[60px]">
                    {colItems.map((c) => {
                      const status =
                        STATUS_CONTRATO.find((s) => s.value === c.status) || STATUS_CONTRATO[0];
                      return (
                        <ContextMenu key={c.id}>
                          <ContextMenuTrigger>
                            <div
                              className={`patrimonio-tag employee-tag group relative flex items-center ${c.mobilizacaoPendente ? "employee-tag-pending" : ""} ${selectedIds.has(c.id) ? "ring-2 ring-primary ring-offset-1 ring-offset-background" : ""}`}
                              draggable={canEdit}
                              onDragStart={() => handleDragStart(c.id)}
                              onClick={(e) => handleCardClick(c.id, e)}
                              onDoubleClick={() => {
                                setProfileId(c.id);
                                setProfileOpen(true);
                              }}
                            >
                              {canEdit && (
                                <div
                                  className={`mr-2 flex items-center shrink-0 transition-opacity ${selectedIds.has(c.id) ? "opacity-100" : "opacity-0 group-hover:opacity-100 focus-within:opacity-100"}`}
                                >
                                  <input
                                    type="checkbox"
                                    checked={selectedIds.has(c.id)}
                                    onChange={() => toggleSelection(c.id)}
                                    onClick={(e) => e.stopPropagation()}
                                    className="h-4 w-4 cursor-pointer accent-primary rounded border-gray-300"
                                    aria-label={`Selecionar ${c.locacaoServico}`}
                                  />
                                </div>
                              )}
                              <div className="matricula-badge">
                                {c.tipo.slice(0, 3).toUpperCase()}
                              </div>
                              <div className="min-w-0 flex-1 pr-8">
                                <p className="text-sm font-medium truncate">
                                  <span className="truncate">{c.locacaoServico}</span>
                                </p>
                                <ComentarioBadgeButton
                                  count={comentariosCount.get(c.id) || 0}
                                  onClick={() =>
                                    setComentando({ id: c.id, nome: c.locacaoServico })
                                  }
                                  className="absolute top-1 right-1 z-10"
                                />
                                <div className="flex gap-1 mt-0.5 flex-wrap">
                                  <Badge
                                    variant="outline"
                                    className={`text-[9px] px-1 py-0 ${status.className}`}
                                  >
                                    {status.label}
                                  </Badge>
                                </div>
                              </div>
                              {c.mobilizacaoPendente && (
                                <div className="text-[10px] text-accent font-semibold shrink-0 text-right leading-tight">
                                  <p>→ {c.mobilizacaoPendente.dataMobilizacao}</p>
                                  <p>{c.mobilizacaoPendente.obraDestinoNome}</p>
                                </div>
                              )}
                            </div>
                          </ContextMenuTrigger>
                          <ContextMenuContent>
                            {canEdit &&
                              columns
                                .filter((cc) => cc.id !== getColumnContratoBucket(c))
                                .map((cc) => (
                                  <ContextMenuItem
                                    key={cc.id ?? "none"}
                                    onClick={() => handleContextMove(c.id, cc.id)}
                                  >
                                    Mover{" "}
                                    {selectedIds.has(c.id) && selectedIds.size > 1
                                      ? `${selectedIds.size} selecionados`
                                      : ""}{" "}
                                    para {cc.nome}
                                  </ContextMenuItem>
                                ))}
                            {isGM && (
                              <>
                                <ContextMenuSeparator />
                                <ContextMenuItem
                                  className="text-destructive"
                                  onClick={() =>
                                    setDeleteTarget({ id: c.id, nome: c.locacaoServico })
                                  }
                                >
                                  Excluir
                                </ContextMenuItem>
                              </>
                            )}
                          </ContextMenuContent>
                        </ContextMenu>
                      );
                    })}
                  </div>
                </div>
              );
            })}
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>

      {/* Mobilization Dialog */}
      <Dialog
        open={!!mobDialog}
        onOpenChange={(v) => {
          if (!v && !mobLoading) setMobDialog(null);
        }}
      >
        <DialogContent className="max-w-xs">
          <DialogHeader>
            <DialogTitle className="font-display text-lg">
              {mobNames.length > 1
                ? `Mobilizar ${mobNames.length} contratos`
                : "Quando será mobilizado?"}
            </DialogTitle>
          </DialogHeader>
          {mobNames.length > 1 && (
            <div className="text-xs text-muted-foreground max-h-20 overflow-auto space-y-0.5">
              {mobNames.map((n, i) => (
                <p key={i}>• {n}</p>
              ))}
            </div>
          )}
          <div>
            <Label className="text-xs">Data da Mobilização</Label>
            <MaskedDateInput value={mobDate} onChange={setMobDate} className="mt-1" />
          </div>
          {mobError && (
            <Alert variant="destructive" className="py-2">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="text-xs">{mobError}</AlertDescription>
            </Alert>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setMobDialog(null)} disabled={mobLoading}>
              Cancelar
            </Button>
            <Button onClick={confirmMobilization} disabled={!mobDate || mobLoading}>
              {mobLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" /> Mobilizando…
                </>
              ) : (
                "Confirmar"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <DeleteConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && deleteContrato(deleteTarget.id)}
        title="Excluir Contrato"
        description={`Deseja realmente excluir "${deleteTarget?.nome}"? Esta ação é irreversível.`}
      />

      <ContratoProfileDialog
        open={profileOpen}
        onClose={() => setProfileOpen(false)}
        contratoId={profileId}
      />

      <ComentariosDrawer
        tipo="contrato"
        id={comentando?.id ?? null}
        nome={comentando?.nome}
        open={!!comentando}
        onOpenChange={(v) => !v && setComentando(null)}
      />

      <Dialog open={exportOpen} onOpenChange={(v) => !v && setExportOpen(false)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-display">Exportar Movimentações</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Data Início</Label>
              <MaskedDateInput
                value={exportDateFrom}
                onChange={setExportDateFrom}
                className="mt-1"
              />
            </div>
            <div>
              <Label className="text-xs">Data Fim</Label>
              <MaskedDateInput value={exportDateTo} onChange={setExportDateTo} className="mt-1" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setExportOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleExport} disabled={!exportDateFrom || !exportDateTo}>
              Exportar XLS
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default QuadroContratos;
