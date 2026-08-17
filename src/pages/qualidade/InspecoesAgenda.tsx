/**
 * Agenda de Inspeções Recorrentes (INSP.5b)
 *
 * Lista, cria e edita `inspecao_agendas`. Botão "Gerar pendentes" chama a
 * função `fn_inspecao_materializar_pendentes` que materializa as inspeções
 * rascunho até a data alvo, sem duplicar.
 */
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { inspecaoAgendasRepo, inspecaoModelosRepo } from "@/lib/repositories/inspecoes";
import { useAuth } from "@/contexts/auth/useAuth";
import { useObrasContext } from "@/contexts/ObrasContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import DatePickerField from "@/components/common/DatePickerField";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Calendar as CalendarIcon, Plus, RefreshCcw, ArrowRight, Trash2 } from "lucide-react";
import { QueryState } from "@/components/common/QueryState";
import { EmptyState } from "@/components/common/EmptyState";
import { toast } from "sonner";
import { OnboardingHint } from "@/components/onboarding/OnboardingHint";
import { confirmDialog } from "@/lib/ui/confirm";

type Frequencia = "diaria" | "semanal" | "quinzenal" | "mensal";

interface AgendaRow {
  id: string;
  modelo_id: string;
  obra_id: string;
  titulo: string | null;
  local: string | null;
  responsavel_id: string | null;
  frequencia: Frequencia;
  dias_semana: number[] | null;
  dia_mes: number | null;
  hora_alvo: string | null;
  data_inicio: string;
  data_fim: string | null;
  ativa: boolean;
  proxima_data: string | null;
  ultima_geracao_em: string | null;
}

interface ModeloRow {
  id: string;
  codigo: string;
  nome: string;
}

const DIAS = [
  { v: 1, l: "Seg" },
  { v: 2, l: "Ter" },
  { v: 3, l: "Qua" },
  { v: 4, l: "Qui" },
  { v: 5, l: "Sex" },
  { v: 6, l: "Sáb" },
  { v: 0, l: "Dom" },
];

const FREQ_LABEL: Record<Frequencia, string> = {
  diaria: "Diária",
  semanal: "Semanal",
  quinzenal: "Quinzenal",
  mensal: "Mensal",
};

