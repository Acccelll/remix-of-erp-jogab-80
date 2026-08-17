import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { profilesRepo } from "@/lib/repositories/admin";
import {
  pacotesTrabalhoRepo,
  restricoesRepo,
  pacoteRestricoesRepo,
  compromissosSemanaisRepo,
} from "@/lib/repositories/planejamento";
import { cronogramaFns as cronogramaRepo, type CronogramaItemRow } from "@/hooks/obras/useCronograma";
import { useObras } from "@/hooks/obras/useObras";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import DatePickerField from "@/components/common/DatePickerField";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Plus,
  Package,
  Loader2,
  CheckCircle2,
  List as ListIcon,
  LayoutGrid,
  ShieldAlert,
} from "lucide-react";
import {
  DndContext,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  DragOverlay,
  pointerWithin,
  useDroppable,
  useDraggable,
  type DragEndEvent,
  type DragStartEvent,
  type DragOverEvent,
} from "@dnd-kit/core";
import { isoDate, semanaDe, formatSemana, proximasNSemanas } from "@/lib/lastplanner/semana";
import { pacoteEstaPronto, type Restricao } from "@/lib/lastplanner/restricoes";
import { useUrlState } from "@/hooks/useUrlState";

type Pacote = {
  id: string;
  obra_id: string;
  cronograma_item_id: string | null;
  descricao: string;
  responsavel_id: string | null;
  semana_inicio: string;
  semana_fim: string;
  status: string;
  tamanho_estimado: number | null;
  unidade: string | null;
  criterio_conclusao: string | null;
  created_at: string;
};
type Obra = { id: string; nome: string };
type CronoItem = { id: string; descricao: string; obra_id: string };
type Profile = { id: string; login: string | null; email: string | null };
type PR = { pacote_id: string; restricao_id: string };
type RestricaoRow = Pick<Restricao, "id" | "tipo" | "status"> & { prazo: string | null };

import {
  STATUS_PACOTE_LABEL as STATUS_LABEL,
  STATUS_PACOTE_VARIANT as STATUS_VARIANT,
  STATUS_PACOTE_ORDER as STATUS_ORDER,
} from "@/lib/status";
import { PageLoading } from "@/components/common/PageLoading";
import { dndAnnouncementsPtBR, dndScreenReaderInstructionsPtBR } from "@/lib/a11y/dndAnnouncements";

