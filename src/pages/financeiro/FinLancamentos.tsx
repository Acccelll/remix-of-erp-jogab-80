import { Link, useNavigate, useSearchParams, useParams, Outlet } from "react-router-dom";
import { lazy, Suspense, useMemo, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
const FinImportar = lazy(() => import("@/pages/financeiro/FinImportar"));

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Download, Upload, Plus, Loader2 } from "lucide-react";
import {
  OrigemBadge,
  OrigemFilter,
  type OrigemLancamento,
} from "@/components/financeiro/OrigemBadge";
import {
  TituloManualFormDialog,
  type TituloManualEdicao,
} from "@/components/financeiro/TituloManualFormDialog";
import { FeatureGate } from "@/components/common/FeatureGate";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
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
import { brl } from "@/lib/billing";
import { financeiroRepo } from "@/lib/repositories/financeiro";
import { usePlanoContasLabels } from "@/lib/financeiro-totvs/labels";
import {
  fetchFinanceiroGeral,
  fetchObrasComVinculo,
  fetchSnapshotAtivo,
  finKeys,
  fetchBmsPrevistas,
  fetchRecebimentos,
  fetchNotasFiscais,
  fetchFinanceiroObra,
} from "@/lib/financeiro-totvs/queries";
import {
  agregarPorObra,
  agregarPorCategoriaIndireta,
  agregarNaoClassificados,
  montarConfronto,
  toCsv,
} from "@/lib/financeiro-totvs/confronto";
import { kpisObra, porNatureza, type FinLinha } from "@/lib/financeiro-totvs/agregacoes";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "@/components/ui/chart";
import { fmtDataHora } from "@/lib/core/date";

function FinanceiroPage() {
  const [novoTituloOpen, setNovoTituloOpen] = useState(false);

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Financeiro</h1>
          <p className="text-sm text-muted-foreground">Confronto TOTVS × ObraFlow.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setNovoTituloOpen(true)}>
            <Plus className="h-4 w-4 mr-2" /> Novo título
          </Button>
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="outline" size="sm">
                <Upload className="h-4 w-4 mr-2" /> Importar TOTVS
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-full sm:max-w-4xl overflow-y-auto">
              <SheetHeader>
                <SheetTitle>Importar dados do TOTVS</SheetTitle>
              </SheetHeader>
              <div className="mt-4">
                <Suspense
                  fallback={<div className="text-sm text-muted-foreground py-8">Carregando…</div>}
                >
                  <FinImportar />
                </Suspense>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </header>

      <TituloManualFormDialog open={novoTituloOpen} onOpenChange={setNovoTituloOpen} />

      <Tabs defaultValue="geral">
        <TabsList>
          <TabsTrigger value="geral">Visão geral</TabsTrigger>
          <TabsTrigger value="prev_real">Previsto × Realizado</TabsTrigger>
          <TabsTrigger value="natureza">Por natureza</TabsTrigger>
        </TabsList>
        <TabsContent value="geral" className="mt-4">
          <VisaoGeral />
        </TabsContent>
        <TabsContent value="prev_real" className="mt-4">
          <PrevistoRealizado />
        </TabsContent>
        <TabsContent value="natureza" className="mt-4">
          <PorNatureza />
        </TabsContent>
      </Tabs>
    </div>
  );
}

