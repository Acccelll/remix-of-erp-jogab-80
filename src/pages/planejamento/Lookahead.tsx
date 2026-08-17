import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import {
  restricoesRepo,
  pacoteRestricoesRepo,
  pacotesTrabalhoRepo,
  compromissosSemanaisRepo,
} from "@/lib/repositories/planejamento";
import { useObras } from "@/hooks/obras/useObras";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CalendarRange, Loader2, AlertTriangle, CheckCircle2, Clock, Check, Copy, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
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
} from "@dnd-kit/core";
import { isoDate, proximasNSemanas, formatSemana, semanaDe } from "@/lib/lastplanner/semana";
import {
  semaforoPacote,
  pacoteEstaPronto,
  type Restricao,
  type Semaforo,
} from "@/lib/lastplanner/restricoes";
import { useUrlState } from "@/hooks/useUrlState";
import { PageLoading } from "@/components/common/PageLoading";
import { dndAnnouncementsPtBR, dndScreenReaderInstructionsPtBR } from "@/lib/a11y/dndAnnouncements";

type Pacote = {
  id: string;
  obra_id: string;
  descricao: string;
  semana_inicio: string;
  semana_fim: string;
  status: string;
};
type Obra = { id: string; nome: string };
type PR = { pacote_id: string; restricao_id: string };
type RestricaoRow = Pick<Restricao, "id" | "tipo" | "status"> & {
  prazo: string | null;
  descricao?: string | null;
};

const SEM_BG: Record<Semaforo, string> = {
  verde: "bg-success/15 border-success/40 hover:bg-success/25",
  amarelo: "bg-warning/15 border-warning/40 hover:bg-warning/25",
  vermelho: "bg-destructive/15 border-destructive/40 hover:bg-destructive/25",
};
const SEM_DOT: Record<Semaforo, string> = {
  verde: "bg-success",
  amarelo: "bg-warning",
  vermelho: "bg-destructive",
};
const SEM_LABEL: Record<Semaforo, string> = {
  verde: "Pronto",
  amarelo: "Restrições abertas",
  vermelho: "Restrições vencidas",
};

