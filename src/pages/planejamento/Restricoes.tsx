import { useEffect, useMemo, useState } from "react";
import { useRequisicoesResumoObra } from "@/hooks/suprimentos/useRequisicoes";
import { profilesRepo } from "@/lib/repositories/admin";
import {
  pacotesTrabalhoRepo,
  pacoteRestricoesRepo,
  restricoesRepo,
} from "@/lib/repositories/planejamento";
import { useObras } from "@/hooks/obras/useObras";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import DatePickerField from "@/components/common/DatePickerField";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
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
import { Plus, ShieldAlert, Loader2, CheckCircle2, Link2, AlertTriangle } from "lucide-react";
import { formatSemana } from "@/lib/lastplanner/semana";
import { fmtDataLocal } from "@/lib/core/date";
import { PageLoading } from "@/components/common/PageLoading";
import { DataTable } from "@/components/ui/data-table";
import { EmptyState } from "@/components/common/EmptyState";
import type { ColumnDef } from "@tanstack/react-table";

const TIPO_LABEL: Record<string, string> = {
  projeto: "Projeto",
  material: "Material",
  mao_obra: "Mão de obra",
  equipamento: "Equipamento",
  area: "Área",
  seguranca: "Segurança",
  contrato: "Contrato",
  outro: "Outro",
};

type Restricao = {
  id: string;
  obra_id: string;
  tipo: string;
  descricao: string;
  responsavel_id: string | null;
  prazo: string | null;
  status: string;
  resolvida_em: string | null;
  card_id: string | null;
  requisicao_id: string | null;
  observacao: string | null;
  created_at: string;
};
type Obra = { id: string; nome: string };
type Profile = { id: string; login: string | null; email: string | null };
type Pacote = { id: string; descricao: string; obra_id: string; semana_inicio: string };
type Requisicao = { id: string; obra_id: string; observacao: string | null };
type PR = { pacote_id: string; restricao_id: string };

const hojeISO = () => new Date().toISOString().slice(0, 10);

