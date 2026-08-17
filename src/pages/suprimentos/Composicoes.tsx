import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/contexts/auth/useAuth";
import { suprimentosRepo } from "@/lib/repositories/suprimentos";
import { useInsumosAtivos } from "@/hooks/suprimentos/useInsumos";
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
import { Plus, Search, Eye, EyeOff, Layers, Pencil, Loader2, Trash2 } from "lucide-react";
import { custoUnitarioComposicao } from "@/lib/orcamento/orcamento";
import { formatBRL } from "@/lib/core/currency";
import { PageLoading } from "@/components/common/PageLoading";
import { DataTable } from "@/components/ui/data-table";
import { EmptyState } from "@/components/common/EmptyState";
import type { ColumnDef } from "@tanstack/react-table";

type Composicao = {
  id: string;
  codigo: string | null;
  descricao: string;
  unidade: string;
  fonte: string;
  ativo: boolean;
};

type Insumo = {
  id: string;
  descricao: string;
  unidade: string;
  preco_unitario: number;
  ativo: boolean;
};

type CompItem = {
  id?: string; // sem id => ainda não persistido
  insumo_id: string;
  coeficiente: number;
};

const FONTES = ["proprio", "SINAPI", "SICRO", "TCPO", "outro"] as const;

const fmtBRL4 = (n: number) => formatBRL(n, { minDigits: 4 });