export default function Lookahead() {
  const [loading, setLoading] = useState(true);
  const [pacotes, setPacotes] = useState<Pacote[]>([]);
  const obrasQuery = useObras();
  const obras = useMemo<Obra[]>(
    () => (obrasQuery.data ?? []).map((o) => ({ id: o.id, nome: o.nome })),
    [obrasQuery.data],
  );
  const [pr, setPr] = useState<PR[]>([]);
  const [restricoes, setRestricoes] = useState<RestricaoRow[]>([]);
  const [filtroObra, setFiltroObra] = useUrlState("obra", "todas");
  const [janelaStr, setJanelaStr] = useUrlState("janela", "6");
  const janela = (["6", "8", "12"].includes(janelaStr) ? janelaStr : "6") as "6" | "8" | "12";
  const setJanela = (v: "6" | "8" | "12") => setJanelaStr(v);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [overSem, setOverSem] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor),
  );

  const semanas = useMemo(() => proximasNSemanas(Number(janela), new Date()), [janela]);
  const semanasIso = useMemo(() => semanas.map(isoDate), [semanas]);

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

  const obraById = useMemo(() => Object.fromEntries(obras.map((o) => [o.id, o.nome])), [obras]);

  async function load() {
    setLoading(true);
    const inicioJanela = semanasIso[0];
    const fimJanela = semanasIso[semanasIso.length - 1];
    const [r1, r3, r4] = await Promise.all([
      pacotesTrabalhoRepo.listJanela(inicioJanela, fimJanela),
      pacoteRestricoesRepo.listComData().then((data) => ({ data, error: null as any })),
      restricoesRepo.listResumo().then((data) => ({ data, error: null as any })),
    ]);
    if (r1.error || r3.error || r4.error) {
      toast.error("Falha ao carregar Lookahead");
      setLoading(false);
      return;
    }
    setPacotes((r1.data ?? []) as Pacote[]);
    setPr((r3.data ?? []) as PR[]);
    setRestricoes((r4.data ?? []) as RestricaoRow[]);
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [janela]);

  // Mapa: semanaIso -> pacotes daquela semana (filtrados por obra)
  const pacotesPorSemana = useMemo(() => {
    const filtrados = pacotes.filter((p) => filtroObra === "todas" || p.obra_id === filtroObra);
    const m = new Map<string, Pacote[]>();
    for (const sem of semanasIso) m.set(sem, []);
    for (const p of filtrados) {
      const ini = isoDate(semanaDe(p.semana_inicio));
      const fim = isoDate(semanaDe(p.semana_fim));
      for (const sem of semanasIso) {
        if (sem >= ini && sem <= fim) m.get(sem)!.push(p);
      }
    }
    return m;
  }, [pacotes, semanasIso, filtroObra]);

  // KPIs agregados na janela
  const kpis = useMemo(() => {
    const visiveis = new Set<string>();
    for (const arr of pacotesPorSemana.values()) for (const p of arr) visiveis.add(p.id);
    let verde = 0,
      amarelo = 0,
      vermelho = 0;
    for (const id of visiveis) {
      const rs = (restPorPacote.get(id) ?? []) as Restricao[];
      const s = semaforoPacote(rs);
      if (s === "verde") verde++;
      else if (s === "amarelo") amarelo++;
      else vermelho++;
    }
    return { total: visiveis.size, verde, amarelo, vermelho };
  }, [pacotesPorSemana, restPorPacote]);

  async function moverPacoteParaSemana(p: Pacote, novaSemana: string) {
    if (novaSemana === p.semana_inicio) return;
    const ini = new Date(p.semana_inicio);
    const fim = new Date(p.semana_fim);
    const dur = Math.max(0, fim.getTime() - ini.getTime());
    const nova = new Date(novaSemana);
    const novoFim = isoDate(new Date(nova.getTime() + dur));
    const prev = pacotes;
    setPacotes((cur) =>
      cur.map((x) =>
        x.id === p.id ? { ...x, semana_inicio: novaSemana, semana_fim: novoFim } : x,
      ),
    );
    try {
      await pacotesTrabalhoRepo.updateSemana(p.id, novaSemana, novoFim);
    } catch {
      setPacotes(prev);
      return toast.error("Falha ao mover pacote");
    }
    toast.success(`Pacote movido para ${formatSemana(novaSemana)}`);
  }

  async function resolverRestricao(rid: string) {
    const prev = restricoes;
    setRestricoes((cur) => cur.map((r) => (r.id === rid ? { ...r, status: "resolvida" } : r)));
    const { error } = await restricoesRepo.updateStatus(rid, "resolvida");
    if (error) {
      setRestricoes(prev);
      return toast.error("Falha ao resolver restrição");
    }
    toast.success("Restrição resolvida");
  }

  /**
   * PRO-025 — Replica os pacotes cuja `semana_inicio` cai na semana anterior
   * a `semAlvo` para a semana `semAlvo`, preservando duração, obra,
   * responsável e demais campos operacionais. Não copia status (novo pacote
   * entra com o default do banco) para forçar reavaliação de restrições.
   */
  async function repetirSemanaAnterior(semAlvo: string) {
    const anterior = isoDate(
      semanaDe(new Date(new Date(semAlvo).getTime() - 7 * 24 * 60 * 60 * 1000)),
    );
    const origem = pacotes.filter(
      (p) =>
        isoDate(semanaDe(p.semana_inicio)) === anterior &&
        (filtroObra === "todas" || p.obra_id === filtroObra),
    );
    if (origem.length === 0) {
      toast.info("Nenhum pacote na semana anterior para repetir.");
      return;
    }
    let full: Array<Record<string, any>>;
    try {
      full = await pacotesTrabalhoRepo.listParaReplicar(origem.map((p) => p.id));
    } catch {
      return toast.error("Falha ao ler pacotes de origem");
    }
    const payload = full.map((p) => {
      const durMs =
        new Date(p.semana_fim).getTime() - new Date(p.semana_inicio).getTime();
      const novoFim = isoDate(
        new Date(new Date(semAlvo).getTime() + Math.max(0, durMs)),
      );
      return { ...p, semana_inicio: semAlvo, semana_fim: novoFim };
    });
    try {
      await pacotesTrabalhoRepo.insertMany(payload);
    } catch {
      return toast.error("Falha ao repetir semana anterior");
    }
    toast.success(`${payload.length} pacote(s) replicados para ${formatSemana(semAlvo)}`);
    await load();
  }

  /**
   * PRO-025.slice-02 — Promove um pacote pronto do Lookahead (semana atual)
   * diretamente para compromisso, sem exigir passar pelo Kanban de Pacotes.
   * Regras: só é aceita a promoção se todas as restrições estiverem
   * resolvidas (`pacoteEstaPronto`) e o pacote ainda não estiver
   * comprometido. Duplicatas na mesma semana são tratadas via 23505.
   */
  async function comprometer(p: Pacote) {
    const rs = (restPorPacote.get(p.id) ?? []) as Restricao[];
    if (!pacoteEstaPronto(rs)) {
      return toast.error("Pacote tem restrições abertas — resolva antes de comprometer.");
    }
    if (p.status === "comprometido") {
      return toast.info("Pacote já está comprometido.");
    }
    const prev = pacotes;
    setPacotes((cur) => cur.map((x) => (x.id === p.id ? { ...x, status: "comprometido" } : x)));
    const { error: insErr } = await compromissosSemanaisRepo.insertRaw({
      pacote_id: p.id,
      obra_id: p.obra_id,
      semana_inicio: p.semana_inicio,
    });
    if (insErr && insErr.code !== "23505") {
      setPacotes(prev);
      return toast.error("Falha ao comprometer pacote.");
    }
    const { error: upErr } = await pacotesTrabalhoRepo.updateStatus(p.id, "comprometido");
    if (upErr) {
      setPacotes(prev);
      return toast.error("Falha ao atualizar status do pacote.");
    }
    toast.success(`Pacote comprometido para ${formatSemana(p.semana_inicio)}.`);
  }



  function onDragStart(e: DragStartEvent) {
    setActiveId(String(e.active.id));
  }
  function onDragEnd(e: DragEndEvent) {
    const id = String(e.active.id);
    const overId = e.over?.id ? String(e.over.id) : null;
    setActiveId(null);
    setOverSem(null);
    if (!overId || !overId.startsWith("sem:")) return;
    const novaSem = overId.slice(4);
    const pacote = pacotes.find((p) => p.id === id);
    if (pacote) void moverPacoteParaSemana(pacote, novaSem);
  }

  const activePacote = activeId ? pacotes.find((p) => p.id === activeId) : null;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <CalendarRange className="h-6 w-6" />
            Lookahead {janela} semanas
          </h1>
          <p className="text-sm text-muted-foreground">
            Visão antecipada dos pacotes por semana — o semáforo indica a prontidão (restrições
            abertas/vencidas).
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            to="/planejamento/pacotes"
            className="text-xs text-muted-foreground hover:text-foreground underline-offset-4 hover:underline"
          >
            ir para Pacotes →
          </Link>
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
          <Label className="text-xs">Janela</Label>
          <Select value={janela} onValueChange={(v) => setJanela(v as "6" | "8" | "12")}>
            <SelectTrigger aria-label="Selecionar janela de semanas">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="6">6 semanas</SelectItem>
              <SelectItem value="8">8 semanas</SelectItem>
              <SelectItem value="12">12 semanas</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-end gap-2 flex-wrap">
          <Badge variant="outline" className="gap-1.5">
            <span className="font-semibold">{kpis.total}</span> pacotes
          </Badge>
          <Badge variant="outline" className="gap-1.5">
            <span className={`h-2 w-2 rounded-full ${SEM_DOT.verde}`} />
            {kpis.verde} prontos
          </Badge>
          <Badge variant="outline" className="gap-1.5">
            <span className={`h-2 w-2 rounded-full ${SEM_DOT.amarelo}`} />
            {kpis.amarelo} c/ restrições
          </Badge>
          <Badge variant="outline" className="gap-1.5">
            <span className={`h-2 w-2 rounded-full ${SEM_DOT.vermelho}`} />
            {kpis.vermelho} vencidas
          </Badge>
        </div>
      </div>

      {loading || obrasQuery.isLoading ? (
        <PageLoading />
      ) : (
        <DndContext
          sensors={sensors}
          accessibility={{ announcements: dndAnnouncementsPtBR(), screenReaderInstructions: dndScreenReaderInstructionsPtBR }}
          collisionDetection={pointerWithin}
          onDragStart={onDragStart}
          onDragOver={(e) => setOverSem(e.over?.id ? String(e.over.id).replace(/^sem:/, "") : null)}
          onDragEnd={onDragEnd}
          onDragCancel={() => {
            setActiveId(null);
            setOverSem(null);
          }}
        >
          <div aria-live="polite" role="status" className="sr-only">
            {activePacote ? `Movendo ${activePacote.descricao}` : ""}
          </div>
          <div className="overflow-x-auto border rounded-lg">
            <div
              className="grid min-w-fit"
              style={{
                gridTemplateColumns: `repeat(${semanasIso.length}, minmax(220px, 1fr))`,
              }}
            >
              {semanasIso.map((sem, idx) => (
                <SemanaColuna
                  key={sem}
                  sem={sem}
                  idx={idx}
                  isOver={overSem === sem}
                  pacotes={pacotesPorSemana.get(sem) ?? []}
                  restPorPacote={restPorPacote}
                  obraById={obraById}
                  onResolver={resolverRestricao}
                  onRepetirSemanaAnterior={repetirSemanaAnterior}
                  onComprometer={comprometer}
                />
              ))}
            </div>
          </div>
          <DragOverlay dropAnimation={{ duration: 180 }}>
            {activePacote ? (
              <div className="rotate-2 shadow-2xl">
                <PacoteCardVisual
                  pacote={activePacote}
                  rs={(restPorPacote.get(activePacote.id) ?? []) as RestricaoRow[]}
                  obraNome={obraById[activePacote.obra_id]}
                />
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      )}
    </div>
  );
}

