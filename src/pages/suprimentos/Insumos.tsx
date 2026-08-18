import { useMemo, useState } from "react";
import { useAuth } from "@/contexts/auth/useAuth";
import {
  useInsumosCompleto,
  useCreateInsumo,
  useUpdateInsumo,
  useToggleInsumoAtivo,
  useInsumosCustoReferencia,
} from "@/hooks/suprimentos/useInsumos";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
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
import { Plus, Search, Eye, EyeOff, Package, Pencil, Loader2 } from "lucide-react";
import { formatBRL } from "@/lib/core/currency";
import { PageLoading } from "@/components/common/PageLoading";
import { DataTable } from "@/components/ui/data-table";
import { EmptyState } from "@/components/common/EmptyState";
import type { ColumnDef } from "@tanstack/react-table";

type Insumo = {
  id: string;
  codigo: string | null;
  descricao: string;
  tipo: string;
  categoria: string | null;
  subcategoria: string | null;
  unidade: string;
  preco_unitario: number;
  fonte: string;
  referencia_externa: string | null;
  ativo: boolean;
  updated_at: string;
};

const TIPOS = ["material", "mao_obra", "equipamento", "servico"] as const;
const FONTES = ["proprio", "SINAPI", "SICRO", "TCPO", "outro"] as const;

const TIPO_LABEL: Record<string, string> = {
  material: "Material",
  mao_obra: "Mão de obra",
  equipamento: "Equipamento",
  servico: "Serviço",
};

const fmtMoney = (n: number) => formatBRL(n, { minDigits: 4 });

