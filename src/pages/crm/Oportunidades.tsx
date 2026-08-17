// CRM — Lista de oportunidades com filtros, cadastro e conversão em cliente.
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

import { useClientesContext } from "@/contexts/ClientesContext";
import { usePlayersContext } from "@/contexts/PlayersContext";
import { usePermissions } from "@/contexts/auth/usePermissions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import DatePickerField from "@/components/common/DatePickerField";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
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
import { MultiSelect } from "@/components/ui/multi-select";
import { DataTable, RowActions } from "@/components/ui/data-table";
import {
  Plus,
  Pencil,
  Trash2,
  UserCheck,
  Download,
  Thermometer,
  MessageSquare,
  CalendarClock,
} from "lucide-react";
import { ColumnDef } from "@tanstack/react-table";
import { Oportunidade, Cliente } from "@/types";
import { useCrmScopeFilter } from "@/hooks/crm/useOportunidadesEscopo";
import { registrarEvento, diffOportunidade } from "@/lib/crm/historico";
import DeleteConfirmDialog from "@/components/common/DeleteConfirmDialog";
import { TemperatureSelector } from "@/components/crm/TemperatureSelector";
import { TemperatureDisplay } from "@/components/crm/TemperatureDisplay";
import { hottestForCliente } from "@/lib/crm/temperatura";
import { ContactsManager, type Contact } from "@/components/common/ContactsManager";
import { OportunidadeComentariosDrawer } from "@/components/crm/OportunidadeComentariosDrawer";
import { formatBRLFromNumber, formatBRLInput, parseBRL } from "@/lib/core/currency";
import { CRM_ESTAGIO_FECHADO_PERDIDO, useCrmMotivosPerda } from "@/hooks/crm/useCrmMotivosPerda";
import { classificarTarefa, proximaTarefaAberta, useCrmTarefas } from "@/hooks/crm/useCrmTarefas";
import { toast } from "sonner";
import { fmtDataLocal } from "@/lib/core/date";

import { SERVICOS } from "@/config/servicos";

const EMPTY_FORM = {
  nome: "",
  clienteId: "",
  servicos: [] as string[],
  email: "",
  telefone: "",
  status: "novo",
  estagio: "prospeccao",
  responsavelId: "",
  observacao: "",
  temperatura_temperatura: null as any,
  contatoNome: "",
  contatoFuncaoSetor: "",
  contatos: null as Contact[] | null,
  valorEstimado: 0,
  valorEstimadoMasked: "",
  dataPrevistaFechamento: "",
  localObra: "",
  potencialInicioObra: "",
  potencialTerminoObra: "",
};
type FormState = typeof EMPTY_FORM;

const oportunidadeToForm = (l: Oportunidade): FormState => {
  // Compatibilidade: primeiro item de `contatos` é o "principal".
  const all = (l.contatos as Contact[] | null) || [];
  const [principal, ...rest] = all;
  return {
    nome: l.nome,
    clienteId: l.clienteId || "",
    servicos: l.servicos || [],
    email: l.email || "",
    telefone: l.telefone || "",
    status: l.status,
    estagio: l.estagio,
    responsavelId: l.responsavelId || "",
    observacao: l.observacao || "",
    temperatura_temperatura: l.temperatura_temperatura || null,
    contatoNome: principal?.nome || "",
    contatoFuncaoSetor: (principal as any)?.funcaoSetor || "",
    contatos: rest.length ? rest : null,
    valorEstimado: Number(l.valorEstimado) || 0,
    valorEstimadoMasked: l.valorEstimado ? formatBRLFromNumber(l.valorEstimado) : "",
    dataPrevistaFechamento: l.dataPrevistaFechamento || "",
    localObra: l.localObra || "",
    potencialInicioObra: l.potencialInicioObra || "",
    potencialTerminoObra: l.potencialTerminoObra || "",
  };
};