export default function Restricoes() {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<Restricao[]>([]);
  const obrasQuery = useObras();
  const obras = useMemo<Obra[]>(
    () => (obrasQuery.data ?? []).map((o) => ({ id: o.id, nome: o.nome })),
    [obrasQuery.data],
  );
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [pacotes, setPacotes] = useState<Pacote[]>([]);
  const reqsQuery = useRequisicoesResumoObra(500);
  const [reqs, setReqs] = useState<Requisicao[]>([]);
  useEffect(() => {
    if (reqsQuery.data) setReqs(reqsQuery.data as unknown as Requisicao[]);
  }, [reqsQuery.data]);
  const [pr, setPr] = useState<PR[]>([]);

  const [filtroObra, setFiltroObra] = useState("todas");
  const [filtroTipo, setFiltroTipo] = useState("todos");
  const [filtroStatus, setFiltroStatus] = useState("aberta");
  const [vencidasOnly, setVencidasOnly] = useState(false);

  const [openForm, setOpenForm] = useState(false);
  const [editing, setEditing] = useState<Restricao | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    obra_id: "",
    tipo: "material",
    descricao: "",
    responsavel_id: "",
    prazo: "",
    card_id: "",
    requisicao_id: "",
    observacao: "",
  });

  const [openVinc, setOpenVinc] = useState<Restricao | null>(null);
  const [vincSel, setVincSel] = useState<Set<string>>(new Set());

  const obraById = useMemo(() => Object.fromEntries(obras.map((o) => [o.id, o.nome])), [obras]);
  const profById = useMemo(
    () => Object.fromEntries(profiles.map((p) => [p.id, p.login ?? p.email ?? p.id.slice(0, 8)])),
    [profiles],
  );
  const pacoteById = useMemo(() => Object.fromEntries(pacotes.map((p) => [p.id, p])), [pacotes]);

  const vinculadosPorRestricao = useMemo(() => {
    const m = new Map<string, string[]>();
    for (const link of pr) {
      const arr = m.get(link.restricao_id) ?? [];
      arr.push(link.pacote_id);
      m.set(link.restricao_id, arr);
    }
    return m;
  }, [pr]);

  async function load() {
    setLoading(true);
    const [restricoesRes, profilesRes, pacotesRes, linksRes] = await Promise.all([
      restricoesRepo.listCompleto().then((data) => ({ data, error: null as any })),
      profilesRepo.listMin().then((data) => ({ data, error: null as any })),
      pacotesTrabalhoRepo.listResumoObra().then((data) => ({ data, error: null as any })),
      pacoteRestricoesRepo.listComData().then((data) => ({ data, error: null as any })),
      reqsQuery.refetch(),
    ]);
    if (restricoesRes.error || profilesRes.error || pacotesRes.error || linksRes.error) {
      toast.error("Falha ao carregar restrições");
      setLoading(false);
      return;
    }
    setRows((restricoesRes.data ?? []) as Restricao[]);
    setProfiles((profilesRes.data ?? []) as unknown as Profile[]); // TODO(ARC-001/E-01): profiles.email ausente.
    setPacotes((pacotesRes.data ?? []) as Pacote[]);
    setPr((linksRes.data ?? []) as PR[]);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  function openNew() {
    setEditing(null);
    setForm({
      obra_id: obras[0]?.id ?? "",
      tipo: "material",
      descricao: "",
      responsavel_id: "",
      prazo: "",
      card_id: "",
      requisicao_id: "",
      observacao: "",
    });
    setOpenForm(true);
  }

  function openEdit(r: Restricao) {
    setEditing(r);
    setForm({
      obra_id: r.obra_id,
      tipo: r.tipo,
      descricao: r.descricao,
      responsavel_id: r.responsavel_id ?? "",
      prazo: r.prazo ?? "",
      card_id: r.card_id ?? "",
      requisicao_id: r.requisicao_id ?? "",
      observacao: r.observacao ?? "",
    });
    setOpenForm(true);
  }

  async function salvar() {
    if (!form.obra_id) return toast.error("Selecione a obra");
    if (!form.descricao.trim()) return toast.error("Informe a descrição");
    setSaving(true);
    const payload = {
      obra_id: form.obra_id,
      tipo: form.tipo,
      descricao: form.descricao.trim(),
      responsavel_id: form.responsavel_id || null,
      prazo: form.prazo || null,
      card_id: form.card_id || null,
      requisicao_id: form.requisicao_id || null,
      observacao: form.observacao || null,
    };
    const { error } = await restricoesRepo.upsert(editing?.id, payload);
    setSaving(false);
    if (error) return toast.error("Falha ao salvar");
    toast.success(editing ? "Restrição atualizada" : "Restrição criada");
    setOpenForm(false);
    await load();
  }

  async function alterarStatus(r: Restricao, novo: string) {
    const { error } = await restricoesRepo.updateStatus(r.id, novo);
    if (error) return toast.error("Falha");
    toast.success(novo === "resolvida" ? "Restrição resolvida" : "Status atualizado");
    await load();
  }

  function abrirVinculo(r: Restricao) {
    setOpenVinc(r);
    setVincSel(new Set(vinculadosPorRestricao.get(r.id) ?? []));
  }

  async function salvarVinculo() {
    if (!openVinc) return;
    const atuais = new Set(vinculadosPorRestricao.get(openVinc.id) ?? []);
    const toAdd = [...vincSel].filter((id) => !atuais.has(id));
    const toRem = [...atuais].filter((id) => !vincSel.has(id));

    if (toAdd.length > 0) {
      const { error } = await pacoteRestricoesRepo.vincular(openVinc.id, toAdd);
      if (error) return toast.error("Falha ao vincular");
    }
    if (toRem.length > 0) {
      const { error } = await pacoteRestricoesRepo.desvincular(openVinc.id, toRem);
      if (error) return toast.error("Falha ao desvincular");
    }
    toast.success("Vínculos atualizados");
    setOpenVinc(null);
    await load();
  }

  const filtradas = useMemo(() => {
    const h = hojeISO();
    return rows.filter((r) => {
      if (filtroObra !== "todas" && r.obra_id !== filtroObra) return false;
      if (filtroTipo !== "todos" && r.tipo !== filtroTipo) return false;
      if (filtroStatus !== "todos" && r.status !== filtroStatus) return false;
      if (vencidasOnly && !(r.status === "aberta" && r.prazo && r.prazo < h)) return false;
      return true;
    });
  }, [rows, filtroObra, filtroTipo, filtroStatus, vencidasOnly]);

  const pacotesDoVinculo = useMemo(() => {
    if (!openVinc) return [];
    return pacotes
      .filter((p) => p.obra_id === openVinc.obra_id)
      .sort((a, b) => a.semana_inicio.localeCompare(b.semana_inicio));
  }, [openVinc, pacotes]);

  const reqsDaObra = useMemo(
    () => reqs.filter((r) => !form.obra_id || r.obra_id === form.obra_id).slice(0, 100),
    [reqs, form.obra_id],
  );

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ShieldAlert className="h-6 w-6" />
            Restrições
          </h1>
          <p className="text-sm text-muted-foreground">
            Bloqueios que impedem os pacotes de ficarem prontos. Resolver libera o "vai".
          </p>
        </div>
        <Button onClick={openNew}>
          <Plus className="h-4 w-4 mr-2" />
          Nova Restrição
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <div>
          <Label className="text-xs">Obra</Label>
          <Select value={filtroObra} onValueChange={setFiltroObra}>
            <SelectTrigger>
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
          <Label className="text-xs">Tipo</Label>
          <Select value={filtroTipo} onValueChange={setFiltroTipo}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              {Object.entries(TIPO_LABEL).map(([k, v]) => (
                <SelectItem key={k} value={k}>
                  {v}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">Status</Label>
          <Select value={filtroStatus} onValueChange={setFiltroStatus}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              <SelectItem value="aberta">Aberta</SelectItem>
              <SelectItem value="resolvida">Resolvida</SelectItem>
              <SelectItem value="cancelada">Cancelada</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-end gap-2">
          <Checkbox
            id="venc"
            checked={vencidasOnly}
            onCheckedChange={(c) => setVencidasOnly(c === true)}
          />
          <Label htmlFor="venc" className="cursor-pointer text-sm">
            Apenas vencidas
          </Label>
        </div>
      </div>

      {loading || obrasQuery.isLoading ? (
        <PageLoading />
      ) : (
        <DataTable
          columns={restricaoColumns(
            obraById,
            profById,
            vinculadosPorRestricao,
            openEdit,
            abrirVinculo,
            alterarStatus,
          )}
          data={filtradas}
          hideSearch
          pageSize={50}
          emptyState={<EmptyState title="Nenhuma restrição encontrada." />}
        />
      )}

      {/* Form Dialog */}
      <Dialog open={openForm} onOpenChange={setOpenForm}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar Restrição" : "Nova Restrição"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Obra</Label>
                <Select
                  value={form.obra_id}
                  onValueChange={(v) => setForm({ ...form, obra_id: v })}
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
                <Label>Tipo</Label>
                <Select value={form.tipo} onValueChange={(v) => setForm({ ...form, tipo: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(TIPO_LABEL).map(([k, v]) => (
                      <SelectItem key={k} value={k}>
                        {v}
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
                placeholder="Ex: Aguardando projeto estrutural revisão B"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
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
              <div>
                <Label>Prazo</Label>
                <DatePickerField
                  value={form.prazo}
                  onChange={(v) => setForm({ ...form, prazo: v })}
                />
              </div>
            </div>
            <div>
              <Label>Requisição vinculada (opcional)</Label>
              <Select
                value={form.requisicao_id || "__none"}
                onValueChange={(v) => setForm({ ...form, requisicao_id: v === "__none" ? "" : v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none">— sem vínculo —</SelectItem>
                  {reqsDaObra.map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      {(r.observacao ?? r.id).slice(0, 60)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Observação</Label>
              <Textarea
                rows={2}
                value={form.observacao}
                onChange={(e) => setForm({ ...form, observacao: e.target.value })}
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

      {/* Vínculo Dialog */}
      <Dialog open={!!openVinc} onOpenChange={(o) => !o && setOpenVinc(null)}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Pacotes afetados por esta restrição</DialogTitle>
          </DialogHeader>
          <div className="max-h-96 overflow-y-auto space-y-1">
            {pacotesDoVinculo.length === 0 && (
              <div className="text-sm text-muted-foreground p-4 text-center">
                Sem pacotes nesta obra.
              </div>
            )}
            {pacotesDoVinculo.map((p) => {
              const checked = vincSel.has(p.id);
              return (
                <label
                  key={p.id}
                  className="flex items-center gap-3 p-2 rounded hover:bg-accent/40 cursor-pointer"
                >
                  <Checkbox
                    checked={checked}
                    onCheckedChange={(c) => {
                      const n = new Set(vincSel);
                      if (c === true) n.add(p.id);
                      else n.delete(p.id);
                      setVincSel(n);
                    }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{p.descricao}</div>
                    <div className="text-xs text-muted-foreground">
                      {formatSemana(p.semana_inicio)}
                    </div>
                  </div>
                </label>
              );
            })}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenVinc(null)}>
              Cancelar
            </Button>
            <Button onClick={salvarVinculo}>Salvar vínculos</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function restricaoColumns(
  obraById: Record<string, string>,
  profById: Record<string, string>,
  vinculadosPorRestricao: Map<string, unknown[]>,
  openEdit: (r: Restricao) => void,
  abrirVinculo: (r: Restricao) => void,
  alterarStatus: (r: Restricao, novo: string) => void,
): ColumnDef<Restricao, any>[] {
  return [
    {
      accessorKey: "descricao",
      header: "Descrição",
      cell: ({ row }) => (
        <button className="text-left hover:underline" onClick={() => openEdit(row.original)}>
          {row.original.descricao}
        </button>
      ),
    },
    {
      accessorKey: "obra_id",
      header: "Obra",
      cell: ({ row }) => obraById[row.original.obra_id] ?? "—",
    },
    {
      accessorKey: "tipo",
      header: "Tipo",
      cell: ({ row }) => (
        <Badge variant="outline">{TIPO_LABEL[row.original.tipo] ?? row.original.tipo}</Badge>
      ),
    },
    {
      accessorKey: "responsavel_id",
      header: "Resp.",
      cell: ({ row }) => (
        <span className="text-xs">
          {row.original.responsavel_id ? profById[row.original.responsavel_id] : "—"}
        </span>
      ),
    },
    {
      accessorKey: "prazo",
      header: "Prazo",
      cell: ({ row }) => {
        const r = row.original;
        const venc = r.status === "aberta" && r.prazo != null && r.prazo < hojeISO();
        return (
          <span className="text-xs whitespace-nowrap">
            {r.prazo ? (
              <span className={venc ? "text-destructive font-medium" : ""}>
                {venc && <AlertTriangle className="inline h-3 w-3 mr-1" />}
                {fmtDataLocal(r.prazo)}
              </span>
            ) : (
              "—"
            )}
          </span>
        );
      },
    },
    {
      id: "pacotes",
      header: "Pacotes",
      enableSorting: false,
      cell: ({ row }) => {
        const vinc = vinculadosPorRestricao.get(row.original.id)?.length ?? 0;
        return (
          <div className="text-center">
            <button
              className="text-xs hover:underline inline-flex items-center gap-1"
              onClick={() => abrirVinculo(row.original)}
            >
              <Link2 className="h-3 w-3" />
              {vinc}
            </button>
          </div>
        );
      },
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => {
        const r = row.original;
        return (
          <div className="text-center">
            {r.status === "aberta" && <Badge variant="destructive">Aberta</Badge>}
            {r.status === "resolvida" && (
              <Badge variant="default" className="gap-1">
                <CheckCircle2 className="h-3 w-3" />
                Resolvida
              </Badge>
            )}
            {r.status === "cancelada" && <Badge variant="secondary">Cancelada</Badge>}
          </div>
        );
      },
    },
    {
      id: "acoes",
      header: "",
      enableSorting: false,
      cell: ({ row }) => {
        const r = row.original;
        return (
          <div className="text-right">
            {r.status === "aberta" ? (
              <Button size="sm" variant="default" onClick={() => alterarStatus(r, "resolvida")}>
                Resolver
              </Button>
            ) : r.status === "resolvida" ? (
              <Button size="sm" variant="ghost" onClick={() => alterarStatus(r, "aberta")}>
                Reabrir
              </Button>
            ) : null}
          </div>
        );
      },
    },
  ];
}
