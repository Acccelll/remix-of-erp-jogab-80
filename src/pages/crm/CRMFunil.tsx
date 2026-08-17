// CRM — Funil de vendas (Kanban) com drag-and-drop nativo (HTML5),
// no mesmo padrão visual e funcional do Quadro de Obras.
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { usePermissions } from "@/contexts/auth/usePermissions";
import { useClientesContext } from "@/contexts/ClientesContext";
import { usePlayersContext } from "@/contexts/PlayersContext";
import { useOportunidadeComentariosCount } from "@/hooks/crm/useOportunidadeComentarios";
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
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import ColumnFilter from "@/components/common/ColumnFilter";
import { TemperatureDisplay } from "@/components/crm/TemperatureDisplay";
import { formatBRLFromNumber } from "@/lib/core/currency";
import { AlertTriangle, Filter, Search, X, Calendar, MessageSquare, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Oportunidade, OportunidadeComentario } from "@/types";
import { OportunidadeFormDialog } from "@/components/crm/OportunidadeFormDialog";
import { OportunidadeComentariosDrawer } from "@/components/crm/OportunidadeComentariosDrawer";
import { fmtDataLocal } from "@/lib/core/date";
import { swallow } from "@/lib/core/errors";
import { CRM_ESTAGIO_FECHADO_PERDIDO, useCrmMotivosPerda } from "@/hooks/crm/useCrmMotivosPerda";
import { toast } from "sonner";
import { useCrmScopeFilter } from "@/hooks/crm/useOportunidadesEscopo";
import { registrarEvento, registrarInteracao } from "@/lib/crm/historico";