export default function Oportunidades() {
  const {
    oportunidades,
    funilEstagios,
    addOportunidade,
    updateOportunidade,
    deleteOportunidade,
    converterOportunidade,
    clientes,
  } = useClientesContext();
  const { players } = usePlayersContext();
  const { hasAccess, can } = usePermissions();
  // PRO-031 · Fase 3 — gates: edição pelo nível legado; excluir/exportar pela matriz fina.
  const canEdit = hasAccess("crm", "editar");
  const canDelete = canEdit && can("/crm/vendas", "X");
  const canExport = can("/crm/vendas", "Ex");
  const { motivos, getRegistro, registrarPerda, adicionarMotivo } = useCrmMotivosPerda();
  const { todas: crmTarefas } = useCrmTarefas();
  const navigate = useNavigate();
  const [sp, setSp] = useSearchParams();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Oportunidade | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [convertId, setConvertId] = useState<string | null>(null);
  const [commentsFor, setCommentsFor] = useState<Oportunidade | null>(null);
  const [motivoPerdaId, setMotivoPerdaId] = useState("");
  const [motivoPerdaObs, setMotivoPerdaObs] = useState("");
  const [novoMotivoPerda, setNovoMotivoPerda] = useState("");

  // Filtros
  const [fStatus, setFStatus] = useState("todos");
  const [fResp, setFResp] = useState("todos");
  const [fFollowUp, setFFollowUp] = useState("todos");

  const loginDe = useMemo(() => {
    const m = new Map<string, string>();
    players.forEach((p) => m.set(p.id, p.login));
    return m;
  }, [players]);

  const clienteDe = useMemo(() => {
    const m = new Map<string, string>();
    clientes.forEach((c) => m.set(c.id, c.nome));
    return m;
  }, [clientes]);

  const rotuloEstagio = useMemo(() => {
    const m = new Map<string, string>();
    funilEstagios.forEach((e) => m.set(e.chave, e.rotulo));
    return m;
  }, [funilEstagios]);

  const playersWithOpportunities = useMemo(() => {
    const ids = new Set(oportunidades.map((l) => l.responsavelId).filter(Boolean));
    return players.filter((p) => ids.has(p.id));
  }, [oportunidades, players]);

  const hojeISO = new Date().toISOString().slice(0, 10);
  const proximoFollowUpPorOportunidade = useMemo(() => {
    const m = new Map<string, ReturnType<typeof proximaTarefaAberta>>();
    oportunidades.forEach((o) => m.set(o.id, proximaTarefaAberta(crmTarefas, o.id)));
    return m;
  }, [crmTarefas, oportunidades]);

  const { filter: scopeFilter } = useCrmScopeFilter();

  const filtered = useMemo(
    () =>
      scopeFilter(oportunidades).filter((l) => {
        const prox = proximoFollowUpPorOportunidade.get(l.id);
        const classe = prox ? classificarTarefa(prox, hojeISO) : null;
        return (
          (fStatus === "todos" || l.status === fStatus) &&
          (fResp === "todos" || l.responsavelId === fResp) &&
          (fFollowUp === "todos" ||
            (fFollowUp === "pendente" && !!prox) ||
            (fFollowUp === "vencido" && classe === "vencida") ||
            (fFollowUp === "sem" && !prox))
        );
      }),
    [
      oportunidades,
      fStatus,
      fResp,
      fFollowUp,
      proximoFollowUpPorOportunidade,
      hojeISO,
      scopeFilter,
    ],
  );

  const statusOptions = useMemo(
    () => Array.from(new Set(oportunidades.map((l) => l.status).filter(Boolean))),
    [oportunidades],
  );

  const set = (k: keyof FormState, v: any) => setForm((p) => ({ ...p, [k]: v }));

  const openNew = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setMotivoPerdaId("");
    setMotivoPerdaObs("");
    setNovoMotivoPerda("");
    setDialogOpen(true);
  };
  const openEdit = (l: Oportunidade) => {
    setEditing(l);
    setForm(oportunidadeToForm(l));
    const perda = getRegistro(l.id);
    setMotivoPerdaId(perda?.motivoId ?? "");
    setMotivoPerdaObs(perda?.observacao ?? "");
    setNovoMotivoPerda("");
    setDialogOpen(true);
  };

  // Abre diálogo via query params (ex.: vindo do Funil): ?new=1 ou ?edit=<id>
  useEffect(() => {
    const isNew = sp.get("new") === "1";
    const editId = sp.get("edit");
    if (isNew) {
      if (canEdit) openNew();
      const next = new URLSearchParams(sp);
      next.delete("new");
      setSp(next, { replace: true });
    } else if (editId) {
      const l = oportunidades.find((o) => o.id === editId);
      if (l && canEdit) openEdit(l);
      const next = new URLSearchParams(sp);
      next.delete("edit");
      setSp(next, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sp, oportunidades]);

  const handleSave = async () => {
    if (!form.nome.trim()) {
      toast.error("Nome é obrigatório");
      return;
    }
    if (!form.clienteId.trim()) {
      toast.error("Cliente é obrigatório");
      return;
    }
    const exigeMotivoPerda = form.estagio === CRM_ESTAGIO_FECHADO_PERDIDO;
    const motivoSelecionado = motivos.find((m) => m.id === motivoPerdaId);
    const motivoFinal =
      motivoSelecionado || (novoMotivoPerda.trim() ? adicionarMotivo(novoMotivoPerda) : null);
    if (exigeMotivoPerda && !motivoFinal) {
      toast.error("Informe o motivo da perda");
      return;
    }
    setSaving(true);
    try {
      const adicionaisLimpos = (form.contatos || []).filter(
        (c) =>
          (c.nome || "").trim() ||
          (c.email || "").trim() ||
          (c.telefone || "").trim() ||
          ((c as any).funcaoSetor || "").trim(),
      );
      const principal: Contact | null =
        (form.contatoNome || "").trim() ||
        (form.email || "").trim() ||
        (form.telefone || "").trim() ||
        (form.contatoFuncaoSetor || "").trim()
          ? {
              nome: form.contatoNome || "",
              email: form.email || undefined,
              telefone: form.telefone || undefined,
              funcaoSetor: form.contatoFuncaoSetor || undefined,
            }
          : null;
      const contatosMerged = [...(principal ? [principal] : []), ...adicionaisLimpos];
      const payload: any = {
        nome: form.nome.trim(),
        clienteId: form.clienteId,
        servicos: form.servicos.length ? form.servicos : null,
        email: form.email || null,
        telefone: form.telefone || null,
        status: form.status,
        estagio: form.estagio,
        responsavelId: form.responsavelId || null,
        observacao: form.observacao || null,
        temperatura_temperatura: form.temperatura_temperatura || null,
        valorEstimado: Number(form.valorEstimado) || 0,
        dataPrevistaFechamento: form.dataPrevistaFechamento || null,
        contatos: contatosMerged.length ? contatosMerged : null,
        localObra: form.localObra || null,
        potencialInicioObra: form.potencialInicioObra || null,
        potencialTerminoObra: form.potencialTerminoObra || null,
      };
      if (editing) {
        const alteracoes = diffOportunidade(editing as any, payload as any);
        await updateOportunidade(editing.id, payload);
        if (alteracoes.length > 0) {
          registrarEvento({
            oportunidadeId: editing.id,
            tipo: "edicao",
            descricao:
              alteracoes.length === 1
                ? `Alterou ${alteracoes[0].label}`
                : `Alterou ${alteracoes.length} campos`,
            detalhes: { alteracoes },
          });
        }
        if (exigeMotivoPerda && motivoFinal) {
          registrarPerda({
            oportunidadeId: editing.id,
            motivoId: motivoFinal.id,
            motivoRotulo: motivoFinal.rotulo,
            observacao: motivoPerdaObs,
          });
        }
        toast.success("Oportunidade atualizada");
      } else {
        const criada = await addOportunidade(payload as any);
        if (criada?.id) {
          registrarEvento({
            oportunidadeId: criada.id,
            tipo: "criacao",
            descricao: `Oportunidade criada: ${payload.nome ?? ""}`,
          });
        }
        if (exigeMotivoPerda && motivoFinal && criada?.id) {
          registrarPerda({
            oportunidadeId: criada.id,
            motivoId: motivoFinal.id,
            motivoRotulo: motivoFinal.rotulo,
            observacao: motivoPerdaObs,
          });
        }
        toast.success("Oportunidade criada");
      }
      setDialogOpen(false);
    } finally {
      setSaving(false);
    }
  };

  const handleConvert = async () => {
    if (!convertId) return;
    await converterOportunidade(convertId);
    setConvertId(null);
  };

  const exportCSV = () => {
    const headers = [
      "Nome",
      "Cliente",
      "Serviço",
      "E-mail",
      "Telefone",
      "Status",
      "Estágio",
      "Temperatura",
      "Valor estimado",
      "Data prevista",
      "Próximo follow-up",
      "Status follow-up",
      "Responsável follow-up",
      "Responsável",
      "Criado em",
    ];
    const linhas = filtered.map((l) => {
      const prox = proximoFollowUpPorOportunidade.get(l.id);
      return [
        l.nome,
        l.clienteId ? (clienteDe.get(l.clienteId) ?? "") : "",
        (l.servicos || []).join(", "),
        l.email ?? "",
        l.telefone ?? "",
        l.status,
        rotuloEstagio.get(l.estagio) ?? l.estagio,
        l.temperatura_temperatura ?? "",
        String(l.valorEstimado ?? 0),
        l.dataPrevistaFechamento ?? "",
        prox ? `${fmtDataLocal(prox.data)} — ${prox.titulo}` : "",
        prox ? classificarTarefa(prox, hojeISO) : "",
        prox?.responsavelLogin ?? "",
        l.responsavelId ? (loginDe.get(l.responsavelId) ?? "") : "",
        l.dataCriacao ? fmtDataLocal(l.dataCriacao) : "",
      ];
    });
    const escape = (v: string) => `"${String(v).replace(/"/g, '""')}"`;
    const csv = [headers, ...linhas].map((row) => row.map(escape).join(";")).join("\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `oportunidades_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const columns: ColumnDef<Oportunidade>[] = [
    {
      accessorKey: "nome",
      header: "Oportunidade",
      enableSorting: true,
      cell: ({ row }) => (
        <button
          className="font-medium text-primary hover:underline text-left"
          onClick={() => navigate(`/crm/oportunidades/${row.original.id}`)}
        >
          {row.original.nome}
        </button>
      ),
    },
    {
      accessorKey: "clienteId",
      header: "Cliente",
      enableSorting: true,
      cell: ({ getValue }) => clienteDe.get(getValue() as string) || "—",
    },
    {
      accessorKey: "servicos",
      header: "Serviço",
      enableSorting: false,
      cell: ({ getValue }) => {
        const servicos = (getValue() as string[]) || [];
        if (servicos.length === 0) return "—";
        return (
          <div className="flex flex-wrap gap-1">
            {servicos.map((s) => (
              <Badge key={s} variant="outline" className="font-normal">
                {s}
              </Badge>
            ))}
          </div>
        );
      },
    },
    {
      accessorKey: "temperatura_temperatura",
      header: () => (
        <div className="flex justify-center">
          <Thermometer className="h-4 w-4" />
        </div>
      ),
      enableSorting: true,
      cell: ({ row }) => {
        const t =
          hottestForCliente(row.original.clienteId, oportunidades) ??
          row.original.temperatura_temperatura;
        return (
          <div className="flex justify-center">
            {t ? (
              <TemperatureDisplay value={t as any} variant="pill" />
            ) : (
              <span className="text-muted-foreground text-xs">—</span>
            )}
          </div>
        );
      },
    },
    {
      accessorKey: "estagio",
      header: "Estágio",
      enableSorting: true,
      cell: ({ getValue }) => (
        <Badge variant="outline">
          {rotuloEstagio.get(getValue() as string) ?? (getValue() as string)}
        </Badge>
      ),
    },
    {
      id: "motivoPerda",
      header: "Motivo perda",
      enableSorting: false,
      cell: ({ row }) =>
        row.original.estagio === CRM_ESTAGIO_FECHADO_PERDIDO ? (
          <span className="text-sm text-muted-foreground">
            {getRegistro(row.original.id)?.motivoRotulo ?? "Pendente"}
          </span>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      accessorKey: "valorEstimado",
      header: "Valor estimado",
      enableSorting: true,
      cell: ({ getValue }) => formatBRLFromNumber(Number(getValue()) || 0),
    },
    {
      accessorKey: "responsavelId",
      header: "Responsável",
      enableSorting: false,
      cell: ({ getValue }) => (getValue() ? (loginDe.get(getValue() as string) ?? "—") : "—"),
    },
    {
      id: "proximoFollowUp",
      header: "Próximo follow-up",
      enableSorting: false,
      cell: ({ row }) => {
        const prox = proximoFollowUpPorOportunidade.get(row.original.id);
        if (!prox) return <span className="text-muted-foreground">—</span>;
        const classe = classificarTarefa(prox, hojeISO);
        const tone =
          classe === "vencida" ? "text-destructive" : classe === "hoje" ? "text-warning" : "";
        return (
          <button
            className="text-left max-w-[220px] hover:underline"
            onClick={() => navigate(`/crm/oportunidades/${row.original.id}`)}
          >
            <span className={`inline-flex items-center gap-1 text-xs font-medium ${tone}`}>
              <CalendarClock className="h-3.5 w-3.5" /> {fmtDataLocal(prox.data)}
            </span>
            <span className="block text-[11px] text-muted-foreground truncate">
              {prox.titulo}
              {prox.responsavelLogin ? ` · ${prox.responsavelLogin}` : ""}
            </span>
          </button>
        );
      },
    },
    {
      accessorKey: "dataCriacao",
      header: "Criado em",
      enableSorting: true,
      cell: ({ getValue }) => {
        const v = getValue() as string | null;
        return v ? fmtDataLocal(v) : "—";
      },
    },
    {
      id: "acoes",
      header: "",
      enableSorting: false,
      cell: ({ row }) => {
        const l = row.original;
        return (
          <RowActions>
            {!l.clienteId && (
              <Button
                size="icon"
                variant="ghost"
                className="text-success"
                title="Converter em cliente"
                aria-label="Converter em cliente"
                onClick={() => setConvertId(l.id)}
              >
                <UserCheck className="h-4 w-4" />
              </Button>
            )}
            <Button
              size="icon"
              variant="ghost"
              onClick={() => setCommentsFor(l)}
              title="Comentários"
              aria-label="Comentários"
            >
              <MessageSquare className="h-4 w-4" />
            </Button>
            {canEdit && (
              <Button
                size="icon"
                variant="ghost"
                onClick={() => openEdit(l)}
                title="Editar"
                aria-label="Editar oportunidade"
              >
                <Pencil className="h-4 w-4" />
              </Button>
            )}
            {canDelete && (
              <Button
                size="icon"
                variant="ghost"
                className="text-destructive"
                onClick={() => setDeleteId(l.id)}
                title="Remover"
                aria-label="Remover"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </RowActions>
        );
      },
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-semibold">Oportunidades</h1>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={exportCSV}
            disabled={!canExport || filtered.length === 0}
          >
            <Download className="h-4 w-4 mr-1" /> Exportar CSV
          </Button>
          {canEdit && (
            <Button onClick={openNew}>
              <Plus className="h-4 w-4 mr-1" /> Nova oportunidade
            </Button>
          )}
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Follow-up</Label>
          <Select value={fFollowUp} onValueChange={setFFollowUp}>
            <SelectTrigger className="w-44 h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              <SelectItem value="pendente">Com pendência</SelectItem>
              <SelectItem value="vencido">Vencidos</SelectItem>
              <SelectItem value="sem">Sem follow-up</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="space-y-1">
          <Label className="text-xs">Status</Label>
          <Select value={fStatus} onValueChange={setFStatus}>
            <SelectTrigger className="w-44 h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              {statusOptions.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Responsável</Label>
          <Select value={fResp} onValueChange={setFResp}>
            <SelectTrigger className="w-44 h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              {playersWithOpportunities.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.login}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <DataTable
        columns={columns}
        data={filtered}
        searchPlaceholder="Buscar oportunidades…"
        initialSorting={[{ id: "dataCriacao", desc: true }]}
        rowClassName={(row: any) => {
          const t = hottestForCliente(row.clienteId, oportunidades) ?? row.temperatura_temperatura;
          if (t === "frio") return "bg-blue-500/5 hover:bg-blue-500/10";
          if (t === "morno") return "bg-yellow-500/5 hover:bg-yellow-500/10";
          if (t === "quente") return "bg-red-500/5 hover:bg-red-500/10";
          return undefined;
        }}
      />

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar oportunidade" : "Nova oportunidade"}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3 py-2">
            {/* Oportunidade - Full width */}
            <div className="space-y-1 col-span-2">
              <Label>Oportunidade *</Label>
              <Input
                value={form.nome}
                onChange={(e) => set("nome", e.target.value)}
                placeholder="Título da oportunidade"
              />
            </div>

            {/* Valor estimado e Data prevista de fechamento */}
            <div className="space-y-1">
              <Label>Valor estimado</Label>
              <Input
                inputMode="numeric"
                value={form.valorEstimadoMasked}
                onChange={(e) => {
                  const masked = formatBRLInput(e.target.value);
                  set("valorEstimadoMasked", masked);
                  set("valorEstimado", parseBRL(masked));
                }}
                placeholder="R$ 0,00"
              />
            </div>
            <div className="space-y-1">
              <Label>Data prevista de fechamento</Label>
              <DatePickerField
                value={form.dataPrevistaFechamento}
                onChange={(v) => set("dataPrevistaFechamento", v)}
              />
            </div>

            {/* Estágio */}
            <div className="space-y-1 col-span-2">
              <Label>Estágio</Label>
              <Select value={form.estagio} onValueChange={(v) => set("estagio", v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[...funilEstagios]
                    .sort((a, b) => a.ordem - b.ordem)
                    .map((e) => (
                      <SelectItem key={e.chave} value={e.chave}>
                        {e.rotulo}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            {form.estagio === CRM_ESTAGIO_FECHADO_PERDIDO && (
              <div className="col-span-2 grid grid-cols-1 gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-3">
                <div className="space-y-1">
                  <Label>Motivo da perda *</Label>
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
                  <Label>Observação da perda</Label>
                  <Textarea
                    value={motivoPerdaObs}
                    onChange={(e) => setMotivoPerdaObs(e.target.value)}
                    rows={3}
                  />
                </div>
              </div>
            )}

            {/* Responsável and Temperatura */}
            <div className="space-y-1">
              <Label>Responsável</Label>
              <Select
                value={form.responsavelId || undefined}
                onValueChange={(v) => set("responsavelId", v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Atribuir" />
                </SelectTrigger>
                <SelectContent>
                  {players.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.login}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <TemperatureSelector
                value={form.temperatura_temperatura}
                onChange={(v) => set("temperatura_temperatura", v)}
              />
            </div>

            {/* Contatos — padrão único (principal + adicionais) */}
            <div className="col-span-2 space-y-2">
              <Label className="text-sm font-semibold">Contatos</Label>

              {/* Contato principal */}
              <div className="grid grid-cols-[1fr_1fr_1fr_1fr_auto] gap-2 items-end p-3 bg-muted/40 rounded border">
                <div className="col-span-full text-xs font-medium text-muted-foreground">
                  Contato 1 (principal)
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Nome</Label>
                  <Input
                    value={form.contatoNome}
                    onChange={(e) => set("contatoNome", e.target.value)}
                    placeholder="Nome"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Função/Setor</Label>
                  <Input
                    value={(form as any).contatoFuncaoSetor || ""}
                    onChange={(e) => set("contatoFuncaoSetor" as any, e.target.value)}
                    placeholder="Ex.: Compras"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">E-mail</Label>
                  <Input
                    type="email"
                    value={form.email}
                    onChange={(e) => set("email", e.target.value)}
                    placeholder="Email"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Telefone</Label>
                  <Input
                    value={form.telefone}
                    onChange={(e) => set("telefone", e.target.value)}
                    placeholder="Telefone"
                  />
                </div>
                <div />
              </div>

              {/* Contatos adicionais */}
              {(form.contatos || []).map((c, i) => (
                <div
                  key={i}
                  className="grid grid-cols-[1fr_1fr_1fr_1fr_auto] gap-2 items-end p-3 bg-muted/40 rounded border"
                >
                  <div className="col-span-full text-xs font-medium text-muted-foreground">
                    Contato {i + 2}
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Nome</Label>
                    <Input
                      value={c.nome}
                      onChange={(e) => {
                        const next = [...(form.contatos || [])];
                        next[i] = { ...next[i], nome: e.target.value };
                        set("contatos", next);
                      }}
                      placeholder="Nome"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Função/Setor</Label>
                    <Input
                      value={(c as any).funcaoSetor || ""}
                      onChange={(e) => {
                        const next = [...(form.contatos || [])];
                        next[i] = { ...next[i], funcaoSetor: e.target.value };
                        set("contatos", next);
                      }}
                      placeholder="Ex.: Compras"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">E-mail</Label>
                    <Input
                      type="email"
                      value={c.email || ""}
                      onChange={(e) => {
                        const next = [...(form.contatos || [])];
                        next[i] = { ...next[i], email: e.target.value };
                        set("contatos", next);
                      }}
                      placeholder="Email"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Telefone</Label>
                    <Input
                      value={c.telefone || ""}
                      onChange={(e) => {
                        const next = [...(form.contatos || [])];
                        next[i] = { ...next[i], telefone: e.target.value };
                        set("contatos", next);
                      }}
                      placeholder="Telefone"
                    />
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="text-destructive"
                    aria-label="Remover contato"
                    onClick={() => {
                      const next = (form.contatos || []).filter((_, idx) => idx !== i);
                      set("contatos", next.length ? next : null);
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  set("contatos", [
                    ...(form.contatos || []),
                    { nome: "", email: "", telefone: "", funcaoSetor: "" },
                  ])
                }
              >
                <Plus className="h-4 w-4 mr-1" /> Adicionar outro contato
              </Button>
            </div>

            {/* Cliente and Serviço */}
            <div className="space-y-1">
              <Label>Cliente *</Label>
              <Select value={form.clienteId} onValueChange={(v) => set("clienteId", v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {clientes.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Serviço</Label>
              <MultiSelect
                options={SERVICOS.map((s) => ({ value: s, label: s }))}
                selected={form.servicos}
                onChange={(v) => set("servicos", v)}
                placeholder="Selecione…"
              />
            </div>

            {/* Local da obra - Full width */}
            <div className="space-y-1 col-span-2">
              <Label>Local da obra</Label>
              <Input
                value={form.localObra}
                onChange={(e) => set("localObra", e.target.value)}
                placeholder="Cidade/UF"
              />
            </div>

            {/* Potencial início e término de obra */}
            <div className="space-y-1">
              <Label>Potencial início de obra</Label>
              <DatePickerField
                value={form.potencialInicioObra}
                onChange={(v) => set("potencialInicioObra", v)}
              />
            </div>
            <div className="space-y-1">
              <Label>Potencial término de obra</Label>
              <DatePickerField
                value={form.potencialTerminoObra}
                onChange={(v) => set("potencialTerminoObra", v)}
              />
            </div>

            {/* Observação - Full width */}
            <div className="space-y-1 col-span-2">
              <Label>Observação</Label>
              <Textarea
                value={form.observacao}
                onChange={(e) => set("observacao", e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving || !form.nome.trim() || !form.clienteId.trim()}
            >
              {editing ? "Salvar" : "Criar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <DeleteConfirmDialog
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={async () => {
          if (deleteId) {
            await deleteOportunidade(deleteId);
            toast.success("Oportunidade removida");
            setDeleteId(null);
          }
        }}
        title="Remover oportunidade"
        description="Esta ação não pode ser desfeita."
      />

      <Dialog open={!!convertId} onOpenChange={(v) => !v && setConvertId(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Converter em cliente</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Será criado um cliente no ERP a partir desta oportunidade, o funil fecha como{" "}
            <strong>Ganho</strong> e a origem fica rastreável. Continuar?
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConvertId(null)}>
              Cancelar
            </Button>
            <Button onClick={handleConvert}>Converter</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <OportunidadeComentariosDrawer
        oportunidade={commentsFor}
        open={!!commentsFor}
        onOpenChange={(v) => !v && setCommentsFor(null)}
      />
    </div>
  );
}
