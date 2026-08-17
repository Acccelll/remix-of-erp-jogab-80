import { useEffect, useMemo, useState } from "react";
import { suprimentosRepo } from "@/lib/repositories/suprimentos";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Plus, Search, ClipboardList, Loader2, AlertTriangle } from "lucide-react";
import { saldoOrcado } from "@/lib/suprimentos/saldo-orcado";
import {
  useRequisicoesAll,
  useCreateRequisicao,
  useUpdateRequisicaoStatus,
} from "@/hooks/suprimentos/useRequisicoes";
import { useObras } from "@/hooks/obras/useObras";
import { useObrasEditaveis } from "@/hooks/obras/useObrasEditaveis";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { emitirNumeroCustomizado } from "@/lib/empresa/numeracao-documentos";
import {
  getDocumentoNumeroLocal,
  listDocumentoNumeracaoLocal,
  registrarDocumentoNumeroLocal,
  type DocumentoNumeracaoLocal,
} from "@/lib/empresa/documento-numeracao-local";

type Requisicao = {
  id: string;
  obra_id: string;
  orcamento_item_id: string | null;
  insumo_id: string | null;
  card_recurso_id: string | null;
  quantidade: number;
  status: string;
  observacao: string | null;
  created_at: string;
};

type OrcamentoItem = {
  id: string;
  obra_id: string;
  descricao: string;
  unidade: string;
  quantidade: number;
};

type ObraMin = { id: string; nome: string };

import {
  STATUS_REQUISICAO_LABEL as STATUS_LABEL,
  STATUS_REQUISICAO_VARIANT as STATUS_VARIANT,
} from "@/lib/status";
import { PageLoading } from "@/components/common/PageLoading";

const fmtQtd = (n: number) =>
  n.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 4 });

