import { Fragment, useEffect, useMemo, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { z } from "zod";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ArrowLeft,
  Plus,
  CheckCircle2,
  FileText,
  Banknote,
  AlertCircle,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  CalendarClock,
  Upload,
  History,
  Trash2,
  Undo2,
  Download,
  FileDown,
  ListTree,
  Pencil,
  MoreVertical,
  Loader2,
  Calendar as CalendarIcon,
  GanttChart as GanttChartIcon,
  FilePlus as FilePlusIcon,
  GitCompare as GitCompareIcon,
  Upload as UploadIcon,
  LineChart as LineChartIcon,
  BarChart3 as BarChart3Icon,
  TrendingUp as TrendingUpIcon,
  Ruler as RulerIcon,
  Receipt as ReceiptIcon,
  Banknote as BanknoteIcon,
  Wallet as WalletIcon,
  AlertTriangle as AlertTriangleIcon,
  MessageSquareWarning as MessageSquareWarningIcon,
  History as HistoryIcon,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import {
  cronogramaItemRevisoesMutationFns,
  cronogramaMutationFns,
} from "@/hooks/obras/useCronograma";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetFooter,
} from "@/components/ui/sheet";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { brl, calcularVencimento } from "@/lib/billing";
import { addDays, format, parseISO, differenceInCalendarDays } from "date-fns";
import {
  parseMppXml,
  parentChain as mppParentChain,
  isMppBinary,
  type MppTask,
} from "@/lib/cronograma/mpp";
import { MppNotSupportedDialog } from "@/components/import/MppNotSupportedDialog";
import { Switch } from "@/components/ui/switch";
import { AditivosTab } from "@/components/obra/AditivosTab";
import { HistoricoTab } from "@/components/obra/HistoricoTab";
import { CompararRevisoesTab } from "@/components/obra/CompararRevisoesTab";
import { CaminhoCriticoTab } from "@/components/obra/CaminhoCriticoTab";
import { FinanceiroTab } from "@/components/obra/FinanceiroTab";
import { StatusObraBadge, type ObraStatus } from "@/components/obra/StatusObraBadge";
import { TaxCalculator, calcTaxes } from "@/components/obra/TaxCalculator";
import { AnaliseTab } from "@/components/obra/AnaliseTab";
import { DesempenhoTab } from "@/components/obra/DesempenhoTab";
import { RiscosTab } from "@/components/obra/RiscosTab";
import { OcorrenciasTab } from "@/components/obra/OcorrenciasTab";

import { UserCog } from "lucide-react";
import {
  HierarquiaTree,
  HierarquiaTreeControls,
  CronoExpansionProvider,
  buildTree,
  aggregate,
  parseDescricao,
  wbsCompare,
  type CronoNode,
} from "@/lib/cronograma/crono-tree";
import { exportObraToExcel } from "@/lib/obras/export";
import { exportObraToPDF } from "@/lib/obras/export-pdf";
import { ChipsNumberInput } from "@/components/ui/chips-number-input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Info } from "lucide-react";
import { calcularPreviaFechamento, type PreviaFechamento } from "@/lib/bms/fechamento";
import {
  gerarBoletimExcel,
  gerarBoletimPdf,
  totaisBoletim,
  type BoletimData,
  type BoletimItem,
} from "@/lib/bms/boletim";
import { uploadBoletim } from "@/lib/bms/boletim-storage";
import { FileSpreadsheet, Printer, Sparkles } from "lucide-react";
import { StatusBadge as SharedStatusBadge } from "@/components/obra/StatusBadge";