/* ============== Visão geral ============== */
function VisaoGeral() {
  const { data: snapshot } = useQuery({ queryKey: finKeys.snapshot, queryFn: fetchSnapshotAtivo });
  const { data: linhas } = useQuery<FinLinha[]>({
    queryKey: finKeys.geral,
    queryFn: fetchFinanceiroGeral,
  });

  const kpis = useMemo(() => kpisObra(linhas ?? []), [linhas]);
  const porObra = useMemo(() => agregarPorObra(linhas ?? []), [linhas]);
  const porCategoria = useMemo(() => agregarPorCategoriaIndireta(linhas ?? []), [linhas]);
  const naoClassificados = useMemo(() => agregarNaoClassificados(linhas ?? []), [linhas]);
  const obras = useMemo(() => porObra, [porObra]);
  const totalNaoClass = useMemo(
    () => naoClassificados.reduce((a, c) => a + c.total, 0),
    [naoClassificados],
  );
  const totalIndireto = useMemo(
    () => porCategoria.reduce((a, c) => a + c.despesa - c.receita, 0),
    [porCategoria],
  );

  return (
    <div className="space-y-4">
      {snapshot ? (
        <div className="flex items-center justify-between bg-muted/40 border rounded-md px-4 py-2 text-sm">
          <div>
            <span className="font-medium">Snapshot ativo:</span>{" "}
            <span className="text-muted-foreground">
              {snapshot.periodo_ref ?? "—"} · importado em{" "}
              {fmtDataHora(snapshot.importado_em)} · {snapshot.total_titulos}{" "}
              títulos
            </span>
          </div>
          <div className="flex items-center gap-3">
            <Link to="/financeiro/centros" className="text-primary hover:underline">
              Centros de custo
            </Link>
            <FeatureGate flag="legacy.financeiro_import">
              <Link
                to="/financeiro/importar"
                className="inline-flex items-center gap-1 text-primary hover:underline"
              >
                <Upload className="h-4 w-4" /> Reimportar
              </Link>
            </FeatureGate>
          </div>
        </div>
      ) : (
        <div className="bg-muted/40 border rounded-md px-4 py-3 text-sm">
          Nenhum snapshot importado.{" "}
          <FeatureGate
            flag="legacy.financeiro_import"
            fallback={
              <span className="text-muted-foreground">Aguardando snapshot automático.</span>
            }
          >
            <Link to="/financeiro/importar" className="text-primary hover:underline">
              Importar relatório TOTVS
            </Link>
            .
          </FeatureGate>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Kpi label="Receita (snapshot)" valor={kpis.receitaBaixada + kpis.receitaAReceber} />
        <Kpi label="Despesa (snapshot)" valor={kpis.despesaPaga + kpis.despesaAPagar} />
        <Kpi label="Saldo realizado" valor={kpis.saldoRealizado} highlight />
        <Kpi label="Indiretos (ADM, RH, Frota…)" valor={totalIndireto} />
      </div>

      {naoClassificados.length > 0 && (
        <Card className="border-warning/40 bg-warning/40 dark:bg-warning/20">
          <CardContent className="py-3 flex items-center justify-between gap-4">
            <div className="text-sm">
              <strong>{naoClassificados.length}</strong> centro(s) de custo não classificado(s) ·{" "}
              {brl(totalNaoClass)} em títulos · não entram em obra nem em indireto.
            </div>
            <Link
              to="/financeiro/centros"
              className="text-sm text-primary hover:underline whitespace-nowrap"
            >
              Classificar agora →
            </Link>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Por obra</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Código</TableHead>
                <TableHead>Obra</TableHead>
                <TableHead className="text-right">Receita</TableHead>
                <TableHead className="text-right">Despesa</TableHead>
                <TableHead className="text-right">Saldo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {obras.map((o) => (
                <TableRow
                  key={o.obra_id ?? "__sem_obra__"}
                  className={o.obra_id ? "" : "bg-warning/40 dark:bg-warning/20"}
                >
                  <TableCell>{o.obra_codigo ?? (o.obra_id ? "—" : "—")}</TableCell>
                  <TableCell>
                    {o.obra_nome ?? (
                      <span className="text-warning">
                        Sem obra — centros não classificados ·{" "}
                        <Link to="/financeiro/centros" className="underline">
                          classificar
                        </Link>
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">{brl(o.receita)}</TableCell>
                  <TableCell className="text-right">{brl(o.despesa)}</TableCell>
                  <TableCell
                    className={`text-right font-medium ${o.saldo < 0 ? "text-destructive" : ""}`}
                  >
                    {brl(o.saldo)}
                  </TableCell>
                </TableRow>
              ))}
              {obras.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-muted-foreground">
                    Sem dados.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Indiretos por categoria</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Categoria</TableHead>
                <TableHead className="text-right">Títulos</TableHead>
                <TableHead className="text-right">Receita</TableHead>
                <TableHead className="text-right">Despesa</TableHead>
                <TableHead className="text-right">Saldo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {porCategoria.map((c) => (
                <TableRow key={c.categoria}>
                  <TableCell className="font-medium">{c.categoria}</TableCell>
                  <TableCell className="text-right">{c.titulos}</TableCell>
                  <TableCell className="text-right">{brl(c.receita)}</TableCell>
                  <TableCell className="text-right">{brl(c.despesa)}</TableCell>
                  <TableCell
                    className={`text-right font-medium ${c.saldo < 0 ? "text-destructive" : ""}`}
                  >
                    {brl(c.saldo)}
                  </TableCell>
                </TableRow>
              ))}
              {porCategoria.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-muted-foreground">
                    Nenhum centro classificado como indireto ainda.{" "}
                    <Link to="/financeiro/centros" className="text-primary hover:underline">
                      Classificar →
                    </Link>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

import { Kpi as KpiBase } from "@/components/common/Kpi";
function Kpi({ label, valor, highlight }: { label: string; valor: number; highlight?: boolean }) {
  return (
    <KpiBase
      label={label}
      value={brl(valor)}
      tone={valor < 0 ? "danger" : "default"}
      highlight={highlight}
      tabularNums={false}
    />
  );
}

/* ============== Previsto × Realizado ============== */
function PrevistoRealizado() {
  const { data: obras } = useQuery({ queryKey: ["obras_vinculo"], queryFn: fetchObrasComVinculo });
  const obrasComCc = (obras ?? []).filter((o) => !!o.centro_custo_totvs);
  const [obraId, setObraId] = useState<string>("");

  const obraSel = obrasComCc[0];
  const selecionada = obraId || obraSel?.id || "";

  const enabled = !!selecionada;
  const linhasQ = useQuery({
    queryKey: finKeys.obra(selecionada),
    queryFn: () => fetchFinanceiroObra(selecionada),
    enabled,
  });
  const bmsQ = useQuery({
    queryKey: ["bms_prev_ro", selecionada],
    queryFn: () => fetchBmsPrevistas(selecionada),
    enabled,
  });
  const recebQ = useQuery({
    queryKey: ["receb_ro", selecionada],
    queryFn: () => fetchRecebimentos(selecionada),
    enabled,
  });
  const nfsQ = useQuery({
    queryKey: ["nfs_ro", selecionada],
    queryFn: () => fetchNotasFiscais(selecionada),
    enabled,
  });

  const confronto = useMemo(() => {
    if (!selecionada) return [];
    return montarConfronto({
      linhas: (linhasQ.data as FinLinha[] | undefined) ?? [],
      bms:
        (bmsQ.data as { data_corte: string; valor_previsto_dinamico: number }[] | undefined) ?? [],
      receb: (recebQ.data as Parameters<typeof montarConfronto>[0]["receb"] | undefined) ?? [],
      nfs:
        (nfsQ.data as
          | {
              competencia: string | null;
              data_emissao: string | null;
              valor: number;
              status: string;
            }[]
          | undefined) ?? [],
    });
  }, [selecionada, linhasQ.data, bmsQ.data, recebQ.data, nfsQ.data]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <span className="text-sm text-muted-foreground">Obra:</span>
        <Select value={selecionada} onValueChange={setObraId}>
          <SelectTrigger className="w-80">
            <SelectValue placeholder="Selecione" />
          </SelectTrigger>
          <SelectContent>
            {obrasComCc.map((o) => (
              <SelectItem key={o.id} value={o.id}>
                {o.codigo} — {o.nome}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {obras && obrasComCc.length === 0 && (
        <Card className="border-warning/40 bg-warning/40 dark:bg-warning/20">
          <CardContent className="py-4 text-sm space-y-1">
            <div className="font-medium">Nenhuma obra com Centro de Custo TOTVS vinculado.</div>
            <div className="text-muted-foreground">
              Para comparar previsto × realizado, edite cada obra e informe o código do Centro de
              Custo TOTVS (campo na ficha da obra) ou classifique os centros em{" "}
              <Link to="/financeiro/centros" className="text-primary hover:underline">
                Centros de custo
              </Link>
              .
            </div>
          </CardContent>
        </Card>
      )}

      {selecionada && (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Despesa: BMS previsto × TOTVS realizado</CardTitle>
            </CardHeader>
            <CardContent style={{ height: 280 }}>
              {confronto.length === 0 ? (
                <div className="text-sm text-muted-foreground">Sem dados.</div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={confronto}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="mes" />
                    <YAxis tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                    <Tooltip formatter={(v: any) => brl(Number(v))} />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="despesaPrevistaBms"
                      name="Previsto (BMS)"
                      stroke="hsl(var(--primary))"
                      strokeWidth={2}
                      dot={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="despesaRealizadaTotvs"
                      name="Realizado (TOTVS)"
                      stroke="hsl(var(--destructive))"
                      strokeWidth={2}
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Tabela comparativa</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Mês</TableHead>
                    <TableHead className="text-right">BMS previsto</TableHead>
                    <TableHead className="text-right">Despesa TOTVS</TableHead>
                    <TableHead className="text-right">Desvio</TableHead>
                    <TableHead className="text-right">Receita TOTVS</TableHead>
                    <TableHead className="text-right">Recebimentos</TableHead>
                    <TableHead className="text-right">NFs emitidas</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {confronto.map((r) => (
                    <TableRow key={r.mes}>
                      <TableCell>{r.mes}</TableCell>
                      <TableCell className="text-right">{brl(r.despesaPrevistaBms)}</TableCell>
                      <TableCell className="text-right">{brl(r.despesaRealizadaTotvs)}</TableCell>
                      <TableCell
                        className={`text-right font-medium ${r.desvioDespesa < 0 ? "text-destructive" : "text-success"}`}
                      >
                        {brl(r.desvioDespesa)}
                      </TableCell>
                      <TableCell className="text-right">{brl(r.receitaTotvs)}</TableCell>
                      <TableCell className="text-right">{brl(r.receitaRecebimentos)}</TableCell>
                      <TableCell className="text-right">{brl(r.receitaNfsEmitidas)}</TableCell>
                    </TableRow>
                  ))}
                  {confronto.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-muted-foreground">
                        Sem dados.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

/* ============== Por natureza ============== */
function PorNatureza() {
  const queryClient = useQueryClient();
  const { data: linhas } = useQuery<FinLinha[]>({
    queryKey: finKeys.geral,
    queryFn: fetchFinanceiroGeral,
  });
  const { data: obras } = useQuery({ queryKey: ["obras_vinculo"], queryFn: fetchObrasComVinculo });

  const [obraFiltro, setObraFiltro] = useState<string>("__todas__");
  const [grupoFiltro, setGrupoFiltro] = useState<string>("__todos__");
  const [statusFiltro, setStatusFiltro] = useState<string>("__todos__");
  const [origemFiltro, setOrigemFiltro] = useState<OrigemLancamento | "todos">("todos");
  const [mesIni, setMesIni] = useState("");
  const [mesFim, setMesFim] = useState("");
  const [nivelSel, setNivelSel] = useState<
    | { nivel: "grupo"; grupo: string; label: string }
    | { nivel: "subgrupo"; grupo: string; subgrupo: string; label: string }
    | { nivel: "natureza"; cod: string; desc: string | null }
    | null
  >(null);

  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [edicaoTitulo, setEdicaoTitulo] = useState<TituloManualEdicao | null>(null);
  const [baixaAlvo, setBaixaAlvo] = useState<{ ref: number; saldo: number } | null>(null);
  const [valorBaixa, setValorBaixa] = useState("");
  const [dataBaixa, setDataBaixa] = useState(() => new Date().toISOString().slice(0, 10));
  const [cancelarAlvo, setCancelarAlvo] = useState<number | null>(null);

  const filtradas = useMemo(() => {
    return (linhas ?? []).filter((l) => {
      if (obraFiltro !== "__todas__") {
        if (obraFiltro === "__sem__" && l.obra_id) return false;
        if (obraFiltro !== "__sem__" && l.obra_id !== obraFiltro) return false;
      }
      if (grupoFiltro !== "__todos__" && l.grupo !== grupoFiltro) return false;
      if (statusFiltro !== "__todos__" && String(l.status_cod) !== statusFiltro) return false;
      if (origemFiltro !== "todos" && (l.origem ?? "totvs") !== origemFiltro) return false;
      const mes = (l.mes_competencia ?? l.data_vencimento ?? "").slice(0, 7);
      if (mesIni && mes && mes < mesIni) return false;
      if (mesFim && mes && mes > mesFim) return false;
      return true;
    });
  }, [linhas, obraFiltro, grupoFiltro, statusFiltro, origemFiltro, mesIni, mesFim]);

  const arvore = useMemo(() => porNatureza(filtradas), [filtradas]);
  const { label: rotularNatureza } = usePlanoContasLabels();

  function abrirEdicaoTitulo(refLancamento: number) {
    const linhasDoTitulo = (linhas ?? []).filter(
      (l) => l.ref_lancamento === refLancamento && l.origem === "manual",
    );
    if (!linhasDoTitulo.length) return;
    const base = linhasDoTitulo[0];
    setEdicaoTitulo({
      ref_lancamento: refLancamento,
      natureza_tipo: (base.natureza_tipo === 1 ? 1 : 2) as 1 | 2,
      centro_custo: base.centro_custo ?? "",
      cnpj_cpf: base.cnpj_cpf ?? null,
      nome: base.contraparte ?? null,
      data_emissao: base.data_emissao ?? null,
      data_vencimento: base.data_vencimento ?? "",
      historico: base.historico ?? null,
      rateios: linhasDoTitulo
        .filter((l) => l.cod_natureza)
        .map((l) => ({
          cod_natureza: l.cod_natureza as string,
          valor_rateio: Number(l.valor_rateio ?? 0),
        })),
    });
    setEditDialogOpen(true);
  }

  const baixarMutation = useMutation({
    mutationFn: async () => {
      if (!baixaAlvo) return;
      await financeiroRepo.rpcBaixarTituloManual(
        baixaAlvo.ref,
        Number(valorBaixa.replace(",", ".")) || 0,
        dataBaixa,
      );
    },
    onSuccess: () => {
      toast.success("Baixa registrada.");
      queryClient.invalidateQueries({ queryKey: finKeys.geral });
      setBaixaAlvo(null);
      setValorBaixa("");
    },
    onError: (err: any) => toast.error(err?.message ?? String(err)),
  });

  const cancelarMutation = useMutation({
    mutationFn: async () => {
      if (cancelarAlvo == null) return;
      await financeiroRepo.rpcCancelarTituloManual(cancelarAlvo);
    },
    onSuccess: () => {
      toast.success("Título cancelado.");
      queryClient.invalidateQueries({ queryKey: finKeys.geral });
      setCancelarAlvo(null);
    },
    onError: (err: any) => toast.error(err?.message ?? String(err)),
  });

  function exportarCsv() {
    const rows = filtradas.map((l) => ({
      obra_codigo: (l as unknown as { obra_codigo?: string | null }).obra_codigo ?? "",
      obra_nome: (l as unknown as { obra_nome?: string | null }).obra_nome ?? "",
      grupo: l.grupo ?? "",
      subgrupo: l.subgrupo ?? "",
      cod_natureza: l.cod_natureza ?? "",
      desc_natureza: l.desc_natureza ?? "",
      ref_lancamento: l.ref_lancamento ?? "",
      contraparte: l.contraparte ?? "",
      origem: l.origem ?? "totvs",
      status: l.status_label ?? "",
      mes_competencia: (l.mes_competencia ?? "").slice(0, 7),
      valor_rateio: l.valor_rateio ?? 0,
      valor_liquido: l.valor_liquido ?? 0,
    }));
    const csv = toCsv(rows);
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `financeiro-natureza-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="py-4 flex flex-wrap items-end gap-3">
          <div>
            <div className="text-xs text-muted-foreground mb-1">Obra</div>
            <Select value={obraFiltro} onValueChange={setObraFiltro}>
              <SelectTrigger className="w-64">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__todas__">Todas</SelectItem>
                <SelectItem value="__sem__">Administrativo (sem obra)</SelectItem>
                {(obras ?? []).map((o) => (
                  <SelectItem key={o.id} value={o.id}>
                    {o.codigo} — {o.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <div className="text-xs text-muted-foreground mb-1">Grupo</div>
            <Select value={grupoFiltro} onValueChange={setGrupoFiltro}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__todos__">Todos</SelectItem>
                <SelectItem value="1">1 — Receitas</SelectItem>
                <SelectItem value="2">2 — Despesas</SelectItem>
                <SelectItem value="3">3 — Movimentações</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <div className="text-xs text-muted-foreground mb-1">Status</div>
            <Select value={statusFiltro} onValueChange={setStatusFiltro}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__todos__">Todos</SelectItem>
                <SelectItem value="3">Baixado</SelectItem>
                <SelectItem value="15">Parcial</SelectItem>
                <SelectItem value="40">Vencido</SelectItem>
                <SelectItem value="56">A vencer</SelectItem>
                <SelectItem value="18">Cancelado</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <div className="text-xs text-muted-foreground mb-1">Mês inicial</div>
            <Input
              type="month"
              value={mesIni}
              onChange={(e) => setMesIni(e.target.value)}
              className="w-40"
            />
          </div>
          <div>
            <div className="text-xs text-muted-foreground mb-1">Mês final</div>
            <Input
              type="month"
              value={mesFim}
              onChange={(e) => setMesFim(e.target.value)}
              className="w-40"
            />
          </div>
          <div className="ml-auto">
            <div>
              <div className="text-xs text-muted-foreground mb-1">Origem</div>
              <OrigemFilter value={origemFiltro} onChange={setOrigemFiltro} />
            </div>
            <Button variant="outline" size="sm" onClick={exportarCsv}>
              <Download className="h-4 w-4 mr-1" /> Exportar CSV
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Naturezas ({filtradas.length} linhas)</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Grupo / Subgrupo / Natureza</TableHead>
                <TableHead className="text-right">Pago</TableHead>
                <TableHead className="text-right">Em aberto</TableHead>
                <TableHead className="text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {arvore.map((g) => (
                <Fragmento key={g.grupo}>
                  <TableRow className="bg-muted/40">
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <span>{rotularNatureza(g.grupo)}</span>
                        <Badge
                          variant="outline"
                          className="cursor-pointer hover:bg-muted"
                          title="Ver todos os lançamentos deste grupo"
                          onClick={() =>
                            setNivelSel({
                              nivel: "grupo",
                              grupo: g.grupo,
                              label: rotularNatureza(g.grupo),
                            })
                          }
                        >
                          Ver lançamentos
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">{brl(g.valor_pago)}</TableCell>
                    <TableCell className="text-right">{brl(g.valor_aberto)}</TableCell>
                    <TableCell className="text-right font-medium">{brl(g.valor_total)}</TableCell>
                  </TableRow>
                  {g.subgrupos.map((sg) => (
                    <Fragmento key={`${g.grupo}-${sg.subgrupo}`}>
                      <TableRow>
                        <TableCell className="pl-6 font-medium">
                          <div className="flex items-center gap-2">
                            <span>{rotularNatureza(sg.subgrupo)}</span>
                            <Badge
                              variant="outline"
                              className="cursor-pointer hover:bg-muted"
                              title="Ver todos os lançamentos deste subgrupo"
                              onClick={() =>
                                setNivelSel({
                                  nivel: "subgrupo",
                                  grupo: g.grupo,
                                  subgrupo: sg.subgrupo,
                                  label: rotularNatureza(sg.subgrupo),
                                })
                              }
                            >
                              Ver lançamentos
                            </Badge>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">{brl(sg.valor_pago)}</TableCell>
                        <TableCell className="text-right">{brl(sg.valor_aberto)}</TableCell>
                        <TableCell className="text-right">{brl(sg.valor_total)}</TableCell>
                      </TableRow>
                      {sg.naturezas.map((n) => (
                        <TableRow
                          key={n.cod_natureza}
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() =>
                            setNivelSel({
                              nivel: "natureza",
                              cod: n.cod_natureza,
                              desc: n.desc_natureza ?? null,
                            })
                          }
                        >
                          <TableCell className="pl-12 text-sm">
                            <Badge variant="outline" className="mr-2">
                              {n.cod_natureza}
                            </Badge>
                            {n.desc_natureza ?? ""}
                          </TableCell>
                          <TableCell className="text-right text-sm">{brl(n.valor_pago)}</TableCell>
                          <TableCell className="text-right text-sm">
                            {brl(n.valor_aberto)}
                          </TableCell>
                          <TableCell className="text-right text-sm">{brl(n.valor_total)}</TableCell>
                        </TableRow>
                      ))}
                    </Fragmento>
                  ))}
                </Fragmento>
              ))}
              {arvore.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-muted-foreground">
                    Sem dados.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={!!nivelSel} onOpenChange={(o) => !o && setNivelSel(null)}>
        <DialogContent className="max-w-5xl">
          <DialogHeader>
            <DialogTitle>
              {nivelSel?.nivel === "natureza"
                ? `${nivelSel.cod} — ${nivelSel.desc ?? "Natureza"}`
                : nivelSel?.nivel === "subgrupo"
                  ? `Subgrupo ${nivelSel.subgrupo} — ${nivelSel.label}`
                  : nivelSel?.nivel === "grupo"
                    ? `Grupo ${nivelSel.grupo} — ${nivelSel.label}`
                    : ""}
            </DialogTitle>
          </DialogHeader>
          {(() => {
            const items = filtradas.filter((l) => {
              if (!nivelSel) return false;
              if (nivelSel.nivel === "natureza") return l.cod_natureza === nivelSel.cod;
              if (nivelSel.nivel === "subgrupo")
                return l.grupo === nivelSel.grupo && l.subgrupo === nivelSel.subgrupo;
              if (nivelSel.nivel === "grupo") return l.grupo === nivelSel.grupo;
              return false;
            });
            const total = items.reduce((acc, l) => acc + Number(l.valor_rateio ?? 0), 0);
            return (
              <>
                <div className="text-sm text-muted-foreground">
                  {items.length} linha(s) · total rateado {brl(total)}
                </div>
                <div className="max-h-[60vh] overflow-auto border rounded-md">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Ref.</TableHead>
                        <TableHead>Origem</TableHead>
                        <TableHead>Obra</TableHead>
                        <TableHead>Natureza</TableHead>
                        <TableHead>Contraparte</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Vencimento</TableHead>
                        <TableHead className="text-right">Rateio</TableHead>
                        <TableHead className="text-right">Líquido</TableHead>
                        <TableHead />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {items.map((l, i) => {
                        const ol = l as unknown as { obra_codigo?: string | null };
                        const isManual = l.origem === "manual";
                        const podeEditarBaixar = isManual && l.status_cod !== 3 && l.status_cod !== 18;
                        const saldoAberto = Number(l.valor_liquido ?? 0) - Number(l.valor_baixado ?? 0);
                        return (
                          <TableRow key={`${l.ref_lancamento}-${i}`}>
                            <TableCell className="font-mono text-xs">{l.ref_lancamento}</TableCell>
                            <TableCell>
                              <OrigemBadge origem={l.origem ?? "totvs"} size="sm" />
                            </TableCell>
                            <TableCell className="text-xs">{ol.obra_codigo ?? "—"}</TableCell>
                            <TableCell className="text-xs">
                              <span className="font-mono">{l.cod_natureza ?? "—"}</span>
                              {l.desc_natureza && (
                                <span className="text-muted-foreground"> · {l.desc_natureza}</span>
                              )}
                            </TableCell>
                            <TableCell className="max-w-[28ch] truncate">
                              {l.contraparte ?? "—"}
                            </TableCell>
                            <TableCell>{l.status_label ?? "—"}</TableCell>
                            <TableCell>{l.data_vencimento ?? "—"}</TableCell>
                            <TableCell className="text-right">
                              {brl(Number(l.valor_rateio ?? 0))}
                            </TableCell>
                            <TableCell className="text-right">
                              {brl(Number(l.valor_liquido ?? 0))}
                            </TableCell>
                            <TableCell>
                              {isManual && l.ref_lancamento != null && (
                                <div className="flex items-center gap-1">
                                  {podeEditarBaixar && (
                                    <>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-7 px-2 text-xs"
                                        onClick={() => abrirEdicaoTitulo(l.ref_lancamento as number)}
                                      >
                                        Editar
                                      </Button>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-7 px-2 text-xs"
                                        onClick={() =>
                                          setBaixaAlvo({
                                            ref: l.ref_lancamento as number,
                                            saldo: saldoAberto,
                                          })
                                        }
                                      >
                                        Baixar
                                      </Button>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-7 px-2 text-xs text-destructive"
                                        onClick={() => setCancelarAlvo(l.ref_lancamento as number)}
                                      >
                                        Cancelar
                                      </Button>
                                    </>
                                  )}
                                </div>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>

      <TituloManualFormDialog
        open={editDialogOpen}
        onOpenChange={(o) => {
          setEditDialogOpen(o);
          if (!o) setEdicaoTitulo(null);
        }}
        edicao={edicaoTitulo}
      />

      <Dialog open={!!baixaAlvo} onOpenChange={(o) => !o && setBaixaAlvo(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Baixar título</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="text-sm text-muted-foreground">
              Saldo em aberto: {brl(baixaAlvo?.saldo ?? 0)}
            </div>
            <div className="space-y-1.5">
              <Label>Valor da baixa</Label>
              <Input
                inputMode="decimal"
                value={valorBaixa}
                onChange={(e) => setValorBaixa(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Data da baixa</Label>
              <Input type="date" value={dataBaixa} onChange={(e) => setDataBaixa(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBaixaAlvo(null)}>
              Cancelar
            </Button>
            <Button
              onClick={() => baixarMutation.mutate()}
              disabled={baixarMutation.isPending || !valorBaixa}
            >
              {baixarMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Salvando…
                </>
              ) : (
                "Confirmar baixa"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={cancelarAlvo != null} onOpenChange={(o) => !o && setCancelarAlvo(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar título</AlertDialogTitle>
            <AlertDialogDescription>
              O título será marcado como cancelado. Essa ação não pode ser desfeita pela tela.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction onClick={() => cancelarMutation.mutate()}>
              Confirmar cancelamento
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function Fragmento({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

export default FinanceiroPage;
