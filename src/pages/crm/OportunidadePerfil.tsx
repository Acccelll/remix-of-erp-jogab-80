// CRM — Perfil da oportunidade: dados e timeline de interações.
import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate, Link, useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { usePlayersContext } from "@/contexts/PlayersContext";
import { useClientesContext } from "@/contexts/ClientesContext";
import { apiFetch } from "@/lib/api";
import { interacaoFromApi } from "@/contexts/app/mappers";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
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
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { TemperatureDisplay } from "@/components/crm/TemperatureDisplay";
import {
  ArrowLeft,
  Phone,
  Mail,
  Users,
  StickyNote,
  ArrowRightLeft,
  AlertTriangle,
  UserCheck,
  Plus,
  CheckCircle2,
  Circle,
  Trash2,
  CalendarClock,
  MessageSquare,
  Pencil,
  Sparkles,
} from "lucide-react";
import type { Interacao } from "@/types";
import { toast } from "sonner";
import { fmtData, fmtDataHora } from "@/lib/core/date";
import { Input } from "@/components/ui/input";
import DatePickerField from "@/components/common/DatePickerField";
import { useCrmTarefas, classificarTarefa } from "@/hooks/crm/useCrmTarefas";
import { CRM_ESTAGIO_FECHADO_PERDIDO, useCrmMotivosPerda } from "@/hooks/crm/useCrmMotivosPerda";
import { useAuth } from "@/contexts/auth/useAuth";
import { QueryState } from "@/components/common/QueryState";
import { EmptyState } from "@/components/common/EmptyState";

const TIPO_ICON: Record<string, React.ElementType> = {
  ligacao: Phone,
  email: Mail,
  reuniao: Users,
  nota: StickyNote,
  mudanca_estagio: ArrowRightLeft,
  movimento: ArrowRightLeft,
  comentario: MessageSquare,
  edicao: Pencil,
  criacao: Sparkles,
};
const TIPO_LABEL: Record<string, string> = {
  ligacao: "Ligação",
  email: "E-mail",
  reuniao: "Reunião",
  nota: "Nota",
  mudanca_estagio: "Mudança de estágio",
  movimento: "Mudança de estágio",
  comentario: "Comentário",
  edicao: "Edição",
  criacao: "Criação",
};