export default function InspecoesAgenda() {
  const qc = useQueryClient();
  const { currentPlayer } = useAuth();
  const { obras } = useObrasContext();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<AgendaRow | null>(null);
  const [gerando, setGerando] = useState(false);

  const {
    data: agendas = [],
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ["inspecao-agendas"],
    queryFn: async () => (await inspecaoAgendasRepo.list()) as AgendaRow[],
  });

  const { data: modelos = [] } = useQuery({
    queryKey: ["inspecao-modelos-min"],
    queryFn: async () => (await inspecaoModelosRepo.listMin()) as ModeloRow[],
  });

  const modeloMap = useMemo(() => new Map(modelos.map((m) => [m.id, m])), [modelos]);
  const obraMap = useMemo(() => new Map(obras.map((o) => [o.id, o.nome])), [obras]);

  const upsert = useMutation({
    mutationFn: async (
      row: Partial<AgendaRow> & { modelo_id: string; obra_id: string; frequencia: Frequencia },
    ) => {
      const payload = {
        ...row,
        created_by: editing?.id ? undefined : (currentPlayer?.id ?? null),
      };
      if (editing?.id) {
        await inspecaoAgendasRepo.update(editing.id, payload);
      } else {
        await inspecaoAgendasRepo.insert(payload);
      }
    },
    onSuccess: () => {
      toast.success("Agenda salva.");
      setDialogOpen(false);
      setEditing(null);
      void qc.invalidateQueries({ queryKey: ["inspecao-agendas"] });
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Erro ao salvar"),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      await inspecaoAgendasRepo.remove(id);
    },
    onSuccess: () => {
      toast.success("Agenda removida.");
      void qc.invalidateQueries({ queryKey: ["inspecao-agendas"] });
    },
  });

  async function gerarPendentes() {
    setGerando(true);
    try {
      const data = await inspecaoAgendasRepo.materializarPendentes({
        p_ate: new Date().toISOString().slice(0, 10),
      });
      const n = typeof data === "number" ? data : 0;
      toast.success(`${n} inspeção(ões) criada(s) como rascunho.`);
      void qc.invalidateQueries({ queryKey: ["inspecao-agendas"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao gerar pendentes");
    } finally {
      setGerando(false);
    }
  }

  function abrirNovo() {
    setEditing(null);
    setDialogOpen(true);
  }
  function abrirEdicao(a: AgendaRow) {
    setEditing(a);
    setDialogOpen(true);
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <CalendarIcon className="h-6 w-6" /> Agenda de Inspeções
          </h1>
          <p className="text-sm text-muted-foreground">
            FVS / FVM / Segurança recorrentes. Use “Gerar pendentes” para materializar rascunhos.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={gerarPendentes} disabled={gerando} className="gap-1">
            <RefreshCcw className={`h-4 w-4 ${gerando ? "animate-spin" : ""}`} />
            {gerando ? "Gerando…" : "Gerar pendentes"}
          </Button>
          <Button onClick={abrirNovo} className="gap-1">
            <Plus className="h-4 w-4" /> Nova agenda
          </Button>
        </div>
      </div>

      <OnboardingHint storageKey="inspecoes-agenda.v1" title="Fluxo recomendado">
        1) crie a agenda apontando o modelo (FVS/FVM/Segurança). 2) rode “Gerar pendentes” no início
        da semana — o sistema materializa os rascunhos no app de campo. 3) o inspetor abre via QR,
        responde e fecha pelo celular.
      </OnboardingHint>

      <Card>
        <CardContent className="p-0">
          <QueryState
            isLoading={isLoading}
            isError={isError}
            error={error}
            data={agendas}
            isEmpty={(d) => d.length === 0}
            onRetry={() => refetch()}
            empty={
              <EmptyState
                icon={CalendarIcon}
                title="Nenhuma agenda cadastrada"
                description="Crie a primeira para gerar inspeções automaticamente."
              />
            }
          >
            {(list) => (
              <div className="divide-y">
                {list.map((a) => {
                  const m = modeloMap.get(a.modelo_id);
                  return (
                    <div key={a.id} className="flex items-center gap-3 p-3 hover:bg-muted/30">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant="outline">{m?.codigo ?? "—"}</Badge>
                          <span className="font-medium truncate">
                            {a.titulo || m?.nome || "Inspeção"}
                          </span>
                          <Badge variant={a.ativa ? "default" : "secondary"}>
                            {a.ativa ? "Ativa" : "Pausada"}
                          </Badge>
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5">
                          <span>{obraMap.get(a.obra_id) ?? "—"}</span>
                          <span>{FREQ_LABEL[a.frequencia]}</span>
                          {a.local && <span>· {a.local}</span>}
                          {a.proxima_data && <span>· próxima: {a.proxima_data}</span>}
                        </div>
                      </div>
                      <Button size="sm" variant="ghost" onClick={() => abrirEdicao(a)}>
                        Editar
                      </Button>
                      <Button asChild size="sm" variant="ghost">
                        <Link to={`/inspecoes/${a.modelo_id}`}>
                          Abrir <ArrowRight className="h-3 w-3 ml-1" />
                        </Link>
                      </Button>
                      <Button
                        size="icon"
                        aria-label="Excluir inspeção"
                        variant="ghost"
                        onClick={async () => {
                          if (await confirmDialog({ title: "Remover esta agenda?" }))
                            remove.mutate(a.id);
                        }}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}
          </QueryState>
        </CardContent>
      </Card>

      <AgendaDialog
        open={dialogOpen}
        onOpenChange={(o) => {
          setDialogOpen(o);
          if (!o) setEditing(null);
        }}
        editing={editing}
        modelos={modelos}
        obras={obras.map((o) => ({ id: o.id, nome: o.nome }))}
        onSubmit={(payload) => upsert.mutate(payload)}
        saving={upsert.isPending}
      />
    </div>
  );
}

interface DialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editing: AgendaRow | null;
  modelos: ModeloRow[];
  obras: { id: string; nome: string }[];
  onSubmit: (
    payload: Partial<AgendaRow> & { modelo_id: string; obra_id: string; frequencia: Frequencia },
  ) => void;
  saving: boolean;
}

function AgendaDialog({
  open,
  onOpenChange,
  editing,
  modelos,
  obras,
  onSubmit,
  saving,
}: DialogProps) {
  const [modeloId, setModeloId] = useState("");
  const [obraId, setObraId] = useState("");
  const [titulo, setTitulo] = useState("");
  const [local, setLocal] = useState("");
  const [frequencia, setFrequencia] = useState<Frequencia>("semanal");
  const [diasSemana, setDiasSemana] = useState<number[]>([1]);
  const [diaMes, setDiaMes] = useState<number>(1);
  const [horaAlvo, setHoraAlvo] = useState("08:00");
  const [dataInicio, setDataInicio] = useState(() => new Date().toISOString().slice(0, 10));
  const [dataFim, setDataFim] = useState("");
  const [ativa, setAtiva] = useState(true);

  // Hydrate when editing
  useMemo(() => {
    if (editing) {
      setModeloId(editing.modelo_id);
      setObraId(editing.obra_id);
      setTitulo(editing.titulo ?? "");
      setLocal(editing.local ?? "");
      setFrequencia(editing.frequencia);
      setDiasSemana(editing.dias_semana ?? [1]);
      setDiaMes(editing.dia_mes ?? 1);
      setHoraAlvo((editing.hora_alvo ?? "08:00").slice(0, 5));
      setDataInicio(editing.data_inicio);
      setDataFim(editing.data_fim ?? "");
      setAtiva(editing.ativa);
    } else {
      setModeloId("");
      setObraId("");
      setTitulo("");
      setLocal("");
      setFrequencia("semanal");
      setDiasSemana([1]);
      setDiaMes(1);
      setHoraAlvo("08:00");
      setDataInicio(new Date().toISOString().slice(0, 10));
      setDataFim("");
      setAtiva(true);
    }
  }, [editing]);

  function toggleDia(v: number) {
    setDiasSemana((cur) => (cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v].sort()));
  }

  function submit() {
    if (!modeloId || !obraId) {
      toast.error("Selecione modelo e obra.");
      return;
    }
    onSubmit({
      modelo_id: modeloId,
      obra_id: obraId,
      titulo: titulo || null,
      local: local || null,
      frequencia,
      dias_semana: frequencia === "semanal" || frequencia === "quinzenal" ? diasSemana : null,
      dia_mes: frequencia === "mensal" ? diaMes : null,
      hora_alvo: horaAlvo,
      data_inicio: dataInicio,
      data_fim: dataFim || null,
      ativa,
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{editing ? "Editar agenda" : "Nova agenda"}</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="sm:col-span-2">
            <Label>Modelo</Label>
            <Select value={modeloId} onValueChange={setModeloId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o modelo" />
              </SelectTrigger>
              <SelectContent>
                {modelos.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.codigo} — {m.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Obra</Label>
            <Select value={obraId} onValueChange={setObraId}>
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
            <Label>Frequência</Label>
            <Select value={frequencia} onValueChange={(v) => setFrequencia(v as Frequencia)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(FREQ_LABEL) as Frequencia[]).map((f) => (
                  <SelectItem key={f} value={f}>
                    {FREQ_LABEL[f]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="sm:col-span-2">
            <Label>Título (opcional)</Label>
            <Input
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder="Ex.: FVS — Concretagem laje"
            />
          </div>
          <div className="sm:col-span-2">
            <Label>Local / Frente (opcional)</Label>
            <Input
              value={local}
              onChange={(e) => setLocal(e.target.value)}
              placeholder="Ex.: Pav. 3 — Eixo B"
            />
          </div>

          {(frequencia === "semanal" || frequencia === "quinzenal") && (
            <div className="sm:col-span-2">
              <Label>Dias da semana</Label>
              <div className="flex gap-1.5 flex-wrap mt-1">
                {DIAS.map((d) => {
                  const on = diasSemana.includes(d.v);
                  return (
                    <Button
                      key={d.v}
                      type="button"
                      size="sm"
                      variant={on ? "default" : "outline"}
                      onClick={() => toggleDia(d.v)}
                      className="w-12"
                    >
                      {d.l}
                    </Button>
                  );
                })}
              </div>
            </div>
          )}

          {frequencia === "mensal" && (
            <div>
              <Label>Dia do mês</Label>
              <Input
                type="number"
                min={1}
                max={28}
                value={diaMes}
                onChange={(e) => setDiaMes(Math.max(1, Math.min(28, Number(e.target.value) || 1)))}
              />
            </div>
          )}

          <div>
            <Label>Hora alvo</Label>
            <Input type="time" value={horaAlvo} onChange={(e) => setHoraAlvo(e.target.value)} />
          </div>
          <div>
            <Label>Data início</Label>
            <DatePickerField value={dataInicio} onChange={(v) => setDataInicio(v)} />
          </div>
          <div>
            <Label>Data fim (opcional)</Label>
            <DatePickerField value={dataFim} onChange={(v) => setDataFim(v)} />
          </div>
          <div className="sm:col-span-2 flex items-center justify-between border rounded-md px-3 py-2">
            <span className="text-sm">Agenda ativa</span>
            <Switch checked={ativa} onCheckedChange={setAtiva} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={saving}>
            {saving ? "Salvando…" : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