import { ResumoContrato } from "@/components/obra/ResumoContrato";
import { ResumoFinanceiroTotvs } from "@/components/obra/ResumoFinanceiroTotvs";
import { ConfrontoOperacionalCard } from "@/components/obra/ConfrontoOperacionalCard";
import {
  recalcularPrevisaoNF,
  recalcularAposFaturamento,
  reverterFaturamentoBms,
} from "@/lib/cronograma/recalculo";
import { CronogramaImporter } from "@/components/import/CronogramaImporter";
import { CronogramaSemanalImporter } from "@/components/import/CronogramaSemanalImporter";
import { RevisaoDetalhes } from "@/components/obra/RevisaoDetalhes";
import { PrevistoRealizadoCard } from "@/components/obra/PrevistoRealizadoCard";
import { GanttTabWithMarcos } from "@/components/obra/GanttTabWithMarcos";
import { ObraSelecaoProvider, useObraSelecao } from "@/components/obra/ObraSelecaoContext";
import { VizinhancaSheet } from "@/components/obra/VizinhancaSheet";
import { ReguaEditor } from "@/components/obra/ReguaEditor";

import { RecursosDaLinhaSheet } from "@/components/cards/RecursosDaLinhaSheet";
import { RecursoStatusBadge, type RecursosStatus } from "@/components/cards/RecursoStatusBadge";
import { CascataPrazosBar } from "@/components/cards/CascataPrazosBar";
import { useCascataPorItem } from "@/hooks/obras/useCascataPorItem";
import { usePermissions } from "@/contexts/auth/usePermissions";
import { Package as PackageIcon } from "lucide-react";

