import React, { useState, useMemo, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { usePermissions } from "@/contexts/auth/usePermissions";
import { useObrasContext } from "@/contexts/ObrasContext";
import { useClientesContext } from "@/contexts/ClientesContext";
import { useObrasEscopo } from "@/hooks/obras/useObrasEscopo";
import { syncObraToSupabase, reconciliarObrasFlowcastId } from "@/lib/obras/sync";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
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
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { DataTable } from "@/components/ui/data-table";
import { Plus, Building2, ExternalLink } from "lucide-react";
import { ColumnDef } from "@tanstack/react-table";
import { Obra } from "@/types";
import DeleteConfirmDialog from "@/components/common/DeleteConfirmDialog";
import MaskedDateInput from "@/components/common/MaskedDateInput";
import { fmtData } from "@/lib/utils";
import { formatBRL } from "@/lib/core/currency";
import { swallow } from "@/lib/core/errors";
import { validateObra } from "@/lib/schemas/obra";
import SeletorMunicipio from "@/components/rh/logistica/SeletorMunicipio";
import { logger } from "@/lib/core/logger";

const fmtMoeda = (v?: number) => formatBRL(v);

// Parse "15, 30" → [15, 30]
const parseNumArray = (s: string): number[] =>
  s
    .split(/[,;\s]+/)
    .map(Number)
    .filter((n) => !isNaN(n) && n > 0);

// [15, 30] → "15, 30"
const numArrayToStr = (a?: number[]): string => (a && a.length ? a.join(", ") : "");

const EMPTY_FORM = {
  codigo: "",
  nome: "",
  cliente: "",
  clienteId: "",
  pedidoContrato: "",
  local: "",
  cidade: "",
  uf: "",
  centroCustoTotvs: "",
  ativa: true,
  requerIntegracao: false,
  integracaoInfo: "",
  dataMobilizacao: "",
  dataDesmobilizacao: "",
  dataInicio: "",
  dataFim: "",
  dataPrevisaoTermino: "",
  valorContrato: "",
  valorAntecipacao: "",
  regraMedicao: "",
  diasCorteBmsStr: "",
  diasAteEmissaoNf: "5",
  cnpj: "",
  prazoPadraoPagamento: "",
  prazoPagamentoDias: "",
  diaFixoPagamento1: "",
  diaFixoPagamento2: "",
  diasFixosPagamentoStr: "",
  dataCorteMedicao1: "",
  dataCorteMedicao2: "",
  percentualMaterial: "70",
  aliquotaIss: "5",
  aliquotaInss: "11",
  aliquotaCbs: "0",
  aliquotaIbs: "0",
  observacoes: "",
  flowcastId: "" as string | undefined,
};

type FormState = typeof EMPTY_FORM;

const obraToForm = (o: Obra): FormState => ({
  codigo: o.codigo || "",
  nome: o.nome,
  cliente: o.cliente,
  clienteId: o.clienteId || "",
  pedidoContrato: o.pedidoContrato || "",
  local: o.local || "",
  cidade: o.cidade || "",
  uf: o.uf || "",
  centroCustoTotvs: o.centroCustoTotvs || "",
  ativa: o.ativa,
  requerIntegracao: o.requerIntegracao,
  integracaoInfo: o.integracaoInfo || "",
  dataMobilizacao: o.dataMobilizacao || "",
  dataDesmobilizacao: o.dataDesmobilizacao || "",
  dataInicio: o.dataInicio || "",
  dataFim: o.dataFim || "",
  dataPrevisaoTermino: o.dataPrevisaoTermino || "",
  valorContrato: o.valorContrato != null ? String(o.valorContrato) : "",
  valorAntecipacao: o.valorAntecipacao != null ? String(o.valorAntecipacao) : "",
  regraMedicao: o.regraMedicao || "",
  diasCorteBmsStr: numArrayToStr(o.diasCorteBms),
  diasAteEmissaoNf: o.diasAteEmissaoNf != null ? String(o.diasAteEmissaoNf) : "5",
  cnpj: o.cnpj || "",
  prazoPadraoPagamento: o.prazoPadraoPagamento || "",
  prazoPagamentoDias: o.prazoPagamentoDias != null ? String(o.prazoPagamentoDias) : "",
  diaFixoPagamento1: o.diaFixoPagamento1 || "",
  diaFixoPagamento2: o.diaFixoPagamento2 || "",
  diasFixosPagamentoStr: numArrayToStr(o.diasFixosPagamento),
  dataCorteMedicao1: o.dataCorteMedicao1 || "",
  dataCorteMedicao2: o.dataCorteMedicao2 || "",
  percentualMaterial: o.percentualMaterial != null ? String(o.percentualMaterial) : "70",
  aliquotaIss: o.aliquotaIss != null ? String(o.aliquotaIss) : "5",
  aliquotaInss: o.aliquotaInss != null ? String(o.aliquotaInss) : "11",
  aliquotaCbs: o.aliquotaCbs != null ? String(o.aliquotaCbs) : "0",
  aliquotaIbs: o.aliquotaIbs != null ? String(o.aliquotaIbs) : "0",
  observacoes: o.observacoes || o.observacao || "",
  flowcastId: o.flowcastId || "",
});

const formToPayload = (f: FormState): Omit<Obra, "id"> => ({
  codigo: f.codigo.trim() || undefined,
  nome: f.nome.trim(),
  cliente: f.clienteId ? "" : f.cliente.trim(),
  clienteId: f.clienteId || undefined,
  pedidoContrato: f.pedidoContrato.trim() || undefined,
  local: f.local.trim() || undefined,
  cidade: f.cidade.trim() || undefined,
  uf: f.uf.trim().toUpperCase() || undefined,
  centroCustoTotvs: f.centroCustoTotvs.trim() || undefined,
  ativa: f.ativa,
  requerIntegracao: f.requerIntegracao,
  integracaoInfo: f.requerIntegracao ? f.integracaoInfo : "",
  dataMobilizacao: f.dataMobilizacao || undefined,
  dataDesmobilizacao: f.dataDesmobilizacao || undefined,
  dataInicio: f.dataInicio || undefined,
  dataFim: f.dataFim || undefined,
  dataPrevisaoTermino: f.dataPrevisaoTermino || undefined,
  valorContrato: f.valorContrato !== "" ? Number(f.valorContrato) : undefined,
  valorAntecipacao: f.valorAntecipacao !== "" ? Number(f.valorAntecipacao) : undefined,
  regraMedicao: f.regraMedicao.trim() || undefined,
  diasCorteBms: f.diasCorteBmsStr.trim() ? parseNumArray(f.diasCorteBmsStr) : undefined,
  diasAteEmissaoNf: f.diasAteEmissaoNf !== "" ? Number(f.diasAteEmissaoNf) : undefined,
  cnpj: f.cnpj.trim() || undefined,
  prazoPadraoPagamento: f.prazoPadraoPagamento.trim() || undefined,
  prazoPagamentoDias: f.prazoPagamentoDias !== "" ? Number(f.prazoPagamentoDias) : undefined,
  diaFixoPagamento1: f.diaFixoPagamento1.trim() || undefined,
  diaFixoPagamento2: f.diaFixoPagamento2.trim() || undefined,
  diasFixosPagamento: f.diasFixosPagamentoStr.trim()
    ? parseNumArray(f.diasFixosPagamentoStr)
    : undefined,
  dataCorteMedicao1: f.dataCorteMedicao1 || undefined,
  dataCorteMedicao2: f.dataCorteMedicao2 || undefined,
  percentualMaterial: f.percentualMaterial !== "" ? Number(f.percentualMaterial) : undefined,
  aliquotaIss: f.aliquotaIss !== "" ? Number(f.aliquotaIss) : undefined,
  aliquotaInss: f.aliquotaInss !== "" ? Number(f.aliquotaInss) : undefined,
  aliquotaCbs: f.aliquotaCbs !== "" ? Number(f.aliquotaCbs) : undefined,
  aliquotaIbs: f.aliquotaIbs !== "" ? Number(f.aliquotaIbs) : undefined,
  observacoes: f.observacoes.trim() || undefined,
  flowcastId: (f.flowcastId as string)?.trim() || undefined,
});

// ─── Seção de formulário reutilizável ────────────────────────────────────────
const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div className="space-y-3">
    <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground border-b pb-1">
      {title}
    </h4>
    {children}
  </div>
);

