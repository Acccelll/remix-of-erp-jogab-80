import React, { useState, useMemo } from "react";
import { usePermissions } from "@/contexts/auth/usePermissions";
import { useColaboradoresContext } from "@/contexts/ColaboradoresContext";
import { useVeiculosContext } from "@/contexts/VeiculosContext";
import { useDocumentosContext } from "@/contexts/DocumentosContext";
import { useObrasContext } from "@/contexts/ObrasContext";
import { useContratosContext } from "@/contexts/ContratosContext";
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
import {
  AlertCircle,
  Car,
  Clock,
  Coffee,
  Download,
  LayoutGrid,
  Loader2,
  Search,
  UserX,
  Palmtree,
  Users,
} from "lucide-react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea as ScrollAreaUi } from "@/components/ui/scroll-area";
import { calcularCapacidade } from "@/lib/quadros/capacidade";
import { useDemandaMaoObraBoard } from "@/hooks/suprimentos/useOrcamento";
import ColumnFilter from "@/components/common/ColumnFilter";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import EmployeeProfileDialog from "@/components/rh/EmployeeProfileDialog";
import { ComentarioBadgeButton } from "@/components/common/ComentarioBadgeButton";
import { ComentariosDrawer } from "@/components/common/ComentariosDrawer";
import { comentariosColaborador } from "@/hooks/comentarios/useComentariosEntidade";
import DeleteConfirmDialog from "@/components/common/DeleteConfirmDialog";
import MaskedDateInput from "@/components/common/MaskedDateInput";
import { Alert, AlertDescription } from "@/components/ui/alert";
import * as XLSX from "xlsx";
import { isSpecialStatus } from "@/lib/cards/status-especiais";
import { motoristasElegiveis, veiculoNaColuna } from "@/lib/frotas/alocacao";
import { fmtDataLocal } from "@/lib/core/date";
import type { Colaborador, DecisaoVeiculo, DecisoesVeiculos } from "@/types";

/** Veículo atrelado a um colaborador que está sendo mobilizado. */
interface VeiculoAfetado {
  veiculoId: string;
  label: string;
  colabId: string;
  colabNome: string;
}