export function CronogramaPrincipalTab({
  obra,
  itens,
  revisoes,
  onChange,
}: {
  obra: any;
  itens: any[];
  revisoes: any[];
  onChange: () => void;
}) {
  const obraId = obra.id;
  const valorContrato = Number(obra.valor_contrato);
  const [open, setOpen] = useState(false);
  const [f, setF] = useState<any>({});
  const [openManual, setOpenManual] = useState(false);
  // Custo "orçado" = custo_baseline (congelado na 1ª importação) com fallback no custo atual.
  const custoItem = (i: any) => Number(i.custo_baseline ?? i.custo ?? 0);
  const somaCusto = itens.reduce((a, i) => a + custoItem(i), 0);
  const total =
    valorContrato > 0 && somaCusto > 0
      ? (somaCusto / valorContrato) * 100
      : itens.reduce((a, i) => a + Number(i.percentual_previsto || 0), 0);
  const totalDiffReais = valorContrato - somaCusto;

  // % realizado global: soma(custoBaseline * pctReal) / valorContrato (denominador fixo).
  const somaExec = itens.reduce((a, i) => {
    const custo = custoItem(i);
    const base = custo > 0 ? custo : (Number(i.percentual_previsto || 0) / 100) * valorContrato;
    const pctReal = Number(i.percentual_realizado || 0);
    return a + (base * pctReal) / 100;
  }, 0);
  // Total exibido é sempre o valor do contrato — é o universo fixo da obra.
  const baseTotal = valorContrato;
  const pctRealizadoTotal = baseTotal > 0 ? (somaExec / baseTotal) * 100 : 0;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    try {
      await cronogramaMutationFns.create({
        obra_id: obraId,
        descricao: f.descricao || null,
        data_inicio: f.data_inicio,
        data_fim: f.data_fim,
        percentual_previsto: Number(f.percentual_previsto || 0),
        ordem: itens.length,
      } as any);
    } catch (error: any) {
      return toast.error(error.message);
    }
    toast.success("Janela adicionada");
    setOpen(false);
    setF({});
    onChange();
  }
  async function remove(id: string) {
    await cronogramaMutationFns.remove(id);
    onChange();
  }

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2 flex-wrap">
          <div className="flex-1 min-w-[260px]">
            <CardTitle>
              Cronograma · {total.toFixed(2)}% planejado · {pctRealizadoTotal.toFixed(2)}% realizado
            </CardTitle>
            <div className="relative mt-2 h-2 w-full rounded bg-muted overflow-hidden">
              <div
                className="absolute inset-y-0 left-0 bg-muted-foreground/30"
                style={{ width: `${Math.min(100, total)}%` }}
              />
              <div
                className="absolute inset-y-0 left-0 bg-success"
                style={{ width: `${Math.min(100, pctRealizadoTotal)}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Executado: {brl(somaExec)} de {brl(baseTotal)}
              {Math.abs(totalDiffReais) > Math.max(1, valorContrato * 0.005) && (
                <span className="ml-2 text-warning">
                  · Cronograma cobre {total.toFixed(1)}% do contrato ({brl(totalDiffReais)}{" "}
                  {totalDiffReais > 0 ? "não orçados" : "acima do contrato"})
                </span>
              )}
            </p>
          </div>
          <div className="flex gap-2 flex-wrap items-center">
            <HierarquiaTreeControls roots={buildTree(itens)} className="mr-1" />
            <RecalcularCpmButton obraId={obraId} onDone={onChange} />
            <Button size="sm" variant="outline" onClick={() => setOpenManual(true)}>
              <History className="h-4 w-4 mr-2" />
              Atualizar progresso (manual)
            </Button>
            <Sheet>
              <SheetTrigger asChild>
                <Button size="sm" variant="outline">
                  <Upload className="h-4 w-4 mr-2" />
                  Importar XML (Principal)
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-full sm:max-w-3xl overflow-y-auto">
                <SheetHeader>
                  <SheetTitle>Importar Cronograma Principal (MS Project XML)</SheetTitle>
                </SheetHeader>
                <div className="mt-4">
                  <CronogramaImporter obraIdFixo={obraId} />
                </div>
              </SheetContent>
            </Sheet>

            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  Janela
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Nova janela do cronograma</DialogTitle>
                </DialogHeader>
                <form onSubmit={save} className="grid grid-cols-2 gap-3">
                  <div className="col-span-2 space-y-1.5">
                    <Label>Descrição</Label>
                    <Input
                      value={f.descricao ?? ""}
                      onChange={(e) => setF({ ...f, descricao: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Início</Label>
                    <Input
                      type="date"
                      required
                      value={f.data_inicio ?? ""}
                      onChange={(e) => setF({ ...f, data_inicio: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Fim</Label>
                    <Input
                      type="date"
                      required
                      value={f.data_fim ?? ""}
                      onChange={(e) => setF({ ...f, data_fim: e.target.value })}
                    />
                  </div>
                  <div className="col-span-2 space-y-1.5">
                    <Label>% previsto no período</Label>
                    <Input
                      type="number"
                      step="0.0001"
                      required
                      value={f.percentual_previsto ?? ""}
                      onChange={(e) => setF({ ...f, percentual_previsto: e.target.value })}
                    />
                  </div>
                  <DialogFooter className="col-span-2">
                    <Button type="submit">Adicionar</Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          <SemDependenciasHint obraId={obraId} />
          <CronogramaHierarquia
            itens={itens}
            valorContrato={valorContrato}
            onRemove={remove}
            obraId={obraId}
          />
          {somaCusto > 0 && Math.abs(totalDiffReais) > 0.01 && (
            <p className="text-xs text-warning mt-3">
              Atenção: soma do cronograma é {brl(somaCusto)} ({total.toFixed(2)}%) — diferença de{" "}
              {brl(totalDiffReais)} em relação ao contrato.
            </p>
          )}
          {somaCusto === 0 && total > 0 && Math.abs(total - 100) > 0.01 && (
            <p className="text-xs text-warning mt-3">
              Atenção: soma do cronograma é {total.toFixed(2)}% (ideal 100%).
            </p>
          )}
        </CardContent>
      </Card>
      <AtualizarProgressoManualSheet
        open={openManual}
        onOpenChange={setOpenManual}
        obraId={obraId}
        itens={itens}
        revisoes={revisoes}
        valorContrato={valorContrato}
        onSaved={onChange}
      />
    </>
  );
}

// ====== Atualização manual de progresso (% realizado) ======
function AtualizarProgressoManualSheet({
  open,
  onOpenChange,
  obraId,
  itens,
  revisoes,
  valorContrato,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  obraId: string;
  itens: any[];
  revisoes: any[];
  valorContrato: number;
  onSaved: () => void;
}) {
  const folhas = useMemo(
    () => (itens ?? []).filter((i) => i.ativo !== false && i.data_inicio && i.data_fim),
    [itens],
  );

  const [dataRef, setDataRef] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [obs, setObs] = useState<string>("");
  const [permitirRegressao, setPermitirRegressao] = useState(false);
  const [filtro, setFiltro] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [pcts, setPcts] = useState<Record<string, string>>({});

  // Reinicializa pcts ao abrir
  useEffect(() => {
    if (!open) return;
    const init: Record<string, string> = {};
    for (const i of folhas) init[i.id] = String(i.percentual_realizado ?? 0);
    setPcts(init);
    setDataRef(new Date().toISOString().slice(0, 10));
    setObs("");
    setPermitirRegressao(false);
    setFiltro("");
  }, [open, folhas]);

  const baseRef = (i: any) => Number(i.custo_baseline ?? i.custo ?? 0);

  const linhas = folhas
    .filter((i) => !filtro || (i.descricao ?? "").toLowerCase().includes(filtro.toLowerCase()))
    .map((i) => {
      const anterior = Number(i.percentual_realizado ?? 0);
      const novoRaw = pcts[i.id];
      const novo = novoRaw === undefined || novoRaw === "" ? anterior : Number(novoRaw);
      const delta = novo - anterior;
      const invalido =
        !Number.isFinite(novo) ||
        novo < 0 ||
        novo > 100 ||
        (!permitirRegressao && novo < anterior - 0.001);
      return { i, anterior, novo, delta, invalido };
    });

  const algumInvalido = linhas.some((l) => l.invalido);

  // Totais (sobre TODAS as folhas, não só filtradas)
  const todasLinhas = folhas.map((i) => {
    const anterior = Number(i.percentual_realizado ?? 0);
    const novoRaw = pcts[i.id];
    const novo = novoRaw === undefined || novoRaw === "" ? anterior : Number(novoRaw);
    return { i, anterior, novo, base: baseRef(i) };
  });
  const somaCustoBase = todasLinhas.reduce((a, l) => a + l.base, 0);
  const baseDenom = somaCustoBase > 0 ? somaCustoBase : valorContrato;
  const execAntes = todasLinhas.reduce((a, l) => {
    const base = l.base > 0 ? l.base : (Number(l.i.percentual_previsto || 0) / 100) * valorContrato;
    return a + (base * l.anterior) / 100;
  }, 0);
  const execDepois = todasLinhas.reduce((a, l) => {
    const base = l.base > 0 ? l.base : (Number(l.i.percentual_previsto || 0) / 100) * valorContrato;
    return a + (base * l.novo) / 100;
  }, 0);
  const pctAntes = baseDenom > 0 ? (execAntes / (valorContrato || baseDenom)) * 100 : 0;
  const pctDepois = baseDenom > 0 ? (execDepois / (valorContrato || baseDenom)) * 100 : 0;

  const alterados = todasLinhas.filter((l) => Math.abs(l.novo - l.anterior) > 0.0001);

  async function salvar() {
    if (algumInvalido) return toast.error("Há valores inválidos — ajuste antes de salvar.");
    if (!dataRef) return toast.error("Defina a data de referência.");
    if (!alterados.length) return toast.error("Nenhum item alterado.");

    setSalvando(true);
    try {
      const ultimoNumero = (revisoes ?? []).reduce((m, r) => Math.max(m, Number(r.numero || 0)), 0);
      const numero = ultimoNumero + 1;

      const totais = {
        itens_total: folhas.length,
        alterados_pct: alterados.length,
        origem: "manual",
      };

      const { data: rev, error: revErr } = await supabase
        .from("cronograma_revisoes")
        .insert({
          obra_id: obraId,
          numero,
          data_corte: dataRef,
          arquivo_nome: null,
          observacoes: obs?.trim() ? `Atualização manual · ${obs.trim()}` : "Atualização manual",
          totais,
        })
        .select("id")
        .single();
      if (revErr) throw revErr;

      const snapshots = alterados.map((l) => ({
        revisao_id: rev!.id,
        cronograma_item_id: l.i.id,
        descricao_item: l.i.descricao ?? null,
        tipo_mudanca: "pct",
        percentual_realizado_anterior: l.anterior,
        percentual_realizado_novo: l.novo,
      }));

      await cronogramaItemRevisoesMutationFns.insertMany(snapshots);

      // Atualiza cronograma_itens
      for (const l of alterados) {
        await cronogramaMutationFns.update(l.i.id, { percentual_realizado: l.novo } as any);
      }

      toast.success(
        `Revisão #${numero} criada · ${alterados.length} ${alterados.length === 1 ? "item atualizado" : "itens atualizados"}`,
      );
      onOpenChange(false);
      onSaved();
    } catch (err: any) {
      toast.error(err.message ?? String(err));
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-3xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Atualizar progresso (manual)</SheetTitle>
        </SheetHeader>

        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label>Data de referência</Label>
            <Input type="date" value={dataRef} onChange={(e) => setDataRef(e.target.value)} />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Observações</Label>
            <Input
              value={obs}
              maxLength={500}
              onChange={(e) => setObs(e.target.value)}
              placeholder="Opcional"
            />
          </div>
        </div>

        <div className="mt-3 flex items-center gap-3 flex-wrap">
          <Input
            className="max-w-sm"
            placeholder="Filtrar por descrição…"
            value={filtro}
            onChange={(e) => setFiltro(e.target.value)}
          />
          <label className="flex items-center gap-2 text-sm">
            <Switch checked={permitirRegressao} onCheckedChange={setPermitirRegressao} />
            Permitir correção (regredir %)
          </label>
          <span className="text-xs text-muted-foreground ml-auto">
            {linhas.length} de {folhas.length} itens
          </span>
        </div>

        <div className="mt-3 rounded border max-h-[50vh] overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Descrição</TableHead>
                <TableHead className="w-24 text-right">% anterior</TableHead>
                <TableHead className="w-32 text-right">% novo</TableHead>
                <TableHead className="w-20 text-right">Δ</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {linhas.map((l) => (
                <TableRow key={l.i.id} className={l.invalido ? "bg-destructive/10" : undefined}>
                  <TableCell className="text-xs">{l.i.descricao ?? "(sem descrição)"}</TableCell>
                  <TableCell className="text-right tabular-nums text-xs">
                    {l.anterior.toFixed(2)}%
                  </TableCell>
                  <TableCell className="text-right">
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      step="0.01"
                      className={`h-8 text-right tabular-nums ${l.invalido ? "border-destructive" : ""}`}
                      value={pcts[l.i.id] ?? ""}
                      onChange={(e) => setPcts((p) => ({ ...p, [l.i.id]: e.target.value }))}
                    />
                  </TableCell>
                  <TableCell
                    className={`text-right tabular-nums text-xs ${l.delta > 0 ? "text-success" : l.delta < 0 ? "text-warning" : "text-muted-foreground"}`}
                  >
                    {l.delta > 0 ? "+" : ""}
                    {l.delta.toFixed(2)}
                  </TableCell>
                </TableRow>
              ))}
              {linhas.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground py-6">
                    Nenhum item folha encontrado
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        <div className="mt-3 rounded border p-3 grid gap-2 sm:grid-cols-3 text-sm">
          <div>
            <div className="text-xs text-muted-foreground">% realizado total</div>
            <div className="font-medium">
              {pctAntes.toFixed(2)}% →{" "}
              <span className={pctDepois >= pctAntes ? "text-success" : "text-warning"}>
                {pctDepois.toFixed(2)}%
              </span>
            </div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Valor executado</div>
            <div className="font-medium">
              {brl(execAntes)} →{" "}
              <span className={execDepois >= execAntes ? "text-success" : "text-warning"}>
                {brl(execDepois)}
              </span>
            </div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Alterações</div>
            <div className="font-medium">
              {alterados.length} {alterados.length === 1 ? "item" : "itens"}
            </div>
          </div>
        </div>

        {algumInvalido && (
          <p className="mt-2 text-xs text-destructive">
            Há linhas inválidas (valor fora de 0–100 ou regredindo sem o toggle de correção).
          </p>
        )}

        <SheetFooter className="mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={salvando}>
            Cancelar
          </Button>
          <Button onClick={salvar} disabled={salvando || algumInvalido || alterados.length === 0}>
            {salvando ? "Salvando…" : `Salvar revisão (${alterados.length})`}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

// Helpers de hierarquia (buildTree, aggregate, parseDescricao, CronoNode)
// vivem em src/lib/crono-tree.tsx para serem reaproveitados por Cronograma,
// Gantt, Comparar, Análise, Composição da BMS e Medições.

function CronogramaHierarquia({
  itens,
  valorContrato,
  onRemove,
  obraId,
}: {
  itens: any[];
  valorContrato: number;
  onRemove: (id: string) => void;
  obraId: string;
}) {
  const { setSelectedItemId } = useObraSelecao();
  const { hasAccess } = usePermissions();
  // TODO(perm): trocar por PageKey 'engenharia' quando o modelo de setores existir.
  const canCriarRecurso = hasAccess("obras_div", "editar");
  const [verRecursosDe, setVerRecursosDe] = useState<{
    id: string;
    descricao?: string;
    data_inicio: string;
  } | null>(null);
  const cascataPorItem = useCascataPorItem(obraId);

  const abrirRecursos = (item: any) => {
    if (!item?.id || !item?.data_inicio) return;
    setVerRecursosDe({ id: item.id, descricao: item.descricao, data_inicio: item.data_inicio });
  };

  return (
    <>
      <HierarquiaTree
        itens={itens}
        valorContrato={valorContrato}
        emptyHint="Cadastre as janelas do cronograma"
        onRowClick={(ctx) => {
          if (ctx.node.item?.id) setSelectedItemId(ctx.node.item.id);
          if (ctx.isLeaf && ctx.node.item) abrirRecursos(ctx.node.item);
        }}
        renderDescriptionExtra={({ node, isLeaf }) => {
          if (!isLeaf || !node.item) return null;
          const cascata = cascataPorItem.get(node.item.id);
          return (
            <span className="ml-2 inline-flex items-center gap-2">
              {node.item.critico && (
                <Badge variant="destructive" className="text-[10px] px-1 py-0">
                  crítico
                </Badge>
              )}
              <RecursoStatusBadge
                status={(node.item.recursos_status ?? "sem_recursos") as RecursosStatus}
                count={Number(node.item.recursos_count ?? 0)}
                onClick={() => abrirRecursos(node.item)}
              />
              {cascata && (
                <CascataPrazosBar
                  linha={cascata}
                  width={160}
                  onClick={() => abrirRecursos(node.item)}
                />
              )}
            </span>
          );
        }}

        columns={[
          {
            key: "periodo",
            header: "Período",
            className: "whitespace-nowrap text-xs",
            showOnParents: true,
            render: ({ agg }) =>
              agg.inicio && agg.fim
                ? `${format(parseISO(agg.inicio), "dd/MM/yy")} – ${format(parseISO(agg.fim), "dd/MM/yy")}`
                : "—",
          },
          {
            key: "pct-prev",
            header: "% previsto",
            align: "right",
            showOnParents: true,
            render: ({ agg, isLeaf }) => {
              const pct =
                valorContrato > 0 && agg.base > 0 ? (agg.base / valorContrato) * 100 : agg.pct;
              return (
                <span className={!isLeaf ? "text-muted-foreground" : ""}>
                  {pct ? pct.toFixed(2) + "%" : "—"}
                </span>
              );
            },
          },
          {
            key: "valor",
            header: "Valor",
            align: "right",
            showOnParents: true,
            render: ({ agg, isLeaf }) => (
              <span className={!isLeaf ? "text-muted-foreground italic num" : "num"}>
                {agg.base ? brl(agg.base) : "—"}
              </span>
            ),
          },
          {
            key: "pct-real",
            header: "% Real.",
            align: "right",
            showOnParents: true,
            render: ({ agg }) => {
              const pctReal = agg.base > 0 ? (agg.executado / agg.base) * 100 : 0;
              return (
                <span
                  className={
                    pctReal > 0
                      ? "text-success dark:text-success/80 font-medium"
                      : "text-muted-foreground"
                  }
                >
                  {pctReal > 0 ? pctReal.toFixed(2) + "%" : "—"}
                </span>
              );
            },
          },
          {
            key: "exec",
            header: "Executado",
            align: "right",
            showOnParents: true,
            render: ({ agg }) =>
              agg.executado > 0 ? <span className="num">{brl(agg.executado)}</span> : "—",
          },
          {
            key: "saldo",
            header: "Saldo físico",
            align: "right",
            showOnParents: true,
            render: ({ agg }) =>
              agg.base > 0 ? (
                <span className="text-muted-foreground num">{brl(agg.base - agg.executado)}</span>
              ) : (
                "—"
              ),
          },
          {
            key: "acao",
            header: "",
            align: "right",
            render: ({ node, isLeaf }) =>
              isLeaf && node.item ? (
                <div className="flex items-center justify-end gap-1">
                  <Button variant="ghost" size="sm" onClick={() => onRemove(node.item.id)}>
                    Remover
                  </Button>
                </div>
              ) : null,
          },
        ]}
      />
      {verRecursosDe && (
        <RecursosDaLinhaSheet
          open={!!verRecursosDe}
          onOpenChange={(v) => !v && setVerRecursosDe(null)}
          itemId={verRecursosDe.id}
          itemDescricao={verRecursosDe.descricao}
          itemDataInicio={verRecursosDe.data_inicio}
          obraId={obraId}
          podeAdicionar={canCriarRecurso}
        />
      )}
    </>
  );
}

// ====== Recalcular Caminho Crítico (CPM) ======
function RecalcularCpmButton({ obraId, onDone }: { obraId: string; onDone: () => void }) {
  const [busy, setBusy] = useState(false);
  const qc = useQueryClient();
  async function run() {
    setBusy(true);
    try {
      const { recalcularCpmObra } = await import("@/lib/cronograma/recalcular-cpm");
      const r = await recalcularCpmObra(obraId);
      toast.success(`CPM recalculado · ${r.criticas} tarefa(s) crítica(s)`);
      qc.invalidateQueries({ queryKey: ["crono", obraId] });
      qc.invalidateQueries({ queryKey: ["crono-cpm", obraId] });
      qc.invalidateQueries({ queryKey: ["crono-deps", obraId] });
      onDone();
    } catch (e: any) {
      toast.error(e?.message ?? String(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Button size="sm" variant="outline" onClick={run} disabled={busy}>
      {busy ? (
        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
      ) : (
        <Sparkles className="h-4 w-4 mr-2" />
      )}
      Recalcular caminho crítico
    </Button>
  );
}

function SemDependenciasHint({ obraId }: { obraId: string }) {
  const { data } = useQuery({
    queryKey: ["crono-deps-count", obraId],
    queryFn: async () => {
      const { count } = await supabase
        .from("cronograma_dependencias")
        .select("id", { count: "exact", head: true })
        .eq("obra_id", obraId);
      return count ?? 0;
    },
  });
  if (data === undefined || data > 0) return null;
  return (
    <div className="mb-3 rounded border border-warning/40 bg-warning/10 px-3 py-2 text-xs text-warning-foreground">
      Nenhuma dependência (predecessora/sucessora) cadastrada para esta obra — o caminho crítico só
      aparece depois de importar o XML do MS Project com os vínculos, ou cadastrar dependências
      manualmente.
    </div>
  );
}

// ============== Medições por item ==============

type LeafRow = {
  item: any;
  pctAnterior: number;
  pctAtual: number;
  base: number;
};
