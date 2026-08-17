import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeft,
  Plus,
  Loader2,
  Trash2,
  ListPlus,
  X,
  Search,
  Calculator,
  CheckCircle2,
  XCircle,
  Banknote,
} from "lucide-react";
import { toast } from "sonner";
import {
  useAntecipacaoOperacoes,
  useOperadoresCredito,
  useCriarOperacaoAntecipacao,
  useExcluirOperacaoAntecipacao,
  useAntecipacaoTitulos,
  useAntecipacaoElegiveis,
  useAdicionarTitulosAntecipacao,
  useRemoverTituloAntecipacao,
  useAtualizarOperacaoAntecipacao,
  useAntecipacaoLiquidacoes,
  useRegistrarLiquidacaoAntecipacao,
} from "@/hooks/useAntecipacao";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { brl } from "@/lib/billing";
import { fmtData } from "@/lib/utils";
import { custoCarteira, diasExposicao, type OperacaoResumo } from "@/lib/antecipacao/calculo";

type Filtro = { status?: string; operadorId?: string };

const STATUS_LABEL: Record<string, string> = {
  rascunho: "Rascunho",
  aprovada: "Aprovada",
  liquidada: "Liquidada",
  cancelada: "Cancelada",
};

const STATUS_VARIANT: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  rascunho: "outline",
  aprovada: "default",
  liquidada: "secondary",
  cancelada: "destructive",
};