export default function OportunidadePerfil() {
  const { id } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { oportunidades, funilEstagios } = useClientesContext();
  const { converterOportunidade } = useClientesContext();
  const { players } = usePlayersContext();
  const { currentPlayer } = useAuth();
  const { tarefas, adicionar, alternar, remover } = useCrmTarefas(id);
  const { motivos, getRegistro, registrarPerda, adicionarMotivo } = useCrmMotivosPerda();
  const [novoOpen, setNovoOpen] = useState(false);
  const [tipo, setTipo] = useState("nota");
  const [descricao, setDescricao] = useState("");
  const [convertOpen, setConvertOpen] = useState(false);
  const [novaTarefaTitulo, setNovaTarefaTitulo] = useState("");
  const [novaTarefaData, setNovaTarefaData] = useState("");
  const [novaTarefaResp, setNovaTarefaResp] = useState<string>("");
  const [motivoPerdaId, setMotivoPerdaId] = useState("");
  const [motivoPerdaObs, setMotivoPerdaObs] = useState("");
  const [novoMotivoPerda, setNovoMotivoPerda] = useState("");
  const [searchParams, setSearchParams] = useSearchParams();

  // Ao entrar com ?focus=nota, abrir automaticamente o diálogo de nova interação como "nota".
  useEffect(() => {
    if (searchParams.get("focus") === "nota") {
      setTipo("nota");
      setNovoOpen(true);
      const next = new URLSearchParams(searchParams);
      next.delete("focus");
      setSearchParams(next, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const oportunidade = oportunidades.find((l) => l.id === id);
  const perdaRegistro = getRegistro(id);
  const loginDe = useMemo(() => {
    const m = new Map<string, string>();
    players.forEach((p) => m.set(p.id, p.login));
    return m;
  }, [players]);
  const rotuloEstagio = (chave: string) =>
    funilEstagios.find((e) => e.chave === chave)?.rotulo ?? chave;

  const interacoesQ = useQuery({
    queryKey: ["crm-interacoes", id],
    queryFn: async () =>
      (await apiFetch("interacoes", { params: { oportunidade_id: id! } })).map(
        interacaoFromApi,
      ) as Interacao[],
    enabled: !!id,
  });

  useEffect(() => {
    setMotivoPerdaId(perdaRegistro?.motivoId ?? "");
    setMotivoPerdaObs(perdaRegistro?.observacao ?? "");
    setNovoMotivoPerda("");
  }, [id, perdaRegistro?.motivoId, perdaRegistro?.observacao]);

  if (!oportunidade) {
    return (
      <div className="p-6 space-y-3">
        <Link
          to="/crm/oportunidades"
          className="text-sm text-muted-foreground inline-flex items-center gap-1 hover:text-foreground"
        >
          <ArrowLeft className="h-3 w-3" /> Voltar
        </Link>
        <p className="text-sm text-muted-foreground">Oportunidade não encontrada.</p>
      </div>
    );
  }

  const salvarInteracao = async () => {
    if (!descricao.trim()) {
      toast.error("Descreva a interação");
      return;
    }
    try {
      await apiFetch("interacoes", {
        method: "POST",
        body: { oportunidadeId: id, tipo, descricao: descricao.trim() },
      });
      setDescricao("");
      setTipo("nota");
      setNovoOpen(false);
      qc.invalidateQueries({ queryKey: ["crm-interacoes", id] });
      toast.success("Interação registrada");
    } catch (e: any) {
      toast.error(`Erro: ${e.message ?? e}`);
    }
  };

  const converter = async () => {
    const clienteId = await converterOportunidade(oportunidade.id);
    setConvertOpen(false);
    if (clienteId) navigate("/crm/clientes");
  };

  const salvarMotivoPerda = () => {
    const motivoSelecionado = motivos.find((m) => m.id === motivoPerdaId);
    const motivo =
      motivoSelecionado || (novoMotivoPerda.trim() ? adicionarMotivo(novoMotivoPerda) : null);
    if (!motivo || !id) {
      toast.error("Informe o motivo da perda");
      return;
    }
    registrarPerda({
      oportunidadeId: id,
      motivoId: motivo.id,
      motivoRotulo: motivo.rotulo,
      observacao: motivoPerdaObs,
      registradoPor: currentPlayer?.login,
    });
    setNovoMotivoPerda("");
    toast.success("Motivo de perda atualizado");
  };

  return (
    <div className="p-6 space-y-4 max-w-5xl">
      <Link
        to="/crm/oportunidades"
        className="text-sm text-muted-foreground inline-flex items-center gap-1 hover:text-foreground"
      >
        <ArrowLeft className="h-3 w-3" /> Voltar
      </Link>

      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">{oportunidade.nome}</h1>
          <p className="text-sm text-muted-foreground flex items-center gap-2 flex-wrap">
            {oportunidade.empresa || "—"} ·{" "}
            <Badge variant="outline">{rotuloEstagio(oportunidade.estagio)}</Badge>
            {oportunidade.temperatura_temperatura && (
              <TemperatureDisplay value={oportunidade.temperatura_temperatura} size="sm" />
            )}
            {oportunidade.responsavelId && <> · {loginDe.get(oportunidade.responsavelId)}</>}
          </p>
          <div className="text-xs text-muted-foreground mt-1 flex flex-wrap gap-x-4 gap-y-0.5">
            {oportunidade.email && (
              <span className="inline-flex items-center gap-1">
                <Mail className="h-3 w-3" />
                {oportunidade.email}
              </span>
            )}
            {oportunidade.telefone && (
              <span className="inline-flex items-center gap-1">
                <Phone className="h-3 w-3" />
                {oportunidade.telefone}
              </span>
            )}
            {oportunidade.origem && <span>Origem: {oportunidade.origem}</span>}
          </div>
        </div>
        {oportunidade.clienteId ? (
          <Badge className="bg-success">Convertido em cliente</Badge>
        ) : (
          <Button onClick={() => setConvertOpen(true)} className="bg-success hover:bg-success/90">
            <UserCheck className="h-4 w-4 mr-1" /> Converter em cliente
          </Button>
        )}
      </div>

      {oportunidade.estagio === CRM_ESTAGIO_FECHADO_PERDIDO && (
        <Card className="border-destructive/30 bg-destructive/5">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-destructive" /> Motivo da perda
              {perdaRegistro ? (
                <Badge variant="outline">{perdaRegistro.motivoRotulo}</Badge>
              ) : (
                <Badge variant="destructive">Pendente</Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-3">
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
            <div className="space-y-1 md:col-span-2">
              <Label>Observação</Label>
              <Textarea
                value={motivoPerdaObs}
                onChange={(e) => setMotivoPerdaObs(e.target.value)}
                rows={3}
              />
            </div>
            <div className="md:col-span-2 flex justify-end">
              <Button onClick={salvarMotivoPerda}>Salvar motivo</Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-4">
        {/* Tarefas / follow-up (PRO-002) */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <CalendarClock className="h-4 w-4" /> Tarefas de follow-up
              {tarefas.filter((t) => t.status === "aberta").length > 0 && (
                <Badge variant="secondary">
                  {tarefas.filter((t) => t.status === "aberta").length} aberta(s)
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-[1fr_160px_180px_auto] gap-2">
              <Input
                placeholder="Descreva a próxima ação (ex.: ligar para retomar)"
                value={novaTarefaTitulo}
                onChange={(e) => setNovaTarefaTitulo(e.target.value)}
              />
              <DatePickerField value={novaTarefaData} onChange={(v) => setNovaTarefaData(v)} />
              <Select value={novaTarefaResp} onValueChange={setNovaTarefaResp}>
                <SelectTrigger>
                  <SelectValue placeholder="Responsável" />
                </SelectTrigger>
                <SelectContent>
                  {players.map((p) => (
                    <SelectItem key={p.id} value={p.login}>
                      {p.login}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                onClick={() => {
                  if (!novaTarefaTitulo.trim() || !novaTarefaData) {
                    toast.error("Informe título e data");
                    return;
                  }
                  adicionar({
                    oportunidadeId: id!,
                    titulo: novaTarefaTitulo.trim(),
                    data: novaTarefaData,
                    responsavelLogin: novaTarefaResp || currentPlayer?.login,
                  });
                  setNovaTarefaTitulo("");
                  setNovaTarefaData("");
                  setNovaTarefaResp("");
                  toast.success("Tarefa criada");
                }}
              >
                <Plus className="h-4 w-4 mr-1" /> Adicionar
              </Button>
            </div>

            {tarefas.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma tarefa cadastrada.</p>
            ) : (
              <ul className="divide-y divide-border rounded border">
                {[...tarefas]
                  .sort((a, b) => {
                    if (a.status !== b.status) return a.status === "aberta" ? -1 : 1;
                    return a.data.localeCompare(b.data);
                  })
                  .map((t) => {
                    const hojeISO = new Date().toISOString().slice(0, 10);
                    const cls =
                      t.status === "concluida"
                        ? "text-muted-foreground line-through"
                        : classificarTarefa(t, hojeISO) === "vencida"
                          ? "text-destructive"
                          : classificarTarefa(t, hojeISO) === "hoje"
                            ? "text-warning"
                            : "";
                    return (
                      <li key={t.id} className="flex items-center gap-2 px-3 py-2 text-sm">
                        <button
                          type="button"
                          onClick={() => alternar(t.id)}
                          className="text-muted-foreground hover:text-foreground"
                          aria-label={t.status === "aberta" ? "Concluir tarefa" : "Reabrir tarefa"}
                        >
                          {t.status === "concluida" ? (
                            <CheckCircle2 className="h-4 w-4 text-success" />
                          ) : (
                            <Circle className="h-4 w-4" />
                          )}
                        </button>
                        <div className="flex-1 min-w-0">
                          <div className={`font-medium truncate ${cls}`}>{t.titulo}</div>
                          <div className="text-[11px] text-muted-foreground">
                            {fmtData(t.data)}
                            {t.responsavelLogin ? ` · ${t.responsavelLogin}` : ""}
                            {t.status === "aberta" &&
                              classificarTarefa(t, hojeISO) === "vencida" &&
                              " · vencida"}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => remover(t.id)}
                          className="text-muted-foreground hover:text-destructive"
                          aria-label="Remover tarefa"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </li>
                    );
                  })}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Timeline */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Histórico de interações</CardTitle>
            <Button size="sm" variant="outline" onClick={() => setNovoOpen(true)}>
              <Plus className="h-4 w-4 mr-1" /> Nova
            </Button>
          </CardHeader>
          <CardContent>
            <QueryState
              isLoading={interacoesQ.isLoading}
              isError={interacoesQ.isError}
              error={interacoesQ.error}
              data={interacoesQ.data ?? []}
              isEmpty={(d) => d.length === 0}
              onRetry={() => interacoesQ.refetch()}
              empty={
                <EmptyState title="Sem interações" description="Nenhuma interação registrada." />
              }
            >
              {(items) => (
                <ol className="relative border-l border-border ml-2 space-y-4">
                  {items.map((it) => {
                    const Icon = TIPO_ICON[it.tipo] ?? StickyNote;
                    return (
                      <li key={it.id} className="ml-4">
                        <span className="absolute -left-2.5 flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 ring-2 ring-background">
                          <Icon className="h-3 w-3 text-primary" />
                        </span>
                        <div className="text-sm font-medium">{TIPO_LABEL[it.tipo] ?? it.tipo}</div>
                        {it.descricao && (
                          <div className="text-sm text-muted-foreground">{it.descricao}</div>
                        )}
                        <div className="text-[11px] text-muted-foreground/70">
                          {it.data ? fmtDataHora(it.data) : ""}
                          {it.usuario_login ? ` · ${it.usuario_login}` : ""}
                        </div>
                      </li>
                    );
                  })}
                </ol>
              )}
            </QueryState>
          </CardContent>
        </Card>
      </div>

      {/* Dialog nova interação */}
      <Dialog open={novoOpen} onOpenChange={setNovoOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Nova interação</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <Label>Tipo</Label>
              <Select value={tipo} onValueChange={setTipo}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {["ligacao", "email", "reuniao", "nota"].map((t) => (
                    <SelectItem key={t} value={t}>
                      {TIPO_LABEL[t]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Descrição</Label>
              <Textarea
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                rows={3}
                placeholder="O que aconteceu?"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNovoOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={salvarInteracao} disabled={!descricao.trim()}>
              Registrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog converter */}
      <Dialog open={convertOpen} onOpenChange={setConvertOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Converter em cliente</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Será criado um cliente a partir desta oportunidade, o funil fecha como{" "}
            <strong>Ganho</strong> e a origem fica rastreável. Continuar?
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConvertOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={converter}>Converter</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