const Board = () => {
  const {
    colaboradores,
    mobilizarColaborador,
    cancelarMobilizacaoColaborador,
    deleteColaborador,
  } = useColaboradoresContext();
  const { veiculos } = useVeiculosContext();
  const { hasAccess, currentPlayer } = usePermissions();
  const { obras } = useObrasContext();
  const { contratos } = useContratosContext();
  const { getAllExpiringDocuments } = useDocumentosContext();
  // "Gestão de Equipe" (/rh/equipes) fica sob o módulo RH no NAV (permission
  // "rh"), mas manipula a alocação de colaboradores (Obras). Aceita edição de
  // QUALQUER um dos dois módulos: quem tem RH editar consegue mover os cartões
  // sem precisar de Obras, e quem já editava via Obras não perde o acesso.
  const canEdit = hasAccess("rh", "editar") || hasAccess("obras_div", "editar");
  const isGM = currentPlayer?.isGM;
  const activeObras = obras.filter((o) => o.ativa);

  const [search, setSearch] = useState("");
  const [hiddenColumns, setHiddenColumns] = useState<Set<string>>(new Set());
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [draggedIds, setDraggedIds] = useState<string[]>([]);
  const [dragOverCol, setDragOverCol] = useState<string | null | undefined>(undefined);

  const [mobDialog, setMobDialog] = useState<{
    colabIds: string[];
    obraDestinoId: string | null;
    veiculos: VeiculoAfetado[];
  } | null>(null);
  const [decisoesVeiculos, setDecisoesVeiculos] = useState<DecisoesVeiculos>({});
  const [mobDate, setMobDate] = useState("");
  const [mobLoading, setMobLoading] = useState(false);
  const [mobError, setMobError] = useState("");
  const [integWarning, setIntegWarning] = useState<{ colabNome: string; obraNome: string } | null>(
    null,
  );

  const [profileOpen, setProfileOpen] = useState(false);
  const [profileId, setProfileId] = useState<string | null>(null);
  const [profileTab, setProfileTab] = useState("ficha");

  // Comentários encadeados por colaborador (balão no card → drawer).
  const { data: comentariosCount } = comentariosColaborador.useContagem();
  const [comentando, setComentando] = useState<{ id: string; nome: string } | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<{ id: string; nome: string } | null>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [exportDateFrom, setExportDateFrom] = useState("");
  const [exportDateTo, setExportDateTo] = useState("");
  const [expiringOpen, setExpiringOpen] = useState(false);

  const activeColabs = useMemo(() => {
    let list = colaboradores.filter((c) => c.ativo);
    if (search) {
      const s = search.toLowerCase();
      list = list.filter(
        (c) =>
          c.nome.toLowerCase().includes(s) ||
          c.matricula.includes(search) ||
          c.funcao.toLowerCase().includes(s) ||
          (c.cidade || "").toLowerCase().includes(s),
      );
    }
    return list;
  }, [colaboradores, search]);

  const toggleSelection = (colabId: string) => {
    if (!canEdit) return;
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(colabId)) next.delete(colabId);
      else next.add(colabId);
      return next;
    });
  };

  const handleCardClick = (colabId: string, e: React.MouseEvent) => {
    if (!canEdit) return;
    if (e.ctrlKey || e.metaKey) {
      toggleSelection(colabId);
    }
  };

  const handleDragStart = (colabId: string) => {
    if (selectedIds.has(colabId) && selectedIds.size > 1) {
      setDraggedIds(Array.from(selectedIds));
    } else {
      setDraggedIds([colabId]);
    }
  };

  const checkIntegWarnings = (colabIds: string[], obraId: string | null) => {
    if (!obraId) return;
    const obra = obras.find((o) => o.id === obraId);
    if (!obra?.requerIntegracao) return;
    for (const id of colabIds) {
      const colab = colaboradores.find((c) => c.id === id);
      if (colab && !colab.integracoes.some((i) => i.obraId === obraId)) {
        setIntegWarning({ colabNome: colab.nome, obraNome: obra.nome });
        return;
      }
    }
  };

  /**
   * Veículos atrelados aos colaboradores em movimento. Vale para qualquer
   * destino — inclusive folga/férias/afastamento, quando o carro costuma ficar
   * na obra com outra pessoa e antes passava despercebido.
   */
  const getVeiculosAfetados = (colabIds: string[]): VeiculoAfetado[] => {
    const afetados: VeiculoAfetado[] = [];
    for (const id of colabIds) {
      const colabNome = colaboradores.find((c) => c.id === id)?.nome || "";
      veiculos
        .filter((v) => v.ativo && v.motoristaId === id)
        .forEach((v) => {
          afetados.push({
            veiculoId: v.id,
            label: `${v.nome} (${v.codigo})`,
            colabId: id,
            colabNome,
          });
        });
    }
    return afetados;
  };

  /**
   * Entre obras o carro normalmente acompanha o motorista; indo para folga,
   * férias ou afastamento ele normalmente fica onde está.
   */
  const decisoesIniciais = (
    veiculosAfetados: VeiculoAfetado[],
    obraId: string | null,
  ): DecisoesVeiculos => {
    const isSpecial = obraId === null || isSpecialStatus(obraId);
    const padrao: DecisaoVeiculo = isSpecial ? { acao: "semMotorista" } : { acao: "acompanha" };
    return Object.fromEntries(veiculosAfetados.map((v) => [v.veiculoId, padrao]));
  };

  const abrirMobDialog = (colabIds: string[], obraId: string | null) => {
    checkIntegWarnings(colabIds, obraId);
    const veiculosAfetados = getVeiculosAfetados(colabIds);
    setMobDialog({ colabIds, obraDestinoId: obraId, veiculos: veiculosAfetados });
    setDecisoesVeiculos(decisoesIniciais(veiculosAfetados, obraId));
    setMobDate("");
    setMobError("");
  };

  const handleDrop = (obraId: string | null, e: React.DragEvent) => {
    e.preventDefault();
    if (draggedIds.length === 0 || !canEdit) return;
    const idsToMove = draggedIds.filter((id) => {
      const colab = colaboradores.find((c) => c.id === id);
      const cur = colab ? colab.statusEspecial || colab.obraAtualId || null : null;
      return colab && cur !== obraId;
    });
    if (idsToMove.length === 0) {
      setDraggedIds([]);
      return;
    }
    abrirMobDialog(idsToMove, obraId);
    setDraggedIds([]);
  };

  const confirmMobilization = async () => {
    if (!mobDialog || !mobDate) return;
    const parts = mobDate.split("-");
    if (parts.length !== 3) return;
    const ano = parseInt(parts[0]);
    const mes = parseInt(parts[1]);
    const dia = parseInt(parts[2]);

    setMobLoading(true);
    setMobError("");
    try {
      for (const colabId of mobDialog.colabIds) {
        await mobilizarColaborador(
          colabId,
          mobDialog.obraDestinoId,
          dia,
          mes,
          ano,
          true,
          decisoesVeiculos,
        );
      }
      setMobDialog(null);
      setSelectedIds(new Set());
    } catch {
      setMobError("Falha ao mobilizar colaborador(es). Tente novamente.");
    } finally {
      setMobLoading(false);
    }
  };

  const handleContextMove = (colabId: string, obraId: string | null) => {
    const idsToMove =
      selectedIds.has(colabId) && selectedIds.size > 1
        ? Array.from(selectedIds).filter((id) => {
            const colab = colaboradores.find((c) => c.id === id);
            const cur = colab ? colab.statusEspecial || colab.obraAtualId || null : null;
            return colab && cur !== obraId;
          })
        : [colabId];
    if (idsToMove.length === 0) return;
    abrirMobDialog(idsToMove, obraId);
  };

  const canViewColabProfile = hasAccess("rh", "editar");
  const openProfile = (id: string, tab = "ficha") => {
    if (!canViewColabProfile) return;
    setProfileId(id);
    setProfileTab(tab);
    setProfileOpen(true);
  };

  const handleExportQuadroAtual = () => {
    const obraMap = new Map(obras.map((o) => [o.id, o.nome]));
    const rows = colaboradores
      .filter((c) => c.ativo)
      .sort((a, b) => {
        const obraA = (a.obraAtualId ? obraMap.get(a.obraAtualId) : null) ?? "Sem Alocação";
        const obraB = (b.obraAtualId ? obraMap.get(b.obraAtualId) : null) ?? "Sem Alocação";
        return obraA.localeCompare(obraB, "pt-BR") || a.nome.localeCompare(b.nome, "pt-BR");
      })
      .map((c) => ({
        Obra: (c.obraAtualId ? obraMap.get(c.obraAtualId) : null) ?? "Sem Alocação",
        Matrícula: c.matricula,
        Nome: c.nome,
        Função: c.funcao,
      }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Quadro Atual");
    XLSX.writeFile(wb, `quadro_atual_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const handleExport = () => {
    if (!exportDateFrom || !exportDateTo) return;
    const from = new Date(exportDateFrom);
    const to = new Date(exportDateTo);
    to.setHours(23, 59, 59, 999);

    const rows: any[] = [];
    colaboradores.forEach((c) => {
      if (!c.ativo && c.dataInativacao) {
        const inativDate = new Date(c.dataInativacao);
        if (inativDate < from) return;
      }
      c.historico
        .filter((h) => h.tipo === "mobilizacao")
        .forEach((h) => {
          const hDate = new Date(h.data);
          if (hDate >= from && hDate <= to) {
            // REGEX CORRIGIDA: captura sem aspas duplas
            const match = h.descricao.match(/de (.*?) para (.*?)(?: em (\S+))?$/);
            const de = match?.[1] || "";
            const para = match?.[2] || "";
            const dataMob = match?.[3] || "";
            rows.push({
              Matrícula: c.matricula,
              Nome: c.nome,
              Função: c.funcao,
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
        Matrícula: "",
        Nome: "Nenhuma movimentação no período",
        Função: "",
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
    XLSX.writeFile(wb, `movimentacoes_${exportDateFrom}_a_${exportDateTo}.xlsx`);
    setExportOpen(false);
  };

  const FIXED_COLUMN_IDS = new Set(["folga", "afastamento", "ferias"]);

  const FIXED_COLUMNS = [
    { id: "folga", nome: "Folga", icon: Coffee },
    { id: "afastamento", nome: "Afastamento", icon: UserX },
    { id: "ferias", nome: "Férias", icon: Palmtree },
  ];

  const columns = [
    { id: null as string | null, nome: "Sem Alocação/Ocioso (a)", icon: null as any },
    ...activeObras
      .slice()
      .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"))
      .map((o) => ({ id: o.id as string | null, nome: o.nome, icon: null as any })),
    ...FIXED_COLUMNS,
  ];

  // Motoristas elegíveis a assumir um veículo, menos quem está sendo movido.
  const motoristasDisponiveis = useMemo(() => {
    const emMovimento = new Set(mobDialog?.colabIds ?? []);
    return motoristasElegiveis(colaboradores)
      .filter((c) => !emMovimento.has(c.id))
      .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  }, [colaboradores, mobDialog]);

  const mobDestinoEspecial =
    !!mobDialog && (mobDialog.obraDestinoId === null || isSpecialStatus(mobDialog.obraDestinoId));

  // Trava o Confirmar enquanto houver "passou para outro motorista" sem escolha.
  const decisoesIncompletas = (mobDialog?.veiculos ?? []).some((v) => {
    const d = decisoesVeiculos[v.veiculoId];
    return d?.acao === "novoMotorista" && !d.motoristaId;
  });

  // "Foi com o colaborador" respeita a data (vira mobilização pendente do
  // veículo); trocar o motorista, não — vale já. Avisa em vez de surpreender.
  const trocaMotoristaImediata = (() => {
    const partes = mobDate.split("-");
    if (partes.length !== 3) return false;
    const alvo = new Date(Number(partes[0]), Number(partes[1]) - 1, Number(partes[2]));
    const hoje = new Date();
    const futura = alvo > new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
    return (
      futura &&
      (mobDialog?.veiculos ?? []).some(
        (v) => decisoesVeiculos[v.veiculoId]?.acao !== "acompanha",
      )
    );
  })();

  const mobColabNames = mobDialog
    ? mobDialog.colabIds.map((id) => colaboradores.find((c) => c.id === id)?.nome).filter(Boolean)
    : [];

  return (
    <div
      className="flex flex-col h-[calc(100vh-7rem)]"
      onClick={(e) => {
        if (
          !(e.ctrlKey || e.metaKey) &&
          (e.target as HTMLElement).closest(".employee-tag") === null
        ) {
          setSelectedIds(new Set());
        }
      }}
    >
      <div className="flex items-center justify-between mb-4 shrink-0">
        <div className="flex items-center gap-3">
          <h2 className="font-display text-2xl font-bold flex items-center gap-2">
            <LayoutGrid className="h-6 w-6" /> Gestão de Equipe
          </h2>
          {selectedIds.size > 0 && (
            <span className="text-xs bg-primary/10 text-primary font-medium px-2 py-1 rounded-full">
              {selectedIds.size} selecionado{selectedIds.size > 1 ? "s" : ""}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <CapacidadePopover colaboradores={colaboradores} obras={obras} />
          <Button variant="outline" size="sm" onClick={() => setExpiringOpen(true)}>
            <Clock className="h-4 w-4 mr-1" /> A vencer
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportQuadroAtual}>
            <Download className="h-4 w-4 mr-1" /> Quadro Atual
          </Button>
          <Button variant="outline" size="sm" onClick={() => setExportOpen(true)}>
            <Download className="h-4 w-4 mr-1" /> Exportar movimentações
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-2 mb-4 shrink-0">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nome, matrícula, função ou cidade..."
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
              // Filtro inteligente: quando a busca está ativa, esconde colunas vazias.
              if (!search.trim()) return true;
              return activeColabs.some(
                (c) => (c.statusEspecial || c.obraAtualId || null) === col.id,
              );
            })
            .map((col) => {
              const colColabs = activeColabs.filter((c) => {
                // Se tem status especial, usa ele diretamente; senão, usa obraAtualId ou null
                const key = c.statusEspecial || c.obraAtualId || null;
                return key === col.id;
              });
              // Veículos da coluna: pela obra do motorista ou, sem motorista,
              // pela obra do próprio veículo (ver `veiculoNaColuna`).
              const colColabIds = new Set(colColabs.map((c) => c.id));
              const colVeiculos =
                col.id && !FIXED_COLUMN_IDS.has(col.id)
                  ? veiculos.filter((v) => veiculoNaColuna(v, colColabIds, col.id as string))
                  : [];
              // Contratos do tipo Máquina alocados nesta obra
              const colContratosMaquina =
                col.id && !FIXED_COLUMN_IDS.has(col.id)
                  ? contratos.filter(
                      (c) => c.ativo && c.tipo === "Máquina" && (c.obraAtualId || null) === col.id,
                    )
                  : [];
              const totalEquipamentos = colVeiculos.length + colContratosMaquina.length;
              const funcCounts = colColabs.reduce<Record<string, number>>((acc, c) => {
                acc[c.funcao || "Sem função"] = (acc[c.funcao || "Sem função"] || 0) + 1;
                return acc;
              }, {});
              const veicCounts = colVeiculos.reduce<Record<string, number>>((acc, v) => {
                acc[v.tipo || "Sem tipo"] = (acc[v.tipo || "Sem tipo"] || 0) + 1;
                return acc;
              }, {});
              const contratoMaqCounts = colContratosMaquina.reduce<Record<string, number>>(
                (acc, c) => {
                  const k = `${c.tipoMaquina || "Sem tipo"} (Contrato)`;
                  acc[k] = (acc[k] || 0) + 1;
                  return acc;
                },
                {},
              );

              const isDragOver = dragOverCol === col.id;

              return (
                <div
                  key={col.id ?? "none"}
                  className={`obra-column transition-all duration-200 ${FIXED_COLUMN_IDS.has(col.id || "") ? "border-dashed border-muted-foreground/30" : ""} ${
                    isDragOver ? "ring-2 ring-primary ring-inset bg-primary/5 rounded-lg" : ""
                  }`}
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
                    <h3
                      className={`font-display text-sm font-semibold truncate flex items-center gap-1.5 ${FIXED_COLUMN_IDS.has(col.id || "") ? "text-muted-foreground" : ""}`}
                    >
                      {col.icon && <col.icon className="h-3.5 w-3.5 shrink-0" />}
                      {col.nome}
                    </h3>
                    <TooltipProvider delayDuration={200}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="text-xs text-muted-foreground bg-secondary rounded-full px-2 py-0.5 cursor-default">
                            {colColabs.length}
                            {totalEquipamentos > 0 && (
                              <span className="ml-1 text-primary"> | {totalEquipamentos}</span>
                            )}
                          </span>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="text-xs">
                          {colColabs.length === 0 && totalEquipamentos === 0 ? (
                            <p>Nenhum colaborador</p>
                          ) : (
                            <div className="space-y-1.5">
                              {colColabs.length > 0 && (
                                <div>
                                  <p className="font-semibold border-b border-border pb-0.5 mb-1">
                                    Colaboradores
                                  </p>
                                  {Object.entries(funcCounts).map(([funcao, count]) => (
                                    <p key={funcao}>
                                      {funcao}: {count}
                                    </p>
                                  ))}
                                </div>
                              )}
                              {totalEquipamentos > 0 && (
                                <div>
                                  <p className="font-semibold border-b border-border pb-0.5 mb-1">
                                    Veículos
                                  </p>
                                  {Object.entries(veicCounts).map(([tipo, count]) => (
                                    <p key={tipo}>
                                      {tipo}: {count}
                                    </p>
                                  ))}
                                  {Object.entries(contratoMaqCounts).map(([tipo, count]) => (
                                    <p key={tipo}>
                                      {tipo}: {count}
                                    </p>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                  <div className="space-y-2 min-h-[60px]">
                    {colColabs.map((c) => {
                      const hasMenuItems = canEdit || isGM;
                      const cardEl = (
                        <div
                          className={`employee-tag group relative flex items-center ${c.mobilizacaoPendente ? "employee-tag-pending" : ""} ${selectedIds.has(c.id) ? "ring-2 ring-primary ring-offset-1 ring-offset-background" : ""}`}
                          draggable={canEdit}
                          onDragStart={() => handleDragStart(c.id)}
                          onClick={(e) => handleCardClick(c.id, e)}
                          onDoubleClick={() => openProfile(c.id, "integracoes")}
                        >
                          {canEdit && (
                            <div
                              className={`mr-2 flex items-center shrink-0 transition-opacity ${selectedIds.has(c.id) ? "opacity-100" : "opacity-0 group-hover:opacity-100 focus-within:opacity-100"}`}
                            >
                              <input
                                type="checkbox"
                                checked={selectedIds.has(c.id)}
                                onChange={(e) => {
                                  toggleSelection(c.id);
                                }}
                                onClick={(e) => e.stopPropagation()}
                                className="h-4 w-4 cursor-pointer accent-primary rounded border-gray-300"
                                aria-label={`Selecionar ${c.nome}`}
                              />
                            </div>
                          )}
                          <div className="matricula-badge">{c.matricula.padStart(4, "0")}</div>
                          <div className="min-w-0 flex-1 pr-8">
                            <p className="text-sm font-medium truncate">{c.nome}</p>
                            <p className="text-[11px] text-muted-foreground truncate">{c.funcao}</p>
                          </div>
                          <ComentarioBadgeButton
                            count={comentariosCount.get(c.id) || 0}
                            onClick={() => setComentando({ id: c.id, nome: c.nome })}
                            className="absolute top-1 right-1 z-10"
                          />
                          {c.mobilizacaoPendente && (
                            <div className="text-[10px] text-accent font-semibold shrink-0 text-right leading-tight ml-2">
                              <p>→ {c.mobilizacaoPendente.dataMobilizacao}</p>
                              <p>{c.mobilizacaoPendente.obraDestinoNome}</p>
                            </div>
                          )}
                        </div>
                      );
                      if (!hasMenuItems) return <div key={c.id}>{cardEl}</div>;
                      return (
                        <ContextMenu key={c.id}>
                          <ContextMenuTrigger asChild>{cardEl}</ContextMenuTrigger>
                          <ContextMenuContent>
                            {canEdit && c.mobilizacaoPendente && (
                              <>
                                <ContextMenuItem
                                  className="text-warning font-medium"
                                  onClick={() => cancelarMobilizacaoColaborador(c.id)}
                                >
                                  Cancelar mobilização pendente
                                </ContextMenuItem>
                                <ContextMenuSeparator />
                              </>
                            )}
                            {canEdit &&
                              (() => {
                                const obraCols = columns.filter(
                                  (cc) =>
                                    cc.id !== (c.statusEspecial || c.obraAtualId || null) &&
                                    !FIXED_COLUMN_IDS.has(cc.id as string),
                                );
                                const statusCols = columns.filter(
                                  (cc) =>
                                    cc.id !== (c.statusEspecial || c.obraAtualId || null) &&
                                    FIXED_COLUMN_IDS.has(cc.id as string),
                                );
                                const label =
                                  selectedIds.has(c.id) && selectedIds.size > 1
                                    ? `${selectedIds.size} selecionados`
                                    : "";
                                return (
                                  <>
                                    {obraCols.length > 0 && (
                                      <>
                                        <ContextMenuLabel className="text-[10px] uppercase tracking-wider text-muted-foreground">
                                          Obras
                                        </ContextMenuLabel>
                                        {obraCols.map((cc) => (
                                          <ContextMenuItem
                                            key={cc.id ?? "none"}
                                            onClick={() => handleContextMove(c.id, cc.id)}
                                          >
                                            Mover {label} para {cc.nome}
                                          </ContextMenuItem>
                                        ))}
                                      </>
                                    )}
                                    {statusCols.length > 0 && (
                                      <>
                                        {obraCols.length > 0 && <ContextMenuSeparator />}
                                        <ContextMenuLabel className="text-[10px] uppercase tracking-wider text-muted-foreground">
                                          Status
                                        </ContextMenuLabel>
                                        {statusCols.map((cc) => (
                                          <ContextMenuItem
                                            key={cc.id ?? "none"}
                                            onClick={() => handleContextMove(c.id, cc.id)}
                                          >
                                            Mover {label} para {cc.nome}
                                          </ContextMenuItem>
                                        ))}
                                      </>
                                    )}
                                  </>
                                );
                              })()}
                            {isGM && (
                              <>
                                <ContextMenuSeparator />
                                <ContextMenuItem
                                  className="text-destructive"
                                  onClick={() => setDeleteTarget({ id: c.id, nome: c.nome })}
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
          if (!v && !mobLoading) {
            setMobDialog(null);
          }
        }}
      >
        <DialogContent className={mobDialog?.veiculos.length ? "max-w-md" : "max-w-xs"}>
          <DialogHeader>
            <DialogTitle className="font-display text-lg">
              {mobColabNames.length > 1
                ? `Mobilizar ${mobColabNames.length} colaboradores`
                : "Quando será mobilizado?"}
            </DialogTitle>
          </DialogHeader>
          {mobColabNames.length > 1 && (
            <div className="text-xs text-muted-foreground max-h-20 overflow-auto space-y-0.5">
              {mobColabNames.map((n, i) => (
                <p key={i}>• {n}</p>
              ))}
            </div>
          )}
          {mobDialog && mobDialog.veiculos.length > 0 && (
            <div className="rounded-md border border-border">
              <div className="flex items-center gap-1.5 px-3 py-2 border-b border-border">
                <Car className="h-3.5 w-3.5 text-muted-foreground" />
                <p className="text-xs font-semibold">
                  {mobDialog.veiculos.length === 1
                    ? "Veículo atrelado"
                    : `${mobDialog.veiculos.length} veículos atrelados`}
                </p>
              </div>
              <ScrollAreaUi className="max-h-64">
                <div className="p-3 space-y-3">
                  {mobDialog.veiculos.map((v) => (
                    <VeiculoDecisaoField
                      key={v.veiculoId}
                      veiculo={v}
                      mostrarColaborador={mobDialog.colabIds.length > 1}
                      destinoEspecial={mobDestinoEspecial}
                      motoristas={motoristasDisponiveis}
                      decisao={decisoesVeiculos[v.veiculoId] ?? { acao: "acompanha" }}
                      onChange={(d) =>
                        setDecisoesVeiculos((prev) => ({ ...prev, [v.veiculoId]: d }))
                      }
                      disabled={mobLoading}
                    />
                  ))}
                </div>
              </ScrollAreaUi>
            </div>
          )}
          <div>
            <Label className="text-xs">Data da Mobilização</Label>
            <MaskedDateInput value={mobDate} onChange={setMobDate} className="mt-1" />
            {trocaMotoristaImediata && (
              <p className="mt-2 flex items-start gap-1.5 rounded-md border border-warning/40 bg-warning/10 px-2 py-1.5 text-[11px] text-warning">
                <AlertCircle className="h-3.5 w-3.5 mt-px shrink-0" />
                <span>
                  A mobilização fica agendada, mas a mudança de motorista do veículo vale a
                  partir de agora.
                </span>
              </p>
            )}
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
            <Button
              onClick={confirmMobilization}
              disabled={!mobDate || mobLoading || decisoesIncompletas}
            >
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

      {/* Integration Warning */}
      <Dialog open={!!integWarning} onOpenChange={(v) => !v && setIntegWarning(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-display flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-warning" />
              Integração Necessária
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm">
            <strong>{integWarning?.colabNome}</strong> não está integrado(a) em{" "}
            <strong>{integWarning?.obraNome}</strong> e precisa realizar a integração.
          </p>
          <DialogFooter>
            <Button onClick={() => setIntegWarning(null)}>Entendido</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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

      {/* Delete Confirm */}
      <DeleteConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && deleteColaborador(deleteTarget.id)}
        title="Excluir Colaborador"
        description={`Deseja realmente excluir "${deleteTarget?.nome}"? Esta ação é irreversível.`}
      />

      <EmployeeProfileDialog
        open={profileOpen}
        onClose={() => setProfileOpen(false)}
        colaboradorId={profileId}
        defaultTab={profileTab}
      />

      <ComentariosDrawer
        tipo="colaborador"
        id={comentando?.id ?? null}
        nome={comentando?.nome}
        open={!!comentando}
        onOpenChange={(v) => !v && setComentando(null)}
      />

      {/* Expiring Documents Dialog */}
      <Dialog open={expiringOpen} onOpenChange={(v) => !v && setExpiringOpen(false)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display flex items-center gap-2">
              <Clock className="h-5 w-5 text-warning" />
              Documentos a Vencer
            </DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[400px]">
            {(() => {
              const docs = getAllExpiringDocuments();
              if (docs.length === 0)
                return (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    Nenhum documento a vencer.
                  </p>
                );
              return (
                <div className="space-y-1">
                  {docs.map((item, i) => {
                    const dv = new Date(item.documento.dataVencimento);
                    const now = new Date();
                    const diffDays = Math.ceil(
                      (dv.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
                    );
                    return (
                      <div
                        key={i}
                        className="flex items-center gap-2 p-2 rounded-md hover:bg-secondary/50 text-sm"
                      >
                        <div className="matricula-badge">
                          {item.colaborador.matricula.padStart(4, "0")}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{item.colaborador.nome}</p>
                          <p className="text-xs text-muted-foreground truncate">
                            {item.documento.nome}
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-xs font-medium">{fmtDataLocal(dv)}</p>
                          <p
                            className={`text-[10px] font-semibold ${diffDays < 0 ? "text-destructive" : diffDays <= 7 ? "text-destructive" : diffDays <= 30 ? "text-warning" : "text-muted-foreground"}`}
                          >
                            {diffDays < 0
                              ? `Vencido há ${Math.abs(diffDays)} dias`
                              : diffDays === 0
                                ? "Vence hoje"
                                : diffDays === 1
                                  ? "Amanhã"
                                  : `${diffDays} dias`}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </ScrollArea>
          <DialogFooter>
            <Button variant="outline" onClick={() => setExpiringOpen(false)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Board;

/**
 * Decisão sobre um veículo atrelado ao colaborador que está sendo mobilizado:
 * ele foi junto, passou para outro motorista, ou ficou na obra sem motorista.
 * Antes o carro simplesmente acompanhava entre obras e era ignorado em folga,
 * férias e afastamento — sumindo do quadro no exato caso em que continua na obra.
 */
function VeiculoDecisaoField({
  veiculo,
  mostrarColaborador,
  destinoEspecial,
  motoristas,
  decisao,
  onChange,
  disabled,
}: {
  veiculo: VeiculoAfetado;
  mostrarColaborador: boolean;
  destinoEspecial: boolean;
  motoristas: Colaborador[];
  decisao: DecisaoVeiculo;
  onChange: (d: DecisaoVeiculo) => void;
  disabled: boolean;
}) {
  const name = `veiculo-${veiculo.veiculoId}`;
  const opcao = (valor: DecisaoVeiculo["acao"], id: string, label: React.ReactNode) => (
    <div className="flex items-start gap-2">
      <RadioGroupItem value={valor} id={id} className="mt-0.5" />
      <Label htmlFor={id} className="text-xs font-normal leading-snug cursor-pointer">
        {label}
      </Label>
    </div>
  );

  return (
    <div className="space-y-2">
      <div>
        <p className="text-xs font-medium">{veiculo.label}</p>
        {mostrarColaborador && (
          <p className="text-[11px] text-muted-foreground">{veiculo.colabNome}</p>
        )}
      </div>
      <RadioGroup
        value={decisao.acao}
        onValueChange={(v) =>
          onChange(
            v === "novoMotorista"
              ? { acao: "novoMotorista", motoristaId: "" }
              : { acao: v as "acompanha" | "semMotorista" },
          )
        }
        disabled={disabled}
        className="gap-1.5"
      >
        {opcao(
          "acompanha",
          `${name}-acompanha`,
          <>
            Foi com o colaborador
            {destinoEspecial && (
              <span className="block text-[10px] text-muted-foreground">
                o veículo sai da obra
              </span>
            )}
          </>,
        )}
        {opcao("novoMotorista", `${name}-novo`, "Ficou — passou para outro motorista")}
        {decisao.acao === "novoMotorista" && (
          <div className="pl-6">
            <Select
              value={decisao.motoristaId || undefined}
              onValueChange={(motoristaId) => onChange({ acao: "novoMotorista", motoristaId })}
              disabled={disabled}
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="Selecione o novo motorista" />
              </SelectTrigger>
              <SelectContent>
                {motoristas.length === 0 ? (
                  <div className="px-2 py-1.5 text-xs text-muted-foreground">
                    Nenhum motorista disponível
                  </div>
                ) : (
                  motoristas.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.nome}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>
        )}
        {opcao("semMotorista", `${name}-sem`, "Ficou na obra sem motorista definido")}
      </RadioGroup>
    </div>
  );
}

/**
 * PRO-022 · slice-02 — Resumo de capacidade de mão de obra por obra,
 * disponível no header do Board via popover para não invadir o espaço
 * das colunas.
 */
function CapacidadePopover({
  colaboradores,
  obras,
}: {
  colaboradores: Array<{ id: string; ativo: boolean; obraAtualId: string | null; funcao?: string | null }>;
  obras: Array<{ id: string; nome: string; ativa: boolean }>;
}) {
  const { data: demandaRows = [], isFetching, isError } = useDemandaMaoObraBoard({
    enabled: obras.length > 0,
  });
  const demandas = React.useMemo(
    () =>
      demandaRows.map((d) => ({
        obraId: d.obra_id,
        funcao: d.funcao,
        quantidade: d.quantidade,
      })),
    [demandaRows],
  );
  const resumo = React.useMemo(
    () => calcularCapacidade(colaboradores, obras, demandas),
    [colaboradores, obras, demandas],
  );
  const deficitTotal = resumo.porObra.reduce((s, o) => s + o.deficitTotal, 0);
  const fmtQtd = (n: number) =>
    Number.isInteger(n) ? String(n) : n.toLocaleString("pt-BR", { maximumFractionDigits: 1 });
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm">
          <Users className="h-4 w-4 mr-1" /> Capacidade
          <span className="ml-1.5 inline-flex items-center justify-center min-w-[20px] h-5 px-1 rounded-full bg-primary/10 text-primary text-[11px] font-semibold">
            {resumo.totalAlocados}
          </span>
          {deficitTotal > 0 && (
            <span className="ml-1 inline-flex items-center justify-center min-w-[20px] h-5 px-1 rounded-full bg-destructive/10 text-destructive text-[11px] font-semibold">
              -{fmtQtd(deficitTotal)}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-96 p-0">
        <div className="p-3 border-b">
          <h4 className="font-display font-semibold text-sm">Capacidade de mão de obra</h4>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            {resumo.totalDisponiveis} ativos · {resumo.totalAlocados} em obra ·{" "}
            {resumo.totalSemObra} sem obra · {resumo.totalEspeciais} em status especial
          </p>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Demanda: {isFetching ? "carregando" : isError ? "indisponível" : `${fmtQtd(deficitTotal)} déficit`}
          </p>
        </div>
        <ScrollAreaUi className="max-h-[60vh]">
          {resumo.porObra.length === 0 ? (
            <p className="p-4 text-xs text-muted-foreground text-center">
              Nenhum colaborador alocado a obras ativas.
            </p>
          ) : (
            <div className="p-2 space-y-1">
              {resumo.porObra.map((o) => (
                <div key={o.obraId} className="rounded-md p-2 hover:bg-secondary/50">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium truncate">{o.obraNome}</p>
                    <div className="flex items-center gap-1 shrink-0">
                      {o.deficitTotal > 0 && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-destructive">
                          <AlertCircle className="h-3 w-3" /> -{fmtQtd(o.deficitTotal)}
                        </span>
                      )}
                      <span className="text-xs font-semibold">{fmtQtd(o.total)}</span>
                    </div>
                  </div>
                  {o.demandaTotal > 0 ? (
                    <div className="mt-1 space-y-0.5">
                      {o.porFuncaoDemanda.slice(0, 4).map((f) => (
                        <div key={f.funcao} className="flex items-center justify-between gap-2 text-[11px]">
                          <span className="truncate text-muted-foreground">{f.funcao}</span>
                          <span className={f.saldo < 0 ? "font-medium text-destructive" : "text-muted-foreground"}>
                            {fmtQtd(f.alocado)}/{fmtQtd(f.demanda)}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-[11px] text-muted-foreground truncate">
                      {o.porFuncao.map((f) => `${f.funcao}: ${f.qtd}`).join(" · ")}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </ScrollAreaUi>
      </PopoverContent>
    </Popover>
  );
}