const Requisicoes = () => {
  const { canEditObra } = useObrasEditaveis();
  const { empresaAtualId } = useEmpresa();
  const [items, setItems] = useState<Requisicao[]>([]);
  const [numeracoesDocumento, setNumeracoesDocumento] = useState<DocumentoNumeracaoLocal[]>(() =>
    listDocumentoNumeracaoLocal("requisicao"),
  );
  const obrasQuery = useObras();
  const obras = useMemo<ObraMin[]>(
    () => (obrasQuery.data ?? []).map((o) => ({ id: o.id, nome: o.nome })),
    [obrasQuery.data],
  );
  const [orcamentoItens, setOrcamentoItens] = useState<OrcamentoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterObra, setFilterObra] = useState<string>("todas");
  const [filterStatus, setFilterStatus] = useState<string>("ativas");

  const [formOpen, setFormOpen] = useState(false);
  const [obraId, setObraId] = useState<string>("");
  const [orcItemId, setOrcItemId] = useState<string>("");
  const [quantidade, setQuantidade] = useState<string>("");
  const [observacao, setObservacao] = useState("");

  const requisicoesQuery = useRequisicoesAll();
  const createMut = useCreateRequisicao();
  const statusMut = useUpdateRequisicaoStatus();
  const saving = createMut.isPending;

  // Sincroniza cache de requisições no state local (mantém API existente da UI)
  useEffect(() => {
    if (requisicoesQuery.data) setItems(requisicoesQuery.data as Requisicao[]);
  }, [requisicoesQuery.data]);

  const load = async () => {
    setLoading(true);
    const [reqRefetch, orcRes] = await Promise.all([
      requisicoesQuery.refetch(),
      suprimentosRepo
        .listOrcamentoItensDetalhado("id,obra_id,descricao,unidade,quantidade")
        .then((data) => ({ data, error: null as any }))
        .catch((error) => ({ data: [] as any[], error })),
    ]);
    if (reqRefetch.error)
      toast.error("Falha ao carregar requisições: " + (reqRefetch.error as any)?.message);
    if (orcRes.error) toast.error("Falha ao carregar orçamento: " + orcRes.error.message);
    setOrcamentoItens((orcRes.data ?? []) as OrcamentoItem[]);
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


  const obrasById = useMemo(() => new Map(obras.map((o) => [o.id, o])), [obras]);
  const orcById = useMemo(() => new Map(orcamentoItens.map((i) => [i.id, i])), [orcamentoItens]);

  /** Itens de orçamento da obra escolhida no form. */
  const orcDaObraForm = useMemo(
    () => orcamentoItens.filter((i) => i.obra_id === obraId),
    [orcamentoItens, obraId],
  );

  /** Soma de requisições vivas (não canceladas) do item escolhido. */
  const previewSaldo = useMemo(() => {
    const item = orcItemId ? orcById.get(orcItemId) : null;
    if (!item) return null;
    const requisicoesDoItem = items.filter((r) => r.orcamento_item_id === orcItemId);
    const qty = Number((quantidade || "0").replace(",", "."));
    // Simula incluir o pedido em digitação (status 'aberta')
    const simulado = [...requisicoesDoItem, { quantidade: Number.isFinite(qty) ? qty : 0 }];
    return {
      item,
      atual: saldoOrcado(item, requisicoesDoItem),
      simulado: saldoOrcado(item, simulado),
    };
  }, [orcItemId, orcById, items, quantidade]);

  const openForm = () => {
    setObraId("");
    setOrcItemId("");
    setQuantidade("");
    setObservacao("");
    setFormOpen(true);
  };

  const handleSave = async () => {
    if (!obraId) {
      toast.error("Escolha a obra.");
      return;
    }
    if (!canEditObra(obraId)) {
      toast.error("Você não tem permissão para criar requisições nesta obra.");
      return;
    }
    const qty = Number((quantidade || "0").replace(",", "."));
    if (!Number.isFinite(qty) || qty <= 0) {
      toast.error("Quantidade inválida.");
      return;
    }
    const item = orcItemId ? orcById.get(orcItemId) : null;
    const requisicaoId = crypto.randomUUID();
    const numeroParametrizado = emitirNumeroCustomizado(empresaAtualId, "requisicao");
    const payload = {
      id: requisicaoId,
      obra_id: obraId,
      orcamento_item_id: orcItemId || null,
      insumo_id: null, // 5A.2: usa o insumo via orcamento_item; ligação direta fica para 5A.3
      quantidade: qty,
      observacao: observacao.trim() || (item ? item.descricao : null),
      status: "aberta",
    };
    try {
      await createMut.mutateAsync(payload as any);
    } catch {
      numeroParametrizado?.rollback();
      return;
    }
    if (numeroParametrizado) {
      registrarDocumentoNumeroLocal({
        documentoId: requisicaoId,
        tipo: "requisicao",
        empresaId: empresaAtualId ?? undefined,
        numero: numeroParametrizado.numero,
        sequencial: numeroParametrizado.emitido,
      });
      setNumeracoesDocumento(listDocumentoNumeracaoLocal("requisicao"));
    }
    toast.success(
      numeroParametrizado
        ? `Requisição ${numeroParametrizado.numero} criada.`
        : "Requisição criada.",
    );
    setFormOpen(false);
  };

  const changeStatus = async (id: string, status: string) => {
    const req = items.find((r) => r.id === id);
    if (req && !canEditObra(req.obra_id)) {
      toast.error("Você não tem permissão para alterar requisições desta obra.");
      return;
    }
    try {
      await statusMut.mutateAsync({ id, status });
    } catch {
      return;
    }
    toast.success("Status atualizado.");
  };


  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((r) => {
      if (filterObra !== "todas" && r.obra_id !== filterObra) return false;
      if (filterStatus === "ativas" && r.status === "cancelada") return false;
      if (filterStatus !== "ativas" && filterStatus !== "todas" && r.status !== filterStatus)
        return false;
      if (!q) return true;
      const obra = obrasById.get(r.obra_id);
      const orc = r.orcamento_item_id ? orcById.get(r.orcamento_item_id) : null;
      return (
        (obra?.nome ?? "").toLowerCase().includes(q) ||
        (orc?.descricao ?? "").toLowerCase().includes(q) ||
        (r.observacao ?? "").toLowerCase().includes(q)
      );
    });
  }, [items, search, filterObra, filterStatus, obrasById, orcById]);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-display text-2xl font-bold flex items-center gap-2">
          <ClipboardList className="h-6 w-6" /> Requisições
        </h2>
        <Button size="sm" onClick={openForm}>
          <Plus className="h-4 w-4 mr-1" /> Nova Requisição
        </Button>
      </div>

      <div className="flex flex-wrap gap-3 mb-4">
        <div className="relative max-w-sm flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar..."
            className="pl-9"
          />
        </div>
        <Select value={filterObra} onValueChange={setFilterObra}>
          <SelectTrigger className="w-[220px]">
            <SelectValue placeholder="Obra" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas as obras</SelectItem>
            {obras.map((o) => (
              <SelectItem key={o.id} value={o.id}>
                {o.nome}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ativas">Ativas (exceto canceladas)</SelectItem>
            <SelectItem value="todas">Todas</SelectItem>
            <SelectItem value="aberta">Abertas</SelectItem>
            <SelectItem value="cotando">Cotando</SelectItem>
            <SelectItem value="atendida">Atendidas</SelectItem>
            <SelectItem value="cancelada">Canceladas</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading || obrasQuery.isLoading ? (
        <PageLoading />
      ) : filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center">Nenhuma requisição.</p>
      ) : (
        <div className="grid gap-2">
          {filtered.map((r) => {
            const obra = obrasById.get(r.obra_id);
            const orc = r.orcamento_item_id ? orcById.get(r.orcamento_item_id) : null;
            const requisicoesDoItem = orc
              ? items.filter((x) => x.orcamento_item_id === orc.id)
              : [];
            const saldo = orc ? saldoOrcado(orc, requisicoesDoItem) : null;
            const podeEditarObra = canEditObra(r.obra_id);
            const numeracaoLocal =
              numeracoesDocumento.find((n) => n.documentoId === r.id) ??
              getDocumentoNumeroLocal(r.id, "requisicao");
            const numeroExibido = numeracaoLocal?.numero ?? `REQ-${r.id.slice(-6).toUpperCase()}`;
            return (
              <div
                key={r.id}
                className="bg-card border border-border rounded-lg p-4 flex items-start gap-4"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="outline" className="text-xs font-mono">
                      {numeroExibido}
                    </Badge>
                    <p className="font-medium truncate">
                      {orc?.descricao ?? r.observacao ?? "(sem descrição)"}
                    </p>
                    <Badge variant={STATUS_VARIANT[r.status] ?? "outline"} className="text-xs">
                      {STATUS_LABEL[r.status] ?? r.status}
                    </Badge>
                    {saldo?.excedido && (
                      <Badge
                        variant="outline"
                        className="text-xs border-destructive text-destructive bg-destructive/10"
                      >
                        <AlertTriangle className="h-3 w-3 mr-1" /> Excedido
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground truncate mt-1">
                    {obra?.nome ?? "(obra removida)"}
                    {orc
                      ? ` · ${fmtQtd(r.quantidade)} ${orc.unidade}`
                      : ` · qtd ${fmtQtd(r.quantidade)}`}
                  </p>
                  {saldo && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Orçado {fmtQtd(saldo.orcado)} {orc!.unidade} · requisitado{" "}
                      {fmtQtd(saldo.requisitado)} · saldo{" "}
                      <span className={saldo.excedido ? "text-destructive font-medium" : ""}>
                        {fmtQtd(saldo.saldo)}
                      </span>
                    </p>
                  )}
                </div>
                <div className="flex flex-col gap-1 items-end">
                  {r.status === "aberta" && podeEditarObra && (
                    <Button size="sm" variant="ghost" onClick={() => changeStatus(r.id, "cotando")}>
                      Cotar
                    </Button>
                  )}
                  {r.status === "cotando" && podeEditarObra && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => changeStatus(r.id, "atendida")}
                    >
                      Marcar atendida
                    </Button>
                  )}
                  {r.status !== "cancelada" && r.status !== "atendida" && podeEditarObra && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => changeStatus(r.id, "cancelada")}
                    >
                      Cancelar
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={formOpen} onOpenChange={(v) => !v && setFormOpen(false)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-display">Nova Requisição</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Obra *</Label>
              <Select
                value={obraId}
                onValueChange={(v) => {
                  setObraId(v);
                  setOrcItemId("");
                }}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Selecione a obra" />
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
              <Label>Item do Orçamento</Label>
              <Select value={orcItemId} onValueChange={setOrcItemId} disabled={!obraId}>
                <SelectTrigger className="mt-1">
                  <SelectValue
                    placeholder={
                      obraId ? "Selecione o item (opcional)" : "Selecione a obra primeiro"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {orcDaObraForm.length === 0 ? (
                    <div className="px-2 py-1.5 text-xs text-muted-foreground">
                      Esta obra não tem itens de orçamento.
                    </div>
                  ) : (
                    orcDaObraForm.map((i) => (
                      <SelectItem key={i.id} value={i.id}>
                        {i.descricao} ({i.unidade})
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Quantidade *</Label>
              <Input
                value={quantidade}
                onChange={(e) => setQuantidade(e.target.value)}
                placeholder="0,00"
                className="mt-1"
              />
            </div>
            {previewSaldo && (
              <div
                className={`text-xs rounded-md border p-2 ${
                  previewSaldo.simulado.excedido
                    ? "border-destructive/50 bg-destructive/10 text-destructive"
                    : "border-border bg-muted/50 text-muted-foreground"
                }`}
              >
                <div className="flex items-center gap-1 font-medium">
                  {previewSaldo.simulado.excedido && <AlertTriangle className="h-3 w-3" />}
                  Saldo do item: {fmtQtd(previewSaldo.atual.saldo)} {previewSaldo.item.unidade}
                </div>
                <div>
                  Orçado {fmtQtd(previewSaldo.atual.orcado)} · já requisitado{" "}
                  {fmtQtd(previewSaldo.atual.requisitado)}
                </div>
                {previewSaldo.simulado.excedido && (
                  <div className="mt-1">
                    Esta requisição excederia o orçado em {fmtQtd(previewSaldo.simulado.excesso)}{" "}
                    {previewSaldo.item.unidade}.
                  </div>
                )}
              </div>
            )}
            <div>
              <Label>Observação</Label>
              <Input
                value={observacao}
                onChange={(e) => setObservacao(e.target.value)}
                placeholder="(opcional)"
                className="mt-1"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving || !obraId || !quantidade || !canEditObra(obraId)}
              title={obraId && !canEditObra(obraId) ? "Sem permissão nesta obra" : undefined}
            >
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Requisicoes;
