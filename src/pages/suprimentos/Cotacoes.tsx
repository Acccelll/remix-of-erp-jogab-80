import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useFornecedoresContatos } from "@/hooks/suprimentos/useFornecedores";
import { useUpdateRequisicaoStatus } from "@/hooks/suprimentos/useRequisicoes";
import { suprimentosRepo } from "@/lib/repositories/suprimentos";
import { useAuth } from "@/contexts/auth/useAuth";
import { exportPedidoCotacaoToPDF } from "@/lib/suprimentos/export-pdf";
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
import { Plus, Scale, Loader2, Trash2, Check, Trophy, Timer, FileText } from "lucide-react";
import { useObras } from "@/hooks/obras/useObras";
import { formatBRL } from "@/lib/core/currency";
import { PageLoading } from "@/components/common/PageLoading";
import { DesktopOnlyHint } from "@/components/common/DesktopOnlyHint";

type Cotacao = {
  id: string;
  requisicao_id: string;
  status: string;
  created_at: string;
};

type Proposta = {
  id: string;
  cotacao_id: string;
  fornecedor_id: string;
  preco_unitario: number;
  prazo_entrega_dias: number | null;
  condicao_pagamento: string | null;
  observacao: string | null;
  escolhida: boolean;
};

type Requisicao = {
  id: string;
  obra_id: string;
  orcamento_item_id: string | null;
  quantidade: number;
  status: string;
  observacao: string | null;
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
  ativo: boolean;
};

const fmtBRL = (n: number) => formatBRL(n);
const fmtQtd = (n: number) =>
  n.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 4 });
const safe = (v: unknown) => String(v ?? "").replace(/[^a-zA-Z0-9_-]+/g, "_").slice(0, 40);

