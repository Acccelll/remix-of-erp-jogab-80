import { Link, useNavigate, useSearchParams, useParams, Outlet } from "react-router-dom";
import { useFiltrosPersistidos } from "@/hooks/useFiltrosPersistidos";
import { useEffect, useMemo, useState } from "react";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Plus,
  Pencil,
  Trash2,
  Building2,
  AlertCircle,
  Download,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import * as XLSX from "xlsx";
import { obrasRepo } from "@/lib/repositories/obras";
import { useClientes } from "@/hooks/crm/useClientes";
import { usePermissions } from "@/contexts/auth/usePermissions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import DatePickerField from "@/components/common/DatePickerField";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ShoppingCart } from "lucide-react";
import { useCarrinhoStore } from "@/hooks/financeiro/useCarrinhoStore";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { brl } from "@/lib/billing";
import { fmtData } from "@/lib/utils";
import { STORAGE_KEYS } from "@/lib/core/storage/keys";
import { StatusObraBadge, isAtrasada, type ObraStatus } from "@/components/obra/StatusObraBadge";
import { ChipsNumberInput } from "@/components/ui/chips-number-input";
import { MoneyInput } from "@/components/ui/money-input";
import { PercentInput } from "@/components/ui/percent-input";
import { DataTable, RowActions } from "@/components/ui/data-table";
import { validateObra, type ObraFormErrors } from "@/lib/schemas/obra";
import type { ColumnDef, SortingState, VisibilityState } from "@tanstack/react-table";
import { swallow } from "@/lib/core/errors";

const STATUS_OPTIONS: { value: ObraStatus; label: string }[] = [
  { value: "planejada", label: "Planejada" },
  { value: "em_andamento", label: "Em andamento" },
  { value: "paralisada", label: "Paralisada" },
  { value: "concluida", label: "Concluída" },
  { value: "cancelada", label: "Cancelada" },
];

const COLUMN_VIS_KEY = STORAGE_KEYS.obrasColumnVisibility;

const obrasSearchSchema = z.object({
  q: z.string().optional().catch(undefined),
  status: z.string().optional().catch(undefined),
  cliente: z.string().optional().catch(undefined),
  sort: z.string().optional().catch(undefined),
  dir: z.enum(["asc", "desc"]).optional().catch(undefined),
  page: z.coerce.number().int().min(1).optional().catch(undefined),
  new: z.coerce.number().int().optional().catch(undefined),
});

function ObrasPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { currentPlayer, hasAccess } = usePermissions();
  const canEdit = hasAccess("financeiro", "compras");
  const [searchParams, setSearchParams] = useSearchParams();
  useFiltrosPersistidos(STORAGE_KEYS.filtrosFinObras, ["q", "status", "cliente", "sort", "dir"]);
  const search = {
    q: searchParams.get("q") ?? undefined,
    status: searchParams.get("status") ?? undefined,
    cliente: searchParams.get("cliente") ?? undefined,
    new: searchParams.get("new") ? Number(searchParams.get("new")) : undefined,
    sort: searchParams.get("sort") ?? undefined,
    dir: (searchParams.get("dir") ?? undefined) as "asc" | "desc" | undefined,
    page: searchParams.get("page") ? Number(searchParams.get("page")) : undefined,
  };
  function patchSearch(patch: Record<string, string | undefined | null>) {
    setSearchParams(
      (p) => {
        const sp = new URLSearchParams(p);
        for (const [k, v] of Object.entries(patch)) {
          if (v == null || v === "") sp.delete(k);
          else sp.set(k, v);
        }
        // resetar página em mudança de filtro (exceto se foi explicitamente setada)
        if (!("page" in patch)) sp.delete("page");
        return sp;
      },
      { replace: true },
    );
  }

  const { itens: carrinho } = useCarrinhoStore();

  const {
    data: obras,
    isLoading: obrasLoading,
    isError: obrasError,
    refetch: refetchObras,
  } = useQuery({
    queryKey: ["obras"],
    queryFn: () => obrasRepo.listComCliente(),
  });
  const { data: clientes } = useClientes();

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>({});
  const [formErrors, setFormErrors] = useState<ObraFormErrors>({});
  const [editing, setEditing] = useState<any>(null);
  const [eform, setEform] = useState<any>({});
  const [eformErrors, setEformErrors] = useState<ObraFormErrors>({});
  const [deleting, setDeleting] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);

  // Visibilidade de colunas persistida em localStorage
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>(() => {
    try {
      const raw = localStorage.getItem(COLUMN_VIS_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem(COLUMN_VIS_KEY, JSON.stringify(columnVisibility));
    } catch (err) {
      swallow("FinObras.persistColumns", err, "localStorage indisponível");
    }
  }, [columnVisibility]);

  // Dados filtrados (status + cliente) antes de entregar à tabela.
  const filteredObras = useMemo(() => {
    const list = obras ?? [];
    return list.filter((o: any) => {
      if (search.status && (o.status ?? "em_andamento") !== search.status) return false;
      if (search.cliente && o.cliente_id !== search.cliente) return false;
      return true;
    });
  }, [obras, search.status, search.cliente]);

  // Cards de portfólio (sobre os dados filtrados)
  const portfolio = useMemo(() => {
    const valor = filteredObras.reduce((s: number, o: any) => s + Number(o.valor_contrato || 0), 0);
    const ativas = filteredObras.filter(
      (o: any) => (o.status ?? "em_andamento") === "em_andamento",
    ).length;
    const concluidas = filteredObras.filter((o: any) => o.status === "concluida").length;
    const atrasadas = filteredObras.filter((o: any) => isAtrasada(o)).length;
    return { total: filteredObras.length, valor, ativas, concluidas, atrasadas };
  }, [filteredObras]);

  function exportXlsx() {
    if (!filteredObras.length) {
      toast.info("Nenhuma obra para exportar com os filtros atuais.");
      return;
    }
    const rows = filteredObras.map((o: any) => ({
      Código: o.codigo ?? "",
      Obra: o.nome ?? "",
      Cliente: o.clientes?.nome ?? "",
      Status:
        STATUS_OPTIONS.find((s) => s.value === (o.status ?? "em_andamento"))?.label ??
        o.status ??
        "",
      Atrasada: isAtrasada(o) ? "Sim" : "",
      "Valor do contrato": Number(o.valor_contrato || 0),
      Início: o.data_inicio ?? "",
      Fim: o.data_fim ?? "",
      "Previsão término": o.data_previsao_termino ?? "",
      "Centro de custo TOTVS": o.centro_custo_totvs ?? "",
      Local: o.local ?? "",
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Obras");
    const ts = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(wb, `obras_${ts}.xlsx`);
  }

  // ?new=1 abre o diálogo (vindo da command palette / atalhos)
  useEffect(() => {
    if (search.new && !canEdit) {
      // sem permissão: limpa o param e não abre nada
      const sp = new URLSearchParams(searchParams);
      sp.delete("new");
      setSearchParams(sp, { replace: true });
      return;
    }
    if (search.new && !open) {
      setOpen(true);
      // limpa só o ?new, preservando demais filtros/sort/page
      const sp = new URLSearchParams(searchParams);
      sp.delete("new");
      setSearchParams(sp, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search.new]);

  function buildPayload(src: any) {
    return {
      cliente_id: src.cliente_id || null,
      codigo: src.codigo,
      nome: src.nome,
      pedido_contrato: src.pedido_contrato || null,
      centro_custo_totvs: src.centro_custo_totvs ? String(src.centro_custo_totvs).trim() : null,
      local: src.local || null,
      valor_contrato: Number(src.valor_contrato || 0),
      valor_antecipacao:
        src.valor_antecipacao != null && src.valor_antecipacao !== ""
          ? Number(src.valor_antecipacao)
          : null,
      data_inicio: src.data_inicio || null,
      data_fim: src.data_fim || null,
      data_previsao_termino: src.data_previsao_termino || null,
      regra_medicao: src.regra_medicao || null,
      prazo_emitir_nf_dias: src.prazo_emitir_nf_dias ? Number(src.prazo_emitir_nf_dias) : null,
      dias_ate_emissao_nf:
        src.dias_ate_emissao_nf != null && src.dias_ate_emissao_nf !== ""
          ? Number(src.dias_ate_emissao_nf)
          : 5,
      prazo_pagamento_dias: src.prazo_pagamento_dias ? Number(src.prazo_pagamento_dias) : null,
      dias_corte_bms: Array.isArray(src.dias_corte_bms) ? src.dias_corte_bms : [],
      dias_fixos_pagamento: Array.isArray(src.dias_fixos_pagamento) ? src.dias_fixos_pagamento : [],
      dia_fixo_pagamento:
        Array.isArray(src.dias_fixos_pagamento) && src.dias_fixos_pagamento.length
          ? src.dias_fixos_pagamento[0]
          : null,
      percentual_material:
        src.percentual_material != null && src.percentual_material !== ""
          ? Number(src.percentual_material)
          : 70,
      aliquota_iss:
        src.aliquota_iss != null && src.aliquota_iss !== "" ? Number(src.aliquota_iss) : 5,
      aliquota_inss:
        src.aliquota_inss != null && src.aliquota_inss !== "" ? Number(src.aliquota_inss) : 11,
      aliquota_cbs:
        src.aliquota_cbs != null && src.aliquota_cbs !== "" ? Number(src.aliquota_cbs) : 0,
      aliquota_ibs:
        src.aliquota_ibs != null && src.aliquota_ibs !== "" ? Number(src.aliquota_ibs) : 0,
      observacoes: src.observacoes || null,
    };
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (saving) return;
    if (!canEdit) return toast.error("Sem permissão para criar obras");
    const v = validateObra(form);
    if (!v.ok) {
      setFormErrors(v.errors);
      toast.error("Verifique os campos destacados");
      return;
    }
    setFormErrors({});
    setSaving(true);
    try {
      // TODO(auth): rever ao decidir Supabase Auth + RLS — hoje derivamos
      // o owner_id da identidade do AppContext; coluna é nullable.
      const ownerId = currentPlayer?.id ?? null;
      try {
        await obrasRepo.create({ owner_id: ownerId, ...buildPayload(form) });
      } catch (e) {
        return toast.error((e as Error).message);
      }
      toast.success("Obra criada");
      setOpen(false);
      setForm({});
      qc.invalidateQueries({ queryKey: ["obras"] });
    } finally {
      setSaving(false);
    }
  }

  function startEdit(o: any) {
    setEditing(o);
    setEform({
      codigo: o.codigo ?? "",
      nome: o.nome ?? "",
      cliente_id: o.cliente_id ?? "",
      pedido_contrato: o.pedido_contrato ?? "",
      centro_custo_totvs: o.centro_custo_totvs ?? "",
      local: o.local ?? "",
      valor_contrato: o.valor_contrato ?? "",
      valor_antecipacao: o.valor_antecipacao ?? "",
      data_inicio: o.data_inicio ?? "",
      data_fim: o.data_fim ?? "",
      data_previsao_termino: o.data_previsao_termino ?? "",
      regra_medicao: o.regra_medicao ?? "",
      prazo_emitir_nf_dias: o.prazo_emitir_nf_dias ?? "",
      dias_ate_emissao_nf: o.dias_ate_emissao_nf ?? 5,
      prazo_pagamento_dias: o.prazo_pagamento_dias ?? "",
      dias_corte_bms: Array.isArray(o.dias_corte_bms) ? o.dias_corte_bms : [],
      dias_fixos_pagamento: Array.isArray(o.dias_fixos_pagamento) ? o.dias_fixos_pagamento : [],
      percentual_material: o.percentual_material ?? "",
      aliquota_iss: o.aliquota_iss ?? "",
      aliquota_inss: o.aliquota_inss ?? "",
      aliquota_cbs: o.aliquota_cbs ?? "",
      aliquota_ibs: o.aliquota_ibs ?? "",
      observacoes: o.observacoes ?? "",
    });
  }

  async function saveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editing || savingEdit) return;
    const v = validateObra(eform);
    if (!v.ok) {
      setEformErrors(v.errors);
      toast.error("Verifique os campos destacados");
      return;
    }
    setEformErrors({});
    setSavingEdit(true);
    try {
      try {
        await obrasRepo.update(editing.id, buildPayload(eform));
      } catch (e) {
        return toast.error((e as Error).message);
      }
      toast.success("Obra atualizada");
      setEditing(null);
      qc.invalidateQueries({ queryKey: ["obras"] });
      qc.invalidateQueries({ queryKey: ["obra", editing.id] });
    } finally {
      setSavingEdit(false);
    }
  }

  async function doDelete() {
    if (!deleting) return;
    try {
      await obrasRepo.remove(deleting.id);
    } catch (e) {
      return toast.error((e as Error).message);
    }
    toast.success("Obra excluída");
    setDeleting(null);
    qc.invalidateQueries({ queryKey: ["obras"] });
  }

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <header className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Obras</h1>
          <p className="text-sm text-muted-foreground">Contratos em andamento e concluídos.</p>
        </div>
        {canEdit && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Nova obra
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Nova obra</DialogTitle>
              </DialogHeader>
              <form onSubmit={save} className="grid grid-cols-2 gap-3" noValidate>
                <ObraFormFields
                  state={form}
                  setState={setForm}
                  errors={formErrors}
                  clientes={clientes ?? []}
                />
                <DialogFooter className="col-span-2">
                  <Button type="submit" disabled={saving}>
                    Salvar
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        )}
        {carrinho.length > 0 && (
          <Button variant="outline" onClick={() => navigate("/financeiro/fluxo")}>
            <ShoppingCart className="h-4 w-4 mr-2" />
            Carrinho ({carrinho.length})
          </Button>
        )}
      </header>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar obra</DialogTitle>
          </DialogHeader>
          <form onSubmit={saveEdit} className="grid grid-cols-2 gap-3" noValidate>
            <ObraFormFields
              state={eform}
              setState={setEform}
              errors={eformErrors}
              clientes={clientes ?? []}
              isEdit
            />
            <DialogFooter className="col-span-2">
              <Button type="submit" disabled={savingEdit}>
                Salvar alterações
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Cards de portfólio */}
      {!obrasLoading && !obrasError && (obras ?? []).length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <PortfolioCard
            label="Obras"
            value={String(portfolio.total)}
            hint={`${portfolio.ativas} em andamento`}
          />
          <PortfolioCard
            label="Valor contratado"
            value={brl(portfolio.valor)}
            hint="Soma dos contratos filtrados"
          />
          <PortfolioCard label="Concluídas" value={String(portfolio.concluidas)} />
          <PortfolioCard
            label="Atrasadas"
            value={String(portfolio.atrasadas)}
            tone={portfolio.atrasadas > 0 ? "danger" : undefined}
          />
        </div>
      )}

      {/* Filtros */}
      {!obrasLoading && !obrasError && (obras ?? []).length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <Select
            value={search.status ?? "all"}
            onValueChange={(v) => patchSearch({ status: v === "all" ? undefined : v })}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os status</SelectItem>
              {STATUS_OPTIONS.map((s) => (
                <SelectItem key={s.value} value={s.value}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={search.cliente ?? "all"}
            onValueChange={(v) => patchSearch({ cliente: v === "all" ? undefined : v })}
          >
            <SelectTrigger className="w-[220px]">
              <SelectValue placeholder="Cliente" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os clientes</SelectItem>
              {(clientes ?? []).map((c: any) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {(search.status || search.cliente) && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => patchSearch({ status: undefined, cliente: undefined })}
            >
              <X className="h-3 w-3 mr-1" /> Limpar filtros
            </Button>
          )}
          {(search.status || search.cliente) && (
            <div className="flex items-center gap-1 ml-1">
              {search.status && (
                <Badge variant="secondary" className="gap-1">
                  {STATUS_OPTIONS.find((s) => s.value === search.status)?.label ?? search.status}
                </Badge>
              )}
              {search.cliente && (
                <Badge variant="secondary" className="gap-1">
                  {(clientes ?? []).find((c: any) => c.id === search.cliente)?.nome ?? "Cliente"}
                </Badge>
              )}
            </div>
          )}
        </div>
      )}

      <Card>
        <CardContent className="pt-6">
          {obrasError ? (
            <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
              <AlertCircle className="h-8 w-8 text-destructive" />
              <div>
                <p className="font-medium">Não foi possível carregar as obras.</p>
                <p className="text-sm text-muted-foreground">
                  Verifique sua conexão e tente novamente.
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={() => refetchObras()}>
                Tentar novamente
              </Button>
            </div>
          ) : obrasLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-9 w-full" />
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : (obras ?? []).length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
              <Building2 className="h-10 w-10 text-muted-foreground/60" />
              <div>
                <p className="font-medium">Nenhuma obra cadastrada</p>
                <p className="text-sm text-muted-foreground">
                  Comece criando sua primeira obra para gerenciar contratos e medições.
                </p>
              </div>
              {canEdit && (
                <Button size="sm" onClick={() => setOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" /> Cadastrar primeira obra
                </Button>
              )}
            </div>
          ) : (
            <ObrasTable
              data={filteredObras}
              canEdit={canEdit}
              onRowClick={(o) => navigate(`/obras/${o.id}`)}
              onEdit={startEdit}
              onDelete={setDeleting}
              search={search}
              onSearchChange={(next) => patchSearch(next as any)}
              columnVisibility={columnVisibility}
              onColumnVisibilityChange={setColumnVisibility}
              onExport={exportXlsx}
            />
          )}
        </CardContent>
      </Card>

      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir a obra <strong>{deleting?.nome}</strong>? Esta ação não
              pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeleting(null)}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={doDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

type ObrasSearchState = {
  q?: string;
  status?: string;
  cliente?: string;
  sort?: string;
  dir?: "asc" | "desc";
  page?: number;
};

function PortfolioCard({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "danger";
}) {
  return (
    <Card>
      <CardContent className="pt-4 pb-4">
        <p className="text-xs text-muted-foreground uppercase tracking-wide">{label}</p>
        <p className={`text-2xl font-semibold mt-1 ${tone === "danger" ? "text-destructive" : ""}`}>
          {value}
        </p>
        {hint && <p className="text-xs text-muted-foreground mt-1">{hint}</p>}
      </CardContent>
    </Card>
  );
}

function ObrasTable({
  data,
  onRowClick,
  onEdit,
  onDelete,
  search,
  onSearchChange,
  canEdit,
  columnVisibility,
  onColumnVisibilityChange,
  onExport,
}: {
  data: any[];
  onRowClick: (o: any) => void;
  onEdit: (o: any) => void;
  onDelete: (o: any) => void;
  search?: ObrasSearchState;
  onSearchChange?: (next: Partial<ObrasSearchState>) => void;
  canEdit: boolean;
  columnVisibility?: VisibilityState;
  onColumnVisibilityChange?: (v: VisibilityState) => void;
  onExport?: () => void;
}) {
  const columns: ColumnDef<any>[] = [
    {
      accessorKey: "codigo",
      header: "Código",
      cell: ({ row }) => (
        <Link
          to={`/obras/${row.original.id}`}
          onClick={(e) => e.stopPropagation()}
          className="text-primary hover:underline font-medium"
        >
          {row.original.codigo}
        </Link>
      ),
    },
    { accessorKey: "nome", header: "Obra" },
    {
      id: "cliente",
      accessorFn: (o: any) => o.clientes?.nome ?? "",
      header: "Cliente",
      cell: ({ row }) => row.original.clientes?.nome ?? "—",
    },
    {
      id: "status",
      header: "Status",
      enableSorting: false,
      cell: ({ row }) => <StatusObraBadge obra={row.original} />,
    },
    {
      accessorKey: "data_inicio",
      header: "Início",
      cell: ({ row }) => fmtData(row.original.data_inicio),
    },
    {
      accessorKey: "data_fim",
      header: "Fim",
      cell: ({ row }) => fmtData(row.original.data_fim),
    },
    {
      accessorKey: "centro_custo_totvs",
      header: "C. Custo TOTVS",
      cell: ({ row }) => row.original.centro_custo_totvs ?? "—",
    },
    {
      accessorKey: "local",
      header: "Local",
      cell: ({ row }) => row.original.local ?? "—",
    },
    ...(canEdit
      ? ([
          {
            id: "acoes",
            header: () => <div className="text-right w-full">Ações</div>,
            enableSorting: false,
            cell: ({ row }) => (
              <RowActions>
                <Button size="sm" variant="ghost" onClick={() => onEdit(row.original)}>
                  <Pencil className="h-3 w-3 mr-1" />
                  Editar
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-destructive hover:text-destructive"
                  onClick={() => onDelete(row.original)}
                >
                  <Trash2 className="h-3 w-3 mr-1" />
                  Excluir
                </Button>
              </RowActions>
            ),
          },
        ] as ColumnDef<any>[])
      : []),
  ];

  // Colunas ocultas por padrão
  const defaultHidden = { centro_custo_totvs: false, local: false } as VisibilityState;
  const effectiveVisibility = { ...defaultHidden, ...(columnVisibility ?? {}) };

  const sorting: SortingState = search?.sort
    ? [{ id: search.sort, desc: search.dir === "desc" }]
    : [{ id: "codigo", desc: false }];

  const COLUMN_LABELS: Record<string, string> = {
    codigo: "Código",
    nome: "Obra",
    cliente: "Cliente",
    status: "Status",
    valor_contrato: "Valor",
    data_inicio: "Início",
    data_fim: "Fim",
    centro_custo_totvs: "C. Custo TOTVS",
    local: "Local",
  };

  const toolbar = (
    <>
      <Button variant="outline" size="sm" onClick={onExport}>
        <Download className="h-4 w-4 mr-2" /> Exportar
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm">
            <SlidersHorizontal className="h-4 w-4 mr-2" /> Colunas
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuLabel>Mostrar colunas</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {columns
            .filter((c) => c.id !== "acoes")
            .map((c) => {
              const id = (c.id ?? (c as any).accessorKey) as string;
              const label = COLUMN_LABELS[id] ?? id;
              const checked = effectiveVisibility[id] !== false;
              return (
                <DropdownMenuCheckboxItem
                  key={id}
                  checked={checked}
                  onCheckedChange={(v) =>
                    onColumnVisibilityChange?.({ ...effectiveVisibility, [id]: !!v })
                  }
                >
                  {label}
                </DropdownMenuCheckboxItem>
              );
            })}
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );

  return (
    <DataTable
      columns={columns}
      data={data}
      searchPlaceholder="Buscar por código, nome, cliente…"
      countLabel={(f, t) => `${f} ${f === 1 ? "obra" : "obras"}${f !== t ? ` (de ${t})` : ""}`}
      onRowClick={onRowClick}
      initialSorting={[{ id: "codigo", desc: false }]}
      globalFilter={search?.q ?? ""}
      onGlobalFilterChange={(v) => onSearchChange?.({ q: v || undefined, page: undefined })}
      sorting={sorting}
      onSortingChange={(s) => {
        const head = s[0];
        onSearchChange?.({ sort: head?.id, dir: head ? (head.desc ? "desc" : "asc") : undefined });
      }}
      pageIndex={search?.page ? Math.max(0, search.page - 1) : 0}
      onPageIndexChange={(i) => onSearchChange?.({ page: i === 0 ? undefined : i + 1 })}
      columnVisibility={effectiveVisibility}
      onColumnVisibilityChange={onColumnVisibilityChange}
      toolbar={toolbar}
    />
  );
}

function F({
  label,
  children,
  error,
}: {
  label: string;
  children: React.ReactNode;
  error?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

function ObraFormFields({
  state,
  setState,
  errors,
  isEdit,
  clientes,
}: {
  state: any;
  setState: (s: any) => void;
  errors?: ObraFormErrors;
  isEdit?: boolean;
  clientes: any[];
}) {
  const err = errors ?? {};
  return (
    <>
      <F label="Código *" error={err.codigo}>
        <Input
          value={state.codigo ?? ""}
          onChange={(e) => setState({ ...state, codigo: e.target.value })}
          aria-invalid={!!err.codigo}
        />
      </F>
      <F label="Nome *" error={err.nome}>
        <Input
          value={state.nome ?? ""}
          onChange={(e) => setState({ ...state, nome: e.target.value })}
          aria-invalid={!!err.nome}
        />
      </F>
      <F label="Cliente">
        <Select
          value={state.cliente_id ?? ""}
          onValueChange={(v) => {
            const c: any = (clientes ?? []).find((x: any) => x.id === v);
            setState({
              ...state,
              cliente_id: v,
              ...(isEdit
                ? {}
                : {
                    prazo_pagamento_dias:
                      state.prazo_pagamento_dias ?? c?.prazo_pagamento_dias ?? "",
                    dias_fixos_pagamento:
                      state.dias_fixos_pagamento ??
                      (Array.isArray(c?.dias_fixos_pagamento) && c.dias_fixos_pagamento.length
                        ? c.dias_fixos_pagamento
                        : c?.dia_fixo_pagamento
                          ? [c.dia_fixo_pagamento]
                          : []),
                    dias_ate_emissao_nf: state.dias_ate_emissao_nf ?? c?.prazo_emitir_nf_dias ?? 5,
                    prazo_emitir_nf_dias:
                      state.prazo_emitir_nf_dias ?? c?.prazo_emitir_nf_dias ?? "",
                    percentual_material: state.percentual_material ?? c?.percentual_material ?? "",
                    aliquota_iss: state.aliquota_iss ?? c?.aliquota_iss ?? "",
                    aliquota_inss: state.aliquota_inss ?? c?.aliquota_inss ?? "",
                    aliquota_cbs: state.aliquota_cbs ?? c?.aliquota_cbs ?? "",
                    aliquota_ibs: state.aliquota_ibs ?? c?.aliquota_ibs ?? "",
                  }),
            });
          }}
        >
          <SelectTrigger>
            <SelectValue placeholder="Selecione" />
          </SelectTrigger>
          <SelectContent>
            {(clientes ?? []).map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.nome}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </F>
      <F label="Pedido/Contrato">
        <Input
          value={state.pedido_contrato ?? ""}
          onChange={(e) => setState({ ...state, pedido_contrato: e.target.value })}
        />
      </F>
      <F label="Local">
        <Input
          value={state.local ?? ""}
          onChange={(e) => setState({ ...state, local: e.target.value })}
        />
      </F>
      <F label="Centro de Custo TOTVS">
        <Input
          placeholder="Ex.: 01.002.0202"
          value={state.centro_custo_totvs ?? ""}
          onChange={(e) => setState({ ...state, centro_custo_totvs: e.target.value })}
        />
      </F>
      <F label="Valor do contrato (R$) *" error={err.valor_contrato}>
        <MoneyInput
          value={state.valor_contrato ?? null}
          onChange={(v) => setState({ ...state, valor_contrato: v ?? "" })}
          aria-invalid={!!err.valor_contrato}
        />
      </F>
      <F label="Antecipação / Mobilização (% do contrato)">
        <PercentInput
          value={
            state.percentual_antecipacao_input ??
            (() => {
              const vc = Number(state.valor_contrato || 0);
              const va = Number(state.valor_antecipacao || 0);
              return vc > 0 && va > 0 ? Number(((va / vc) * 100).toFixed(4)) : null;
            })()
          }
          onChange={(pct) => {
            const vc = Number(state.valor_contrato || 0);
            const valor = pct != null && vc > 0 ? Math.round((pct / 100) * vc * 100) / 100 : "";
            setState({
              ...state,
              percentual_antecipacao_input: pct ?? "",
              valor_antecipacao: valor,
            });
          }}
        />
        {(() => {
          const vc = Number(state.valor_contrato || 0);
          const va = Number(state.valor_antecipacao || 0);
          if (vc <= 0 || va <= 0) return null;
          return <p className="text-xs text-muted-foreground mt-1">= {brl(va)}</p>;
        })()}
      </F>
      <F label="Início">
        <DatePickerField
          value={state.data_inicio ?? ""}
          onChange={(v) => setState({ ...state, data_inicio: v })}
        />
      </F>
      <F label="Fim" error={err.data_fim}>
        <DatePickerField
          value={state.data_fim ?? ""}
          onChange={(v) => setState({ ...state, data_fim: v })}
          aria-invalid={!!err.data_fim}
        />
      </F>
      <F label="Previsão de término">
        <DatePickerField
          value={state.data_previsao_termino ?? ""}
          onChange={(v) => setState({ ...state, data_previsao_termino: v })}
        />
      </F>
      <F label="Regra de medição">
        <Input
          placeholder="ex: Dia 15, Dias 15 e 30, Mensal"
          value={state.regra_medicao ?? ""}
          onChange={(e) => setState({ ...state, regra_medicao: e.target.value })}
        />
      </F>
      <div className="col-span-2 pt-2 mt-2 border-t">
        <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-2">
          Régua de medição e pagamento
        </div>
      </div>
      <F label="Dias de corte da BMS">
        <ChipsNumberInput
          value={state.dias_corte_bms ?? []}
          onChange={(v) => setState({ ...state, dias_corte_bms: v })}
          placeholder="Ex.: 15, 30"
        />
      </F>
      <F label="Dias até emissão da NFS">
        <Input
          type="number"
          min={0}
          placeholder="5"
          value={state.dias_ate_emissao_nf ?? ""}
          onChange={(e) => setState({ ...state, dias_ate_emissao_nf: e.target.value })}
        />
      </F>
      <F label="Prazo pagamento (DDL)">
        <Input
          type="number"
          value={state.prazo_pagamento_dias ?? ""}
          onChange={(e) => setState({ ...state, prazo_pagamento_dias: e.target.value })}
        />
      </F>
      <F label="Dias fixos de pagamento">
        <ChipsNumberInput
          value={state.dias_fixos_pagamento ?? []}
          onChange={(v) => setState({ ...state, dias_fixos_pagamento: v })}
          placeholder="Ex.: 1, 15"
        />
      </F>
      <div className="col-span-2 pt-2 mt-2 border-t">
        <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-2">
          Retenções padrão (usadas como sugestão nas NFs)
        </div>
      </div>
      <F label="% Material" error={err.percentual_material}>
        <PercentInput
          value={state.percentual_material ?? null}
          onChange={(v) => setState({ ...state, percentual_material: v ?? "" })}
          placeholder="70,00"
        />
      </F>
      <F label="ISS" error={err.aliquota_iss}>
        <PercentInput
          value={state.aliquota_iss ?? null}
          onChange={(v) => setState({ ...state, aliquota_iss: v ?? "" })}
          placeholder="5,00"
        />
      </F>
      <F label="INSS" error={err.aliquota_inss}>
        <PercentInput
          value={state.aliquota_inss ?? null}
          onChange={(v) => setState({ ...state, aliquota_inss: v ?? "" })}
          placeholder="11,00"
        />
      </F>
      <F label="CBS" error={err.aliquota_cbs}>
        <PercentInput
          value={state.aliquota_cbs ?? null}
          onChange={(v) => setState({ ...state, aliquota_cbs: v ?? "" })}
          placeholder="0,00"
        />
      </F>
      <F label="IBS" error={err.aliquota_ibs}>
        <PercentInput
          value={state.aliquota_ibs ?? null}
          onChange={(v) => setState({ ...state, aliquota_ibs: v ?? "" })}
          placeholder="0,00"
        />
      </F>
      <div className="col-span-2">
        <F label="Observações">
          <Textarea
            value={state.observacoes ?? ""}
            onChange={(e) => setState({ ...state, observacoes: e.target.value })}
          />
        </F>
      </div>
    </>
  );
}

export default ObrasPage;