export default function PacotesTrabalho() {
  const [loading, setLoading] = useState(true);
  const [pacotes, setPacotes] = useState<Pacote[]>([]);
  const obrasQuery = useObras();
  const obras = useMemo<Obra[]>(
    () => (obrasQuery.data ?? []).map((o) => ({ id: o.id, nome: o.nome })),
    [obrasQuery.data],
  );
  const [cronoItens, setCronoItens] = useState<CronoItem[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [pr, setPr] = useState<PR[]>([]);
  const [restricoes, setRestricoes] = useState<RestricaoRow[]>([]);

  const [filtroObra, setFiltroObra] = useUrlState("obra", "todas");
  const [filtroStatus, setFiltroStatus] = useUrlState("status", "todos");
  const [filtroSemana, setFiltroSemana] = useUrlState("semana", "todas");

  const [openForm, setOpenForm] = useState(false);
  const [editing, setEditing] = useState<Pacote | null>(null);
  const [saving, setSaving] = useState(false);
  const [viewStr, setViewStr] = useUrlState("view", "kanban");
  const view = (viewStr === "lista" ? "lista" : "kanban") as "lista" | "kanban";
  const setView = (v: "lista" | "kanban") => setViewStr(v);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [overCol, setOverCol] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor),
  );
  const [form, setForm] = useState({
    obra_id: "",
    cronograma_item_id: "",
    descricao: "",
    responsavel_id: "",
    semana_inicio: isoDate(semanaDe(new Date())),
    semana_fim: isoDate(semanaDe(new Date())),
    tamanho_estimado: "",
    unidade: "",
    criterio_conclusao: "",
  });

  const obraById = useMemo(() => Object.fromEntries(obras.map((o) => [o.id, o.nome])), [obras]);
  const profById = useMemo(
    () => Object.fromEntries(profiles.map((p) => [p.id, p.login ?? p.email ?? p.id.slice(0, 6)])),
    [profiles],
  );
  const cronoById = useMemo(
    () => Object.fromEntries(cronoItens.map((c) => [c.id, c.descricao])),
    [cronoItens],
  );

  // Mapa pacote -> restrições
  const restById = useMemo(
    () => Object.fromEntries(restricoes.map((r) => [r.id, r])),
    [restricoes],
  );
  const restPorPacote = useMemo(() => {
    const m = new Map<string, RestricaoRow[]>();
    for (const link of pr) {
      const r = restById[link.restricao_id];
      if (!r) continue;
      const arr = m.get(link.pacote_id) ?? [];
      arr.push(r);
      m.set(link.pacote_id, arr);
    }
    return m;
  }, [pr, restById]);

  async function load() {
    setLoading(true);
    const [pacotesRes, cronoRes, profilesRes, linksRes, restricoesRes] = await Promise.all([
      pacotesTrabalhoRepo.listCompleto().then((data) => ({ data, error: null as any })),
      cronogramaRepo
        .listResumoPacotes()
        .then((data: Pick<CronogramaItemRow, "id" | "descricao" | "obra_id">[]) => ({
          data,
          error: null as any,
        })),
      profilesRepo.listMin().then((data) => ({ data, error: null as any })),
      pacoteRestricoesRepo.listComData().then((data) => ({ data, error: null as any })),
      restricoesRepo.listCurto().then((data) => ({ data, error: null as any })),
    ]);
    if (
      pacotesRes.error ||
      cronoRes.error ||
      profilesRes.error ||
      linksRes.error ||
      restricoesRes.error
    ) {
      toast.error("Falha ao carregar pacotes");
      setLoading(false);
      return;
    }
    setPacotes((pacotesRes.data ?? []) as Pacote[]);
    setCronoItens((cronoRes.data ?? []) as CronoItem[]);
    setProfiles((profilesRes.data ?? []) as unknown as Profile[]); // TODO(ARC-001/E-01): profiles.email ausente.
    setPr((linksRes.data ?? []) as PR[]);
    setRestricoes((restricoesRes.data ?? []) as RestricaoRow[]);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  function openNew() {
    setEditing(null);
    setForm({
      obra_id: obras[0]?.id ?? "",
      cronograma_item_id: "",
      descricao: "",
      responsavel_id: "",
      semana_inicio: isoDate(semanaDe(new Date())),
      semana_fim: isoDate(semanaDe(new Date())),
      tamanho_estimado: "",
      unidade: "",
      criterio_conclusao: "",
    });
    setOpenForm(true);
  }

  function openEdit(p: Pacote) {
    setEditing(p);
    setForm({
      obra_id: p.obra_id,
      cronograma_item_id: p.cronograma_item_id ?? "",
      descricao: p.descricao,
      responsavel_id: p.responsavel_id ?? "",
      semana_inicio: p.semana_inicio,
      semana_fim: p.semana_fim,
      tamanho_estimado: p.tamanho_estimado != null ? String(p.tamanho_estimado) : "",
      unidade: p.unidade ?? "",
      criterio_conclusao: p.criterio_conclusao ?? "",
    });
    setOpenForm(true);
  }

  async function salvar() {
    if (!form.obra_id) return toast.error("Selecione a obra");
    if (!form.descricao.trim()) return toast.error("Informe a descrição");
    setSaving(true);

    const semIni = isoDate(semanaDe(form.semana_inicio));
    const semFim = isoDate(semanaDe(form.semana_fim));
    const payload = {
      obra_id: form.obra_id,
      cronograma_item_id: form.cronograma_item_id || null,
      descricao: form.descricao.trim(),
      responsavel_id: form.responsavel_id || null,
      semana_inicio: semIni,
      semana_fim: semFim < semIni ? semIni : semFim,
      tamanho_estimado: form.tamanho_estimado ? Number(form.tamanho_estimado) : null,
      unidade: form.unidade || null,
      criterio_conclusao: form.criterio_conclusao || null,
    };
    let error: any = null;
    try {
      await pacotesTrabalhoRepo.upsert(editing?.id, payload);
    } catch (e: any) {
      error = e;
    }
    setSaving(false);
    if (error) return toast.error("Falha ao salvar");
    toast.success(editing ? "Pacote atualizado" : "Pacote criado");
    setOpenForm(false);
    await load();
  }

  async function alterarStatus(p: Pacote, novo: string) {
    const { error } = await pacotesTrabalhoRepo.updateStatus(p.id, novo);
    if (error) return toast.error("Falha ao alterar status");
    toast.success("Status atualizado");
    await load();
  }

  async function comprometer(p: Pacote) {
    const rs = restPorPacote.get(p.id) ?? [];
    if (!pacoteEstaPronto(rs as Restricao[])) {
      return toast.error("Pacote tem restrições abertas — resolva antes de comprometer");
    }
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return toast.error("Sessão expirada");
    const { error } = await compromissosSemanaisRepo.insertRaw({
      pacote_id: p.id,
      obra_id: p.obra_id,
      semana_inicio: p.semana_inicio,
    });
    if (error) {
      if (error.code === "23505") return toast.error("Pacote já comprometido nesta semana");
      return toast.error("Falha ao comprometer");
    }
    await pacotesTrabalhoRepo.updateStatus(p.id, "comprometido");
    toast.success("Pacote comprometido para a semana");
    await load();
  }

  const semanasFiltro = useMemo(() => proximasNSemanas(8, new Date()), []);

  const pacotesFiltrados = useMemo(() => {
    return pacotes.filter((p) => {
      if (filtroObra !== "todas" && p.obra_id !== filtroObra) return false;
      if (filtroStatus !== "todos" && p.status !== filtroStatus) return false;
      if (filtroSemana !== "todas" && p.semana_inicio !== filtroSemana) return false;
      return true;
    });
  }, [pacotes, filtroObra, filtroStatus, filtroSemana]);

  const cronoFiltrado = useMemo(
    () => cronoItens.filter((c) => !form.obra_id || c.obra_id === form.obra_id).slice(0, 200),
    [cronoItens, form.obra_id],
  );

  const porStatus = useMemo(() => {
    const m = new Map<string, Pacote[]>();
    for (const k of STATUS_ORDER) m.set(k, []);
    for (const p of pacotesFiltrados) {
      const arr = m.get(p.status) ?? [];
      arr.push(p);
      m.set(p.status, arr);
    }
    return m;
  }, [pacotesFiltrados]);

  function podeMover(p: Pacote, dest: string): { ok: boolean; motivo?: string } {
    if (p.status === dest) return { ok: false };
    const rs = (restPorPacote.get(p.id) ?? []) as Restricao[];
    if (dest === "comprometido" && !pacoteEstaPronto(rs)) {
      return { ok: false, motivo: "Existem restrições abertas vinculadas a este pacote." };
    }
    return { ok: true };
  }

  async function moverParaStatus(p: Pacote, novo: string) {
    const check = podeMover(p, novo);
    if (!check.ok) {
      if (check.motivo) toast.error(check.motivo);
      return;
    }
    const prev = pacotes;
    setPacotes((cur) => cur.map((x) => (x.id === p.id ? { ...x, status: novo } : x)));
    if (novo === "comprometido") {
      const { error } = await compromissosSemanaisRepo.insertRaw({
        pacote_id: p.id,
        obra_id: p.obra_id,
        semana_inicio: p.semana_inicio,
      });
      if (error && error.code !== "23505") {
        setPacotes(prev);
        return toast.error("Falha ao comprometer");
      }
    }
    const { error } = await pacotesTrabalhoRepo.updateStatus(p.id, novo);
    if (error) {
      setPacotes(prev);
      return toast.error("Falha ao mover");
    }
    toast.success(`Pacote movido para ${STATUS_LABEL[novo] ?? novo}`);
  }

  function onDragStart(e: DragStartEvent) {
    setActiveId(String(e.active.id));
  }
  function onDragOver(e: DragOverEvent) {
    const overId = e.over?.id ? String(e.over.id) : null;
    if (!overId) return setOverCol(null);
    if (overId.startsWith("col:")) setOverCol(overId.slice(4));
  }
  function onDragEnd(e: DragEndEvent) {
    const id = String(e.active.id);
    const overId = e.over?.id ? String(e.over.id) : null;
    setActiveId(null);
    setOverCol(null);
    if (!overId || !overId.startsWith("col:")) return;
    const destStatus = overId.slice(4);
    const pacote = pacotes.find((p) => p.id === id);
    if (!pacote) return;
    void moverParaStatus(pacote, destStatus);
  }

  const activePacote = activeId ? pacotes.find((p) => p.id === activeId) : null;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Package className="h-6 w-6" />
            Pacotes de Trabalho
          </h1>
          <p className="text-sm text-muted-foreground">
            Last Planner — unidade entregável semanal vinculada ao cronograma.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div
            className="inline-flex rounded-md border bg-card p-0.5"
            role="group"
            aria-label="Modo de visualização"
          >
            <Button
              size="sm"
              variant={view === "kanban" ? "default" : "ghost"}
              onClick={() => setView("kanban")}
              aria-pressed={view === "kanban"}
              aria-label="Visualizar como quadro"
              className="h-8"
            >
              <LayoutGrid className="h-4 w-4" />
            </Button>
            <Button
              size="sm"
              variant={view === "lista" ? "default" : "ghost"}
              onClick={() => setView("lista")}
              aria-pressed={view === "lista"}
              aria-label="Visualizar como lista"
              className="h-8"
            >
              <ListIcon className="h-4 w-4" />
            </Button>
          </div>
          <Button onClick={openNew}>
            <Plus className="h-4 w-4 mr-2" />
            Novo Pacote
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div>
          <Label className="text-xs">Obra</Label>
          <Select value={filtroObra} onValueChange={setFiltroObra}>
            <SelectTrigger aria-label="Filtrar por obra">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas</SelectItem>
              {obras.map((o) => (
                <SelectItem key={o.id} value={o.id}>
                  {o.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">Status</Label>
          <Select value={filtroStatus} onValueChange={setFiltroStatus}>
            <SelectTrigger aria-label="Filtrar por status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              {Object.entries(STATUS_LABEL).map(([k, v]) => (
                <SelectItem key={k} value={k}>
                  {v}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">Semana</Label>
          <Select value={filtroSemana} onValueChange={setFiltroSemana}>
            <SelectTrigger aria-label="Filtrar por semana">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas</SelectItem>
              {semanasFiltro.map((d) => {
                const k = isoDate(d);
                return (
                  <SelectItem key={k} value={k}>
                    {formatSemana(k)}
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        </div>
      </div>

      {loading || obrasQuery.isLoading ? (
        <PageLoading />
      ) : pacotesFiltrados.length === 0 ? (
        <div className="text-center text-muted-foreground py-12 border rounded-lg">
          Nenhum pacote encontrado.
        </div>
      ) : view === "kanban" ? (
        <DndContext
          sensors={sensors}
          accessibility={{
            announcements: dndAnnouncementsPtBR(),
            screenReaderInstructions: dndScreenReaderInstructionsPtBR,
          }}
          collisionDetection={pointerWithin}
          onDragStart={onDragStart}
          onDragOver={onDragOver}
          onDragEnd={onDragEnd}
          onDragCancel={() => {
            setActiveId(null);
            setOverCol(null);
          }}
        >
          <div aria-live="polite" role="status" className="sr-only">
            {activePacote ? `Movendo pacote ${activePacote.descricao}` : ""}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3 items-start">
            {STATUS_ORDER.map((status) => {
              const cards = porStatus.get(status) ?? [];
              const isOver = overCol === status;
              const bloqueado =
                !!activePacote &&
                !podeMover(activePacote, status).ok &&
                activePacote.status !== status;
              return (
                <ColunaStatus
                  key={status}
                  status={status}
                  count={cards.length}
                  isOver={isOver}
                  bloqueado={bloqueado}
                >
                  {cards.map((p) => {
                    const rs = (restPorPacote.get(p.id) ?? []) as Restricao[];
                    const abertas = rs.filter((r) => r.status === "aberta").length;
                    return (
                      <PacoteCard
                        key={p.id}
                        pacote={p}
                        abertas={abertas}
                        obraNome={obraById[p.obra_id]}
                        responsavel={p.responsavel_id ? profById[p.responsavel_id] : undefined}
                        onOpen={() => openEdit(p)}
                      />
                    );
                  })}
                  {cards.length === 0 && (
                    <div className="text-xs text-muted-foreground text-center py-6">Vazio</div>
                  )}
                </ColunaStatus>
              );
            })}
          </div>
          <DragOverlay dropAnimation={{ duration: 180 }}>
            {activePacote ? (
              <div className="rotate-2 shadow-2xl">
                <PacoteCard
                  pacote={activePacote}
                  abertas={
                    ((restPorPacote.get(activePacote.id) ?? []) as Restricao[]).filter(
                      (r) => r.status === "aberta",
                    ).length
                  }
                  obraNome={obraById[activePacote.obra_id]}
                  responsavel={
                    activePacote.responsavel_id ? profById[activePacote.responsavel_id] : undefined
                  }
                />
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      ) : (
        <div className="space-y-2">
          {pacotesFiltrados.map((p) => {
            const rs = (restPorPacote.get(p.id) ?? []) as Restricao[];
            const abertas = rs.filter((r) => r.status === "aberta").length;
            const pronto = pacoteEstaPronto(rs);
            return (
              <div
                key={p.id}
                className="border rounded-lg p-4 hover:bg-accent/30 transition cursor-pointer"
                onClick={() => openEdit(p)}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium">{p.descricao}</span>
                      <Badge variant={STATUS_VARIANT[p.status] ?? "outline"}>
                        {STATUS_LABEL[p.status] ?? p.status}
                      </Badge>
                      <Badge variant="outline">{obraById[p.obra_id] ?? "—"}</Badge>
                      {p.cronograma_item_id && (
                        <Badge variant="secondary" className="text-xs">
                          {cronoById[p.cronograma_item_id] ?? "atividade"}
                        </Badge>
                      )}
                      {abertas > 0 ? (
                        <Badge variant="destructive">{abertas} restrição(ões)</Badge>
                      ) : (
                        <Badge variant="default" className="gap-1">
                          <CheckCircle2 className="h-3 w-3" />
                          Pronto
                        </Badge>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {formatSemana(p.semana_inicio)}
                      {p.semana_inicio !== p.semana_fim && ` → ${formatSemana(p.semana_fim)}`}
                      {p.responsavel_id && ` • ${profById[p.responsavel_id] ?? "—"}`}
                      {p.tamanho_estimado != null && ` • ${p.tamanho_estimado} ${p.unidade ?? ""}`}
                    </div>
                  </div>
                  <div
                    className="flex items-center gap-2 shrink-0"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {p.status === "planejado" && (
                      <Button
                        size="sm"
                        disabled={!pronto}
                        onClick={() => comprometer(p)}
                        title={pronto ? "" : "Resolva as restrições primeiro"}
                      >
                        Comprometer
                      </Button>
                    )}
                    {p.status === "comprometido" && (
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => alterarStatus(p, "concluido")}
                      >
                        Marcar concluído
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={openForm} onOpenChange={setOpenForm}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar Pacote" : "Novo Pacote"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Obra</Label>
                <Select
                  value={form.obra_id}
                  onValueChange={(v) => setForm({ ...form, obra_id: v, cronograma_item_id: "" })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione…" />
                  </SelectTrigger>
                  <SelectContent>
                    {obras.map((o) => (
                      <SelectItem key={o.id} value={o.id}>
                        {o.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Item do Cronograma (opcional)</Label>
                <Select
                  value={form.cronograma_item_id || "__none"}
                  onValueChange={(v) =>
                    setForm({ ...form, cronograma_item_id: v === "__none" ? "" : v })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none">— sem vínculo —</SelectItem>
                    {cronoFiltrado.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.descricao}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Descrição</Label>
              <Input
                value={form.descricao}
                onChange={(e) => setForm({ ...form, descricao: e.target.value })}
                placeholder="Ex: Concretagem pilares P10-P15"
              />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label>Semana início</Label>
                <DatePickerField
                  value={form.semana_inicio}
                  onChange={(v) => setForm({ ...form, semana_inicio: v })}
                />
              </div>
              <div>
                <Label>Semana fim</Label>
                <DatePickerField
                  value={form.semana_fim}
                  onChange={(v) => setForm({ ...form, semana_fim: v })}
                />
              </div>
              <div>
                <Label>Responsável</Label>
                <Select
                  value={form.responsavel_id || "__none"}
                  onValueChange={(v) =>
                    setForm({ ...form, responsavel_id: v === "__none" ? "" : v })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none">—</SelectItem>
                    {profiles.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.login ?? p.email ?? p.id.slice(0, 8)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label>Tamanho estimado</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={form.tamanho_estimado}
                  onChange={(e) => setForm({ ...form, tamanho_estimado: e.target.value })}
                />
              </div>
              <div>
                <Label>Unidade</Label>
                <Input
                  value={form.unidade}
                  onChange={(e) => setForm({ ...form, unidade: e.target.value })}
                  placeholder="m², m³, un"
                />
              </div>
            </div>
            <div>
              <Label>Critério de conclusão</Label>
              <Textarea
                rows={2}
                value={form.criterio_conclusao}
                onChange={(e) => setForm({ ...form, criterio_conclusao: e.target.value })}
                placeholder="Ex: 100% das peças concretadas e formas retiradas"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenForm(false)}>
              Cancelar
            </Button>
            <Button onClick={salvar} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ColunaStatus({
  status,
  count,
  isOver,
  bloqueado,
  children,
}: {
  status: string;
  count: number;
  isOver: boolean;
  bloqueado: boolean;
  children: React.ReactNode;
}) {
  const { setNodeRef } = useDroppable({ id: `col:${status}` });
  return (
    <div
      ref={setNodeRef}
      role="region"
      aria-label={`Coluna ${STATUS_LABEL[status] ?? status}`}
      className={`rounded-lg border bg-muted/30 p-3 min-h-[200px] transition ${
        isOver
          ? bloqueado
            ? "ring-2 ring-destructive bg-destructive/5"
            : "ring-2 ring-primary bg-primary/5"
          : ""
      }`}
    >
      <div className="flex items-center justify-between mb-3 px-1">
        <div className="flex items-center gap-2">
          <Badge variant={STATUS_VARIANT[status] ?? "outline"}>
            {STATUS_LABEL[status] ?? status}
          </Badge>
          <span className="text-xs text-muted-foreground">{count}</span>
        </div>
        {isOver && bloqueado && (
          <span className="flex items-center gap-1 text-[10px] text-destructive font-medium">
            <ShieldAlert className="h-3 w-3" /> bloqueado
          </span>
        )}
      </div>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function PacoteCard({
  pacote,
  abertas,
  obraNome,
  responsavel,
  onOpen,
}: {
  pacote: Pacote;
  abertas: number;
  obraNome?: string;
  responsavel?: string;
  onOpen?: () => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: pacote.id });
  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      onClick={(e) => {
        if (isDragging) return;
        e.stopPropagation();
        onOpen?.();
      }}
      className={`rounded-md border bg-card p-3 shadow-sm cursor-grab active:cursor-grabbing hover:bg-accent/40 transition ${
        isDragging ? "opacity-40" : ""
      }`}
    >
      <div className="text-sm font-medium line-clamp-2">{pacote.descricao}</div>
      <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
        {obraNome && (
          <Badge variant="outline" className="text-[10px]">
            {obraNome}
          </Badge>
        )}
        {abertas > 0 ? (
          <Badge variant="destructive" className="text-[10px] gap-1">
            <ShieldAlert className="h-3 w-3" />
            {abertas} restriç{abertas === 1 ? "ão" : "ões"}
          </Badge>
        ) : (
          <Badge variant="default" className="text-[10px] gap-1">
            <CheckCircle2 className="h-3 w-3" /> Pronto
          </Badge>
        )}
        <span>{formatSemana(pacote.semana_inicio)}</span>
        {responsavel && <span>• {responsavel}</span>}
        {pacote.tamanho_estimado != null && (
          <span>
            • {pacote.tamanho_estimado} {pacote.unidade ?? ""}
          </span>
        )}
      </div>
    </div>
  );
}