export default function CRMFunil() {
  const { hasAccess, currentPlayer } = usePermissions();
  const {
    oportunidades,
    funilEstagios,
    moverEstagio,
    clientes,
  } = useClientesContext();
  const { players } = usePlayersContext();
  const navigate = useNavigate();
  const canEdit = hasAccess("crm", "editar");

  // Diálogo de edição/criação — mesmo pop-up usado na página Oportunidades.
  const [formOpen, setFormOpen] = useState(false);
  const [formEditing, setFormEditing] = useState<Oportunidade | null>(null);

  // Drawer de comentários — aberto pelo balãozinho no card (um clique).
  const [comentando, setComentando] = useState<Oportunidade | null>(null);

  function openCard(l: Oportunidade) {
    setFormEditing(l);
    setFormOpen(true);
  }
  function openNew() {
    setFormEditing(null);
    setFormOpen(true);
  }

  const [filtroResp, setFiltroResp] = useState<string>("todos");
  const [search, setSearch] = useState("");
  const [hiddenColumns, setHiddenColumns] = useState<Set<string>>(new Set());
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const [draggedIds, setDraggedIds] = useState<string[]>([]);
  const [dragOverCol, setDragOverCol] = useState<string | null>(null);
  const [perdaIds, setPerdaIds] = useState<string[]>([]);
  const [perdaDestino, setPerdaDestino] = useState<string>(CRM_ESTAGIO_FECHADO_PERDIDO);
  const [motivoPerdaId, setMotivoPerdaId] = useState("");
  const [motivoPerdaObs, setMotivoPerdaObs] = useState("");
  const [novoMotivoPerda, setNovoMotivoPerda] = useState("");
  const { motivos, getRegistro, registrarPerda, adicionarMotivo } = useCrmMotivosPerda();

  const estagios = useMemo(
    () => [...funilEstagios].filter((e) => e.ativo).sort((a, b) => a.ordem - b.ordem),
    [funilEstagios],
  );

  const loginDe = useMemo(() => {
    const m = new Map<string, string>();
    players.forEach((p) => m.set(p.id, p.login));
    return m;
  }, [players]);

  // Escopo: GM vê tudo; os demais veem as oportunidades dos clientes da sua
  // carteira ("Responsável por negociação") mais aquelas em que respondem.
  const { filter: scopeFilter } = useCrmScopeFilter();

  const noEscopo = useMemo(() => scopeFilter(oportunidades), [oportunidades, scopeFilter]);

  // Opções do filtro "Responsável": usuários que respondem por algum card
  // VISÍVEL — oferecer quem só aparece fora do escopo daria um filtro que
  // sempre devolve vazio.
  const playersComCards = useMemo(() => {
    const ids = new Set(noEscopo.map((l) => l.responsavelId).filter(Boolean));
    return players.filter((p) => ids.has(p.id));
  }, [noEscopo, players]);

  const visiveis = useMemo(() => {
    const s = search.trim().toLowerCase();
    return noEscopo.filter((l) => {
      if (filtroResp !== "todos" && l.responsavelId !== filtroResp) return false;
      if (!s) return true;
      const hay = `${l.nome ?? ""} ${l.empresa ?? ""}`.toLowerCase();
      return hay.includes(s);
    });
  }, [noEscopo, filtroResp, search]);

  // Contagem de comentários por oportunidade — para o balãozinho nos cards.
  const { countByOportunidade: comentariosPorOportunidade } = useOportunidadeComentariosCount();


  const porEstagio = (chave: string) => visiveis.filter((l) => l.estagio === chave);
  const totalEstagio = (chave: string) =>
    porEstagio(chave).reduce((s, l) => s + (l.valorEstimado || 0), 0);

  function toggleSel(id: string) {
    setSelecionados((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const [convertLead, setConvertLead] = useState<Oportunidade | null>(null);

  function moverCards(ids: string[], destino: string) {
    let ok = 0;
    let firstWon: Oportunidade | null = null;
    const rotuloDe = (chave: string) =>
      funilEstagios.find((e) => e.chave === chave)?.rotulo ?? chave;
    for (const id of ids) {
      const oportunidade = oportunidades.find((l) => l.id === id);
      if (oportunidade && oportunidade.estagio !== destino) {
        moverEstagio(id, destino);
        const descricaoMov = `Movida de "${rotuloDe(oportunidade.estagio)}" para "${rotuloDe(destino)}"`;
        registrarEvento({
          oportunidadeId: id,
          tipo: "movimento",
          autorId: currentPlayer?.id,
          autorLogin: currentPlayer?.login,
          descricao: descricaoMov,
          detalhes: { de: oportunidade.estagio, para: destino },
        });
        // Timeline visível "Histórico de interações" (tabela interacoes).
        void registrarInteracao({
          oportunidadeId: id,
          tipo: "mudanca_estagio",
          descricao: descricaoMov,
        });
        ok++;
        if (!firstWon && destino === "fechado_ganho") firstWon = oportunidade;
      }
    }
    if (ok > 0) setSelecionados(new Set());
    if (firstWon) setConvertLead({ ...firstWon, estagio: "fechado_ganho" });
  }

  function solicitarMoverCards(ids: string[], destino: string) {
    if (destino === CRM_ESTAGIO_FECHADO_PERDIDO) {
      const primeiroRegistro = ids.length === 1 ? getRegistro(ids[0]) : undefined;
      setPerdaIds(ids);
      setPerdaDestino(destino);
      setMotivoPerdaId(primeiroRegistro?.motivoId ?? "");
      setMotivoPerdaObs(primeiroRegistro?.observacao ?? "");
      setNovoMotivoPerda("");
      return;
    }
    moverCards(ids, destino);
  }

  function confirmarPerda() {
    const motivoSelecionado = motivos.find((m) => m.id === motivoPerdaId);
    const motivo = motivoSelecionado || (novoMotivoPerda.trim() ? adicionarMotivo(novoMotivoPerda) : null);
    if (!motivo) {
      toast.error("Informe o motivo da perda");
      return;
    }
    perdaIds.forEach((oportunidadeId) => {
      registrarPerda({
        oportunidadeId,
        motivoId: motivo.id,
        motivoRotulo: motivo.rotulo,
        observacao: motivoPerdaObs,
        registradoPor: currentPlayer?.login,
      });
    });
    moverCards(perdaIds, perdaDestino);
    setPerdaIds([]);
    toast.success("Motivo de perda registrado");
  }

  function confirmarConversaoObra() {
    if (!convertLead) return;
    const cliente = convertLead.clienteId
      ? clientes.find((c) => c.id === convertLead.clienteId)
      : null;
    const prefill = {
      nome: convertLead.nome,
      cliente: cliente?.nome || "",
      clienteId: convertLead.clienteId || "",
      cnpj: cliente?.cnpj || "",
      servicos: Array.isArray((convertLead as any).servicos) ? (convertLead as any).servicos : [],
      valorContrato: convertLead.valorEstimado ? String(convertLead.valorEstimado) : "",
      dataMobilizacao: convertLead.dataPrevistaFechamento || "",
      oportunidadeId: convertLead.id,
    };
    try {
      sessionStorage.setItem("obraPrefill", JSON.stringify(prefill));
    } catch (err) { swallow("CRMFunil.prefill", err, "sessionStorage indisponível"); }
    setConvertLead(null);
    navigate("/obras?prefill=1");
  }

  return (
    <div className="space-y-4 flex flex-col h-full">
      <div className="flex items-center justify-between flex-wrap gap-3 shrink-0">
        <div>
          <h1 className="text-2xl font-bold">Funil de Vendas</h1>
          <p className="text-sm text-muted-foreground">
            Arraste os cards para mover a oportunidade entre os estágios.
          </p>
        </div>
        <div className="flex items-end gap-3">
          <div>
            <Label className="text-xs flex items-center gap-1">
              <Filter className="h-3 w-3" /> Responsável
            </Label>
            <Select value={filtroResp} onValueChange={setFiltroResp}>
              <SelectTrigger className="w-48 h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                {playersComCards.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.login}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {canEdit && (
            <Button size="sm" onClick={openNew}>
              <Plus className="h-4 w-4 mr-1" /> Nova oportunidade
            </Button>
          )}
        </div>
      </div>

      {selecionados.size > 0 && (
        <div className="sticky top-0 z-20 flex flex-wrap items-center gap-3 rounded-md border bg-card p-3 shadow-sm">
          <span className="text-sm font-medium">
            {selecionados.size} oportunidade(s) selecionado(s)
          </span>
          <Button size="sm" variant="ghost" onClick={() => setSelecionados(new Set())}>
            <X className="h-4 w-4" /> Cancelar
          </Button>
        </div>
      )}

      <div className="flex items-center gap-2 shrink-0">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nome ou empresa..."
            className="pl-9"
          />
        </div>
        <ColumnFilter
          columns={estagios.map((e) => ({ id: e.chave, label: e.rotulo }))}
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

      {estagios.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum estágio de funil configurado.</p>
      ) : (
        <ScrollArea className="flex-1 min-h-0">
          <div className="flex gap-4 pb-4 min-w-max items-start">
            {estagios
              .filter((e) => !hiddenColumns.has(e.chave))
              .map((est) => {
                const cards = porEstagio(est.chave);
                return (
                  <div
                    key={est.id}
                    className={cn(
                      "obra-column transition-all",
                      dragOverCol === est.chave &&
                        draggedIds.length > 0 &&
                        "ring-2 ring-primary/60 bg-primary/5 border-primary/40",
                    )}
                    onDragOver={(e) => {
                      if (draggedIds.length === 0) return;
                      e.preventDefault();
                      if (dragOverCol !== est.chave) setDragOverCol(est.chave);
                    }}
                    onDragLeave={(e) => {
                      const rt = e.relatedTarget as Node | null;
                      if (!rt || !(e.currentTarget as Node).contains(rt)) {
                        setDragOverCol((cur) => (cur === est.chave ? null : cur));
                      }
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      setDragOverCol(null);
                      if (draggedIds.length === 0) return;
                      solicitarMoverCards(draggedIds, est.chave);
                      setDraggedIds([]);
                    }}
                  >
                    <div className="flex items-center justify-between mb-3 gap-2">
                      <div className="min-w-0">
                        <h3 className="font-display text-sm font-semibold truncate">
                          {est.rotulo}
                        </h3>
                        <div className="text-xs text-muted-foreground">
                          {formatBRLFromNumber(totalEstagio(est.chave))}
                        </div>
                      </div>
                      <span className="text-xs text-muted-foreground bg-secondary rounded-full px-2 py-0.5">
                        {cards.length}
                      </span>
                    </div>
                    <div className="flex flex-col gap-2">
                      {cards.map((oportunidade) => {
                        const sel = selecionados.has(oportunidade.id);
                        const dragging = draggedIds.includes(oportunidade.id);
                        const responsavel = oportunidade.responsavelId
                          ? loginDe.get(oportunidade.responsavelId)
                          : undefined;
                        const perda = getRegistro(oportunidade.id);
                        return (
                          <ContextMenu key={oportunidade.id}>
                            <ContextMenuTrigger asChild>
                              <div
                                draggable={canEdit}
                                onDragStart={(e) => {
                                  const ids =
                                    sel && selecionados.size > 0
                                      ? Array.from(selecionados)
                                      : [oportunidade.id];
                                  setDraggedIds(ids);
                                  e.dataTransfer.effectAllowed = "move";
                                }}
                                onDragEnd={() => {
                                  setDraggedIds([]);
                                  setDragOverCol(null);
                                }}
                                onClick={(e) => {
                                  if (e.ctrlKey || e.metaKey) {
                                    e.preventDefault();
                                    toggleSel(oportunidade.id);
                                  }
                                  // Um clique simples não abre mais o card:
                                  // é preciso dar dois cliques (onDoubleClick).
                                }}
                                onDoubleClick={(e) => {
                                  e.preventDefault();
                                  openCard(oportunidade);
                                }}
                                title="Dê dois cliques para abrir"
                                className={cn(
                                  "rounded-md bg-card border border-border p-2.5 text-sm shadow-sm transition-colors hover:border-primary/50 select-none",
                                  canEdit ? "cursor-grab active:cursor-grabbing" : "cursor-pointer",
                                  sel && "border-primary ring-1 ring-primary",
                                  dragging && "opacity-50",
                                )}
                              >
                                <div className="flex items-start justify-between gap-2 mb-1">
                                  <div className="flex items-start gap-2 flex-1 min-w-0">
                                    <Checkbox
                                      checked={sel}
                                      onCheckedChange={() => toggleSel(oportunidade.id)}
                                      onClick={(e) => e.stopPropagation()}
                                      className="mt-0.5"
                                    />
                                    <div className="font-medium truncate flex-1">
                                      {oportunidade.nome}
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-1 shrink-0">
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setComentando(oportunidade);
                                      }}
                                      onDoubleClick={(e) => e.stopPropagation()}
                                      className="inline-flex items-center gap-0.5 rounded-full bg-secondary px-1.5 py-0.5 text-[10px] font-medium text-secondary-foreground hover:bg-secondary/80 transition-colors"
                                      title={
                                        (comentariosPorOportunidade.get(oportunidade.id) || 0) > 0
                                          ? `${comentariosPorOportunidade.get(oportunidade.id)} comentário(s) — clique para abrir`
                                          : "Adicionar comentário"
                                      }
                                    >
                                      <MessageSquare className="h-3 w-3" />
                                      {comentariosPorOportunidade.get(oportunidade.id) || 0}
                                    </button>
                                    {oportunidade.temperatura_temperatura && (
                                      <TemperatureDisplay
                                        value={oportunidade.temperatura_temperatura}
                                        size="sm"
                                        variant="dot"
                                      />
                                    )}
                                  </div>
                                </div>
                                {oportunidade.empresa && (
                                  <div className="text-xs text-muted-foreground truncate">
                                    {oportunidade.empresa}
                                  </div>
                                )}
                                {oportunidade.estagio === CRM_ESTAGIO_FECHADO_PERDIDO && (
                                  <div className="mt-1 text-[11px] text-destructive inline-flex items-center gap-1 max-w-full">
                                    <AlertTriangle className="h-3 w-3 shrink-0" />
                                    <span className="truncate">
                                      Perda: {perda?.motivoRotulo ?? "motivo pendente"}
                                    </span>
                                  </div>
                                )}
                                <div className="flex items-center justify-between mt-1.5 gap-2">
                                  <span className="text-xs font-semibold text-primary">
                                    {formatBRLFromNumber(oportunidade.valorEstimado || 0)}
                                  </span>
                                  {oportunidade.dataPrevistaFechamento && (
                                    <span className="text-[10px] text-muted-foreground inline-flex items-center gap-1">
                                      <Calendar className="h-3 w-3" />
                                      {fmtDataLocal(
                                        oportunidade.dataPrevistaFechamento,
                                      )}
                                    </span>
                                  )}
                                  {responsavel && (
                                    <span className="text-[10px] text-muted-foreground truncate max-w-[110px]">
                                      {responsavel}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </ContextMenuTrigger>
                            <ContextMenuContent>
                              <ContextMenuItem onSelect={() => openCard(oportunidade)}>
                                Abrir card
                              </ContextMenuItem>
                              <ContextMenuItem onSelect={() => toggleSel(oportunidade.id)}>
                                {sel ? "Remover da seleção" : "Adicionar à seleção"}
                              </ContextMenuItem>
                              <ContextMenuSeparator />
                              {estagios
                                .filter((destino) => destino.chave !== oportunidade.estagio)
                                .map((destino) => (
                                  <ContextMenuItem
                                    key={destino.id}
                                    onSelect={() => {
                                      const ids =
                                        sel && selecionados.size > 0
                                          ? Array.from(selecionados)
                                          : [oportunidade.id];
                                      solicitarMoverCards(ids, destino.chave);
                                    }}
                                  >
                                    Mover para “{destino.rotulo}”
                                  </ContextMenuItem>
                                ))}
                            </ContextMenuContent>
                          </ContextMenu>
                        );
                      })}
                      {cards.length === 0 && (
                        <div className="text-xs text-muted-foreground text-center py-4">
                          Sem oportunidades
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      )}

      <Dialog open={!!convertLead} onOpenChange={(v) => !v && setConvertLead(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Converter como obra?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            A oportunidade <strong>{convertLead?.nome}</strong> entrou em <em>Fechado Ganho</em>.
            Deseja replicar automaticamente para a página <strong>Obras</strong> abrindo o
            formulário pré-preenchido?
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConvertLead(null)}>
              Agora não
            </Button>
            <Button onClick={confirmarConversaoObra}>Converter como obra</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={perdaIds.length > 0} onOpenChange={(v) => !v && setPerdaIds([])}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Registrar motivo da perda</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <Label>Motivo *</Label>
              <Select value={motivoPerdaId} onValueChange={setMotivoPerdaId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {motivos.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.rotulo}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Novo motivo</Label>
              <Input
                value={novoMotivoPerda}
                onChange={(e) => setNovoMotivoPerda(e.target.value)}
                placeholder="Adicionar à lista gerenciável"
              />
            </div>
            <div className="space-y-1">
              <Label>Observação</Label>
              <Textarea
                value={motivoPerdaObs}
                onChange={(e) => setMotivoPerdaObs(e.target.value)}
                rows={3}
                placeholder="Detalhes comerciais relevantes"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPerdaIds([])}>
              Cancelar
            </Button>
            <Button onClick={confirmarPerda}>Registrar e mover</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <OportunidadeFormDialog open={formOpen} onOpenChange={setFormOpen} editing={formEditing} />

      <OportunidadeComentariosDrawer
        oportunidade={comentando}
        open={!!comentando}
        onOpenChange={(v) => !v && setComentando(null)}
      />
    </div>
  );
}