function SemanaColuna({
  sem,
  idx,
  isOver,
  pacotes,
  restPorPacote,
  obraById,
  onResolver,
  onRepetirSemanaAnterior,
  onComprometer,
}: {
  sem: string;
  idx: number;
  isOver: boolean;
  pacotes: Pacote[];
  restPorPacote: Map<string, RestricaoRow[]>;
  obraById: Record<string, string>;
  onResolver: (rid: string) => void;
  onRepetirSemanaAnterior: (semAlvo: string) => void;
  onComprometer: (p: Pacote) => void;
}) {
  const { setNodeRef } = useDroppable({ id: `sem:${sem}` });
  const isSemanaAtual = idx === 0;
  return (
    <div
      ref={setNodeRef}
      className={`border-r last:border-r-0 transition ${idx === 0 ? "bg-muted/40" : ""} ${
        isOver ? "bg-primary/5 ring-1 ring-primary/40" : ""
      }`}
      role="region"
      aria-label={`Semana ${formatSemana(sem)}`}
    >
      <div className="sticky top-0 z-10 bg-card border-b px-3 py-2">
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="text-xs text-muted-foreground">
              Semana {idx + 1}
              {idx === 0 && " (atual)"}
            </div>
            <div className="font-semibold text-sm">{formatSemana(sem)}</div>
            <div className="text-[10px] text-muted-foreground">
              {pacotes.length} pacote(s)
            </div>
          </div>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-7 px-2 text-[11px]"
            title="Replica os pacotes da semana anterior para esta semana (PRO-025)"
            aria-label={`Repetir semana anterior em ${formatSemana(sem)}`}
            onClick={() => onRepetirSemanaAnterior(sem)}
          >
            <Copy className="h-3.5 w-3.5 mr-1" aria-hidden="true" />
            Repetir
          </Button>
        </div>
      </div>
      <div className="p-2 space-y-2 min-h-[160px]">
        {pacotes.length === 0 ? (
          <div className="text-[11px] text-muted-foreground text-center py-6">—</div>
        ) : (
          pacotes.map((p) => (
            <PacoteDraggable
              key={p.id}
              pacote={p}
              rs={(restPorPacote.get(p.id) ?? []) as RestricaoRow[]}
              obraNome={obraById[p.obra_id]}
              onResolver={onResolver}
              onComprometer={isSemanaAtual ? onComprometer : undefined}
            />
          ))
        )}
      </div>
    </div>
  );
}

