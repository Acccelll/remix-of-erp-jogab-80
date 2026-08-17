import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/contexts/auth/useAuth";
import { useObrasContext } from "@/contexts/ObrasContext";

import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { Calculator, Plus, Trash2, Loader2, CheckCircle2, Search } from "lucide-react";
import {
  custoUnitarioComposicao,
  valorItemOrcamento,
  custoAtividade,
} from "@/lib/orcamento/orcamento";
import { formatBRL } from "@/lib/core/currency";
import { PageLoading } from "@/components/common/PageLoading";
import {
  useComposicoes,
  useComposicaoItens,
  useInsumosPrecos,
  useAtividadesObra,
  useOrcamentoItensObra,
  useCreateOrcamentoItem,
  useDeleteOrcamentoItem,
  useAprovarOrcamentoBaseline,
  type Atividade,
  type OrcItem,
  type CompItem,
} from "@/hooks/suprimentos/useOrcamento";


const fmtBRL = (n: number) => formatBRL(n, { minDigits: 2 });

const Orcamento = () => {
  const { currentPlayer } = useAuth();
  const { obras } = useObrasContext();
  const canEdit = !!currentPlayer?.isGM;

  const [obraId, setObraId] = useState<string>("");
  const [selectedAtv, setSelectedAtv] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [aprovarOpen, setAprovarOpen] = useState(false);

  // form nova linha
  const [novoComp, setNovoComp] = useState<string>("none");
  const [novoDesc, setNovoDesc] = useState("");
  const [novoUn, setNovoUn] = useState("");
  const [novoQtd, setNovoQtd] = useState("");
  const [novoPreco, setNovoPreco] = useState("");

  // Queries (TanStack Query)
  const { data: comps = [] } = useComposicoes();
  const { data: compItens = [] } = useComposicaoItens();
  const { data: insumos = [] } = useInsumosPrecos();
  const {
    data: atividades = [],
    isFetching: loadingAtv,
  } = useAtividadesObra(obraId);
  const {
    data: itens = [],
    isFetching: loadingItens,
  } = useOrcamentoItensObra(obraId);
  const loading = !!obraId && (loadingAtv || loadingItens);

  const createItem = useCreateOrcamentoItem(obraId);
  const deleteItem = useDeleteOrcamentoItem(obraId);
  const aprovar = useAprovarOrcamentoBaseline(obraId);
  const savingLine = createItem.isPending;
  const aprovando = aprovar.isPending;

  // Reset seleção quando obra muda
  useEffect(() => {
    setSelectedAtv(null);
  }, [obraId]);

  const obrasOrd = useMemo(
    () => [...obras].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")),
    [obras],
  );

  const insumoPreco = useMemo(() => {
    const m = new Map<string, number>();
    insumos.forEach((i) => m.set(i.id, Number(i.preco_unitario)));
    return m;
  }, [insumos]);

  const compItensPor = useMemo(() => {
    const m = new Map<string, CompItem[]>();
    compItens.forEach((c) => {
      const arr = m.get(c.composicao_id) || [];
      arr.push(c);
      m.set(c.composicao_id, arr);
    });
    return m;
  }, [compItens]);

  const calcCustoComp = (compId: string) =>
    custoUnitarioComposicao(
      (compItensPor.get(compId) || []).map((it) => ({
        coeficiente: Number(it.coeficiente),
        preco_unitario: insumoPreco.get(it.insumo_id) ?? 0,
      })),
    );

  const itensPorAtv = useMemo(() => {
    const m = new Map<string, OrcItem[]>();
    itens.forEach((it) => {
      if (!it.cronograma_item_id) return;
      const arr = m.get(it.cronograma_item_id) || [];
      arr.push(it);
      m.set(it.cronograma_item_id, arr);
    });
    return m;
  }, [itens]);

  const totalAtv = (atvId: string) =>
    custoAtividade(
      (itensPorAtv.get(atvId) || []).map((i) => ({ valor_total: Number(i.valor_total ?? 0) })),
    );

  const atvFiltradas = useMemo(() => {
    const s = search.trim().toLowerCase();
    if (!s) return atividades;
    return atividades.filter((a) => (a.descricao || "").toLowerCase().includes(s));
  }, [atividades, search]);

  const totalObra = useMemo(
    () => custoAtividade(itens.map((i) => ({ valor_total: Number(i.valor_total ?? 0) }))),
    [itens],
  );

  const atvSel = atividades.find((a) => a.id === selectedAtv) || null;
  const linhasSel = selectedAtv ? itensPorAtv.get(selectedAtv) || [] : [];

  const handleCompChange = (v: string) => {
    setNovoComp(v);
    if (v === "none") return;
    const c = comps.find((x) => x.id === v);
    if (!c) return;
    setNovoDesc(c.descricao);
    setNovoUn(c.unidade);
    setNovoPreco(String(calcCustoComp(c.id)));
  };

  const addLine = async () => {
    if (!selectedAtv || !obraId) return;
    const qtd = Number(novoQtd.replace(",", "."));
    const preco = Number(novoPreco.replace(",", "."));
    if (!novoDesc.trim() || !novoUn.trim() || !Number.isFinite(qtd) || !Number.isFinite(preco)) {
      toast.error("Preencha descrição, unidade, quantidade e preço.");
      return;
    }
    const ordem = (linhasSel.length || 0) + 1;
    try {
      await createItem.mutateAsync({
        obra_id: obraId,
        cronograma_item_id: selectedAtv,
        composicao_id: novoComp === "none" ? null : novoComp,
        descricao: novoDesc.trim(),
        unidade: novoUn.trim(),
        quantidade: qtd,
        preco_unitario: preco,
        ordem,
      });
    } catch (e) {
      toast.error("Erro ao adicionar", { description: (e as Error).message });
      return;
    }
    toast.success("Linha adicionada");
    setNovoComp("none");
    setNovoDesc("");
    setNovoUn("");
    setNovoQtd("");
    setNovoPreco("");
  };

  const removeLine = async (id: string) => {
    try {
      await deleteItem.mutateAsync(id);
    } catch (e) {
      toast.error("Erro ao remover", { description: (e as Error).message });
    }
  };

  const aprovarBaseline = async () => {
    if (!obraId) return;
    try {
      await aprovar.mutateAsync();
    } catch (e: any) {
      setAprovarOpen(false);
      toast.error("Erro ao aprovar baseline", { description: e?.message });
      return;
    }
    setAprovarOpen(false);
    toast.success("Baseline atualizado a partir do orçamento atual");
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <h2 className="font-display text-2xl font-bold flex items-center gap-2">
          <Calculator className="h-6 w-6" /> Orçamento por Atividade
        </h2>
        <div className="flex items-center gap-3">
          <Select value={obraId} onValueChange={setObraId}>
            <SelectTrigger className="w-72">
              <SelectValue placeholder="Selecione uma obra" />
            </SelectTrigger>
            <SelectContent>
              {obrasOrd.map((o) => (
                <SelectItem key={o.id} value={o.id}>
                  {o.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {canEdit && obraId && (
            <Button variant="outline" size="sm" onClick={() => setAprovarOpen(true)}>
              <CheckCircle2 className="h-4 w-4 mr-1" /> Aprovar → Baseline
            </Button>
          )}
        </div>
      </div>

      {!obraId ? (
        <div className="text-center py-16 text-muted-foreground">
          Selecione uma obra para visualizar e lançar o orçamento.
        </div>
      ) : loading ? (
        <PageLoading />
      ) : (
        <>
          <div className="mb-3 flex items-center justify-between flex-wrap gap-2">
            <div className="text-sm text-muted-foreground">
              {atividades.length} atividade(s) · Total orçado:{" "}
              <span className="font-semibold text-foreground tabular-nums">
                {fmtBRL(totalObra)}
              </span>
            </div>
            <div className="relative max-w-xs w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar atividade..."
                className="pl-9 h-9"
              />
            </div>
          </div>

          <div className="grid grid-cols-12 gap-4">
            {/* Lista atividades */}
            <div className="col-span-12 lg:col-span-5 border border-border rounded-lg overflow-hidden bg-card">
              <div className="bg-muted/40 px-3 py-2 text-xs uppercase text-muted-foreground">
                Atividades
              </div>
              <div className="max-h-[60vh] overflow-y-auto divide-y divide-border">
                {atvFiltradas.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-6">
                    Nenhuma atividade.
                  </p>
                )}
                {atvFiltradas.map((a) => {
                  const total = totalAtv(a.id);
                  const isSel = a.id === selectedAtv;
                  const hasOrc = (itensPorAtv.get(a.id) || []).length > 0;
                  return (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() => setSelectedAtv(a.id)}
                      className={`w-full text-left px-3 py-2 hover:bg-muted/40 transition-colors ${
                        isSel ? "bg-primary/10 border-l-4 border-primary" : ""
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="text-xs text-muted-foreground">#{a.ordem}</p>
                          <p className="text-sm truncate">{a.descricao || "(sem descrição)"}</p>
                        </div>
                        <div className="text-right shrink-0">
                          {hasOrc ? (
                            <Badge variant="default" className="text-[10px] mb-1">
                              orçado
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-[10px] mb-1">
                              MS Project
                            </Badge>
                          )}
                          <p className="text-xs tabular-nums">
                            {fmtBRL(hasOrc ? total : Number(a.custo ?? 0))}
                          </p>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Detalhe atividade */}
            <div className="col-span-12 lg:col-span-7 border border-border rounded-lg overflow-hidden bg-card">
              {!atvSel ? (
                <div className="p-8 text-center text-muted-foreground text-sm">
                  Selecione uma atividade à esquerda para lançar/visualizar suas linhas de
                  orçamento.
                </div>
              ) : (
                <>
                  <div className="bg-muted/40 px-3 py-2">
                    <p className="text-xs text-muted-foreground">Atividade #{atvSel.ordem}</p>
                    <p className="text-sm font-medium">{atvSel.descricao || "(sem descrição)"}</p>
                    <div className="text-xs mt-1 flex gap-4">
                      <span>
                        Custo atual:{" "}
                        <span className="font-semibold tabular-nums">
                          {fmtBRL(Number(atvSel.custo ?? 0))}
                        </span>
                      </span>
                      <span>
                        Baseline:{" "}
                        <span className="font-semibold tabular-nums">
                          {fmtBRL(Number(atvSel.custo_baseline ?? 0))}
                        </span>
                      </span>
                    </div>
                  </div>

                  <div className="max-h-[40vh] overflow-y-auto">
                    {linhasSel.length === 0 ? (
                      <p className="text-xs text-muted-foreground text-center py-6">
                        Nenhuma linha. {canEdit ? "Adicione abaixo." : ""}
                      </p>
                    ) : (
                      <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="text-xs uppercase text-muted-foreground bg-muted/20 sticky top-0">
                          <tr>
                            <th className="text-left p-2">Descrição</th>
                            <th className="text-left p-2 w-16">Un.</th>
                            <th className="text-right p-2 w-20">Qtd.</th>
                            <th className="text-right p-2 w-28">Preço</th>
                            <th className="text-right p-2 w-28">Total</th>
                            {canEdit && <th className="w-8" />}
                          </tr>
                        </thead>
                        <tbody>
                          {linhasSel.map((l) => (
                            <tr key={l.id} className="border-t border-border">
                              <td className="p-2">{l.descricao}</td>
                              <td className="p-2">{l.unidade}</td>
                              <td className="p-2 text-right tabular-nums">{l.quantidade}</td>
                              <td className="p-2 text-right tabular-nums">
                                {fmtBRL(Number(l.preco_unitario))}
                              </td>
                              <td className="p-2 text-right tabular-nums font-medium">
                                {fmtBRL(
                                  Number(
                                    l.valor_total ??
                                      valorItemOrcamento(l.quantidade, l.preco_unitario),
                                  ),
                                )}
                              </td>
                              {canEdit && (
                                <td className="p-2">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => removeLine(l.id)}
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </Button>
                                </td>
                              )}
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr className="border-t border-border bg-muted/30">
                            <td colSpan={4} className="p-2 text-right font-medium">
                              Total da atividade
                            </td>
                            <td className="p-2 text-right tabular-nums font-bold">
                              {fmtBRL(totalAtv(atvSel.id))}
                            </td>
                            {canEdit && <td />}
                          </tr>
                        </tfoot>
                      </table>
                      </div>
                    )}
                  </div>

                  {canEdit && (
                    <div className="border-t border-border p-3 bg-muted/20">
                      <p className="text-xs font-medium mb-2">Nova linha</p>
                      <div className="grid grid-cols-12 gap-2">
                        <div className="col-span-12">
                          <Label className="text-xs">Composição (opcional)</Label>
                          <Select value={novoComp} onValueChange={handleCompChange}>
                            <SelectTrigger className="h-8 mt-1">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">— sem composição —</SelectItem>
                              {comps.map((c) => (
                                <SelectItem key={c.id} value={c.id}>
                                  {c.descricao} ({c.unidade})
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="col-span-6">
                          <Label className="text-xs">Descrição</Label>
                          <Input
                            className="h-8 mt-1"
                            value={novoDesc}
                            onChange={(e) => setNovoDesc(e.target.value)}
                          />
                        </div>
                        <div className="col-span-2">
                          <Label className="text-xs">Un.</Label>
                          <Input
                            className="h-8 mt-1"
                            value={novoUn}
                            onChange={(e) => setNovoUn(e.target.value)}
                          />
                        </div>
                        <div className="col-span-2">
                          <Label className="text-xs">Qtd.</Label>
                          <Input
                            className="h-8 mt-1 text-right"
                            inputMode="decimal"
                            value={novoQtd}
                            onChange={(e) => setNovoQtd(e.target.value)}
                          />
                        </div>
                        <div className="col-span-2">
                          <Label className="text-xs">Preço</Label>
                          <Input
                            className="h-8 mt-1 text-right"
                            inputMode="decimal"
                            value={novoPreco}
                            onChange={(e) => setNovoPreco(e.target.value)}
                          />
                        </div>
                      </div>
                      <div className="flex justify-end mt-2">
                        <Button size="sm" onClick={addLine} disabled={savingLine}>
                          {savingLine ? (
                            <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                          ) : (
                            <Plus className="h-3.5 w-3.5 mr-1" />
                          )}
                          Adicionar linha
                        </Button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </>
      )}

      <AlertDialog open={aprovarOpen} onOpenChange={setAprovarOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Aprovar orçamento como baseline?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação copia o custo atual de cada atividade para o campo de baseline
              (`custo_baseline`). Use isto após aprovar o orçamento — ele passa a ser a referência
              para EVM. Atividades sem orçamento mantêm o custo do MS Project.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={aprovando}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={aprovarBaseline} disabled={aprovando}>
              {aprovando && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              Aprovar baseline
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Orcamento;
