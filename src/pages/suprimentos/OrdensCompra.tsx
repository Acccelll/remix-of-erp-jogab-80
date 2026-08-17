import { useEffect, useMemo, useState } from "react";
import { useFornecedoresContatos } from "@/hooks/suprimentos/useFornecedores";
import { useRequisicoesAll } from "@/hooks/suprimentos/useRequisicoes";
import { suprimentosRepo } from "@/lib/repositories/suprimentos";
import { useAuth } from "@/contexts/auth/useAuth";
import { exportOrdemCompraToPDF } from "@/lib/suprimentos/export-pdf";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { empresaParametrizacaoRepo, getInstitucionalHeaderLines } from "@/lib/empresa/parametrizacao";
import { emitirNumeroCustomizado } from "@/lib/empresa/numeracao-documentos";
import {
  getDocumentoNumeroLocal,
  listDocumentoNumeracaoLocal,
  registrarDocumentoNumeroLocal,
  type DocumentoNumeracaoLocal,
} from "@/lib/empresa/documento-numeracao-local";
import {
  listSuprimentoEnvios,
  registrarSuprimentoEnvio,
  subscribeSuprimentoEnvios,
  type SuprimentoEnvio,
} from "@/lib/suprimentos/envios";
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
import { Plus, FileText, Loader2, Trash2, Send, CheckCircle2, XCircle } from "lucide-react";
import { useObras } from "@/hooks/obras/useObras";
import { useObrasEditaveis } from "@/hooks/obras/useObrasEditaveis";
import { formatBRL } from "@/lib/core/currency";
import { fmtDataLocal } from "@/lib/core/date";

type OC = {
  id: string;
  obra_id: string;
  fornecedor_id: string;
  numero: number;
  status: string;
  status_aprovacao: string;
  valor_total: number;
  emitida_em: string | null;
  observacao: string | null;
  created_at: string;
};

type OCItem = {
  id: string;
  ordem_compra_id: string;
  requisicao_id: string | null;
  insumo_id: string | null;
  descricao: string;
  quantidade: number;
  preco_unitario: number;
  valor_total: number | null;
};

type Cotacao = { id: string; requisicao_id: string; status: string };
type Proposta = {
  id: string;
  cotacao_id: string;
  fornecedor_id: string;
  preco_unitario: number;
  escolhida: boolean;
};
type Req = {
  id: string;
  obra_id: string;
  orcamento_item_id: string | null;
  quantidade: number;
  observacao: string | null;
  status: string;
};
type OrcItem = { id: string; descricao: string; unidade: string };
type Obra = { id: string; nome: string };
type Fornecedor = {
  id: string;
  razao_social: string;
  nome_fantasia?: string | null;
  contato?: string | null;
  email?: string | null;
  telefone?: string | null;
};

import {
  STATUS_OC_LABEL as STATUS_LABEL,
  STATUS_OC_VARIANT as STATUS_VARIANT,
} from "@/lib/status";
import { PageLoading } from "@/components/common/PageLoading";

const APR_LABEL: Record<string, string> = {
  pendente: "Aprovação pendente",
  aprovada: "Aprovada",
  rejeitada: "Rejeitada",
};

const fmtBRL = (n: number) => formatBRL(n);
const fmtQtd = (n: number) =>
  n.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 4 });

