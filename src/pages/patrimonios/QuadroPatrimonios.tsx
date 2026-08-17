import React, { useState, useMemo } from "react";
import { User } from "lucide-react";
import { usePermissions } from "@/contexts/auth/usePermissions";
import { useColaboradoresContext } from "@/contexts/ColaboradoresContext";
import { usePatrimoniosContext } from "@/contexts/PatrimoniosContext";
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
import { AlertCircle, Download, Loader2, Package, Search, Wrench, Droplets } from "lucide-react";
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
import PatrimonioProfileDialog from "@/components/patrimonios/PatrimonioProfileDialog";
import { ComentarioBadgeButton } from "@/components/common/ComentarioBadgeButton";
import { ComentariosDrawer } from "@/components/common/ComentariosDrawer";
import { comentariosPatrimonio } from "@/hooks/comentarios/useComentariosEntidade";
import { Badge } from "@/components/ui/badge";
import * as XLSX from "xlsx";
import { etiquetasDaColuna } from "@/lib/patrimonios/reflexo";
import { fmtDataLocal } from "@/lib/core/date";

const QuadroPatrimonios = () => {
  const { hasAccess, currentPlayer } = usePermissions();
  const { obras } = useObrasContext();
  const { colaboradores } = useColaboradoresContext();
  const { patrimonios, mobilizarPatrimonio, deletePatrimonio } = usePatrimoniosContext();
  const canEdit = hasAccess("patrimonios", "editar");
  const isGM = currentPlayer?.isGM;
  const canViewPatProfile = hasAccess("patrimonios", "editar");
  const activeObras = obras.filter((o) => o.ativa);
  const responsaveis = colaboradores.filter(
    (c) => c.ativo && (c.responsabilidades || []).includes("quadroPatrimonios"),
  );

  const [search, setSearch] = useState("");
  const [hiddenColumns, setHiddenColumns] = useState<Set<string>>(new Set());
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [draggedIds, setDraggedIds] = useState<string[]>([]);
  const [dragOverCol, setDragOverCol] = useState<string | null | undefined>(undefined);
  const [mobDialog, setMobDialog] = useState<{
    patIds: string[];
    obraDestinoId: string | null;
  } | null>(null);
  // Arrastar uma etiqueta REFLETIDA desfaz o vínculo com o responsável. O
  // quadro confirma isso antes de pedir a data — a etiqueta na obra é reflexo,
  // não a posição real do bem.
  const [reflexoDialog, setReflexoDialog] = useState<{
    patIds: string[];
    obraDestinoId: string | null;
    responsaveis: string[];
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

  // Comentários encadeados por patrimônio (balão no card → drawer).
  const { data: comentariosCount } = comentariosPatrimonio.useContagem();
  const [comentando, setComentando] = useState<{ id: string; nome: string } | null>(null);

  const activePatrimonios = useMemo(() => {
    let list = patrimonios.filter((p) => p.ativo);
    if (search) {
      const s = search.toLowerCase();
      list = list.filter((p) => p.nome.toLowerCase().includes(s) || p.codigo.includes(search));
    }
    return list;
  }, [patrimonios, search]);

  const toggleSelection = (patId: string) => {
    if (!canEdit) return;
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(patId)) next.delete(patId);
      else next.add(patId);
      return next;
    });
  };

  const handleCardClick = (patId: string, e: React.MouseEvent) => {
    if (!canEdit) return;
    if (e.ctrlKey || e.metaKey) {
      toggleSelection(patId);
    }
  };

  const handleDragStart = (patId: string) => {
    if (selectedIds.has(patId) && selectedIds.size > 1) setDraggedIds(Array.from(selectedIds));
    else setDraggedIds([patId]);
  };

  /**
   * Abre o fluxo de mobilização para os ids dados. Quando algum deles está
   * apenas REFLETIDO numa obra (a posse real é de um responsável), pede
   * confirmação primeiro: mover a etiqueta encerra a responsabilidade, e isso
   * precisa ser uma decisão consciente, não um efeito colateral do arrasto.
   */
  const iniciarMobilizacao = (idsToMove: string[], obraId: string | null) => {
    if (idsToMove.length === 0) return;
    const comResponsavel = idsToMove.filter((id) => {
      const pat = patrimonios.find((p) => p.id === id);
      return !!pat?.responsavelId;
    });
    if (comResponsavel.length > 0) {
      const nomes = Array.from(
        new Set(
          comResponsavel
            .map((id) => patrimonios.find((p) => p.id === id)?.responsavelId)
            .map((cid) => colaboradores.find((c) => c.id === cid)?.nome)
            .filter(Boolean) as string[],
        ),
      );
      setReflexoDialog({ patIds: idsToMove, obraDestinoId: obraId, responsaveis: nomes });
      return;
    }
    setMobDialog({ patIds: idsToMove, obraDestinoId: obraId });
    setMobDate("");
    setMobError("");
  };

  const handleDrop = (obraId: string | null, e: React.DragEvent) => {
    e.preventDefault();
    if (draggedIds.length === 0 || !canEdit) return;
    const idsToMove = draggedIds.filter((id) => {
      const pat = patrimonios.find((p) => p.id === id);
      return pat && (pat.obraAtualId || null) !== obraId;
    });
    setDraggedIds([]);
    iniciarMobilizacao(idsToMove, obraId);
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
      for (const patId of mobDialog.patIds) {
        await mobilizarPatrimonio(patId, mobDialog.obraDestinoId, dia, mes, ano);
      }
      setMobDialog(null);
      setSelectedIds(new Set());
    } catch {
      setMobError("Falha ao mobilizar patrimônio(s). Tente novamente.");
    } finally {
      setMobLoading(false);
    }
  };

  const handleContextMove = (patId: string, obraId: string | null) => {
    const idsToMove =
      selectedIds.has(patId) && selectedIds.size > 1
        ? Array.from(selectedIds).filter((id) => {
            const pat = patrimonios.find((p) => p.id === id);
            return pat && (pat.obraAtualId || null) !== obraId;
          })
        : [patId];
    iniciarMobilizacao(idsToMove, obraId);
  };

  const FIXED_COLUMN_IDS = new Set(["__manutencao__", "__sujo__"]);
  const RESPONSAVEL_PREFIX = "__resp__";

  const FIXED_COLUMNS = [
    { id: "__manutencao__" as string | null, nome: "Em Manutenção", icon: Wrench },
    { id: "__sujo__" as string | null, nome: "Sujo", icon: Droplets },
  ];

  const responsavelColumns = responsaveis.map((c) => {
    const obraNome = obras.find((o) => o.id === c.obraAtualId)?.nome;
    return {
      id: `${RESPONSAVEL_PREFIX}${c.id}` as string | null,
      nome: c.nome,
      obraInfo: obraNome ? `(${obraNome})` : null,
      icon: User,
    };
  });

  const columns = [
    {
      id: null as string | null,
      nome: "Sem Alocação",
      obraInfo: null as string | null,
      icon: null as any,
    },
    ...activeObras
      .slice()
      .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"))
      .map((o) => ({
        id: o.id as string | null,
        nome: o.nome,
        obraInfo: null as string | null,
        icon: null as any,
      })),
    ...responsavelColumns,
    ...FIXED_COLUMNS.map((c) => ({ ...c, obraInfo: null as string | null })),
  ];

  const mobPatNames = mobDialog
    ? mobDialog.patIds.map((id) => patrimonios.find((p) => p.id === id)?.nome).filter(Boolean)
    : [];

  const getStatusBadges = (pat: (typeof patrimonios)[0]) => {
    const badges: {
      label: string;
      variant: "destructive" | "secondary" | "outline";
      className?: string;
    }[] = [];
    if (pat.alugado)
      badges.push({
        label: "Alugado",
        variant: "outline",
        className: "bg-warning/15 text-warning border-warning/40",
      });
    if (pat.riscado) badges.push({ label: "Riscado", variant: "outline" });
    if (pat.quebrado) badges.push({ label: "Quebrado", variant: "destructive" });
    if (pat.emManutencao)
      badges.push({
        label: "Em Manutenção",
        variant: "outline",
        className: "bg-warning/15 text-warning border-warning/40",
      });
    if (pat.sujo)
      badges.push({
        label: "Sujo",
        variant: "outline",
        className: "bg-warning/15 text-warning border-warning/40",
      });
    return badges;
  };

  const handleExport = () => {
    if (!exportDateFrom || !exportDateTo) return;
    const from = new Date(exportDateFrom);
    const to = new Date(exportDateTo);
    to.setHours(23, 59, 59, 999);

    const rows: any[] = [];
    patrimonios.forEach((p) => {
      p.historico
        .filter((h) => h.tipo === "mobilizacao")
        .forEach((h) => {
          const hDate = new Date(h.data);
          if (hDate >= from && hDate <= to) {
            const match = h.descricao.match(/de "(.+?)" para "(.+?)"(?: em (\S+))?/);
            const de = match?.[1] || "";
            const para = match?.[2] || "";
            const dataMob = match?.[3] || "";
            rows.push({
              Código: p.codigo,
              Nome: p.nome,
              De: de,
              Para: para,
              "Data do Movimento": fmtDataLocal(h.data),
              "Data de Mobilização": dataMob,
              Usuário: h.usuario,
            });
          }
        });
    });

    if (rows.length === 0) {
      rows.push({
        Código: "",
        Nome: "Nenhuma movimentação no período",
        De: "",
        Para: "",
        "Data do Movimento": "",
        "Data de Mobilização": "",
        Usuário: "",
      });
    }

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Movimentações");
    XLSX.writeFile(wb, `movimentacoes_patrimonios_${exportDateFrom}_a_${exportDateTo}.xlsx`);
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
            <Package className="h-6 w-6" /> Gestão de Patrimônios
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
            placeholder="Buscar por nome ou código..."
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
              // Filtro inteligente: quando busca está ativa, esconde colunas sem resultados.
              if (!search.trim()) return true;
              return activePatrimonios.some((p) => (p.obraAtualId || null) === col.id);
            })
            .map((col) => {
              const isFixed = FIXED_COLUMN_IDS.has(col.id || "");
              const isResp = (col.id || "").startsWith(RESPONSAVEL_PREFIX);
              const isDragOver = dragOverCol === col.id;
              // Etiquetas da coluna = as próprias + as refletidas por
              // responsáveis alocados nesta obra. O bem com responsável mora na
              // coluna dele; aqui ele apenas aparece.
              const etiquetas = etiquetasDaColuna(col.id, activePatrimonios, colaboradores);
              const colPats = etiquetas.map((e) => e.item);
              return (
                <div
                  key={col.id ?? "none"}
                  className={`obra-column transition-all duration-200 ${isFixed ? "border-dashed border-muted-foreground/30" : ""} ${isResp ? "border-dashed border-primary/30 bg-primary/[0.02]" : ""} ${isDragOver ? "ring-2 ring-primary ring-inset bg-primary/5 rounded-lg" : ""}`}
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
                        className={`font-display text-sm font-semibold truncate flex items-center gap-1.5 ${isFixed ? "text-muted-foreground" : ""} ${isResp ? "text-primary" : ""}`}
                      >
                        {col.icon && <col.icon className="h-3.5 w-3.5 shrink-0" />}
                        {col.nome}
                      </h3>
                      {col.obraInfo && (
                        <p className="text-[10px] text-muted-foreground truncate">{col.obraInfo}</p>
                      )}
                    </div>
                    <TooltipProvider delayDuration={200}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="text-xs text-muted-foreground bg-secondary rounded-full px-2 py-0.5 cursor-default">
                            {colPats.length}
                          </span>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="text-xs">
                          {colPats.length === 0 ? (
                            <p>Nenhum patrimônio</p>
                          ) : (
                            <p>
                              {colPats.length} patrimônio{colPats.length > 1 ? "s" : ""}
                            </p>
                          )}
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                  <div className="space-y-2 min-h-[60px]">
                    {etiquetas.map(({ item: p, origem, responsavelId }) => {
                      const badges = getStatusBadges(p);
                      const ehReflexo = origem === "reflexo";
                      const respNome = ehReflexo
                        ? colaboradores.find((c) => c.id === responsavelId)?.nome
                        : undefined;
                      return (
                        <ContextMenu key={`${origem}-${p.id}`}>
                          <ContextMenuTrigger>
                            <div
                              title={
                                ehReflexo
                                  ? `Sob responsabilidade de ${respNome ?? "colaborador"} — aparece aqui porque ${respNome ? "ele" : "o responsável"} está nesta obra`
                                  : undefined
                              }
                              className={`patrimonio-tag employee-tag group relative flex items-center ${p.mobilizacaoPendente ? "employee-tag-pending" : ""} ${ehReflexo ? "employee-tag-reflexo" : ""} ${selectedIds.has(p.id) ? "ring-2 ring-primary ring-offset-1 ring-offset-background" : ""}`}
                              draggable={canEdit}
                              onDragStart={() => handleDragStart(p.id)}
                              onClick={(e) => handleCardClick(p.id, e)}
                              onDoubleClick={() => {
                                if (!canViewPatProfile) return;
                                setProfileId(p.id);
                                setProfileOpen(true);
                              }}
                            >
                              {canEdit && (
                                <div
                                  className={`mr-2 flex items-center shrink-0 transition-opacity ${selectedIds.has(p.id) ? "opacity-100" : "opacity-0 group-hover:opacity-100 focus-within:opacity-100"}`}
                                >
                                  <input
                                    type="checkbox"
                                    checked={selectedIds.has(p.id)}
                                    onChange={() => toggleSelection(p.id)}
                                    onClick={(e) => e.stopPropagation()}
                                    className="h-4 w-4 cursor-pointer accent-primary rounded border-gray-300"
                                    aria-label={`Selecionar ${p.nome}`}
                                  />
                                </div>
                              )}
                              <div className="matricula-badge">{p.codigo}</div>
                              <div className="min-w-0 flex-1 pr-8">
                                <p className="text-sm font-medium truncate">
                                  <span className="truncate">{p.nome}</span>
                                </p>
                              <ComentarioBadgeButton
                                count={comentariosCount.get(p.id) || 0}
                                onClick={() => setComentando({ id: p.id, nome: p.nome })}
                                className="absolute top-1 right-1 z-10"
                              />
                                {badges.length > 0 && (
                                  <div className="flex gap-1 mt-0.5">
                                    {badges.map((b) => (
                                      <Badge
                                        key={b.label}
                                        variant={b.variant}
                                        className={`text-[9px] px-1 py-0 ${b.className || ""}`}
                                      >
                                        {b.label}
                                      </Badge>
                                    ))}
                                  </div>
                                )}
                              </div>
                              {ehReflexo && !p.mobilizacaoPendente && (
                                <div className="text-[10px] font-semibold shrink-0 text-right leading-tight text-[hsl(var(--info))]">
                                  <p>reflexo</p>
                                  <p className="font-normal truncate max-w-[7rem]">{respNome}</p>
                                </div>
                              )}
                              {p.mobilizacaoPendente && (
                                <div className="text-[10px] text-accent font-semibold shrink-0 text-right leading-tight">
                                  <p>→ {p.mobilizacaoPendente.dataMobilizacao}</p>
                                  <p>{p.mobilizacaoPendente.obraDestinoNome}</p>
                                </div>
                              )}
                            </div>
                          </ContextMenuTrigger>
                          <ContextMenuContent>
                            {canEdit &&
                              columns
                                .filter((cc) => cc.id !== (p.obraAtualId || null))
                                .map((cc) => (
                                  <ContextMenuItem
                                    key={cc.id ?? "none"}
                                    onClick={() => handleContextMove(p.id, cc.id)}
                                  >
                                    Mover{" "}
                                    {selectedIds.has(p.id) && selectedIds.size > 1
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
                                  onClick={() => setDeleteTarget({ id: p.id, nome: p.nome })}
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

      {/* Confirmação de rompimento de vínculo com o responsável.
          Vem ANTES do diálogo de data: a etiqueta na obra é reflexo, e movê-la
          encerra a responsabilidade — o usuário decide isso primeiro. */}
      <Dialog open={!!reflexoDialog} onOpenChange={(v) => !v && setReflexoDialog(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-display text-lg">
              Patrimônio sob responsabilidade
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <p>
              {reflexoDialog && reflexoDialog.patIds.length > 1
                ? `${reflexoDialog.patIds.length} patrimônios estão`
                : "Este patrimônio está"}{" "}
              sob responsabilidade de{" "}
              <strong>{reflexoDialog?.responsaveis.join(", ") || "um colaborador"}</strong> e
              aparece na obra apenas como reflexo de onde{" "}
              {reflexoDialog && reflexoDialog.responsaveis.length > 1 ? "eles estão" : "ele está"}.
            </p>
            <p className="text-muted-foreground">
              Mobilizar encerra o período de responsabilidade e passa o bem para a obra de
              destino. Para mantê-lo com o responsável, mobilize o colaborador no quadro de
              colaboradores — o patrimônio acompanha sozinho.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReflexoDialog(null)}>
              Cancelar
            </Button>
            <Button
              onClick={() => {
                if (!reflexoDialog) return;
                setMobDialog({
                  patIds: reflexoDialog.patIds,
                  obraDestinoId: reflexoDialog.obraDestinoId,
                });
                setMobDate("");
                setMobError("");
                setReflexoDialog(null);
              }}
            >
              Continuar e escolher a data
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
              {mobPatNames.length > 1
                ? `Mobilizar ${mobPatNames.length} patrimônios`
                : "Quando será mobilizado?"}
            </DialogTitle>
          </DialogHeader>
          {mobPatNames.length > 1 && (
            <div className="text-xs text-muted-foreground max-h-20 overflow-auto space-y-0.5">
              {mobPatNames.map((n, i) => (
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
        onConfirm={() => deleteTarget && deletePatrimonio(deleteTarget.id)}
        title="Excluir Patrimônio"
        description={`Deseja realmente excluir "${deleteTarget?.nome}"? Esta ação é irreversível.`}
      />

      <PatrimonioProfileDialog
        open={profileOpen}
        onClose={() => setProfileOpen(false)}
        patrimonioId={profileId}
      />

      <ComentariosDrawer
        tipo="patrimonio"
        id={comentando?.id ?? null}
        nome={comentando?.nome}
        open={!!comentando}
        onOpenChange={(v) => !v && setComentando(null)}
      />

      {/* Export Dialog */}
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

export default QuadroPatrimonios;