const Field = ({
  label,
  children,
  span2 = false,
}: {
  label: string;
  children: React.ReactNode;
  span2?: boolean;
}) => (
  <div className={span2 ? "col-span-2" : ""}>
    <Label className="text-xs mb-1 block">{label}</Label>
    {children}
  </div>
);

// ─── Componente principal ─────────────────────────────────────────────────────
const Obras = () => {
  // EST-002 (Onda 0): consumir obras já recortadas pela empresa selecionada.
  // Mutações (add/update/delete) continuam vindo do AppContext.
  const { addObra, updateObra, deleteObra } = useObrasContext();
  const { hasAccess, currentPlayer } = usePermissions();
  const { clientes } = useClientesContext();
  const { obras } = useObrasEscopo();
  const canEdit = hasAccess("obras_div", "editar");
  const isGM = currentPlayer?.isGM;

  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const q = searchParams.get("q") ?? "";
  const sortId = searchParams.get("sort") ?? "nome";
  const sortDir = searchParams.get("dir") ?? "asc";
  const pageIndex = Number(searchParams.get("page") ?? "0");
  const showInactive = searchParams.get("inativos") === "1";

  const setParam = (key: string, val: string | null) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (val == null || val === "") next.delete(key);
      else next.set(key, val);
      return next;
    });
  };

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Obra | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [confirmInactivate, setConfirmInactivate] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; nome: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [reconciling, setReconciling] = useState(false);

  const set = (k: keyof FormState, v: any) => setForm((f) => ({ ...f, [k]: v }));

  const openForm = (obra?: Obra) => {
    setEditing(obra ?? null);
    setForm(obra ? obraToForm(obra) : EMPTY_FORM);
    setFormOpen(true);
  };

  // Pré-preenche o formulário quando vindo do Funil (Fechado Ganho).
  useEffect(() => {
    if (searchParams.get("prefill") !== "1") return;
    try {
      const raw = sessionStorage.getItem("obraPrefill");
      if (raw) {
        const p = JSON.parse(raw);
        setEditing(null);
        setForm({
          ...EMPTY_FORM,
          nome: p.nome || "",
          cliente: p.cliente || "",
          clienteId: p.clienteId || "",
          cnpj: p.cnpj || "",
          valorContrato: p.valorContrato || "",
          dataMobilizacao: p.dataMobilizacao || "",
        });
        setFormOpen(true);
        sessionStorage.removeItem("obraPrefill");
      }
    } catch (err) { swallow("Obras.prefill", err, "prefill inválido em sessionStorage"); }
    setParam("prefill", null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSave = async () => {
    if (saving) return;
    const validation = validateObra(form);
    if (!validation.ok) {
      toast.error(Object.values(validation.errors)[0] ?? "Verifique os campos do cadastro.");
      return;
    }
    setSaving(true);
    try {
      const payload = formToPayload(form);
      if (editing) {
        await updateObra(editing.id, payload);
        setFormOpen(false);
        syncObraToSupabase({ ...editing, ...payload }).catch(logger.error);
      } else {
        const nova = await addObra(payload);
        setFormOpen(false);
        if (nova) syncObraToSupabase(nova as any).catch(logger.error);
      }
    } finally {
      setSaving(false);
    }
  };

  const handleReconciliarVinculos = async () => {
    if (reconciling || filtered.length === 0) return;
    setReconciling(true);
    try {
      const result = await reconciliarObrasFlowcastId(filtered);

      if (result.reconciliadas.length > 0) {
        toast.success(
          `✅ ${result.reconciliadas.length} obra${result.reconciliadas.length !== 1 ? "s" : ""} reconciliada${result.reconciliadas.length !== 1 ? "s" : ""}`,
        );
      }

      if (result.semCentroCusto.length > 0) {
        toast.warning(
          `⚠️ ${result.semCentroCusto.length} obra${result.semCentroCusto.length !== 1 ? "s" : ""} sem centro de custo`,
        );
      }

      if (result.naoEncontradas.length > 0) {
        toast.error(
          `❌ ${result.naoEncontradas.length} obra${result.naoEncontradas.length !== 1 ? "s" : ""} não encontrada${result.naoEncontradas.length !== 1 ? "s" : ""} no Supabase`,
        );
      }

      if (result.jaSincronizadas > 0) {
        toast.info(
          `ℹ️ ${result.jaSincronizadas} obra${result.jaSincronizadas !== 1 ? "s" : ""} já sincronizada${result.jaSincronizadas !== 1 ? "s" : ""}`,
        );
      }

      if (result.naoPersistidas.length > 0) {
        toast.error(
          `❌ ${result.naoPersistidas.length} obra(s) foram pareadas, mas o backend não gravou o vínculo (coluna "flowcastId" ausente na tabela obras). O dashboard usará o centro de custo como chave alternativa.`,
          { duration: 10000 },
        );
      }

      if (
        result.reconciliadas.length === 0 &&
        result.jaSincronizadas === 0 &&
        result.naoPersistidas.length === 0
      ) {
        toast.info("Nenhuma obra para reconciliar.");
      }

    } catch (err: any) {
      logger.error("handleReconciliarVinculos", err);
      toast.error(`Erro ao reconciliar: ${err.message ?? err}`);
    } finally {
      setReconciling(false);
    }
  };

  const clienteNome = (o: Obra) => {
    if (o.clienteId) return clientes.find((c) => c.id === o.clienteId)?.nome ?? o.cliente;
    return o.cliente;
  };

  const filtered = useMemo(
    () => obras.filter((o) => (showInactive ? !o.ativa : o.ativa)),
    [obras, showInactive],
  );

  const columns: ColumnDef<Obra>[] = useMemo(
    () => [
      {
        accessorKey: "codigo",
        header: "Código",
        cell: ({ row }) =>
          row.original.codigo ? (
            <span className="font-mono text-sm">{row.original.codigo}</span>
          ) : (
            <span className="text-muted-foreground text-xs">—</span>
          ),
      },
      {
        accessorKey: "nome",
        header: "Nome",
        cell: ({ row }) => <span className="font-medium">{row.original.nome}</span>,
      },
      {
        id: "clienteNome",
        header: "Cliente",
        cell: ({ row }) =>
          clienteNome(row.original) || <span className="text-muted-foreground text-xs">—</span>,
      },
      {
        accessorKey: "ativa",
        header: "Status",
        cell: ({ row }) =>
          row.original.ativa ? (
            <Badge className="bg-success/15 text-success border-success/40 dark:bg-success/30 dark:text-success">
              Ativa
            </Badge>
          ) : (
            <Badge variant="outline" className="text-muted-foreground">
              Inativa
            </Badge>
          ),
      },
      {
        accessorKey: "dataMobilizacao",
        header: "Mobilização",
        cell: ({ row }) =>
          row.original.dataMobilizacao ? (
            fmtData(row.original.dataMobilizacao)
          ) : (
            <span className="text-muted-foreground text-xs">—</span>
          ),
      },
      {
        id: "acoes",
        header: "",
        cell: ({ row }: { row: { original: Obra } }) => {
          const o = row.original;
          return (
            <div className="flex gap-1 justify-end" onClick={(e) => e.stopPropagation()}>
              {o.flowcastId && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={async () => {
                    try {
                      const uuid = await syncObraToSupabase(o);
                      if (uuid !== o.flowcastId) updateObra(o.id, { flowcastId: uuid });
                      navigate(`/obras/${uuid}`);
                    } catch (e: any) {
                      toast.error(`Falha ao abrir planejamento: ${e.message ?? e}`);
                    }
                  }}
                >
                  <ExternalLink className="h-3 w-3 mr-1" />
                  Planejamento
                </Button>
              )}
              {canEdit && (
                <>
                  <Button variant="ghost" size="sm" onClick={() => openForm(o)}>
                    Editar
                  </Button>
                  {o.ativa ? (
                    <Button variant="ghost" size="sm" onClick={() => setConfirmInactivate(o.id)}>
                      Inativar
                    </Button>
                  ) : (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => updateObra(o.id, { ativa: true })}
                    >
                      Ativar
                    </Button>
                  )}
                </>
              )}
            </div>
          );
        },
      } as ColumnDef<Obra>,
    ],
    [canEdit, clientes],
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-display text-2xl font-bold flex items-center gap-2">
          <Building2 className="h-6 w-6" /> Obras
        </h2>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Switch
              id="inativos-obras"
              checked={showInactive}
              onCheckedChange={(v) => setParam("inativos", v ? "1" : null)}
            />
            <Label htmlFor="inativos-obras" className="text-sm">
              Mostrar Inativos
            </Label>
          </div>
          {canEdit && filtered.length > 0 && (
            <Button
              onClick={handleReconciliarVinculos}
              disabled={reconciling}
              variant="outline"
              size="sm"
            >
              {reconciling ? "Reconciliando…" : "Reconciliar Vínculos"}
            </Button>
          )}
          {canEdit && (
            <Button onClick={() => openForm()} size="sm">
              <Plus className="h-4 w-4 mr-1" /> Nova Obra
            </Button>
          )}
        </div>
      </div>

      <DataTable
        columns={columns}
        data={filtered}
        searchPlaceholder="Buscar obra ou cliente…"
        globalFilter={q}
        onGlobalFilterChange={(v) => setParam("q", v)}
        initialSorting={[{ id: sortId, desc: sortDir === "desc" }]}
        onSortingChange={(s) => {
          if (!s.length) return;
          setSearchParams((prev) => {
            const next = new URLSearchParams(prev);
            next.set("sort", s[0].id);
            next.set("dir", s[0].desc ? "desc" : "asc");
            return next;
          });
        }}
        pageIndex={pageIndex}
        onPageIndexChange={(i) => setParam("page", i > 0 ? String(i) : null)}
        countLabel={(f, t) => `${f} obra${f !== 1 ? "s" : ""} (de ${t})`}
        emptyState={
          <p className="text-sm text-muted-foreground py-8 text-center">Nenhuma obra encontrada.</p>
        }
        onRowClick={async (o) => {
          try {
            const uuid = await syncObraToSupabase(o);
            if (uuid !== o.flowcastId) updateObra(o.id, { flowcastId: uuid });
            navigate(`/obras/${uuid}`);
          } catch (e: any) {
            toast.error(`Falha ao abrir planejamento: ${e.message ?? e}`);
          }
        }}
      />

      {/* ── Formulário ── */}
      <Dialog open={formOpen} onOpenChange={(v) => !v && setFormOpen(false)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display">
              {editing ? "Editar Obra" : "Nova Obra"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-6 py-1">
            {/* ── Identificação ── */}
            <Section title="Identificação">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Código">
                  <Input
                    id="obra-codigo"
                    name="obra-codigo"
                    value={form.codigo}
                    onChange={(e) => set("codigo", e.target.value)}
                    placeholder="ex: 208"
                  />
                </Field>
                <Field label="Código Centro de Custo TOTVS">
                  <Input
                    id="obra-cc-totvs"
                    name="obra-cc-totvs"
                    value={form.centroCustoTotvs}
                    onChange={(e) => set("centroCustoTotvs", e.target.value)}
                    placeholder="ex: 01.002.0202"
                  />
                </Field>
                <Field label="Nome *" span2>
                  <Input
                    id="obra-nome"
                    name="obra-nome"
                    value={form.nome}
                    onChange={(e) => set("nome", e.target.value)}
                    autoFocus
                  />
                </Field>
                <Field label="Cliente">
                  <Select
                    value={form.clienteId}
                    onValueChange={(v) => set("clienteId", v === "__none__" ? "" : v)}
                  >
                    <SelectTrigger id="obra-cliente-id">
                      <SelectValue placeholder="Selecionar cliente…" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">— Nenhum —</SelectItem>
                      {clientes
                        .filter((c) => c.ativa)
                        .map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.nome}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Cliente (texto livre)">
                  <Input
                    id="obra-cliente"
                    name="obra-cliente"
                    value={form.cliente}
                    onChange={(e) => set("cliente", e.target.value)}
                    placeholder="Nome do cliente se não cadastrado"
                    disabled={!!form.clienteId}
                  />
                </Field>
                <Field label="Pedido / N° Contrato">
                  <Input
                    id="obra-pedido"
                    name="obra-pedido"
                    value={form.pedidoContrato}
                    onChange={(e) => set("pedidoContrato", e.target.value)}
                  />
                </Field>
                <Field label="Local" span2>
                  <Input
                    id="obra-local"
                    name="obra-local"
                    value={form.local}
                    onChange={(e) => set("local", e.target.value)}
                  />
                </Field>
                {/* Cidade/UF posicionam a obra no mapa de logística; `Local`
                    segue livre para o ponto exato dentro do município. */}
                <Field label="Cidade / UF" span2>
                  <SeletorMunicipio
                    cidade={form.cidade}
                    uf={form.uf}
                    onChange={({ cidade, uf }) => {
                      set("cidade", cidade);
                      set("uf", uf);
                    }}
                  />
                </Field>
                <Field label="ID Planejamento (Flowcast)" span2>
                  <Input
                    id="obra-flowcast-id"
                    name="obra-flowcast-id"
                    value={form.flowcastId ?? ""}
                    onChange={(e) => set("flowcastId", e.target.value || undefined)}
                    placeholder="UUID do Supabase — habilita aba de Cronograma/Gantt/Medições"
                  />
                </Field>
                <div className="col-span-2 flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <Switch
                      id="obra-ativa"
                      checked={form.ativa}
                      onCheckedChange={(v) => set("ativa", v)}
                    />
                    <Label htmlFor="obra-ativa">Obra ativa</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="reqInt"
                      checked={form.requerIntegracao}
                      onCheckedChange={(v) => set("requerIntegracao", !!v)}
                    />
                    <Label htmlFor="reqInt">Requer integração?</Label>
                  </div>
                </div>
                {form.requerIntegracao && (
                  <Field label="Informações de Integração" span2>
                    <Textarea
                      id="obra-integracao"
                      name="obra-integracao"
                      value={form.integracaoInfo}
                      onChange={(e) => set("integracaoInfo", e.target.value)}
                      placeholder="Site ou forma de integração…"
                    />
                  </Field>
                )}
              </div>
            </Section>

            {/* ── Datas ── */}
            <Section title="Datas">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Início">
                  <MaskedDateInput
                    id="obra-data-inicio"
                    name="obra-data-inicio"
                    value={form.dataInicio}
                    onChange={(v) => set("dataInicio", v)}
                  />
                </Field>
                <Field label="Fim Previsto">
                  <MaskedDateInput
                    id="obra-data-fim"
                    name="obra-data-fim"
                    value={form.dataFim}
                    onChange={(v) => set("dataFim", v)}
                  />
                </Field>
                <Field label="Previsão Término">
                  <MaskedDateInput
                    id="obra-data-prev"
                    name="obra-data-prev"
                    value={form.dataPrevisaoTermino}
                    onChange={(v) => set("dataPrevisaoTermino", v)}
                  />
                </Field>
                <Field label="Mobilização">
                  <MaskedDateInput
                    id="obra-data-mob"
                    name="obra-data-mob"
                    value={form.dataMobilizacao}
                    onChange={(v) => set("dataMobilizacao", v)}
                  />
                </Field>
                <Field label="Desmobilização">
                  <MaskedDateInput
                    id="obra-data-desmob"
                    name="obra-data-desmob"
                    value={form.dataDesmobilizacao}
                    onChange={(v) => set("dataDesmobilizacao", v)}
                  />
                </Field>
              </div>
            </Section>

            {/* ── Contrato e Medição ── */}
            <Section title="Contrato e Medição">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Valor do Contrato (R$)">
                  <Input
                    id="obra-valor"
                    name="obra-valor"
                    type="number"
                    min={0}
                    step={0.01}
                    value={form.valorContrato}
                    onChange={(e) => set("valorContrato", e.target.value)}
                    placeholder="0,00"
                  />
                </Field>
                <Field label="Antecipação (R$)">
                  <Input
                    id="obra-antecip"
                    name="obra-antecip"
                    type="number"
                    min={0}
                    step={0.01}
                    value={form.valorAntecipacao}
                    onChange={(e) => set("valorAntecipacao", e.target.value)}
                    placeholder="0,00"
                  />
                </Field>
                <Field label="Regra de Medição" span2>
                  <Input
                    id="obra-regra"
                    name="obra-regra"
                    value={form.regraMedicao}
                    onChange={(e) => set("regraMedicao", e.target.value)}
                    placeholder="ex: Dia 15, Dias 15 e 30, Mensal"
                  />
                </Field>
                <Field label="Dias de Corte BMs (ex: 15, 30)">
                  <Input
                    id="obra-dias-bms"
                    name="obra-dias-bms"
                    value={form.diasCorteBmsStr}
                    onChange={(e) => set("diasCorteBmsStr", e.target.value)}
                    placeholder="15, 30"
                  />
                </Field>
                <Field label="Dias até Emissão NF">
                  <Input
                    id="obra-dias-nf"
                    name="obra-dias-nf"
                    type="number"
                    min={0}
                    value={form.diasAteEmissaoNf}
                    onChange={(e) => set("diasAteEmissaoNf", e.target.value)}
                  />
                </Field>
                <Field label="Data Corte Medição 1">
                  <MaskedDateInput
                    id="obra-corte1"
                    name="obra-corte1"
                    value={form.dataCorteMedicao1}
                    onChange={(v) => set("dataCorteMedicao1", v)}
                  />
                </Field>
                <Field label="Data Corte Medição 2">
                  <MaskedDateInput
                    id="obra-corte2"
                    name="obra-corte2"
                    value={form.dataCorteMedicao2}
                    onChange={(v) => set("dataCorteMedicao2", v)}
                  />
                </Field>
              </div>
            </Section>

            {/* ── Pagamento ── */}
            <Section title="Pagamento">
              <div className="grid grid-cols-2 gap-3">
                <Field label="CNPJ">
                  <Input
                    id="obra-cnpj"
                    name="obra-cnpj"
                    value={form.cnpj}
                    onChange={(e) => set("cnpj", e.target.value)}
                    placeholder="00.000.000/0000-00"
                  />
                </Field>
                <Field label="Prazo Padrão">
                  <Input
                    id="obra-prazo"
                    name="obra-prazo"
                    value={form.prazoPadraoPagamento}
                    onChange={(e) => set("prazoPadraoPagamento", e.target.value)}
                    placeholder="ex: 30 dias"
                  />
                </Field>
                <Field label="Prazo Pagamento (dias)">
                  <Input
                    id="obra-prazo-dias"
                    name="obra-prazo-dias"
                    type="number"
                    min={0}
                    value={form.prazoPagamentoDias}
                    onChange={(e) => set("prazoPagamentoDias", e.target.value)}
                  />
                </Field>
                <Field label="Dia Fixo Pag. 1">
                  <Input
                    id="obra-dia-pag1"
                    name="obra-dia-pag1"
                    type="number"
                    min={1}
                    max={31}
                    value={form.diaFixoPagamento1}
                    onChange={(e) => set("diaFixoPagamento1", e.target.value)}
                  />
                </Field>
                <Field label="Dia Fixo Pag. 2">
                  <Input
                    id="obra-dia-pag2"
                    name="obra-dia-pag2"
                    type="number"
                    min={1}
                    max={31}
                    value={form.diaFixoPagamento2}
                    onChange={(e) => set("diaFixoPagamento2", e.target.value)}
                  />
                </Field>
                <Field label="Dias Fixos Pagamento (ex: 15, 30)">
                  <Input
                    id="obra-dias-pag"
                    name="obra-dias-pag"
                    value={form.diasFixosPagamentoStr}
                    onChange={(e) => set("diasFixosPagamentoStr", e.target.value)}
                    placeholder="15, 30"
                  />
                </Field>
              </div>
            </Section>

            {/* ── Retenções ── */}
            <Section title="Retenções Padrão (%)">
              <div className="grid grid-cols-3 gap-3">
                <Field label="% Material">
                  <Input
                    id="obra-mat"
                    name="obra-mat"
                    type="number"
                    min={0}
                    max={100}
                    step={0.01}
                    value={form.percentualMaterial}
                    onChange={(e) => set("percentualMaterial", e.target.value)}
                  />
                </Field>
                <Field label="ISS (%)">
                  <Input
                    id="obra-iss"
                    name="obra-iss"
                    type="number"
                    min={0}
                    max={100}
                    step={0.01}
                    value={form.aliquotaIss}
                    onChange={(e) => set("aliquotaIss", e.target.value)}
                  />
                </Field>
                <Field label="INSS (%)">
                  <Input
                    id="obra-inss"
                    name="obra-inss"
                    type="number"
                    min={0}
                    max={100}
                    step={0.01}
                    value={form.aliquotaInss}
                    onChange={(e) => set("aliquotaInss", e.target.value)}
                  />
                </Field>
                <Field label="CBS (%)">
                  <Input
                    id="obra-cbs"
                    name="obra-cbs"
                    type="number"
                    min={0}
                    max={100}
                    step={0.01}
                    value={form.aliquotaCbs}
                    onChange={(e) => set("aliquotaCbs", e.target.value)}
                  />
                </Field>
                <Field label="IBS (%)">
                  <Input
                    id="obra-ibs"
                    name="obra-ibs"
                    type="number"
                    min={0}
                    max={100}
                    step={0.01}
                    value={form.aliquotaIbs}
                    onChange={(e) => set("aliquotaIbs", e.target.value)}
                  />
                </Field>
              </div>
            </Section>

            {/* ── Observações ── */}
            <Section title="Observações">
              <Textarea
                id="obra-obs"
                name="obra-obs"
                value={form.observacoes}
                onChange={(e) => set("observacoes", e.target.value)}
                rows={3}
              />
            </Section>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={!form.nome.trim() || saving}>
              {saving ? "Salvando…" : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm Inactivate */}
      <Dialog open={!!confirmInactivate} onOpenChange={(v) => !v && setConfirmInactivate(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-display">Confirmar Inativação</DialogTitle>
          </DialogHeader>
          <p className="text-sm">
            Deseja realmente inativar esta obra? Ela será removida da listagem principal.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmInactivate(null)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (confirmInactivate) {
                  updateObra(confirmInactivate, { ativa: false });
                  setConfirmInactivate(null);
                }
              }}
            >
              Inativar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <DeleteConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && deleteObra(deleteTarget.id)}
        title="Excluir Obra"
        description={`Deseja realmente excluir "${deleteTarget?.nome}"? Esta ação é irreversível.`}
      />
    </div>
  );
};

export default Obras;