function PacoteDraggable({
  pacote,
  rs,
  obraNome,
  onResolver,
  onComprometer,
}: {
  pacote: Pacote;
  rs: RestricaoRow[];
  obraNome?: string;
  onResolver: (rid: string) => void;
  onComprometer?: (p: Pacote) => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: pacote.id });
  return (
    <div ref={setNodeRef} className={isDragging ? "opacity-40" : ""}>
      <PacoteCardVisual
        pacote={pacote}
        rs={rs}
        obraNome={obraNome}
        onResolver={onResolver}
        onComprometer={onComprometer}
        dragAttrs={attributes}
        dragListeners={listeners}
      />
    </div>
  );
}

function PacoteCardVisual({
  pacote,
  rs,
  obraNome,
  onResolver,
  onComprometer,
  dragAttrs,
  dragListeners,
}: {
  pacote: Pacote;
  rs: RestricaoRow[];
  obraNome?: string;
  onResolver?: (rid: string) => void;
  onComprometer?: (p: Pacote) => void;
  dragAttrs?: any;
  dragListeners?: any;
}) {
  const sFlag = semaforoPacote(rs as Restricao[]);
  const abertas = rs.filter((r) => r.status === "aberta");
  const pronto = pacoteEstaPronto(rs as Restricao[]);
  return (
    <div
      className={`block border rounded-md p-2 text-xs transition ${SEM_BG[sFlag]}`}
      title={SEM_LABEL[sFlag]}
    >
      <div className="flex items-start gap-1.5">
        <span
          {...(dragAttrs ?? {})}
          {...(dragListeners ?? {})}
          className={`h-2 w-2 rounded-full mt-1 shrink-0 ${SEM_DOT[sFlag]} ${
            dragListeners ? "cursor-grab active:cursor-grabbing" : ""
          }`}
          aria-label="Arrastar pacote"
        />
        <div
          {...(dragAttrs ?? {})}
          {...(dragListeners ?? {})}
          className={`min-w-0 flex-1 ${dragListeners ? "cursor-grab active:cursor-grabbing" : ""}`}
        >
          <div className="font-medium truncate">{pacote.descricao}</div>
          <div className="text-[10px] text-muted-foreground truncate">{obraNome ?? "—"}</div>
        </div>
      </div>
      <div className="flex items-center gap-1 mt-1.5 flex-wrap pl-3.5">
        <Badge variant="outline" className="text-[10px] px-1 py-0 h-4">
          {pacote.status}
        </Badge>
        {abertas.length > 0 ? (
          <Popover>
            <PopoverTrigger asChild>
              <button
                type="button"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => e.stopPropagation()}
                className="inline-flex"
                aria-label={`${abertas.length} restrições abertas — clique para resolver`}
              >
                <Badge
                  variant={sFlag === "vermelho" ? "destructive" : "secondary"}
                  className="text-[10px] px-1 py-0 h-4 gap-0.5 cursor-pointer"
                >
                  {sFlag === "vermelho" ? (
                    <AlertTriangle className="h-2.5 w-2.5" />
                  ) : (
                    <Clock className="h-2.5 w-2.5" />
                  )}
                  {abertas.length}
                </Badge>
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-72 p-2" onPointerDown={(e) => e.stopPropagation()}>
              <div className="text-xs font-semibold mb-1.5">Restrições abertas</div>
              <div className="space-y-1.5 max-h-64 overflow-auto">
                {abertas.map((r) => (
                  <div key={r.id} className="flex items-start gap-2 border rounded p-1.5">
                    <div className="flex-1 min-w-0">
                      <div className="text-xs truncate">{r.descricao ?? r.tipo}</div>
                      {r.prazo && (
                        <div className="text-[10px] text-muted-foreground">prazo {r.prazo}</div>
                      )}
                    </div>
                    {onResolver && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 px-1.5"
                        onClick={() => onResolver(r.id)}
                        aria-label="Resolver restrição"
                      >
                        <Check className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
              <div className="mt-2 text-[10px] text-muted-foreground">
                Resolver libera o pacote no Last Planner.
              </div>
            </PopoverContent>
          </Popover>
        ) : pronto ? (
          <Badge variant="default" className="text-[10px] px-1 py-0 h-4 gap-0.5">
            <CheckCircle2 className="h-2.5 w-2.5" />
            pronto
          </Badge>
        ) : null}
        {onComprometer && pronto && pacote.status !== "comprometido" ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-5 px-1.5 text-[10px] ml-auto gap-0.5"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              onComprometer(pacote);
            }}
            title="Promover para compromisso semanal (PPC)"
            aria-label={`Comprometer pacote ${pacote.descricao}`}
          >
            <Zap className="h-2.5 w-2.5" aria-hidden="true" />
            Comprometer
          </Button>
        ) : null}
      </div>
    </div>
  );
}