export default function FinAntecipacao() {
  const [filtro, setFiltro] = useState<Filtro>({});
  const [openNovo, setOpenNovo] = useState(false);
  const [operacaoAtivaId, setOperacaoAtivaId] = useState<string | null>(null);
  const [liquidarOpId, setLiquidarOpId] = useState<string | null>(null);

  const operadoresQ = useOperadoresCredito();
  const operacoesQ = useAntecipacaoOperacoes(filtro);
  const criar = useCriarOperacaoAntecipacao();
  const excluir = useExcluirOperacaoAntecipacao();
  const atualizar = useAtualizarOperacaoAntecipacao();

  const operadores = operadoresQ.data ?? [];
  const operacoes = operacoesQ.data ?? [];

  const kpis = useMemo(() => {
    const abertas = operacoes.filter((o: any) => o.status === "aprovada");
    const resumos: OperacaoResumo[] = operacoes.map((o: any) => ({
      operadorId: o.operador_id,
      valorFaceTotal: Number(o.valor_face_total ?? 0),
      desagioTotal: Number(o.desagio_total ?? 0),
      iof: Number(o.iof ?? 0),
      tarifas: Number(o.tarifas ?? 0),
      diasExposicaoPonderado: o.data_vencimento_repasse
        ? diasExposicao(o.data_operacao, o.data_vencimento_repasse)
        : 0,
    }));
    const carteira = custoCarteira(resumos);
    const faceTotal = resumos.reduce((a, r) => a + r.valorFaceTotal, 0);
    const custoTotal = carteira.desagioTotal + carteira.iofTotal + carteira.tarifasTotal;
    return {
      total: operacoes.length,
      abertas: abertas.length,
      faceTotal,
      custoTotal,
      cetMedio: carteira.cetMedioPonderado,
    };
  }, [operacoes]);

  const operacaoAtiva = operacoes.find((o: any) => o.id === operacaoAtivaId) ?? null;

  async function handleCriar(payload: any) {
    try {
      await criar.mutateAsync(payload);
      toast.success("Operação criada", { description: "Rascunho gerado com sucesso." });
      setOpenNovo(false);
    } catch (e: any) {
      toast.error("Não foi possível criar", { description: e?.message });
    }
  }

  async function handleExcluir(id: string, numero: string | null) {
    if (!confirm(`Excluir operação ${numero ?? id}?`)) return;
    try {
      await excluir.mutateAsync(id);
      if (operacaoAtivaId === id) setOperacaoAtivaId(null);
      toast.success("Operação excluída");
    } catch (e: any) {
      toast.error("Falha ao excluir", { description: e?.message });
    }
  }

  async function handleAprovar(o: any) {
    if (!confirm(`Aprovar a operação ${o.numero_interno ?? o.id}?`)) return;
    try {
      await atualizar.mutateAsync({
        id: o.id,
        patch: { status: "aprovada", aprovado_em: new Date().toISOString() },
      });
      toast.success("Operação aprovada");
    } catch (e: any) {
      toast.error("Falha ao aprovar", { description: e?.message });
    }
  }

  async function handleCancelar(o: any) {
    if (!confirm(`Cancelar a operação ${o.numero_interno ?? o.id}?`)) return;
    try {
      await atualizar.mutateAsync({ id: o.id, patch: { status: "cancelada" } });
      toast.success("Operação cancelada");
    } catch (e: any) {
      toast.error("Falha ao cancelar", { description: e?.message });
    }
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <Button asChild variant="ghost" size="sm">
            <Link to="/financeiro/dashboard">
              <ArrowLeft className="h-4 w-4 mr-1" /> Financeiro
            </Link>
          </Button>
          <div>
            <h1 className="font-display text-2xl font-bold">Antecipação de Recebíveis</h1>
            <p className="text-sm text-muted-foreground">
              Operações com fundos, bancos e securitizadoras (coobrigação padrão).
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link to="/financeiro/antecipacao/importar">
              <Calculator className="h-4 w-4 mr-1" /> Conciliação
            </Link>
          </Button>
          <Button onClick={() => setOpenNovo(true)}>
            <Plus className="h-4 w-4 mr-1" /> Nova operação
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Kpi label="Operações" value={String(kpis.total)} />
        <Kpi label="Aprovadas" value={String(kpis.abertas)} />
        <Kpi label="Face total" value={brl(kpis.faceTotal)} />
        <Kpi label="Custo total" value={brl(kpis.custoTotal)} />
        <Kpi
          label="CET médio (a.m.)"
          value={kpis.cetMedio != null ? `${(kpis.cetMedio * 100).toFixed(2)}%` : "—"}
        />
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2">
          <CardTitle className="text-base">Operações</CardTitle>
          <div className="flex gap-2">
            <Select
              value={filtro.status ?? "all"}
              onValueChange={(v) =>
                setFiltro((f) => ({ ...f, status: v === "all" ? undefined : v }))
              }
            >
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os status</SelectItem>
                {Object.entries(STATUS_LABEL).map(([k, v]) => (
                  <SelectItem key={k} value={k}>
                    {v}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={filtro.operadorId ?? "all"}
              onValueChange={(v) =>
                setFiltro((f) => ({ ...f, operadorId: v === "all" ? undefined : v }))
              }
            >
              <SelectTrigger className="w-56">
                <SelectValue placeholder="Operador" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os operadores</SelectItem>
                {operadores.map((op: any) => (
                  <SelectItem key={op.id} value={op.id}>
                    {op.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {operacoesQ.isLoading ? (
            <div className="flex items-center justify-center py-10 text-muted-foreground">
              <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Carregando...
            </div>
          ) : operacoes.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              Nenhuma operação registrada ainda.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nº</TableHead>
                  <TableHead>Operador</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead>Face</TableHead>
                  <TableHead>Líquido</TableHead>
                  <TableHead>Repasse</TableHead>
                  <TableHead>CET</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {operacoes.map((o: any) => {
                  const face = Number(o.valor_face_total ?? 0);
                  const custo =
                    Number(o.desagio_total ?? 0) + Number(o.iof ?? 0) + Number(o.tarifas ?? 0);
                  const cet = face > 0 ? custo / face : 0;
                  return (
                    <TableRow
                      key={o.id}
                      className={operacaoAtivaId === o.id ? "bg-muted/50" : undefined}
                    >
                      <TableCell className="font-mono text-xs">{o.numero_interno ?? "—"}</TableCell>
                      <TableCell>{o.operador?.nome ?? "—"}</TableCell>
                      <TableCell className="capitalize">
                        {String(o.tipo ?? "").replace(/_/g, " ")}
                      </TableCell>
                      <TableCell>{fmtData(o.data_operacao)}</TableCell>
                      <TableCell>{brl(face)}</TableCell>
                      <TableCell>{brl(Number(o.valor_liquido_recebido ?? 0))}</TableCell>
                      <TableCell>
                        {o.data_vencimento_repasse ? fmtData(o.data_vencimento_repasse) : "—"}
                      </TableCell>
                      <TableCell>{cet > 0 ? `${(cet * 100).toFixed(2)}%` : "—"}</TableCell>
                      <TableCell>
                        <Badge variant={STATUS_VARIANT[o.status] ?? "outline"}>
                          {STATUS_LABEL[o.status] ?? o.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setOperacaoAtivaId((id) => (id === o.id ? null : o.id))}
                          >
                            <ListPlus className="h-4 w-4 mr-1" /> Títulos
                          </Button>
                          {o.status === "rascunho" && (
                            <>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleAprovar(o)}
                                disabled={atualizar.isPending}
                                title="Aprovar operação"
                              >
                                <CheckCircle2 className="h-4 w-4 mr-1 text-emerald-600" /> Aprovar
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleExcluir(o.id, o.numero_interno)}
                                title="Excluir rascunho"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </>
                          )}
                          {o.status === "aprovada" && (
                            <>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setLiquidarOpId(o.id)}
                                title="Registrar liquidação"
                              >
                                <Banknote className="h-4 w-4 mr-1" /> Liquidar
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleCancelar(o)}
                                disabled={atualizar.isPending}
                                title="Cancelar operação"
                              >
                                <XCircle className="h-4 w-4" />
                              </Button>
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {operacaoAtiva && (
        <OperacaoTitulosPanel operacao={operacaoAtiva} onClose={() => setOperacaoAtivaId(null)} />
      )}

      <NovaOperacaoDialog
        open={openNovo}
        onOpenChange={setOpenNovo}
        operadores={operadores}
        onSubmit={handleCriar}
        submitting={criar.isPending}
      />

      <LiquidacaoDialog
        operacao={operacoes.find((o: any) => o.id === liquidarOpId) ?? null}
        onClose={() => setLiquidarOpId(null)}
      />
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-xl font-bold font-display mt-1">{value}</p>
      </CardContent>
    </Card>
  );
}

function NovaOperacaoDialog({
  open,
  onOpenChange,
  operadores,
  onSubmit,
  submitting,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  operadores: any[];
  onSubmit: (payload: any) => void;
  submitting: boolean;
}) {
  const [operadorId, setOperadorId] = useState<string>("");
  const [numeroInterno, setNumeroInterno] = useState<string>("");
  const [tipo, setTipo] = useState<string>("desconto_titulo");
  const [dataOperacao, setDataOperacao] = useState<string>(() =>
    new Date().toISOString().slice(0, 10),
  );
  const [dataLiquidacao, setDataLiquidacao] = useState<string>("");
  const [iof, setIof] = useState<string>("0");
  const [tarifas, setTarifas] = useState<string>("0");
  const [observacoes, setObservacoes] = useState<string>("");

  function handleSubmit() {
    if (!operadorId) return toast.error("Selecione um operador");
    onSubmit({
      numero_interno: numeroInterno || null,
      operador_id: operadorId,
      tipo,
      status: "rascunho",
      com_coobrigacao: true,
      data_operacao: dataOperacao,
      data_vencimento_repasse: dataLiquidacao || null,
      iof: Number(iof || 0),
      tarifas: Number(tarifas || 0),
      observacoes: observacoes || null,
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Nova operação de antecipação</DialogTitle>
          <DialogDescription>
            Rascunho inicial. Títulos e liquidação são adicionados depois.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="grid gap-1">
            <Label>Número interno</Label>
            <Input
              value={numeroInterno}
              onChange={(e) => setNumeroInterno(e.target.value)}
              placeholder="ANT-2026-001"
            />
          </div>
          <div className="grid gap-1">
            <Label>Operador</Label>
            <Select value={operadorId} onValueChange={setOperadorId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                {operadores.map((op: any) => (
                  <SelectItem key={op.id} value={op.id}>
                    {op.nome} · {op.tipo}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-3">
            <div className="grid gap-1">
              <Label>Tipo</Label>
              <Select value={tipo} onValueChange={setTipo}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="desconto_titulo">Desconto de título</SelectItem>
                  <SelectItem value="cessao">Cessão</SelectItem>
                  <SelectItem value="risco_sacado">Risco sacado</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1">
              <Label>Data da operação</Label>
              <Input
                type="date"
                value={dataOperacao}
                onChange={(e) => setDataOperacao(e.target.value)}
              />
            </div>
            <div className="grid gap-1">
              <Label>Liquidação prevista</Label>
              <Input
                type="date"
                value={dataLiquidacao}
                onChange={(e) => setDataLiquidacao(e.target.value)}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1">
              <Label>IOF (R$)</Label>
              <Input
                type="number"
                step="0.01"
                value={iof}
                onChange={(e) => setIof(e.target.value)}
              />
            </div>
            <div className="grid gap-1">
              <Label>Tarifas (R$)</Label>
              <Input
                type="number"
                step="0.01"
                value={tarifas}
                onChange={(e) => setTarifas(e.target.value)}
              />
            </div>
          </div>
          <div className="grid gap-1">
            <Label>Observações</Label>
            <Textarea
              rows={2}
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
            Criar rascunho
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function OperacaoTitulosPanel({ operacao, onClose }: { operacao: any; onClose: () => void }) {
  const titulosQ = useAntecipacaoTitulos(operacao.id);
  const elegiveisQ = useAntecipacaoElegiveis();
  const adicionar = useAdicionarTitulosAntecipacao();
  const remover = useRemoverTituloAntecipacao(operacao.id);
  const atualizarOperacao = useAtualizarOperacaoAntecipacao();

  const titulos = titulosQ.data ?? [];
  const elegiveis = elegiveisQ.data ?? [];
  const [busca, setBusca] = useState("");
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const [taxaMensal, setTaxaMensal] = useState(() =>
    taxaOperadorParaInput(operacao.operador?.taxa_referencia_am),
  );
  const [iof, setIof] = useState(() => String(Number(operacao.iof ?? 0)));
  const [tarifas, setTarifas] = useState(() => String(Number(operacao.tarifas ?? 0)));

  const idsAtuais = useMemo(
    () => new Set(titulos.map((t: any) => t.faturamento_nfse_id)),
    [titulos],
  );
  const elegiveisFiltrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return elegiveis
      .filter((nf: any) => !idsAtuais.has(nf.id))
      .filter((nf: any) => {
        if (!termo) return true;
        return [nf.numero_nfse, nf.tomador_razao, nf.obra?.nome]
          .filter(Boolean)
          .some((v) => String(v).toLowerCase().includes(termo));
      });
  }, [busca, elegiveis, idsAtuais]);

  const nfsSelecionadas = useMemo(
    () => elegiveis.filter((nf: any) => selecionados.has(nf.id)),
    [elegiveis, selecionados],
  );

  const previa = useMemo(() => {
    const taxa = Number(taxaMensal || 0) / 100;
    const novos = nfsSelecionadas.map((nf: any) =>
      calcularTituloNovo(nf, operacao.data_operacao, taxa),
    );
    const existentes = titulos.map((t: any) => ({
      valorFace: Number(t.valor_face ?? 0),
      valorAntecipado: Number(t.valor_antecipado ?? 0),
      desagio: Number(t.desagio_rateado ?? 0),
      iof: Number(t.iof_rateado ?? 0),
      vencimento: t.data_vencimento_original,
      dias: Number(t.dias_exposicao ?? 0),
    }));
    const todos = [...existentes, ...novos];
    const face = round2(todos.reduce((acc, t) => acc + t.valorFace, 0));
    const desagioTotal = round2(todos.reduce((acc, t) => acc + t.desagio, 0));
    const iofTotal = Number(iof || 0);
    const tarifasTotal = Number(tarifas || 0);
    const liquido = round2(Math.max(0, face - desagioTotal - iofTotal - tarifasTotal));
    const prazoMedio = calcularPrazoMedio(todos);
    return {
      novos,
      face,
      desagioTotal,
      iofTotal,
      tarifasTotal,
      liquido,
      prazoMedio,
      vencimentoRepasse: maiorData(todos.map((t) => t.vencimento).filter(Boolean)),
    };
  }, [iof, nfsSelecionadas, operacao.data_operacao, tarifas, taxaMensal, titulos]);

  function toggleSelecionado(id: string, checked: boolean) {
    setSelecionados((atual) => {
      const next = new Set(atual);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  async function atualizarTotais(extra?: { titulos?: any[] }) {
    const base = extra?.titulos ?? titulos;
    const face = round2(base.reduce((acc: number, t: any) => acc + Number(t.valor_face ?? 0), 0));
    const desagio = round2(
      base.reduce((acc: number, t: any) => acc + Number(t.desagio_rateado ?? 0), 0),
    );
    const iofTotal = Number(iof || 0);
    const tarifasTotal = Number(tarifas || 0);
    await atualizarOperacao.mutateAsync({
      id: operacao.id,
      patch: {
        valor_face_total: face,
        valor_liquido_recebido: round2(Math.max(0, face - desagio - iofTotal - tarifasTotal)),
        desagio_total: desagio,
        iof: iofTotal,
        tarifas: tarifasTotal,
        data_vencimento_repasse:
          maiorData(base.map((t: any) => t.data_vencimento_original).filter(Boolean)) ??
          operacao.data_vencimento_repasse,
      },
    });
  }

  async function handleAdicionar() {
    if (nfsSelecionadas.length === 0) return toast.error("Selecione ao menos uma NFS-e");
    const taxa = Number(taxaMensal || 0) / 100;
    const rows = nfsSelecionadas.map((nf: any) => {
      const calc = calcularTituloNovo(nf, operacao.data_operacao, taxa);
      return {
        operacao_id: operacao.id,
        faturamento_nfse_id: nf.id,
        obra_id: nf.obra_id ?? null,
        valor_face: calc.valorFace,
        valor_antecipado: calc.valorAntecipado,
        desagio_rateado: calc.desagio,
        iof_rateado: 0,
        data_vencimento_original: nf.data_vencimento,
        dias_exposicao: calc.dias,
      };
    });
    try {
      const inseridos = await adicionar.mutateAsync(rows);
      await atualizarTotais({ titulos: [...titulos, ...(inseridos ?? [])] });
      setSelecionados(new Set());
      toast.success("Títulos vinculados", {
        description: `${rows.length} NFS-e adicionada(s) à operação.`,
      });
    } catch (e: any) {
      toast.error("Falha ao vincular títulos", { description: e?.message });
    }
  }

  async function handleRemover(titulo: any) {
    try {
      await remover.mutateAsync(titulo.id);
      await atualizarTotais({ titulos: titulos.filter((t: any) => t.id !== titulo.id) });
      toast.success("Título removido");
    } catch (e: any) {
      toast.error("Falha ao remover título", { description: e?.message });
    }
  }

  async function handleAtualizarTotais() {
    try {
      await atualizarTotais();
      toast.success("Totais atualizados");
    } catch (e: any) {
      toast.error("Falha ao atualizar totais", { description: e?.message });
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3">
        <div>
          <CardTitle className="text-base">
            Títulos da operação {operacao.numero_interno ?? "—"}
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Selecione NFS-e vencíveis e confira face, deságio, líquido e prazo antes de aprovar.
          </p>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <Kpi label="Face projetada" value={brl(previa.face)} />
          <Kpi label="Deságio" value={brl(previa.desagioTotal)} />
          <Kpi label="Líquido" value={brl(previa.liquido)} />
          <Kpi
            label="Prazo médio"
            value={previa.prazoMedio ? `${previa.prazoMedio.toFixed(0)} d` : "—"}
          />
          <Kpi label="NFS-e" value={String(titulos.length + nfsSelecionadas.length)} />
        </div>

        <div className="grid md:grid-cols-4 gap-3">
          <div className="grid gap-1">
            <Label>Taxa mensal p/ novos (%)</Label>
            <Input
              type="number"
              step="0.01"
              value={taxaMensal}
              onChange={(e) => setTaxaMensal(e.target.value)}
            />
          </div>
          <div className="grid gap-1">
            <Label>IOF total (R$)</Label>
            <Input type="number" step="0.01" value={iof} onChange={(e) => setIof(e.target.value)} />
          </div>
          <div className="grid gap-1">
            <Label>Tarifas (R$)</Label>
            <Input
              type="number"
              step="0.01"
              value={tarifas}
              onChange={(e) => setTarifas(e.target.value)}
            />
          </div>
          <div className="flex items-end">
            <Button
              variant="outline"
              className="w-full"
              onClick={handleAtualizarTotais}
              disabled={atualizarOperacao.isPending}
            >
              <Calculator className="h-4 w-4 mr-1" /> Atualizar totais
            </Button>
          </div>
        </div>

        <div className="grid lg:grid-cols-[1fr_1.1fr] gap-5">
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold">Títulos vinculados</h2>
              {titulosQ.isLoading && (
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              )}
            </div>
            <div className="border rounded-md overflow-hidden">
              {titulos.length === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center">
                  Nenhum título vinculado.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>NFS-e</TableHead>
                      <TableHead>Venc.</TableHead>
                      <TableHead>Face</TableHead>
                      <TableHead />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {titulos.map((t: any) => (
                      <TableRow key={t.id}>
                        <TableCell>
                          <div className="font-mono text-xs">
                            {t.faturamento?.numero_nfse ?? "—"}
                          </div>
                          <div className="text-xs text-muted-foreground truncate max-w-44">
                            {t.faturamento?.tomador_razao ?? t.obra?.nome ?? "—"}
                          </div>
                        </TableCell>
                        <TableCell>{fmtData(t.data_vencimento_original)}</TableCell>
                        <TableCell>{brl(Number(t.valor_face ?? 0))}</TableCell>
                        <TableCell className="text-right">
                          {operacao.status === "rascunho" && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleRemover(t)}
                              disabled={remover.isPending}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold">NFS-e elegíveis</h2>
              <Button
                size="sm"
                onClick={handleAdicionar}
                disabled={
                  adicionar.isPending || selecionados.size === 0 || operacao.status !== "rascunho"
                }
              >
                {adicionar.isPending ? (
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                ) : (
                  <Plus className="h-4 w-4 mr-1" />
                )}
                Adicionar {selecionados.size || ""}
              </Button>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-9"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar por NFS-e, tomador ou obra"
              />
            </div>
            <ScrollArea className="h-96 rounded-md border">
              {elegiveisQ.isLoading ? (
                <div className="flex items-center justify-center h-40 text-muted-foreground">
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Carregando títulos...
                </div>
              ) : elegiveisFiltrados.length === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center">
                  Nenhuma NFS-e elegível encontrada.
                </p>
              ) : (
                <div className="divide-y">
                  {elegiveisFiltrados.map((nf: any) => {
                    const calc = calcularTituloNovo(
                      nf,
                      operacao.data_operacao,
                      Number(taxaMensal || 0) / 100,
                    );
                    return (
                      <label
                        key={nf.id}
                        className="flex gap-3 p-3 cursor-pointer hover:bg-muted/50"
                      >
                        <Checkbox
                          checked={selecionados.has(nf.id)}
                          onCheckedChange={(checked) => toggleSelecionado(nf.id, checked === true)}
                          disabled={operacao.status !== "rascunho"}
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-mono text-xs">{nf.numero_nfse}</span>
                            <span className="text-sm font-medium">{brl(calc.valorFace)}</span>
                          </div>
                          <p className="text-xs text-muted-foreground truncate">
                            {nf.tomador_razao ?? nf.obra?.nome ?? "—"}
                          </p>
                          <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                            <span>Venc. {fmtData(nf.data_vencimento)}</span>
                            <span>{calc.dias} d</span>
                            <span>Líquido proj. {brl(calc.valorAntecipado)}</span>
                          </div>
                        </div>
                      </label>
                    );
                  })}
                </div>
              )}
            </ScrollArea>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function round2(v: number): number {
  return Math.round((Number.isFinite(v) ? v : 0) * 100) / 100;
}

function taxaOperadorParaInput(v: unknown): string {
  const n = Number(v ?? 0);
  if (!Number.isFinite(n) || n <= 0) return "";
  return String(round2(n <= 1 ? n * 100 : n));
}

function calcularTituloNovo(nf: any, dataOperacao: string, taxaMensalDecimal: number) {
  const valorFace = round2(Number(nf.valor_liquido ?? nf.valor_servicos ?? 0));
  const dias = Math.max(0, diasExposicao(dataOperacao, nf.data_vencimento));
  const taxaPeriodo =
    taxaMensalDecimal > 0 && dias > 0 ? Math.pow(1 + taxaMensalDecimal, dias / 30) - 1 : 0;
  const desagio = round2(valorFace * taxaPeriodo);
  return {
    valorFace,
    valorAntecipado: round2(Math.max(0, valorFace - desagio)),
    desagio,
    iof: 0,
    vencimento: nf.data_vencimento,
    dias,
  };
}

function calcularPrazoMedio(titulos: { valorFace: number; dias: number }[]): number {
  const face = titulos.reduce((acc, t) => acc + Number(t.valorFace || 0), 0);
  if (face <= 0) return 0;
  return titulos.reduce((acc, t) => acc + Number(t.valorFace || 0) * Number(t.dias || 0), 0) / face;
}

function maiorData(datas: string[]): string | null {
  if (datas.length === 0) return null;
  return datas.reduce((maior, atual) => (atual > maior ? atual : maior), datas[0]);
}

function LiquidacaoDialog({ operacao, onClose }: { operacao: any | null; onClose: () => void }) {
  const open = !!operacao;
  const opId = operacao?.id as string | undefined;
  const liqQ = useAntecipacaoLiquidacoes(opId);
  const registrar = useRegistrarLiquidacaoAntecipacao();
  const atualizar = useAtualizarOperacaoAntecipacao();

  const liquidacoes = liqQ.data ?? [];
  const totalLiquidado = liquidacoes.reduce((acc: number, l: any) => acc + Number(l.valor ?? 0), 0);
  const alvo = Number(operacao?.valor_liquido_recebido ?? 0);
  const saldo = round2(Math.max(0, alvo - totalLiquidado));

  const [data, setData] = useState(() => new Date().toISOString().slice(0, 10));
  const [tipo, setTipo] = useState("total");
  const [valor, setValor] = useState("");
  const [obs, setObs] = useState("");

  async function handleRegistrar() {
    const v = Number(valor || 0);
    if (!opId) return;
    if (!(v > 0)) return toast.error("Informe um valor > 0");
    try {
      await registrar.mutateAsync({
        operacao_id: opId,
        data,
        tipo,
        valor: round2(v),
        observacoes: obs || null,
      });
      const novoTotal = round2(totalLiquidado + v);
      if (novoTotal + 0.005 >= alvo) {
        await atualizar.mutateAsync({
          id: opId,
          patch: { status: "liquidada" },
        });
        toast.success("Operação liquidada integralmente");
        onClose();
      } else {
        toast.success("Liquidação registrada", {
          description: `Saldo restante ${brl(alvo - novoTotal)}`,
        });
      }
      setValor("");
      setObs("");
    } catch (e: any) {
      toast.error("Falha ao registrar", { description: e?.message });
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Liquidação — {operacao?.numero_interno ?? "—"}</DialogTitle>
          <DialogDescription>
            Registre repasses parciais ou integrais. A operação passa a “Liquidada” ao atingir o
            valor líquido esperado.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-3 gap-3">
          <Kpi label="Líquido esperado" value={brl(alvo)} />
          <Kpi label="Liquidado" value={brl(totalLiquidado)} />
          <Kpi label="Saldo" value={brl(saldo)} />
        </div>

        <div className="grid md:grid-cols-4 gap-3 mt-2">
          <div className="grid gap-1">
            <Label>Data</Label>
            <Input type="date" value={data} onChange={(e) => setData(e.target.value)} />
          </div>
          <div className="grid gap-1">
            <Label>Tipo</Label>
            <Select value={tipo} onValueChange={setTipo}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="total">Total</SelectItem>
                <SelectItem value="parcial">Parcial</SelectItem>
                <SelectItem value="ajuste">Ajuste</SelectItem>
                <SelectItem value="estorno">Estorno</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1">
            <Label>Valor (R$)</Label>
            <Input
              type="number"
              step="0.01"
              value={valor}
              onChange={(e) => setValor(e.target.value)}
              placeholder={String(saldo)}
            />
          </div>
          <div className="flex items-end">
            <Button className="w-full" onClick={handleRegistrar} disabled={registrar.isPending}>
              {registrar.isPending ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <Plus className="h-4 w-4 mr-1" />
              )}
              Registrar
            </Button>
          </div>
          <div className="md:col-span-4 grid gap-1">
            <Label>Observações</Label>
            <Textarea rows={2} value={obs} onChange={(e) => setObs(e.target.value)} />
          </div>
        </div>

        <div className="border rounded-md overflow-hidden mt-3">
          {liqQ.isLoading ? (
            <div className="flex items-center justify-center py-6 text-muted-foreground">
              <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Carregando...
            </div>
          ) : liquidacoes.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">
              Nenhuma liquidação registrada.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead>Observações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {liquidacoes.map((l: any) => (
                  <TableRow key={l.id}>
                    <TableCell>{fmtData(l.data)}</TableCell>
                    <TableCell className="capitalize">{l.tipo}</TableCell>
                    <TableCell>{brl(Number(l.valor ?? 0))}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {l.observacoes ?? "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