const Insumos = () => {
  const { currentPlayer } = useAuth();
  const canEdit = !!currentPlayer?.isGM; // RLS final é no servidor (GM ou setor Engenharia)
  const { data: insumosData = [], isLoading: loading } = useInsumosCompleto();
  const items = insumosData as Insumo[];
  const { data: custoReferenciaData = [] } = useInsumosCustoReferencia();
  const custoReferenciaPorInsumo = useMemo(() => {
    const map = new Map<string, number | null>();
    for (const c of custoReferenciaData) {
      map.set(c.insumo_id, c.preco_medio_comprado ?? c.preco_medio_cotado_vencedor ?? null);
    }
    return map;
  }, [custoReferenciaData]);
  const createMut = useCreateInsumo();
  const updateMut = useUpdateInsumo();
  const toggleMut = useToggleInsumoAtivo();
  const [search, setSearch] = useState("");
  const [filterTipo, setFilterTipo] = useState<string>("todos");
  const [showInactive, setShowInactive] = useState(false);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Insumo | null>(null);
  const saving = createMut.isPending || updateMut.isPending;

  const [descricao, setDescricao] = useState("");
  const [codigo, setCodigo] = useState("");
  const [tipo, setTipo] = useState<string>("material");
  const [categoria, setCategoria] = useState("");
  const [subcategoria, setSubcategoria] = useState("");
  const [unidade, setUnidade] = useState("");
  const [precoStr, setPrecoStr] = useState("");
  const [fonte, setFonte] = useState<string>("proprio");
  const [referencia, setReferencia] = useState("");
  const [ativo, setAtivo] = useState(true);


  const filtered = useMemo(() => {
    return items.filter((i) => {
      if (!showInactive && !i.ativo) return false;
      if (showInactive && i.ativo) return false;
      if (filterTipo !== "todos" && i.tipo !== filterTipo) return false;
      if (search) {
        const s = search.toLowerCase();
        return (
          i.descricao.toLowerCase().includes(s) ||
          (i.codigo || "").toLowerCase().includes(s) ||
          (i.referencia_externa || "").toLowerCase().includes(s)
        );
      }
      return true;
    });
  }, [items, search, filterTipo, showInactive]);

  const openForm = (i?: Insumo) => {
    if (i) {
      setEditing(i);
      setDescricao(i.descricao);
      setCodigo(i.codigo || "");
      setTipo(i.tipo);
      setCategoria(i.categoria || "");
      setSubcategoria(i.subcategoria || "");
      setUnidade(i.unidade);
      setPrecoStr(String(i.preco_unitario));
      setFonte(i.fonte);
      setReferencia(i.referencia_externa || "");
      setAtivo(i.ativo);
    } else {
      setEditing(null);
      setDescricao("");
      setCodigo("");
      setTipo("material");
      setCategoria("");
      setSubcategoria("");
      setUnidade("");
      setPrecoStr("");
      setFonte("proprio");
      setReferencia("");
      setAtivo(true);
    }
    setFormOpen(true);
  };

  const handleSave = async () => {
    const preco = Number(precoStr.replace(",", "."));
    if (!descricao.trim() || !unidade.trim() || Number.isNaN(preco) || preco < 0) {
      toast.error("Preencha descrição, unidade e preço (≥ 0).");
      return;
    }
    const payload = {
      descricao: descricao.trim(),
      codigo: codigo.trim() || null,
      tipo,
      categoria: categoria.trim() || null,
      subcategoria: subcategoria.trim() || null,
      unidade: unidade.trim(),
      preco_unitario: preco,
      fonte,
      referencia_externa: referencia.trim() || null,
      ativo,
    };
    try {
      if (editing) await updateMut.mutateAsync({ id: editing.id, patch: payload });
      else await createMut.mutateAsync(payload as any);
    } catch {
      return;
    }
    toast.success(editing ? "Insumo atualizado" : "Insumo criado");
    setFormOpen(false);
  };

  const toggleAtivo = async (i: Insumo) => {
    try {
      await toggleMut.mutateAsync({ id: i.id, ativo: !i.ativo });
    } catch {
      /* toast já emitido pelo hook */
    }
  };


  return (
    <div>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <h2 className="font-display text-2xl font-bold flex items-center gap-2">
          <Package className="h-6 w-6" /> Banco de Insumos
        </h2>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <Switch
              id="inativos-insumos"
              checked={showInactive}
              onCheckedChange={setShowInactive}
            />
            <Label htmlFor="inativos-insumos" className="text-sm">
              {showInactive ? (
                <EyeOff className="h-4 w-4 inline" />
              ) : (
                <Eye className="h-4 w-4 inline" />
              )}{" "}
              Inativos
            </Label>
          </div>
          {canEdit && (
            <Button onClick={() => openForm()} size="sm">
              <Plus className="h-4 w-4 mr-1" /> Novo Insumo
            </Button>
          )}
        </div>
      </div>

      <div className="flex gap-2 mb-4 flex-wrap">
        <div className="relative max-w-sm flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por descrição, código ou referência..."
            className="pl-9"
          />
        </div>
        <Select value={filterTipo} onValueChange={setFilterTipo}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os tipos</SelectItem>
            {TIPOS.map((t) => (
              <SelectItem key={t} value={t}>
                {TIPO_LABEL[t]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <PageLoading />
      ) : (
        <DataTable
          columns={insumoColumns(canEdit, openForm, toggleAtivo, custoReferenciaPorInsumo)}
          data={filtered}
          hideSearch
          pageSize={50}
          emptyState={<EmptyState title="Nenhum insumo encontrado." />}
        />
      )}

      <Dialog open={formOpen} onOpenChange={(v) => !v && setFormOpen(false)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-display">
              {editing ? "Editar Insumo" : "Novo Insumo"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Descrição *</Label>
              <Input
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                className="mt-1"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Código</Label>
                <Input
                  value={codigo}
                  onChange={(e) => setCodigo(e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Unidade *</Label>
                <Input
                  value={unidade}
                  onChange={(e) => setUnidade(e.target.value)}
                  placeholder="m³, kg, h, un..."
                  className="mt-1"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Tipo *</Label>
                <Select value={tipo} onValueChange={setTipo}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TIPOS.map((t) => (
                      <SelectItem key={t} value={t}>
                        {TIPO_LABEL[t]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Preço unitário (R$) *</Label>
                <Input
                  value={precoStr}
                  onChange={(e) => setPrecoStr(e.target.value)}
                  inputMode="decimal"
                  placeholder="0,0000"
                  className="mt-1"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Categoria</Label>
                <Input
                  value={categoria}
                  onChange={(e) => setCategoria(e.target.value)}
                  placeholder="Ex: Elétrico"
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Subcategoria</Label>
                <Input
                  value={subcategoria}
                  onChange={(e) => setSubcategoria(e.target.value)}
                  placeholder="Ex: Cabos"
                  className="mt-1"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Fonte</Label>
                <Select value={fonte} onValueChange={setFonte}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FONTES.map((f) => (
                      <SelectItem key={f} value={f}>
                        {f}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Referência externa</Label>
                <Input
                  value={referencia}
                  onChange={(e) => setReferencia(e.target.value)}
                  placeholder="Ex: SINAPI 88248"
                  className="mt-1"
                />
              </div>
            </div>
            <div className="flex items-center gap-2 pt-2">
              <Switch id="ativo-insumo" checked={ativo} onCheckedChange={setAtivo} />
              <Label htmlFor="ativo-insumo">Ativo</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Insumos;

function insumoColumns(
  canEdit: boolean,
  openForm: (i: Insumo) => void,
  toggleAtivo: (i: Insumo) => void,
  custoReferenciaPorInsumo: Map<string, number | null>,
): ColumnDef<Insumo, any>[] {
  const cols: ColumnDef<Insumo, any>[] = [
    {
      accessorKey: "codigo",
      header: "Código",
      cell: ({ row }) => (
        <span className="font-mono text-xs">{row.original.codigo || "—"}</span>
      ),
    },
    { accessorKey: "descricao", header: "Descrição" },
    {
      accessorKey: "tipo",
      header: "Tipo",
      cell: ({ row }) => (
        <Badge variant="secondary" className="text-xs">
          {TIPO_LABEL[row.original.tipo] || row.original.tipo}
        </Badge>
      ),
    },
    {
      id: "categoria",
      header: "Categoria",
      cell: ({ row }) => {
        const { categoria, subcategoria } = row.original;
        if (!categoria && !subcategoria) return <span className="text-muted-foreground">—</span>;
        return (
          <span className="text-xs text-muted-foreground">
            {[categoria, subcategoria].filter(Boolean).join(" > ")}
          </span>
        );
      },
    },
    { accessorKey: "unidade", header: "Un." },
    {
      accessorKey: "preco_unitario",
      header: "Preço unit.",
      cell: ({ row }) => {
        const cadastrado = Number(row.original.preco_unitario);
        const referencia = custoReferenciaPorInsumo.get(row.original.id);
        const divergente =
          referencia != null && Math.abs(referencia - cadastrado) > cadastrado * 0.05;
        return (
          <div className="text-right">
            <div className="tabular-nums">{formatBRL(cadastrado, { minDigits: 4 })}</div>
            {divergente && (
              <div className="text-[10px] text-muted-foreground tabular-nums">
                compra real: {formatBRL(referencia, { minDigits: 4 })}
              </div>
            )}
          </div>
        );
      },
    },
    {
      accessorKey: "fonte",
      header: "Fonte",
      cell: ({ row }) => (
        <>
          <Badge variant="outline" className="text-xs">
            {row.original.fonte}
          </Badge>
          {row.original.referencia_externa && (
            <span className="ml-2 text-xs text-muted-foreground">
              {row.original.referencia_externa}
            </span>
          )}
        </>
      ),
    },
  ];
  if (canEdit) {
    cols.push({
      id: "acoes",
      header: "",
      enableSorting: false,
      cell: ({ row }) => (
        <div className="flex gap-1 justify-end">
          <Button variant="ghost" size="sm" onClick={() => openForm(row.original)}>
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => toggleAtivo(row.original)}>
            {row.original.ativo ? "Inativar" : "Ativar"}
          </Button>
        </div>
      ),
    });
  }
  return cols;
}