const Composicoes = () => {
  const { currentPlayer } = useAuth();
  const canEdit = !!currentPlayer?.isGM;

  const [comps, setComps] = useState<Composicao[]>([]);
  const { data: insumosData = [] } = useInsumosAtivos();
  const insumos = insumosData as Insumo[];
  const [itensPorComp, setItensPorComp] = useState<Record<string, CompItem[]>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showInactive, setShowInactive] = useState(false);

  const [formOpen, setFormOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<Composicao | null>(null);

  const [descricao, setDescricao] = useState("");
  const [codigo, setCodigo] = useState("");
  const [unidade, setUnidade] = useState("");
  const [fonte, setFonte] = useState<string>("proprio");
  const [ativo, setAtivo] = useState(true);
  const [itens, setItens] = useState<CompItem[]>([]);

  const insumoById = useMemo(() => {
    const m = new Map<string, Insumo>();
    insumos.forEach((i) => m.set(i.id, i));
    return m;
  }, [insumos]);

  const load = async () => {
    setLoading(true);
    const [cr, cir] = await Promise.all([
      suprimentosRepo
        .listComposicoesTodas(
          "id, codigo, descricao, unidade, fonte, ativo, created_at, updated_at",
        )
        .then((data) => ({ data, error: null as any })),
      suprimentosRepo
        .listComposicaoItens("id,composicao_id,insumo_id,coeficiente")
        .then((data) => ({ data, error: null as any })),
    ]);
    if (cr.error) toast.error("Erro ao carregar composições", { description: cr.error.message });
    if (cir.error) toast.error("Erro ao carregar itens", { description: cir.error.message });
    setComps((cr.data || []) as Composicao[]);
    const grouped: Record<string, CompItem[]> = {};
    (cir.data || []).forEach((r: any) => {
      (grouped[r.composicao_id] ||= []).push({
        id: r.id,
        insumo_id: r.insumo_id,
        coeficiente: Number(r.coeficiente),
      });
    });
    setItensPorComp(grouped);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);


  const custoComp = (compId: string) => {
    const lst = itensPorComp[compId] || [];
    return custoUnitarioComposicao(
      lst.map((it) => ({
        coeficiente: it.coeficiente,
        preco_unitario: Number(insumoById.get(it.insumo_id)?.preco_unitario ?? 0),
      })),
    );
  };

  const custoFormItens = useMemo(
    () =>
      custoUnitarioComposicao(
        itens.map((it) => ({
          coeficiente: it.coeficiente,
          preco_unitario: Number(insumoById.get(it.insumo_id)?.preco_unitario ?? 0),
        })),
      ),
    [itens, insumoById],
  );

  const filtered = useMemo(() => {
    return comps.filter((c) => {
      if (!showInactive && !c.ativo) return false;
      if (showInactive && c.ativo) return false;
      if (search) {
        const s = search.toLowerCase();
        return c.descricao.toLowerCase().includes(s) || (c.codigo || "").toLowerCase().includes(s);
      }
      return true;
    });
  }, [comps, search, showInactive]);

  const openForm = (c?: Composicao) => {
    if (c) {
      setEditing(c);
      setDescricao(c.descricao);
      setCodigo(c.codigo || "");
      setUnidade(c.unidade);
      setFonte(c.fonte);
      setAtivo(c.ativo);
      setItens((itensPorComp[c.id] || []).map((it) => ({ ...it })));
    } else {
      setEditing(null);
      setDescricao("");
      setCodigo("");
      setUnidade("");
      setFonte("proprio");
      setAtivo(true);
      setItens([]);
    }
    setFormOpen(true);
  };

  const addItem = () => {
    const first = insumos[0];
    if (!first) {
      toast.error("Cadastre insumos antes de compor.");
      return;
    }
    setItens((p) => [...p, { insumo_id: first.id, coeficiente: 1 }]);
  };

  const updateItem = (idx: number, patch: Partial<CompItem>) => {
    setItens((p) => p.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  };

  const removeItem = (idx: number) => setItens((p) => p.filter((_, i) => i !== idx));

  const handleSave = async () => {
    if (!descricao.trim() || !unidade.trim()) {
      toast.error("Preencha descrição e unidade.");
      return;
    }
    if (
      itens.some((it) => !it.insumo_id || !Number.isFinite(it.coeficiente) || it.coeficiente < 0)
    ) {
      toast.error("Itens com insumo e coeficiente válidos (≥ 0).");
      return;
    }
    setSaving(true);
    try {
      const head = {
        descricao: descricao.trim(),
        codigo: codigo.trim() || null,
        unidade: unidade.trim(),
        fonte,
        ativo,
      };
      let compId = editing?.id;
      if (editing) {
        await suprimentosRepo.updateComposicao(editing.id, head);
      } else {
        compId = await suprimentosRepo.createComposicaoReturningId(head);
      }
      // Itens: estratégia simples — apaga todos e reinsere.
      await suprimentosRepo.deleteComposicaoItensByComposicao(compId!);
      if (itens.length > 0) {
        const insRes = await suprimentosRepo.insertComposicaoItens(
          itens.map((it) => ({
            composicao_id: compId!,
            insumo_id: it.insumo_id,
            coeficiente: it.coeficiente,
          })),
        );
        if (insRes.error) throw insRes.error;
      }
      toast.success(editing ? "Composição atualizada" : "Composição criada");
      setFormOpen(false);
      await load();
    } catch (e: any) {
      toast.error("Erro ao salvar", { description: e.message });
    } finally {
      setSaving(false);
    }
  };

  const toggleAtivo = async (c: Composicao) => {
    try {
      await suprimentosRepo.toggleComposicaoAtiva(c.id, !c.ativo);
    } catch (e) {
      toast.error("Erro ao alterar status", { description: (e as Error).message });
      return;
    }
    load();
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <h2 className="font-display text-2xl font-bold flex items-center gap-2">
          <Layers className="h-6 w-6" /> Composições
        </h2>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <Switch id="inativos-comp" checked={showInactive} onCheckedChange={setShowInactive} />
            <Label htmlFor="inativos-comp" className="text-sm">
              {showInactive ? (
                <EyeOff className="h-4 w-4 inline" />
              ) : (
                <Eye className="h-4 w-4 inline" />
              )}{" "}
              Inativos
            </Label>
          </div>
          {canEdit && (
            <Button size="sm" onClick={() => openForm()}>
              <Plus className="h-4 w-4 mr-1" /> Nova Composição
            </Button>
          )}
        </div>
      </div>

      <div className="relative max-w-sm mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por descrição ou código..."
          className="pl-9"
        />
      </div>

      {loading ? (
        <PageLoading />
      ) : (
        <DataTable
          columns={compColumns(canEdit, itensPorComp, custoComp, openForm, toggleAtivo)}
          data={filtered}
          hideSearch
          pageSize={50}
          emptyState={<EmptyState title="Nenhuma composição encontrada." />}
        />
      )}

      <Dialog open={formOpen} onOpenChange={(v) => !v && setFormOpen(false)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="font-display">
              {editing ? "Editar Composição" : "Nova Composição"}
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
            <div className="grid grid-cols-3 gap-3">
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
                  placeholder="m², m³..."
                  className="mt-1"
                />
              </div>
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
            </div>

            <div className="border border-border rounded-lg overflow-hidden">
              <div className="bg-muted/40 px-3 py-2 flex items-center justify-between">
                <span className="text-sm font-medium">Insumos da composição</span>
                <Button variant="outline" size="sm" onClick={addItem}>
                  <Plus className="h-3.5 w-3.5 mr-1" /> Adicionar insumo
                </Button>
              </div>
              {itens.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-6">
                  Nenhum insumo. Adicione ao menos um para calcular o custo unitário.
                </p>
              ) : (
                <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-xs uppercase text-muted-foreground bg-muted/20">
                    <tr>
                      <th className="text-left p-2">Insumo</th>
                      <th className="text-right p-2 w-28">Coef.</th>
                      <th className="text-right p-2 w-32">Preço unit.</th>
                      <th className="text-right p-2 w-32">Subtotal</th>
                      <th className="w-10" />
                    </tr>
                  </thead>
                  <tbody>
                    {itens.map((it, idx) => {
                      const ins = insumoById.get(it.insumo_id);
                      const preco = Number(ins?.preco_unitario ?? 0);
                      const sub = preco * (Number(it.coeficiente) || 0);
                      return (
                        <tr key={idx} className="border-t border-border">
                          <td className="p-2">
                            <Select
                              value={it.insumo_id}
                              onValueChange={(v) => updateItem(idx, { insumo_id: v })}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {insumos.map((i) => (
                                  <SelectItem key={i.id} value={i.id}>
                                    {i.descricao} ({i.unidade})
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </td>
                          <td className="p-2">
                            <Input
                              className="text-right"
                              inputMode="decimal"
                              value={String(it.coeficiente)}
                              onChange={(e) =>
                                updateItem(idx, {
                                  coeficiente: Number(e.target.value.replace(",", ".")) || 0,
                                })
                              }
                            />
                          </td>
                          <td className="p-2 text-right tabular-nums text-muted-foreground">
                            {fmtBRL4(preco)}
                          </td>
                          <td className="p-2 text-right tabular-nums">{fmtBRL4(sub)}</td>
                          <td className="p-2 text-right">
                            <Button variant="ghost" size="sm" onClick={() => removeItem(idx)}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-border bg-muted/30">
                      <td className="p-2 text-right font-medium" colSpan={3}>
                        Custo unitário
                      </td>
                      <td className="p-2 text-right tabular-nums font-bold">
                        {fmtBRL4(custoFormItens)}
                      </td>
                      <td />
                    </tr>
                  </tfoot>
                </table>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2 pt-1">
              <Switch id="ativo-comp" checked={ativo} onCheckedChange={setAtivo} />
              <Label htmlFor="ativo-comp">Ativa</Label>
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

export default Composicoes;

function compColumns(
  canEdit: boolean,
  itensPorComp: Record<string, CompItem[]>,
  custoComp: (id: string) => number,
  openForm: (c: Composicao) => void,
  toggleAtivo: (c: Composicao) => void,
): ColumnDef<Composicao, any>[] {
  const cols: ColumnDef<Composicao, any>[] = [
    {
      accessorKey: "codigo",
      header: "Código",
      cell: ({ row }) => (
        <span className="font-mono text-xs">{row.original.codigo || "—"}</span>
      ),
    },
    { accessorKey: "descricao", header: "Descrição" },
    { accessorKey: "unidade", header: "Un." },
    {
      id: "itens",
      header: "Itens",
      cell: ({ row }) => (
        <div className="text-right tabular-nums">
          {(itensPorComp[row.original.id] || []).length}
        </div>
      ),
    },
    {
      id: "custo",
      header: "Custo unit. (calc.)",
      cell: ({ row }) => (
        <div className="text-right tabular-nums">
          {formatBRL(custoComp(row.original.id), { minDigits: 4 })}
        </div>
      ),
    },
    {
      accessorKey: "fonte",
      header: "Fonte",
      cell: ({ row }) => (
        <Badge variant="outline" className="text-xs">
          {row.original.fonte}
        </Badge>
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