const Cotacoes = () => {
  const navigate = useNavigate();
  const { currentPlayer } = useAuth();
  const { empresaAtualId } = useEmpresa();
  const [gerandoOc, setGerandoOc] = useState(false);
  const [envios, setEnvios] = useState<SuprimentoEnvio[]>(() => listSuprimentoEnvios());
  const [numeracoesDocumento, setNumeracoesDocumento] = useState<DocumentoNumeracaoLocal[]>(() =>
    listDocumentoNumeracaoLocal("cotacao"),
  );
  const [cotacoes, setCotacoes] = useState<Cotacao[]>([]);
  const [propostas, setPropostas] = useState<Proposta[]>([]);
  const [requisicoes, setRequisicoes] = useState<Requisicao[]>([]);
  const obrasQuery = useObras();
  const obras = useMemo<Obra[]>(
    () => (obrasQuery.data ?? []).map((o) => ({ id: o.id, nome: o.nome })),
    [obrasQuery.data],
  );
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
        ativo: !!f.ativo,
      })),
    [fornecedoresQuery.data],
  );
  const [loading, setLoading] = useState(true);

  // nova cotação
  const [novaOpen, setNovaOpen] = useState(false);
  const [novaReqId, setNovaReqId] = useState<string>("");
  const [salvandoNova, setSalvandoNova] = useState(false);
  const updateReqStatusMut = useUpdateRequisicaoStatus();

  // detalhe / propostas
  const [detOpen, setDetOpen] = useState(false);
  const [detCotacaoId, setDetCotacaoId] = useState<string | null>(null);

  // form proposta
  const [pFornecedor, setPFornecedor] = useState<string>("");
  const [pPreco, setPPreco] = useState("");
  const [pPrazo, setPPrazo] = useState("");
  const [pCondicao, setPCondicao] = useState("");
  const [pObs, setPObs] = useState("");
  const [savingProp, setSavingProp] = useState(false);

  const load = async () => {
    setLoading(true);
    const wrap = <T,>(p: Promise<T>) =>
      p.then((data) => ({ data, error: null as any })).catch((error) => ({ data: [] as any, error }));
    const [c, p, r, oi] = await Promise.all([
      wrap(suprimentosRepo.listCotacoesDetalhadas()),
      wrap(suprimentosRepo.listPropostasDetalhadas()),
      wrap(suprimentosRepo.listRequisicoesDetalhadas()),
      suprimentosRepo.listOrcamentoItens().then((data) => ({ data, error: null as any })),
    ]);
    if (c.error) toast.error("Cotações: " + c.error.message);
    setCotacoes((c.data ?? []) as Cotacao[]);
    setPropostas((p.data ?? []) as Proposta[]);
    setRequisicoes((r.data ?? []) as Requisicao[]);
    setOrc((oi.data ?? []) as OrcItem[]);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => subscribeSuprimentoEnvios(() => setEnvios(listSuprimentoEnvios())), []);

  const reqById = useMemo(() => new Map(requisicoes.map((x) => [x.id, x])), [requisicoes]);
  const obraById = useMemo(() => new Map(obras.map((x) => [x.id, x])), [obras]);
  const orcById = useMemo(() => new Map(orc.map((x) => [x.id, x])), [orc]);
  const fornById = useMemo(() => new Map(fornecedores.map((x) => [x.id, x])), [fornecedores]);

  const propostasDaCotacao = (cId: string) => propostas.filter((p) => p.cotacao_id === cId);

  /** Requisições elegíveis para nova cotação: aberta/cotando, sem cotação aberta ainda. */
  const requisicoesElegiveis = useMemo(() => {
    const comCotacaoAberta = new Set(
      cotacoes.filter((c) => c.status !== "fechada").map((c) => c.requisicao_id),
    );
    return requisicoes.filter(
      (r) => (r.status === "aberta" || r.status === "cotando") && !comCotacaoAberta.has(r.id),
    );
  }, [requisicoes, cotacoes]);

  const descricaoReq = (rId: string) => {
    const r = reqById.get(rId);
    if (!r) return "(requisição removida)";
    const obra = obraById.get(r.obra_id);
    const item = r.orcamento_item_id ? orcById.get(r.orcamento_item_id) : null;
    const titulo = item?.descricao ?? r.observacao ?? "(sem descrição)";
    const unid = item?.unidade ?? "";
    return `${titulo} · ${obra?.nome ?? "(obra?)"} · ${fmtQtd(r.quantidade)} ${unid}`.trim();
  };

  const criarCotacao = async () => {
    if (!novaReqId) return;
    setSalvandoNova(true);
    let error: { message: string } | null = null;
    const cotacaoId = crypto.randomUUID();
    const numeroParametrizado = emitirNumeroCustomizado(empresaAtualId, "cotacao");
    try {
      await suprimentosRepo.createCotacao({ id: cotacaoId, requisicao_id: novaReqId });
    } catch (e) {
      numeroParametrizado?.rollback();
      error = { message: (e as Error).message };
    }
    if (!error) {
      if (numeroParametrizado) {
        registrarDocumentoNumeroLocal({
          documentoId: cotacaoId,
          tipo: "cotacao",
          empresaId: empresaAtualId ?? undefined,
          numero: numeroParametrizado.numero,
          sequencial: numeroParametrizado.emitido,
        });
        setNumeracoesDocumento(listDocumentoNumeracaoLocal("cotacao"));
      }
      // marca requisição como 'cotando' se ainda estava 'aberta'
      const req = reqById.get(novaReqId);
      if (req && req.status === "aberta") {
        await updateReqStatusMut.mutateAsync({ id: novaReqId, status: "cotando" });
      }
    }
    setSalvandoNova(false);
    if (error) {
      toast.error("Erro: " + error.message);
      return;
    }
    toast.success("Cotação criada.");
    setNovaOpen(false);
    setNovaReqId("");
    load();
  };

  const abrirDetalhe = (cId: string) => {
    setDetCotacaoId(cId);
    setPFornecedor("");
    setPPreco("");
    setPPrazo("");
    setPCondicao("");
    setPObs("");
    setDetOpen(true);
  };

  const adicionarProposta = async () => {
    if (!detCotacaoId || !pFornecedor) {
      toast.error("Escolha o fornecedor.");
      return;
    }
    const preco = Number((pPreco || "0").replace(",", "."));
    if (!Number.isFinite(preco) || preco <= 0) {
      toast.error("Preço inválido.");
      return;
    }
    const prazo = pPrazo ? Number(pPrazo) : null;
    setSavingProp(true);
    let error: { message: string } | null = null;
    try {
      await suprimentosRepo.createProposta({
        cotacao_id: detCotacaoId,
        fornecedor_id: pFornecedor,
        preco_unitario: preco,
        prazo_entrega_dias: prazo,
        condicao_pagamento: pCondicao.trim() || null,
        observacao: pObs.trim() || null,
      });
    } catch (e) {
      error = { message: (e as Error).message };
    }
    setSavingProp(false);
    if (error) {
      toast.error("Erro: " + error.message);
      return;
    }
    setPFornecedor("");
    setPPreco("");
    setPPrazo("");
    setPCondicao("");
    setPObs("");
    load();
  };

  const escolherProposta = async (cId: string, pId: string) => {
    try {
      await suprimentosRepo.setPropostaEscolhida(cId, pId);
    } catch (e) {
      toast.error("Erro: " + (e as Error).message);
      return;
    }
    toast.success("Proposta escolhida.");
    load();
  };

  const removerProposta = async (pId: string) => {
    try {
      await suprimentosRepo.deleteProposta(pId);
    } catch (e) {
      toast.error("Erro: " + (e as Error).message);
      return;
    }
    load();
  };

  const numeroCotacao = (cotacao: Pick<Cotacao, "id">) =>
    numeracoesDocumento.find((n) => n.documentoId === cotacao.id)?.numero ??
    getDocumentoNumeroLocal(cotacao.id, "cotacao")?.numero ??
    safe(cotacao.id).slice(0, 8).toUpperCase();

  const fecharCotacao = async (cId: string) => {
    const props = propostasDaCotacao(cId);
    if (!props.some((p) => p.escolhida)) {
      toast.error("Escolha uma proposta antes de fechar.");
      return;
    }
    try {
      await suprimentosRepo.fecharCotacao(cId);
    } catch (e) {
      toast.error("Erro: " + (e as Error).message);
      return;
    }
    toast.success("Cotação fechada — pronta para gerar OC.");
    setDetOpen(false);
    load();
  };

  /** PRO-009 · slice-01 — gera OC (rascunho) a partir da cotação vencedora. */
  const gerarOc = async (cId: string) => {
    setGerandoOc(true);
    let ocId: string | null = null;
    try {
      ocId = await suprimentosRepo.gerarOcDeCotacao(cId);
    } catch (e) {
      setGerandoOc(false);
      toast.error("Erro ao gerar OC: " + (e as Error).message);
      return;
    }
    setGerandoOc(false);
    toast.success("OC criada em rascunho a partir da cotação.");
    setDetOpen(false);
    load();
    navigate("/suprimentos/ordens-compra");
  };

  const gerarPedidoPdf = () => {
    if (!detCot || !detReq) return;
    const fornecedoresComProposta = detProps
      .map((p) => fornById.get(p.fornecedor_id))
      .filter((f): f is Fornecedor => !!f);
    const destinatarios = fornecedoresComProposta.length
      ? fornecedoresComProposta
      : fornecedores.filter((f) => f.ativo);

    exportPedidoCotacaoToPDF({
      cotacao: { ...detCot, numero: numeroCotacao(detCot) },
      requisicao: detReq,
      item: detItem,
      obraNome: obraById.get(detReq.obra_id)?.nome,
      fornecedores: destinatarios,
      emitenteNome: currentPlayer?.login,
      logoDataUrl: empresaAtualId
        ? (empresaParametrizacaoRepo.get(empresaAtualId).logoUrl ?? undefined)
        : undefined,
      institucionalLines: getInstitucionalHeaderLines(empresaAtualId ?? null),
    });

    if (destinatarios.length === 0) {
      registrarSuprimentoEnvio({
        tipo: "pedido_cotacao",
        cotacaoId: detCot.id,
        canal: "pdf",
        enviadoPor: currentPlayer?.login,
        observacao: "Pedido de cotação exportado em PDF sem destinatário cadastrado.",
      });
    } else {
      destinatarios.forEach((fornecedor) =>
        registrarSuprimentoEnvio({
          tipo: "pedido_cotacao",
          cotacaoId: detCot.id,
          fornecedorId: fornecedor.id,
          destinatarioNome: fornecedor.contato ?? fornecedor.razao_social,
          destinatarioEmail: fornecedor.email ?? undefined,
          canal: "pdf",
          enviadoPor: currentPlayer?.login,
          observacao: "Pedido de cotação exportado em PDF.",
        }),
      );
    }
    setEnvios(listSuprimentoEnvios());
    toast.success("Pedido de cotação em PDF gerado e saída registrada.");
  };

  const detCot = detCotacaoId ? (cotacoes.find((c) => c.id === detCotacaoId) ?? null) : null;
  const detProps = detCotacaoId ? propostasDaCotacao(detCotacaoId) : [];
  const detReq = detCot ? reqById.get(detCot.requisicao_id) : null;
  const detItem = detReq?.orcamento_item_id ? orcById.get(detReq.orcamento_item_id) : null;
  const detEnvios = detCot ? envios.filter((e) => e.cotacaoId === detCot.id) : [];

  const melhorPreco = detProps.length ? Math.min(...detProps.map((p) => p.preco_unitario)) : null;
  const melhorPrazo = detProps.length
    ? Math.min(
        ...detProps
          .filter((p) => p.prazo_entrega_dias != null)
          .map((p) => p.prazo_entrega_dias as number),
      )
    : null;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-display text-2xl font-bold flex items-center gap-2">
          <Scale className="h-6 w-6" /> Cotações
        </h2>
        <Button size="sm" onClick={() => setNovaOpen(true)}>
          <Plus className="h-4 w-4 mr-1" /> Nova Cotação
        </Button>
      </div>

      {loading || obrasQuery.isLoading ? (
        <PageLoading />
      ) : cotacoes.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center">
          Nenhuma cotação. Abra uma requisição em "cotando" e crie uma cotação aqui.
        </p>
      ) : (
        <div className="grid gap-2">
          {cotacoes.map((c) => {
            const props = propostasDaCotacao(c.id);
            const escolhida = props.find((p) => p.escolhida);
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => abrirDetalhe(c.id)}
                className="text-left bg-card border border-border rounded-lg p-4 hover:border-primary transition-colors"
              >
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="outline" className="text-xs">
                    {numeroCotacao(c)}
                  </Badge>
                  <p className="font-medium truncate flex-1">{descricaoReq(c.requisicao_id)}</p>
                  <Badge
                    variant={c.status === "fechada" ? "outline" : "default"}
                    className="text-xs"
                  >
                    {c.status === "fechada" ? "Fechada" : "Aberta"}
                  </Badge>
                  <Badge variant="secondary" className="text-xs">
                    {props.length} proposta{props.length === 1 ? "" : "s"}
                  </Badge>
                </div>
                {escolhida && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Escolhida:{" "}
                    <span className="font-medium text-foreground">
                      {fornById.get(escolhida.fornecedor_id)?.razao_social ?? "?"}
                    </span>{" "}
                    · {fmtBRL(escolhida.preco_unitario)}/un
                    {escolhida.prazo_entrega_dias != null && ` · ${escolhida.prazo_entrega_dias}d`}
                  </p>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Dialog: nova cotação */}
      <Dialog open={novaOpen} onOpenChange={(v) => !v && setNovaOpen(false)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display">Nova Cotação</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Label>Requisição *</Label>
            <Select value={novaReqId} onValueChange={setNovaReqId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione a requisição" />
              </SelectTrigger>
              <SelectContent>
                {requisicoesElegiveis.length === 0 ? (
                  <div className="px-2 py-1.5 text-xs text-muted-foreground">
                    Nenhuma requisição elegível.
                  </div>
                ) : (
                  requisicoesElegiveis.map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      {descricaoReq(r.id)}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNovaOpen(false)} disabled={salvandoNova}>
              Cancelar
            </Button>
            <Button onClick={criarCotacao} disabled={salvandoNova || !novaReqId}>
              {salvandoNova && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Criar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: detalhe / mapa comparativo */}
      <Dialog open={detOpen} onOpenChange={(v) => !v && setDetOpen(false)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="font-display">
              Mapa Comparativo{detCot ? ` · ${numeroCotacao(detCot)}` : ""}
            </DialogTitle>
          </DialogHeader>
          {detCot && detReq && (
            <div className="space-y-4">
              <DesktopOnlyHint label="Mapa comparativo otimizado para desktop." />
              <div className="text-sm border border-border rounded-md p-3 bg-muted/30">
                <p className="font-medium">{detItem?.descricao ?? detReq.observacao ?? "(item)"}</p>
                <p className="text-xs text-muted-foreground">
                  {obraById.get(detReq.obra_id)?.nome ?? "(obra?)"} · {fmtQtd(detReq.quantidade)}{" "}
                  {detItem?.unidade ?? ""}
                </p>
              </div>

              {detProps.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Adicione propostas dos fornecedores abaixo.
                </p>
              ) : (
                <div className="border border-border rounded-md overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50 text-xs">
                      <tr>
                        <th className="text-left p-2">Fornecedor</th>
                        <th className="text-right p-2">Preço un.</th>
                        <th className="text-right p-2">Total</th>
                        <th className="text-right p-2">Prazo</th>
                        <th className="text-left p-2">Pagamento</th>
                        <th className="text-right p-2">Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detProps.map((p) => {
                        const isMelhorPreco = p.preco_unitario === melhorPreco;
                        const isMelhorPrazo =
                          p.prazo_entrega_dias != null && p.prazo_entrega_dias === melhorPrazo;
                        const total = p.preco_unitario * (detReq.quantidade || 0);
                        return (
                          <tr
                            key={p.id}
                            className={`border-t border-border ${
                              p.escolhida ? "bg-primary/5" : ""
                            }`}
                          >
                            <td className="p-2">
                              <div className="flex items-center gap-1">
                                {p.escolhida && <Check className="h-3.5 w-3.5 text-primary" />}
                                <span className="truncate">
                                  {fornById.get(p.fornecedor_id)?.razao_social ?? "(forn.)"}
                                </span>
                              </div>
                            </td>
                            <td className="p-2 text-right">
                              <span className={isMelhorPreco ? "font-medium text-success" : ""}>
                                {fmtBRL(p.preco_unitario)}
                              </span>
                              {isMelhorPreco && (
                                <Trophy className="h-3 w-3 inline ml-1 text-success" />
                              )}
                            </td>
                            <td className="p-2 text-right text-muted-foreground">
                              {fmtBRL(total)}
                            </td>
                            <td className="p-2 text-right">
                              {p.prazo_entrega_dias != null ? (
                                <>
                                  <span
                                    className={isMelhorPrazo ? "font-medium text-success" : ""}
                                  >
                                    {p.prazo_entrega_dias}d
                                  </span>
                                  {isMelhorPrazo && (
                                    <Timer className="h-3 w-3 inline ml-1 text-success" />
                                  )}
                                </>
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </td>
                            <td className="p-2 text-xs text-muted-foreground truncate">
                              {p.condicao_pagamento ?? "—"}
                            </td>
                            <td className="p-2 text-right">
                              <div className="flex justify-end gap-1">
                                {!p.escolhida && (
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => escolherProposta(detCot.id, p.id)}
                                    disabled={detCot.status === "fechada"}
                                  >
                                    Escolher
                                  </Button>
                                )}
                                <Button
                                  size="icon"
                                  aria-label="Remover item"
                                  variant="ghost"
                                  onClick={() => removerProposta(p.id)}
                                  disabled={detCot.status === "fechada"}
                                  className="h-7 w-7"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {detCot.status !== "fechada" && (
                <div className="border-t pt-3 space-y-2">
                  <p className="text-xs font-medium text-muted-foreground uppercase">
                    Adicionar proposta
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    <Select value={pFornecedor} onValueChange={setPFornecedor}>
                      <SelectTrigger>
                        <SelectValue placeholder="Fornecedor" />
                      </SelectTrigger>
                      <SelectContent>
                        {fornecedores
                          .filter((f) => f.ativo)
                          .map((f) => (
                            <SelectItem key={f.id} value={f.id}>
                              {f.razao_social}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                    <Input
                      value={pPreco}
                      onChange={(e) => setPPreco(e.target.value)}
                      placeholder="Preço unitário"
                    />
                    <Input
                      value={pPrazo}
                      onChange={(e) => setPPrazo(e.target.value)}
                      placeholder="Prazo (dias)"
                      type="number"
                    />
                    <Input
                      value={pCondicao}
                      onChange={(e) => setPCondicao(e.target.value)}
                      placeholder="Pagamento (ex: 30/60)"
                    />
                    <Input
                      value={pObs}
                      onChange={(e) => setPObs(e.target.value)}
                      placeholder="Observação"
                      className="col-span-2"
                    />
                  </div>
                  <Button size="sm" onClick={adicionarProposta} disabled={savingProp}>
                    {savingProp && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    <Plus className="h-4 w-4 mr-1" /> Adicionar
                  </Button>
                </div>
              )}

              {detEnvios.length > 0 && (
                <div className="border-t pt-3 space-y-2">
                  <p className="text-xs font-medium text-muted-foreground uppercase">
                    Saídas a fornecedores
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
          <DialogFooter>
            <Button variant="outline" onClick={() => setDetOpen(false)}>
              Fechar
            </Button>
            {detCot && detReq && (
              <Button variant="outline" onClick={gerarPedidoPdf}>
                <FileText className="h-4 w-4 mr-2" /> Pedido PDF
              </Button>
            )}
            {detCot && detCot.status !== "fechada" && (
              <Button onClick={() => fecharCotacao(detCot.id)}>Fechar cotação</Button>
            )}
            {detCot &&
              detCot.status === "fechada" &&
              detProps.some((p) => p.escolhida) && (
                <Button onClick={() => gerarOc(detCot.id)} disabled={gerandoOc}>
                  {gerandoOc ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <FileText className="h-4 w-4 mr-2" />
                  )}
                  Gerar OC
                </Button>
              )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Cotacoes;