const OrdensCompra = () => {
  const { currentPlayer } = useAuth();
  const { canEditObra } = useObrasEditaveis();
  const { empresaAtualId } = useEmpresa();
  const obrasQuery = useObras();
  const obras = useMemo<Obra[]>(
    () => (obrasQuery.data ?? []).map((o) => ({ id: o.id, nome: o.nome })),
    [obrasQuery.data],
  );
  const [ocs, setOcs] = useState<OC[]>([]);
  const [itens, setItens] = useState<OCItem[]>([]);
  const [cotacoes, setCotacoes] = useState<Cotacao[]>([]);
  const [propostas, setPropostas] = useState<Proposta[]>([]);
  const reqsQuery = useRequisicoesAll("id,obra_id,orcamento_item_id,quantidade,observacao,status");
  const [reqs, setReqs] = useState<Req[]>([]);
  useEffect(() => {
    if (reqsQuery.data) setReqs(reqsQuery.data as Req[]);
  }, [reqsQuery.data]);
  const [orc, setOrc] = useState<OrcItem[]>([]);
  const fornecedoresQuery = useFornecedoresContatos();
  const fornecedores = useMemo<Fornecedor[]>(
    () =>
      (fornecedoresQuery.data ?? []).map((f) => ({
        id: f.id,
        razao_social: f.razao_social,
        nome_fantasia: f.nome_fantasia,
        contato: f.contato,
        email: f.email,
        telefone: f.telefone,
      })),
    [fornecedoresQuery.data],
  );
  const [loading, setLoading] = useState(true);
  const [envios, setEnvios] = useState<SuprimentoEnvio[]>(() => listSuprimentoEnvios());
  const [numeracoesDocumento, setNumeracoesDocumento] = useState<DocumentoNumeracaoLocal[]>(() =>
    listDocumentoNumeracaoLocal("ordem_compra"),
  );

  const [filterObra, setFilterObra] = useState<string>("todas");
  const [filterStatus, setFilterStatus] = useState<string>("ativas");

  const [novaOpen, setNovaOpen] = useState(false);
  const [novaCotacaoId, setNovaCotacaoId] = useState<string>("");
  const [salvandoNova, setSalvandoNova] = useState(false);

  const [detOpen, setDetOpen] = useState(false);
  const [detId, setDetId] = useState<string | null>(null);

  // form item manual
  const [newDesc, setNewDesc] = useState("");
  const [newQtd, setNewQtd] = useState("");
  const [newPreco, setNewPreco] = useState("");

  const load = async () => {
    setLoading(true);
    const [o, i, c, p, oi] = await Promise.all([
      suprimentosRepo.listOrdensCompraDetalhadas().then((data) => ({ data, error: null as any })),
      suprimentosRepo.listOrdemCompraItensDetalhados().then((data) => ({ data, error: null as any })),
      suprimentosRepo.listCotacoes().then((data) => ({ data, error: null as any })),
      suprimentosRepo.listPropostas().then((data) => ({ data, error: null as any })),
      suprimentosRepo.listOrcamentoItens().then((data) => ({ data, error: null as any })),
      reqsQuery.refetch(),
    ]);
    if (o.error) toast.error("OCs: " + o.error.message);
    setOcs((o.data ?? []) as OC[]);
    setItens((i.data ?? []) as OCItem[]);
    setCotacoes((c.data ?? []) as Cotacao[]);
    setPropostas((p.data ?? []) as Proposta[]);
    setOrc((oi.data ?? []) as OrcItem[]);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => subscribeSuprimentoEnvios(() => setEnvios(listSuprimentoEnvios())), []);

  const obraById = useMemo(() => new Map(obras.map((x) => [x.id, x])), [obras]);
  const fornById = useMemo(() => new Map(fornecedores.map((x) => [x.id, x])), [fornecedores]);
  const reqById = useMemo(() => new Map(reqs.map((x) => [x.id, x])), [reqs]);
  const orcById = useMemo(() => new Map(orc.map((x) => [x.id, x])), [orc]);

  const itensDaOC = (id: string) => itens.filter((x) => x.ordem_compra_id === id);

  /** Cotações fechadas com proposta escolhida e ainda sem OC vinculada. */
  const cotacoesElegiveis = useMemo(() => {
    const reqsJaOcadas = new Set(itens.map((i) => i.requisicao_id).filter((x): x is string => !!x));
    return cotacoes
      .filter((c) => c.status === "fechada")
      .filter((c) => propostas.some((p) => p.cotacao_id === c.id && p.escolhida))
      .filter((c) => !reqsJaOcadas.has(c.requisicao_id));
  }, [cotacoes, propostas, itens]);

  const descricaoCotacao = (c: Cotacao) => {
    const r = reqById.get(c.requisicao_id);
    if (!r) return "(requisição removida)";
    const item = r.orcamento_item_id ? orcById.get(r.orcamento_item_id) : null;
    const obra = obraById.get(r.obra_id);
    return `${item?.descricao ?? r.observacao ?? "(item)"} · ${obra?.nome ?? "(obra?)"} · ${fmtQtd(r.quantidade)} ${item?.unidade ?? ""}`.trim();
  };

  const recalcValorTotal = async (ocId: string) => {
    const total = itens
      .filter((x) => x.ordem_compra_id === ocId)
      .reduce((acc, x) => acc + Number(x.valor_total ?? x.quantidade * x.preco_unitario), 0);
    await suprimentosRepo.updateOcValorTotal(ocId, Math.round(total * 100) / 100);
  };

  const criarOCFromCotacao = async () => {
    const c = cotacoes.find((x) => x.id === novaCotacaoId);
    if (!c) return;
    const r = reqById.get(c.requisicao_id);
    const escolhida = propostas.find((p) => p.cotacao_id === c.id && p.escolhida);
    if (!r || !escolhida) {
      toast.error("Cotação inválida.");
      return;
    }
    if (!canEditObra(r.obra_id)) {
      toast.error("Você não tem permissão para criar OCs nesta obra.");
      return;
    }
    setSalvandoNova(true);
    const numeroParametrizado = emitirNumeroCustomizado(empresaAtualId, "ordem_compra");
    let ocId: string;
    try {
      ocId = await suprimentosRepo.createOcReturningId({
        obra_id: r.obra_id,
        fornecedor_id: escolhida.fornecedor_id,
        status: "rascunho",
        status_aprovacao: "pendente",
        valor_total: 0,
      });
    } catch (e: any) {
      numeroParametrizado?.rollback();
      setSalvandoNova(false);
      toast.error("Erro ao criar OC: " + (e?.message ?? "?"));
      return;
    }
    if (numeroParametrizado) {
      registrarDocumentoNumeroLocal({
        documentoId: ocId,
        tipo: "ordem_compra",
        empresaId: empresaAtualId ?? undefined,
        numero: numeroParametrizado.numero,
        sequencial: numeroParametrizado.emitido,
      });
      setNumeracoesDocumento(listDocumentoNumeracaoLocal("ordem_compra"));
    }
    const orcItem = r.orcamento_item_id ? orcById.get(r.orcamento_item_id) : null;
    const desc = orcItem?.descricao ?? r.observacao ?? "Item";
    const ins = await suprimentosRepo.createOcItem({
      ordem_compra_id: ocId,
      requisicao_id: r.id,
      descricao: desc,
      quantidade: r.quantidade,
      preco_unitario: escolhida.preco_unitario,
    });
    if (ins.error) {
      toast.error("Erro ao inserir item: " + ins.error.message);
    }
    const total = r.quantidade * escolhida.preco_unitario;
    await suprimentosRepo.updateOcValorTotal(ocId, Math.round(total * 100) / 100);
    setSalvandoNova(false);
    toast.success(
      numeroParametrizado
        ? `OC ${numeroParametrizado.numero} criada em rascunho.`
        : "OC criada em rascunho. Aprove e emita para alimentar o committed cost.",
    );
    setNovaOpen(false);
    setNovaCotacaoId("");
    await load();
    setDetId(ocId);
    setDetOpen(true);
  };

  const aprovar = async (id: string, aprovada: boolean) => {
    const oc = ocs.find((x) => x.id === id);
    if (oc && !canEditObra(oc.obra_id)) {
      toast.error("Sem permissão nesta obra.");
      return;
    }
    if (!aprovada) {
      try {
        await suprimentosRepo.setOcStatusAprovacao(id, "rejeitada");
      } catch (e: any) {
        toast.error("Erro: " + (e?.message ?? "Falha"));
        return;
      }
      toast.success("OC rejeitada.");
      load();
      return;
    }
    let completo: boolean | undefined;
    try {
      const data = await suprimentosRepo.aprovarOc(id);
      completo = data.aprovada;
    } catch (e: any) {
      toast.error(e?.message ?? "Falha");
      return;
    }
    toast.success(completo ? "OC aprovada." : "Aprovação registrada — faltam outras alçadas.");
    load();
  };

  const emitir = async (id: string) => {
    const oc = ocs.find((x) => x.id === id);
    if (oc && !canEditObra(oc.obra_id)) {
      toast.error("Sem permissão nesta obra.");
      return;
    }
    try {
      await suprimentosRepo.emitirOc(id);
    } catch (e: any) {
      toast.error("Erro ao emitir: " + (e?.message ?? ""));
      return;
    }
    toast.success("OC emitida — valor_oc dos cards de recurso atualizado.");
    load();
  };

  const cancelar = async (id: string) => {
    const oc = ocs.find((x) => x.id === id);
    if (oc && !canEditObra(oc.obra_id)) {
      toast.error("Sem permissão nesta obra.");
      return;
    }
    try {
      const { revertidas } = await suprimentosRepo.cancelarOcRascunho(id);
      toast.success(
        revertidas > 0
          ? `OC cancelada. ${revertidas} requisição(ões) reaberta(s) para cotação.`
          : "OC cancelada.",
      );
      load();
    } catch (e: any) {
      toast.error("Erro: " + (e?.message ?? "Falha"));
    }
  };

  const gerarPdfFornecedor = (oc: OC) => {
    const itensOc = itensDaOC(oc.id);
    if (itensOc.length === 0) {
      toast.error("Inclua ao menos um item antes de gerar a OC para fornecedor.");
      return;
    }
    const fornecedor = fornById.get(oc.fornecedor_id);
    const numeroExibido = numeroOc(oc);
    exportOrdemCompraToPDF({
      oc: { ...oc, numero: numeroExibido },
      itens: itensOc,
      obraNome: obraById.get(oc.obra_id)?.nome,
      fornecedor,
      emitenteNome: currentPlayer?.login,
      logoDataUrl: empresaAtualId
        ? (empresaParametrizacaoRepo.get(empresaAtualId).logoUrl ?? undefined)
        : undefined,
      institucionalLines: getInstitucionalHeaderLines(empresaAtualId ?? null),
    });
    registrarSuprimentoEnvio({
      tipo: "ordem_compra",
      ordemCompraId: oc.id,
      fornecedorId: oc.fornecedor_id,
      destinatarioNome: fornecedor?.contato ?? fornecedor?.razao_social,
      destinatarioEmail: fornecedor?.email ?? undefined,
      canal: "pdf",
      enviadoPor: currentPlayer?.login,
      observacao: `${numeroExibido} exportada em PDF para fornecedor.`,
    });
    setEnvios(listSuprimentoEnvios());
    toast.success("PDF da OC gerado e saída registrada.");
  };

  const adicionarItemManual = async () => {
    if (!detId) return;
    if (detOC && !canEditObra(detOC.obra_id)) {
      toast.error("Sem permissão nesta obra.");
      return;
    }
    const qtd = Number((newQtd || "0").replace(",", "."));
    const preco = Number((newPreco || "0").replace(",", "."));
    if (!newDesc.trim() || qtd <= 0 || preco <= 0) {
      toast.error("Descrição, quantidade e preço são obrigatórios.");
      return;
    }
    const ins = await suprimentosRepo.createOcItem({
      ordem_compra_id: detId,
      descricao: newDesc.trim(),
      quantidade: qtd,
      preco_unitario: preco,
    });
    if (ins.error) {
      toast.error("Erro: " + ins.error.message);
      return;
    }
    setNewDesc("");
    setNewQtd("");
    setNewPreco("");
    await load();
    await recalcValorTotal(detId);
    load();
  };

  const removerItem = async (itemId: string) => {
    if (!detId) return;
    if (detOC && !canEditObra(detOC.obra_id)) {
      toast.error("Sem permissão nesta obra.");
      return;
    }
    try {
      await suprimentosRepo.deleteOcItem(itemId);
    } catch (e) {
      toast.error("Erro: " + (e as Error).message);
      return;
    }
    await load();
    await recalcValorTotal(detId);
    load();
  };

  const filtered = useMemo(() => {
    return ocs.filter((o) => {
      if (filterObra !== "todas" && o.obra_id !== filterObra) return false;
      if (filterStatus === "ativas" && (o.status === "cancelada" || o.status === "recebida"))
        return false;
      if (filterStatus !== "ativas" && filterStatus !== "todas" && o.status !== filterStatus)
        return false;
      return true;
    });
  }, [ocs, filterObra, filterStatus]);

  const detOC = detId ? (ocs.find((x) => x.id === detId) ?? null) : null;
  const detItens = detId ? itensDaOC(detId) : [];
  const detTotal = detItens.reduce(
    (acc, x) => acc + Number(x.valor_total ?? x.quantidade * x.preco_unitario),
    0,
  );
  const detPodeObra = detOC ? canEditObra(detOC.obra_id) : false;
  const detEditavel = detOC?.status === "rascunho" && detPodeObra;
  const detEnvios = detOC ? envios.filter((e) => e.ordemCompraId === detOC.id) : [];

  const numeroOc = (oc: Pick<OC, "id" | "numero">) =>
    numeracoesDocumento.find((n) => n.documentoId === oc.id)?.numero ??
    getDocumentoNumeroLocal(oc.id, "ordem_compra")?.numero ??
    (oc.numero != null ? `OC #${oc.numero}` : `OC ${oc.id.slice(-6).toUpperCase()}`);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-display text-2xl font-bold flex items-center gap-2">
          <FileText className="h-6 w-6" /> Ordens de Compra
        </h2>
        <Button size="sm" onClick={() => setNovaOpen(true)}>
          <Plus className="h-4 w-4 mr-1" /> Nova OC
        </Button>
      </div>

      <div className="flex flex-wrap gap-3 mb-4">
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
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ativas">Ativas</SelectItem>
            <SelectItem value="todas">Todas</SelectItem>
            <SelectItem value="rascunho">Rascunho</SelectItem>
            <SelectItem value="emitida">Emitidas</SelectItem>
            <SelectItem value="recebida_parcial">Recebida parcial</SelectItem>
            <SelectItem value="recebida">Recebidas</SelectItem>
            <SelectItem value="cancelada">Canceladas</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading || obrasQuery.isLoading ? (
        <PageLoading />
      ) : filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center">Nenhuma OC.</p>
      ) : (
        <div className="grid gap-2">
          {filtered.map((o) => (
            <button
              key={o.id}
              type="button"
              onClick={() => {
                setDetId(o.id);
                setDetOpen(true);
              }}
              className="text-left bg-card border border-border rounded-lg p-4 hover:border-primary transition-colors"
            >
              <div className="flex items-center gap-2 flex-wrap">
                <p className="font-medium">{numeroOc(o)}</p>
                <Badge variant={STATUS_VARIANT[o.status] ?? "outline"} className="text-xs">
                  {STATUS_LABEL[o.status] ?? o.status}
                </Badge>
                {o.status === "rascunho" && (
                  <Badge variant="outline" className="text-xs">
                    {APR_LABEL[o.status_aprovacao] ?? o.status_aprovacao}
                  </Badge>
                )}
                <span className="ml-auto font-medium">{fmtBRL(o.valor_total)}</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {obraById.get(o.obra_id)?.nome ?? "(obra?)"} ·{" "}
                {fornById.get(o.fornecedor_id)?.razao_social ?? "(fornecedor?)"}
                {o.emitida_em &&
                  ` · emitida em ${fmtDataLocal(o.emitida_em)}`}
              </p>
            </button>
          ))}
        </div>
      )}

      {/* Nova OC */}
      <Dialog open={novaOpen} onOpenChange={(v) => !v && setNovaOpen(false)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-display">Nova OC</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Label>Cotação fechada *</Label>
            <Select value={novaCotacaoId} onValueChange={setNovaCotacaoId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione a cotação" />
              </SelectTrigger>
              <SelectContent>
                {cotacoesElegiveis.length === 0 ? (
                  <div className="px-2 py-1.5 text-xs text-muted-foreground">
                    Nenhuma cotação fechada com proposta escolhida disponível.
                  </div>
                ) : (
                  cotacoesElegiveis.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {descricaoCotacao(c)}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              A OC nasce em rascunho com o fornecedor e o preço da proposta escolhida. Itens
              adicionais podem ser adicionados manualmente no detalhe.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNovaOpen(false)} disabled={salvandoNova}>
              Cancelar
            </Button>
            <Button onClick={criarOCFromCotacao} disabled={salvandoNova || !novaCotacaoId}>
              {salvandoNova && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Criar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detalhe da OC */}
      <Dialog open={detOpen} onOpenChange={(v) => !v && setDetOpen(false)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="font-display">
              OC #{detOC?.numero} — {detOC ? (STATUS_LABEL[detOC.status] ?? detOC.status) : ""}
            </DialogTitle>
          </DialogHeader>
          {detOC && (
            <div className="space-y-4">
              <div className="text-sm border border-border rounded-md p-3 bg-muted/30 grid grid-cols-2 gap-2">
                <div>
                  <span className="text-xs text-muted-foreground">Obra</span>
                  <p className="font-medium">{obraById.get(detOC.obra_id)?.nome ?? "?"}</p>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground">Fornecedor</span>
                  <p className="font-medium">
                    {fornById.get(detOC.fornecedor_id)?.razao_social ?? "?"}
                  </p>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground">Aprovação</span>
                  <p className="font-medium">{APR_LABEL[detOC.status_aprovacao]}</p>
                </div>
                <div className="text-right">
                  <span className="text-xs text-muted-foreground">Total</span>
                  <p className="font-medium text-lg">{fmtBRL(detTotal)}</p>
                </div>
              </div>

              <div className="border border-border rounded-md overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 text-xs">
                    <tr>
                      <th className="text-left p-2">Descrição</th>
                      <th className="text-right p-2">Qtd</th>
                      <th className="text-right p-2">Preço un.</th>
                      <th className="text-right p-2">Total</th>
                      {detEditavel && <th className="p-2" />}
                    </tr>
                  </thead>
                  <tbody>
                    {detItens.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="p-3 text-center text-xs text-muted-foreground">
                          Sem itens.
                        </td>
                      </tr>
                    ) : (
                      detItens.map((i) => (
                        <tr key={i.id} className="border-t border-border">
                          <td className="p-2">{i.descricao}</td>
                          <td className="p-2 text-right">{fmtQtd(i.quantidade)}</td>
                          <td className="p-2 text-right">{fmtBRL(i.preco_unitario)}</td>
                          <td className="p-2 text-right font-medium">
                            {fmtBRL(Number(i.valor_total ?? i.quantidade * i.preco_unitario))}
                          </td>
                          {detEditavel && (
                            <td className="p-2 text-right">
                              <Button
                                size="icon"
                                aria-label="Remover item"
                                variant="ghost"
                                onClick={() => removerItem(i.id)}
                                className="h-7 w-7"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </td>
                          )}
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {detEditavel && (
                <div className="border-t pt-3 space-y-2">
                  <p className="text-xs font-medium text-muted-foreground uppercase">
                    Adicionar item
                  </p>
                  <div className="grid grid-cols-[1fr_120px_120px_auto] gap-2">
                    <Input
                      value={newDesc}
                      onChange={(e) => setNewDesc(e.target.value)}
                      placeholder="Descrição"
                    />
                    <Input
                      value={newQtd}
                      onChange={(e) => setNewQtd(e.target.value)}
                      placeholder="Qtd"
                    />
                    <Input
                      value={newPreco}
                      onChange={(e) => setNewPreco(e.target.value)}
                      placeholder="Preço un."
                    />
                    <Button size="sm" onClick={adicionarItemManual}>
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}

              {detEnvios.length > 0 && (
                <div className="border-t pt-3 space-y-2">
                  <p className="text-xs font-medium text-muted-foreground uppercase">
                    Saídas ao fornecedor
                  </p>
                  <div className="space-y-1 text-xs text-muted-foreground">
                    {detEnvios.slice(0, 5).map((envio) => (
                      <p key={envio.id}>
                        {new Date(envio.enviadoEm).toLocaleString("pt-BR")} · PDF ·{" "}
                        {envio.destinatarioEmail || envio.destinatarioNome || "destinatário não informado"}
                        {envio.enviadoPor ? ` · ${envio.enviadoPor}` : ""}
                      </p>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
          <DialogFooter className="gap-2 flex-wrap">
            <Button variant="outline" onClick={() => setDetOpen(false)}>
              Fechar
            </Button>
            {detOC?.status === "rascunho" &&
              detOC.status_aprovacao === "pendente" &&
              detPodeObra && (
                <>
                  <Button variant="outline" onClick={() => aprovar(detOC.id, false)}>
                    <XCircle className="h-4 w-4 mr-1" /> Rejeitar
                  </Button>
                  <Button onClick={() => aprovar(detOC.id, true)}>
                    <CheckCircle2 className="h-4 w-4 mr-1" /> Aprovar
                  </Button>
                </>
              )}
            {detOC?.status === "rascunho" &&
              detOC.status_aprovacao === "aprovada" &&
              detPodeObra && (
                <Button onClick={() => emitir(detOC.id)}>
                  <Send className="h-4 w-4 mr-1" /> Emitir
                </Button>
              )}
            {detOC && detPodeObra && (
              <Button variant="outline" onClick={() => gerarPdfFornecedor(detOC)}>
                <FileText className="h-4 w-4 mr-1" /> PDF fornecedor
              </Button>
            )}
            {detOC &&
              detOC.status !== "cancelada" &&
              detOC.status !== "recebida" &&
              detPodeObra && (
                <Button variant="ghost" onClick={() => cancelar(detOC.id)}>
                  Cancelar OC
                </Button>
              )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default OrdensCompra;
