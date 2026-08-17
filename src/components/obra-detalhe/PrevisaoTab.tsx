import { useMemo, useState } from "react";
import { toast } from "sonner";
import { format, parseISO, differenceInCalendarDays } from "date-fns";
import { AlertTriangle, CalendarClock, FileText, Info, ListTree, Pencil } from "lucide-react";
import { faturamentoRpc } from "@/lib/repositories/medicoes";
import { bmsPrevistasRepo } from "@/lib/repositories/obraDetalhe";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import DatePickerField from "@/components/common/DatePickerField";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from "@/components/ui/sheet";
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
import { Progress } from "@/components/ui/progress";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { brl, calcularVencimento } from "@/lib/billing";
import { calcularPreviaFechamento, type PreviaFechamento } from "@/lib/bms/fechamento";
import {
  HierarquiaTree,
  HierarquiaTreeControls,
  buildTree,
  type CronoNode,
} from "@/lib/cronograma/crono-tree";
import { StatusBadge as SharedStatusBadge } from "@/components/obra/StatusBadge";
import { EmptyState } from "@/components/obra/EmptyState";
import { PrevistoRealizadoCard } from "@/components/obra/PrevistoRealizadoCard";
import { NovaBmsPrevistaManualDialog } from "@/components/obra/NovaBmsPrevistaManualDialog";

type ComposicaoLinha = {
  item: any;
  sobrep: number;
  duracao: number;
  valorEscalado: number;
  contribuicao: number;
  percPrev: number;
  percReal: number;
};

function ComposicaoBmsTree({ linhas }: { linhas: ComposicaoLinha[] }) {
  const itens = useMemo(() => linhas.map((l) => ({ ...l.item, _l: l })), [linhas]);
  const roots = useMemo(() => buildTree(itens), [itens]);

  const sumValorEscalado = (n: CronoNode): number => {
    if (n.children.length === 0 && n.item) return Number(n.item._l?.valorEscalado ?? 0);
    let s = n.item ? Number(n.item._l?.valorEscalado ?? 0) : 0;
    for (const c of n.children) s += sumValorEscalado(c);
    return s;
  };
  const sumContribuicao = (n: CronoNode): number => {
    if (n.children.length === 0 && n.item) return Number(n.item._l?.contribuicao ?? 0);
    let s = n.item ? Number(n.item._l?.contribuicao ?? 0) : 0;
    for (const c of n.children) s += sumContribuicao(c);
    return s;
  };
  // Média ponderada de % por valorEscalado.
  const weightedPct = (n: CronoNode, field: "percPrev" | "percReal"): number => {
    let num = 0,
      den = 0;
    const walk = (node: CronoNode) => {
      if (node.children.length === 0 && node.item) {
        const l = node.item._l as ComposicaoLinha | undefined;
        if (l) {
          num += l[field] * l.valorEscalado;
          den += l.valorEscalado;
        }
        return;
      }
      if (node.item) {
        const l = node.item._l as ComposicaoLinha | undefined;
        if (l) {
          num += l[field] * l.valorEscalado;
          den += l.valorEscalado;
        }
      }
      for (const c of node.children) walk(c);
    };
    walk(n);
    return den > 0 ? num / den : 0;
  };

  return (
    <div className="overflow-x-auto">
      <div className="flex justify-end pb-2">
        <HierarquiaTreeControls roots={roots} />
      </div>
      <HierarquiaTree
        roots={roots}
        valorContrato={0}
        columns={[
          {
            key: "periodo",
            header: "Período",
            showOnParents: false,
            render: ({ node }) => {
              const it = node.item;
              if (!it?.data_inicio || !it?.data_fim) return null;
              return (
                <span className="text-xs whitespace-nowrap">
                  {format(parseISO(it.data_inicio), "dd/MM/yy")} →{" "}
                  {format(parseISO(it.data_fim), "dd/MM/yy")}
                </span>
              );
            },
          },
          {
            key: "sobrep",
            header: "Sobrep.",
            showOnParents: false,
            render: ({ node }) => {
              const l = node.item?._l as ComposicaoLinha | undefined;
              if (!l) return null;
              return (
                <span className="text-xs tabular-nums whitespace-nowrap">
                  {l.sobrep} de {l.duracao} d
                </span>
              );
            },
          },
          {
            key: "valTotal",
            header: "Valor total",
            align: "right",
            showOnParents: true,
            render: ({ node }) => (
              <span className="tabular-nums text-xs">{brl(sumValorEscalado(node))}</span>
            ),
          },
          {
            key: "contrib",
            header: "Contribuição",
            align: "right",
            showOnParents: true,
            render: ({ node }) => (
              <span className="tabular-nums text-xs font-medium">{brl(sumContribuicao(node))}</span>
            ),
          },
          {
            key: "pctPrev",
            header: "% Previsto",
            width: "w-40",
            showOnParents: true,
            render: ({ node, isLeaf }) => {
              const v = isLeaf
                ? Number(node.item?._l?.percPrev ?? 0)
                : weightedPct(node, "percPrev");
              return (
                <div className="flex items-center gap-2">
                  <Progress value={Math.min(100, v)} className="h-1.5 flex-1" />
                  <span className="text-xs tabular-nums w-10 text-right">{v.toFixed(1)}%</span>
                </div>
              );
            },
          },
          {
            key: "pctReal",
            header: "% Realizado",
            width: "w-40",
            showOnParents: true,
            render: ({ node, isLeaf }) => {
              const prev = isLeaf
                ? Number(node.item?._l?.percPrev ?? 0)
                : weightedPct(node, "percPrev");
              const real = isLeaf
                ? Number(node.item?._l?.percReal ?? 0)
                : weightedPct(node, "percReal");
              const ok = real + 0.001 >= prev;
              return (
                <div className="flex items-center gap-2">
                  <Progress
                    value={Math.min(100, real)}
                    className={`h-1.5 flex-1 ${ok ? "[&>div]:bg-success" : "[&>div]:bg-warning"}`}
                  />
                  <span
                    className={`text-xs tabular-nums w-10 text-right ${ok ? "text-success" : "text-warning"}`}
                  >
                    {real.toFixed(1)}%
                  </span>
                </div>
              );
            },
          },
        ]}
      />
    </div>
  );
}
export function PrevisaoTab({
  obra,
  crono,
  receb,
  nfs,
  bmsPrev,
  medicoes,
  itensMedicao,
  redistrib,
  revisoes,
  onAbrirBms,
  onChange,
}: {
  obra: any;
  crono: any[];
  receb: any[];
  nfs: any[];
  bmsPrev: any[];
  medicoes?: any[];
  itensMedicao?: any[];
  redistrib?: any[];
  revisoes?: any[];
  onAbrirBms?: (bms: any) => void;
  onChange: () => void;
}) {
  const valorContrato = Number(obra.valor_contrato);
  const faturado = nfs.reduce((a, n) => a + Number(n.valor || 0), 0);
  const recebido = receb
    .filter((r) => r.data_recebimento)
    .reduce((a, r) => a + Number(r.valor_recebido || 0), 0);
  const saldo = valorContrato - faturado;

  async function gerarBmsPrevistas() {
    const dataInicioISO = obra.data_inicio;
    const dataFimISO = obra.data_fim ?? obra.data_previsao_termino;
    if (!dataInicioISO || !dataFimISO)
      return toast.error("Defina datas de início e fim/previsão da obra");
    const diasCorte: number[] = Array.isArray(obra.dias_corte_bms) ? obra.dias_corte_bms : [];
    if (!diasCorte.length) return toast.error("Configure os dias de corte da BMS na régua da obra");
    const folhas = (crono ?? []).filter(
      (c: any) => c.ativo !== false && c.data_inicio && c.data_fim,
    );
    if (!folhas.length) return toast.error("Cadastre o cronograma primeiro");

    const { gerarBmsPrevistasParaObra } = await import("@/lib/bms/previstas");
    const { valorTotalItem } = await import("@/lib/bms/valor-item");
    const valorAntec = Number(obra.valor_antecipacao || 0);
    const itens = folhas.map((i: any) => ({
      itemId: i.id,
      dataInicio: parseISO(i.data_inicio),
      dataFim: parseISO(i.data_fim),
      valorTotal: valorTotalItem({
        custo: Number(i.custo || 0),
        percentualPrevisto: Number(i.percentual_previsto || 0),
        valorContrato,
        valorAntecipacao: valorAntec,
      }),
    }));

    const maxFimCrono = folhas.reduce<Date | null>((acc, i: any) => {
      const d = parseISO(i.data_fim);
      return !acc || d > acc ? d : acc;
    }, null);

    const { linhas, avisos } = gerarBmsPrevistasParaObra({
      obraId: obra.id,
      dataInicio: parseISO(dataInicioISO),
      dataFim: parseISO(dataFimISO),
      valorContrato,
      valorAntecipacao: valorAntec,
      diasCorteBms: diasCorte,
      diasAteEmissaoNf: Number(obra.dias_ate_emissao_nf ?? 5),
      prazoPagamentoDias: Number(obra.prazo_pagamento_dias ?? 0),
      diasFixosPagamento: Array.isArray(obra.dias_fixos_pagamento) ? obra.dias_fixos_pagamento : [],
      itens,
      dataFimCronograma: maxFimCrono ?? undefined,
    });

    // Apagar somente BMS previstas com status "prevista" (não toca em aberta/fechada/cancelada/faturada).
    await bmsPrevistasRepo.deletePrevistasPorObra(obra.id);
    // Upsert idempotente: ignora linhas cujo (obra_id, numero) já está ocupado por BMS não-prevista.
    const { error } = await bmsPrevistasRepo.upsertPorObraNumero(linhas);
    if (error) return toast.error(error.message);
    toast.success(`${linhas.length} BMS previstas geradas`);
    for (const aviso of avisos) toast.warning(aviso);
    onChange();
  }

  const bmsOrdenadas = [...bmsPrev].sort((a, b) => Number(a.numero) - Number(b.numero));
  const totalBms = bmsOrdenadas.reduce((a, b) => a + Number(b.valor_previsto_dinamico || 0), 0);

  // Detecta se o cronograma se estende além da data fim contratual da obra.
  const dataFimObraISO: string | null = obra.data_fim ?? obra.data_previsao_termino ?? null;
  const dataFimObra = dataFimObraISO ? parseISO(dataFimObraISO) : null;
  const maxFimCrono = (crono ?? [])
    .filter((c: any) => c.ativo !== false && c.data_fim)
    .reduce<Date | null>((acc, c: any) => {
      const d = parseISO(c.data_fim);
      return !acc || d > acc ? d : acc;
    }, null);
  const cronoExtrapola = !!(dataFimObra && maxFimCrono && maxFimCrono > dataFimObra);

  // Edição de datas por BMS.
  const [editBms, setEditBms] = useState<any | null>(null);
  const [editForm, setEditForm] = useState<{
    data_corte: string;
    data_emissao_nfs_prevista: string;
    data_pagamento_prevista: string;
    observacoes: string;
  }>({
    data_corte: "",
    data_emissao_nfs_prevista: "",
    data_pagamento_prevista: "",
    observacoes: "",
  });

  // Visualização de composição (quais itens do cronograma compõem a BMS).
  const [composicaoBms, setComposicaoBms] = useState<any | null>(null);

  function calcularComposicaoBms(bms: any) {
    const folhas = (crono ?? []).filter(
      (c: any) => c.ativo !== false && c.data_inicio && c.data_fim,
    );
    const valorAntec = Number(obra.valor_antecipacao || 0);
    const baseDist = Math.max(0, valorContrato - valorAntec);
    const fatorVenda = valorContrato > 0 ? baseDist / valorContrato : 1;

    const itensComValor = folhas.map((i: any) => {
      const custo = Number(i.custo || 0);
      const valorTotal =
        custo > 0 ? custo * fatorVenda : (Number(i.percentual_previsto || 0) / 100) * baseDist;
      return {
        item: i,
        valorTotal,
        dataInicio: parseISO(i.data_inicio),
        dataFim: parseISO(i.data_fim),
      };
    });

    // Fator de escala uniforme (mesma lógica de gerarBmsPrevistasParaObra).
    // Aproximação: usa Σ valorTotal como denominador da escala.
    const somaValTotal = itensComValor.reduce((a, b) => a + b.valorTotal, 0);
    const fatorEscala = somaValTotal > 0 ? baseDist / somaValTotal : 1;

    const janIni = parseISO(bms.data_inicio_janela);
    const janFim = parseISO(bms.data_corte);

    const linhas = itensComValor
      .map((x) => {
        const duracao = differenceInCalendarDays(x.dataFim, x.dataInicio) + 1;
        const ini = x.dataInicio > janIni ? x.dataInicio : janIni;
        const fim = x.dataFim < janFim ? x.dataFim : janFim;
        const sobrep = Math.max(0, differenceInCalendarDays(fim, ini) + 1);
        const valorEscalado = x.valorTotal * fatorEscala;
        const contribuicao = duracao > 0 && sobrep > 0 ? (sobrep / duracao) * valorEscalado : 0;
        return {
          item: x.item,
          duracao,
          sobrep,
          valorEscalado,
          contribuicao,
          percPrev: Number(x.item.percentual_previsto || 0),
          percReal: Number(x.item.percentual_realizado || 0),
        };
      })
      .filter((l) => l.sobrep > 0)
      .sort((a, b) => b.contribuicao - a.contribuicao);

    const somaContrib = linhas.reduce((a, b) => a + b.contribuicao, 0);
    return { linhas, somaContrib };
  }

  function abrirEdicao(b: any) {
    setEditBms(b);
    setEditForm({
      data_corte: b.data_corte ?? "",
      data_emissao_nfs_prevista: b.data_emissao_nfs_prevista ?? "",
      data_pagamento_prevista: b.data_pagamento_prevista ?? "",
      observacoes: b.observacoes ?? "",
    });
  }

  function recalcularPagamentoPadrao() {
    if (!editForm.data_emissao_nfs_prevista)
      return toast.error("Defina a data de emissão da NFS primeiro");
    const emissao = parseISO(editForm.data_emissao_nfs_prevista);
    const venc = calcularVencimento(
      emissao,
      Number(obra.prazo_pagamento_dias ?? 0),
      Array.isArray(obra.dias_fixos_pagamento) ? obra.dias_fixos_pagamento : [],
    );
    setEditForm((f) => ({ ...f, data_pagamento_prevista: venc.toISOString().slice(0, 10) }));
  }

  async function salvarEdicao() {
    if (!editBms) return;
    try {
      await bmsPrevistasRepo.update(editBms.id, {
        data_corte: editForm.data_corte || undefined,
        data_emissao_nfs_prevista: editForm.data_emissao_nfs_prevista || null,
        data_pagamento_prevista: editForm.data_pagamento_prevista || null,
        observacoes: editForm.observacoes || null,
      });
    } catch (e: any) {
      return toast.error(e?.message ?? "Erro ao atualizar BMS");
    }
    toast.success("BMS atualizada");
    setEditBms(null);
    onChange();
  }

  async function abrirBms(b: any) {
    onAbrirBms?.(b);
  }

  // ===== Fechamento de BMS =====
  const [confirmFechar, setConfirmFechar] = useState<{ bms: any; previa: PreviaFechamento } | null>(
    null,
  );
  const [fechando, setFechando] = useState(false);

  function calcularPreviaParaBms(b: any): PreviaFechamento | null {
    const med = (medicoes ?? []).find((m) => m.id === b.medicao_id);
    if (!med) return null;
    const itensMed = (itensMedicao ?? []).filter((im: any) => im.medicao_id === med.id);
    return calcularPreviaFechamento({
      bms: b,
      todasBms: bmsOrdenadas,
      valorRealizado: Number(med.valor || 0),
      crono,
      itensMedicao: itensMed,
      valorContrato,
      valorAntecipacao: Number(obra.valor_antecipacao || 0),
    });
  }

  function pedirFechamento(b: any) {
    if (!b.medicao_id)
      return toast.error("BMS sem medição vinculada — abra a BMS na aba Medições primeiro.");
    const previa = calcularPreviaParaBms(b);
    if (!previa) return toast.error("Não foi possível localizar a medição vinculada.");
    setConfirmFechar({ bms: b, previa });
  }

  async function confirmarFechamento() {
    if (!confirmFechar) return;
    const { bms: b, previa } = confirmFechar;
    setFechando(true);
    try {
      // H1.3 — fechamento atômico no banco (BMS + futuras + redistribuição).
      const { error } = await faturamentoRpc.fecharBmsAtomica({
        p_bms_id: b.id,
        p_valor_realizado: previa.valorRealizado,
        p_futuras: previa.futurasDepois.map((f) => ({
          id: f.id,
          valor_novo: f.valor_novo,
        })),
        p_registros: previa.registros.map((r) => ({
          bms_destino_numero: r.bms_destino_numero,
          cronograma_item_id: r.cronograma_item_id,
          descricao_item: r.descricao_item,
          valor_atrasado: r.valor_atrasado,
          valor_absorvido: r.valor_absorvido,
          motivo: r.motivo,
        })),
      });
      if (error) throw error;

      toast.success(`BMS ${b.numero} fechada · saldo ${brl(previa.delta)} redistribuído`);
      setConfirmFechar(null);
      onChange();
    } catch (err: any) {
      toast.error(err.message ?? String(err));
    } finally {
      setFechando(false);
    }
  }

  // Índice de redistribuições por BMS destino
  const redistribPorDestino = (redistrib ?? []).reduce<Record<number, any[]>>((acc, r) => {
    const k = Number(r.bms_destino_numero);
    (acc[k] ??= []).push(r);
    return acc;
  }, {});

  return (
    <div className="space-y-4">
      <PrevistoRealizadoCard
        bmsPrev={bmsOrdenadas}
        nfs={nfs}
        medicoes={medicoes ?? []}
        valorContrato={valorContrato}
      />

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2 flex-wrap">
          <div>
            <CardTitle>BMS previstas</CardTitle>
            <p className="text-xs text-muted-foreground mt-1">
              {bmsOrdenadas.length} BMS · total {brl(totalBms)}
            </p>
            {cronoExtrapola && maxFimCrono && (
              <p className="text-xs text-warning mt-1 flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" />
                Cronograma se estende além do prazo contratual — BMS geradas até{" "}
                {format(maxFimCrono, "dd/MM/yyyy")}.
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <NovaBmsPrevistaManualDialog
              obraId={obra.id}
              proximoNumero={
                (bmsOrdenadas.reduce((m, b) => Math.max(m, Number(b.numero) || 0), 0) || 0) + 1
              }
              onCreated={onChange}
            />
            <Button size="sm" onClick={gerarBmsPrevistas}>
              <FileText className="h-4 w-4 mr-2" />
              Gerar BMS previstas
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            {(() => {
              const temComposicao = bmsOrdenadas.some(
                (b) => (redistribPorDestino[Number(b.numero)] ?? []).length > 0,
              );
              const colCount = temComposicao ? 10 : 9;
              return (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nº</TableHead>
                      <TableHead>Janela</TableHead>
                      <TableHead className="text-right">Valor previsto</TableHead>
                      <TableHead className="text-right">Realizado</TableHead>
                      <TableHead className="text-right">Δ</TableHead>
                      {temComposicao && <TableHead>Composição</TableHead>}
                      <TableHead>NFS prevista</TableHead>
                      <TableHead>Pagto previsto</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {bmsOrdenadas.map((b) => {
                      const editavel = b.status === "prevista" || b.status === "aberta";
                      const absorbed = redistribPorDestino[Number(b.numero)] ?? [];
                      const totalAbsorvido = absorbed.reduce(
                        (a: number, r: any) => a + Number(r.valor_absorvido || 0),
                        0,
                      );
                      return (
                        <TableRow
                          key={b.id}
                          className={Number(b.numero) === 0 ? "bg-muted/40" : undefined}
                        >
                          <TableCell className="font-mono">{b.numero}</TableCell>
                          <TableCell className="text-xs">
                            {Number(b.numero) === 0 ? (
                              <span className="font-medium">Antecipação</span>
                            ) : (
                              <>
                                {format(parseISO(b.data_inicio_janela), "dd/MM/yy")} –{" "}
                                {format(parseISO(b.data_corte), "dd/MM/yy")}
                                {b.observacoes ? ` · ${b.observacoes}` : ""}
                              </>
                            )}
                          </TableCell>

                          <TableCell className="text-right font-medium">
                            {(() => {
                              const previstoExibido = Number(
                                b.valor_previsto_inicial ?? b.valor_previsto_dinamico ?? 0,
                              );
                              return b.status === "prevista" && absorbed.length > 0 ? (
                                <Popover>
                                  <PopoverTrigger asChild>
                                    <button
                                      type="button"
                                      className="underline decoration-dotted underline-offset-2 hover:text-primary"
                                    >
                                      {brl(previstoExibido)}
                                    </button>
                                  </PopoverTrigger>
                                  <PopoverContent className="w-96 text-xs">
                                    <div className="font-medium mb-2">
                                      Composição — saldo absorvido
                                    </div>
                                    <div className="space-y-1.5 max-h-72 overflow-y-auto">
                                      {absorbed.map((r: any) => (
                                        <div
                                          key={r.id}
                                          className="flex justify-between gap-2 border-b border-border/50 pb-1"
                                        >
                                          <div className="min-w-0">
                                            <div className="truncate">{r.descricao_item}</div>
                                            <div className="text-muted-foreground">
                                              BMS {r.bms_origem_numero} ·{" "}
                                              {r.motivo === "realocado_por_revisao"
                                                ? "realocado por revisão"
                                                : "proporcional"}
                                            </div>
                                          </div>
                                          <div
                                            className={`font-mono whitespace-nowrap ${Number(r.valor_absorvido) >= 0 ? "text-warning" : "text-success"}`}
                                          >
                                            {Number(r.valor_absorvido) >= 0 ? "+" : ""}
                                            {brl(r.valor_absorvido)}
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  </PopoverContent>
                                </Popover>
                              ) : (
                                brl(previstoExibido)
                              );
                            })()}
                          </TableCell>
                          {(() => {
                            const nf = b.nota_fiscal_id
                              ? nfs.find((n) => n.id === b.nota_fiscal_id)
                              : null;
                            const temNf = !!nf && nf.status !== "cancelada";
                            const med = b.medicao_id
                              ? (medicoes ?? []).find((m: any) => m.id === b.medicao_id)
                              : null;
                            const temMed = !!med;
                            const valorNf = temNf ? Number(nf.valor_liquido ?? nf.valor ?? 0) : 0;
                            const valorMed = temMed ? Number(med.valor || 0) : 0;
                            // Prioriza NF (valor faturado oficial); senão usa medição.
                            const realizado = temNf ? valorNf : temMed ? valorMed : 0;
                            const temReal = temNf || temMed;
                            const origem = temNf ? "NF" : temMed ? "Medição" : null;
                            const previsto = Number(
                              b.valor_previsto_inicial ?? b.valor_previsto_dinamico ?? 0,
                            );
                            const delta = realizado - previsto;
                            const pct = previsto > 0 ? (delta / previsto) * 100 : 0;
                            const abs = Math.abs(pct);
                            const tone = !temReal
                              ? "text-muted-foreground"
                              : abs <= 1
                                ? "text-[color:var(--success)]"
                                : abs < 10
                                  ? "text-warning"
                                  : "text-destructive";
                            return (
                              <>
                                <TableCell className="text-right num">
                                  {temReal ? (
                                    <span className="inline-flex items-center gap-1.5">
                                      {brl(realizado)}
                                      {origem && (
                                        <Badge
                                          variant="outline"
                                          className="h-4 px-1 text-[9px] font-normal"
                                        >
                                          {origem}
                                        </Badge>
                                      )}
                                    </span>
                                  ) : (
                                    <span className="text-muted-foreground">—</span>
                                  )}
                                </TableCell>
                                <TableCell className={`text-right num text-xs ${tone}`}>
                                  {temReal ? (
                                    <>
                                      {delta >= 0 ? "+" : ""}
                                      {brl(delta)}
                                      <span className="ml-1 opacity-75">
                                        ({delta >= 0 ? "+" : ""}
                                        {pct.toFixed(1)}%)
                                      </span>
                                    </>
                                  ) : (
                                    "—"
                                  )}
                                </TableCell>
                              </>
                            );
                          })()}
                          {temComposicao && (
                            <TableCell>
                              {absorbed.length > 0 ? (
                                <Popover>
                                  <PopoverTrigger asChild>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="h-7 px-2 gap-1 text-xs"
                                    >
                                      <Info className="h-3.5 w-3.5" />
                                      {totalAbsorvido >= 0 ? "+" : ""}
                                      {brl(totalAbsorvido)}
                                    </Button>
                                  </PopoverTrigger>
                                  <PopoverContent className="w-96 text-xs">
                                    <div className="font-medium mb-2">
                                      Saldo absorvido de BMS anteriores
                                    </div>
                                    <div className="space-y-1.5 max-h-72 overflow-y-auto">
                                      {absorbed.map((r: any) => (
                                        <div
                                          key={r.id}
                                          className="flex justify-between gap-2 border-b border-border/50 pb-1"
                                        >
                                          <div className="min-w-0">
                                            <div className="truncate">{r.descricao_item}</div>
                                            <div className="text-muted-foreground">
                                              BMS {r.bms_origem_numero} ·{" "}
                                              {r.motivo === "realocado_por_revisao"
                                                ? "realocado por revisão"
                                                : "proporcional"}
                                            </div>
                                          </div>
                                          <div
                                            className={`font-mono whitespace-nowrap ${Number(r.valor_absorvido) >= 0 ? "text-warning" : "text-success"}`}
                                          >
                                            {Number(r.valor_absorvido) >= 0 ? "+" : ""}
                                            {brl(r.valor_absorvido)}
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  </PopoverContent>
                                </Popover>
                              ) : (
                                <span className="text-xs text-muted-foreground">—</span>
                              )}
                            </TableCell>
                          )}
                          <TableCell>
                            {b.data_emissao_nfs_prevista
                              ? format(parseISO(b.data_emissao_nfs_prevista), "dd/MM/yy")
                              : "—"}
                          </TableCell>
                          <TableCell>
                            {b.data_pagamento_prevista
                              ? format(parseISO(b.data_pagamento_prevista), "dd/MM/yy")
                              : "—"}
                          </TableCell>
                          <TableCell>
                            <SharedStatusBadge tipo="bms" status={b.status} />
                          </TableCell>
                          <TableCell className="text-right whitespace-nowrap">
                            {Number(b.numero) > 0 && (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => setComposicaoBms(b)}
                                title="Ver composição"
                              >
                                <ListTree className="h-3.5 w-3.5" />
                              </Button>
                            )}
                            {editavel && (
                              <Button
                                size="icon"
                                aria-label="Editar datas"
                                variant="ghost"
                                onClick={() => abrirEdicao(b)}
                                title="Editar datas"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                            )}
                            {b.status === "prevista" && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="ml-1"
                                onClick={() => abrirBms(b)}
                              >
                                Abrir BMS
                              </Button>
                            )}
                            {b.status === "aberta" && (
                              <Button
                                size="sm"
                                variant="default"
                                className="ml-1"
                                onClick={() => pedirFechamento(b)}
                              >
                                Fechar BMS
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    {bmsOrdenadas.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={colCount} className="p-0">
                          <EmptyState
                            icon={CalendarClock}
                            title="Nenhuma BMS prevista"
                            description={`Configure a régua de medição e gere as parcelas previstas com base no cronograma e nos dias de corte.${Number(obra.valor_antecipacao || 0) > 0 ? ` Inclui BMS 0 de ${brl(Number(obra.valor_antecipacao))} (antecipação).` : ""}`}
                            action={{
                              label: "Gerar BMS previstas",
                              onClick: gerarBmsPrevistas,
                              icon: FileText,
                            }}
                          />
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              );
            })()}
          </div>
          {bmsOrdenadas.length > 0 &&
            (() => {
              const somaBms = bmsOrdenadas.reduce(
                (a, b) => a + Number(b.valor_previsto_dinamico || 0),
                0,
              );
              const diffContrato = somaBms - valorContrato;
              const bate = Math.abs(diffContrato) < 0.5;
              let somaReal = 0;
              let somaPrevFat = 0;
              for (const b of bmsOrdenadas) {
                const nf = b.nota_fiscal_id ? nfs.find((n) => n.id === b.nota_fiscal_id) : null;
                const med = b.medicao_id
                  ? (medicoes ?? []).find((m: any) => m.id === b.medicao_id)
                  : null;
                const temNf = nf && nf.status !== "cancelada";
                if (temNf || med) {
                  somaReal += temNf
                    ? Number(nf.valor_liquido ?? nf.valor ?? 0)
                    : Number(med.valor || 0);
                  somaPrevFat += Number(b.valor_previsto_inicial ?? b.valor_previsto_dinamico ?? 0);
                }
              }
              const somaDelta = somaReal - somaPrevFat;
              const deltaTone =
                Math.abs(somaDelta) < 0.5
                  ? "text-foreground"
                  : somaDelta >= 0
                    ? "text-[color:var(--success)]"
                    : "text-destructive";

              // Reconciliação financeira: Σ NF emitidas (não canceladas) + Σ BMS previstas (status='prevista') deve == valorContrato.
              const somaNfEmitidas = nfs
                .filter((n) => n.status !== "cancelada" && n.status !== "rascunho")
                .reduce((a, n) => a + Number(n.valor_liquido ?? n.valor ?? 0), 0);
              const somaBmsPrevistas = bmsOrdenadas
                .filter((b) => b.status === "prevista")
                .reduce((a, b) => a + Number(b.valor_previsto_dinamico || 0), 0);
              const reconcEsperado = valorContrato;
              const reconcAtual = somaNfEmitidas + somaBmsPrevistas;
              const reconcDiff = reconcAtual - reconcEsperado;
              const reconcBate = Math.abs(reconcDiff) < 0.5;

              return (
                <>
                  <div className="mt-3 -mx-6 px-6 py-2 border-t bg-muted/30 text-xs flex items-center justify-end gap-3 flex-wrap">
                    {somaReal > 0 && (
                      <>
                        <span className="text-muted-foreground">
                          Σ Realizado ={" "}
                          <span className="num font-medium text-foreground">{brl(somaReal)}</span>
                        </span>
                        <span className="text-muted-foreground">·</span>
                        <span className="text-muted-foreground">
                          Σ Δ ={" "}
                          <span className={`num font-medium ${deltaTone}`}>
                            {somaDelta >= 0 ? "+" : ""}
                            {brl(somaDelta)}
                          </span>
                        </span>
                        <span className="text-muted-foreground">·</span>
                      </>
                    )}
                    <span className="text-muted-foreground">
                      Soma BMS ={" "}
                      <span className="num font-medium text-foreground">{brl(somaBms)}</span>
                    </span>
                    <span className="text-muted-foreground">·</span>
                    <span className="text-muted-foreground">
                      Contrato ={" "}
                      <span className="num font-medium text-foreground">{brl(valorContrato)}</span>
                    </span>
                    <span className="text-muted-foreground">·</span>
                    <span
                      className={
                        bate
                          ? "text-[color:var(--success)] font-medium"
                          : "text-destructive font-medium num"
                      }
                    >
                      {bate ? "✓ bate" : `Δ ${brl(diffContrato)}`}
                    </span>
                  </div>
                  <div className="-mx-6 -mb-4 px-6 py-2 border-t bg-muted/20 text-xs flex items-center justify-between gap-3 flex-wrap">
                    <span className="text-muted-foreground">
                      Reconciliação: Σ NF emitidas + Σ BMS previstas = Contrato
                    </span>
                    <span className="flex items-center gap-2 flex-wrap">
                      <span className="text-muted-foreground">
                        {brl(somaNfEmitidas)} + {brl(somaBmsPrevistas)} =
                      </span>
                      <span className="num font-medium text-foreground">{brl(reconcAtual)}</span>
                      <span className="text-muted-foreground">vs {brl(reconcEsperado)}</span>
                      <span
                        className={
                          reconcBate
                            ? "text-[color:var(--success)] font-medium"
                            : "text-destructive font-medium num"
                        }
                      >
                        {reconcBate ? "✓ reconciliado" : `⚠ Δ ${brl(reconcDiff)}`}
                      </span>
                    </span>
                  </div>
                </>
              );
            })()}
        </CardContent>
      </Card>

      <Dialog open={!!composicaoBms} onOpenChange={(o) => !o && setComposicaoBms(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          {composicaoBms &&
            (() => {
              const { linhas, somaContrib } = calcularComposicaoBms(composicaoBms);
              const valorBms = Number(composicaoBms.valor_previsto_dinamico || 0);
              const diff = somaContrib - valorBms;
              const bate = Math.abs(diff) < 0.5;
              const isFechada = composicaoBms.status === "fechada";
              const itensMedDessa =
                isFechada && composicaoBms.medicao_id
                  ? (itensMedicao ?? []).filter(
                      (im: any) => im.medicao_id === composicaoBms.medicao_id,
                    )
                  : [];
              return (
                <>
                  <DialogHeader>
                    <DialogTitle>
                      Composição da BMS {composicaoBms.numero}
                      <span className="ml-2 text-sm font-normal text-muted-foreground">
                        {format(parseISO(composicaoBms.data_inicio_janela), "dd/MM/yyyy")} –{" "}
                        {format(parseISO(composicaoBms.data_corte), "dd/MM/yyyy")} · {brl(valorBms)}
                      </span>
                    </DialogTitle>
                    {isFechada && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Composição prevista (antes do fechamento).
                      </p>
                    )}
                  </DialogHeader>

                  {linhas.length === 0 ? (
                    <div className="text-sm text-muted-foreground py-8 text-center">
                      Nenhum item do cronograma intersecta esta janela.
                    </div>
                  ) : (
                    <>
                      <ComposicaoBmsTree linhas={linhas} />
                      <div className="mt-3 px-3 py-2 rounded-md border-t bg-muted/30 text-xs flex items-center justify-end gap-3">
                        <span className="text-muted-foreground">
                          Σ contribuições ={" "}
                          <span className="num font-medium text-foreground">
                            {brl(somaContrib)}
                          </span>
                        </span>
                        <span className="text-muted-foreground">·</span>
                        <span className="text-muted-foreground">
                          Valor previsto da BMS ={" "}
                          <span className="num font-medium text-foreground">{brl(valorBms)}</span>
                        </span>
                        <span className="text-muted-foreground">·</span>
                        <span
                          className={
                            bate
                              ? "text-[color:var(--success)] font-medium"
                              : "text-destructive font-medium num"
                          }
                        >
                          {bate ? "✓ bate" : `Δ ${brl(diff)}`}
                        </span>
                      </div>
                    </>
                  )}

                  {isFechada && itensMedDessa.length > 0 && (
                    <div className="mt-6 pt-4 border-t">
                      <div className="text-sm font-medium mb-2">Realizado na medição</div>
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Item</TableHead>
                              <TableHead className="text-right">% Atual</TableHead>
                              <TableHead className="text-right">Valor atual</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {itensMedDessa.map((im: any) => (
                              <TableRow key={im.id}>
                                <TableCell className="max-w-[420px]">
                                  <div className="truncate">{im.bms_descricao ?? "—"}</div>
                                </TableCell>
                                <TableCell className="text-right tabular-nums">
                                  {Number(im.percentual_atual || 0).toFixed(2)}%
                                </TableCell>
                                <TableCell className="text-right tabular-nums">
                                  {brl(im.valor_atual)}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                  )}
                </>
              );
            })()}
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={!!confirmFechar}
        onOpenChange={(v) => !v && !fechando && setConfirmFechar(null)}
      >
        <AlertDialogContent className="max-w-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Fechar BMS {confirmFechar?.bms?.numero}?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 text-sm">
                <div className="grid grid-cols-3 gap-3 pt-2">
                  <div className="rounded border p-2">
                    <div className="text-xs text-muted-foreground">Previsto dinâmico</div>
                    <div className="font-semibold">
                      {brl(confirmFechar?.previa.valorPrevistoAntes ?? 0)}
                    </div>
                  </div>
                  <div className="rounded border p-2">
                    <div className="text-xs text-muted-foreground">Realizado</div>
                    <div className="font-semibold">
                      {brl(confirmFechar?.previa.valorRealizado ?? 0)}
                    </div>
                  </div>
                  <div className="rounded border p-2">
                    <div className="text-xs text-muted-foreground">Δ a redistribuir</div>
                    <div
                      className={`font-semibold ${(confirmFechar?.previa.delta ?? 0) > 0 ? "text-warning" : (confirmFechar?.previa.delta ?? 0) < 0 ? "text-success" : ""}`}
                    >
                      {brl(confirmFechar?.previa.delta ?? 0)}
                    </div>
                  </div>
                </div>

                {confirmFechar && confirmFechar.previa.futurasDepois.length > 0 ? (
                  <div>
                    <div className="text-xs font-medium mb-1">Como ficam as BMS futuras:</div>
                    <div className="max-h-48 overflow-auto rounded border">
                      <table className="w-full text-xs">
                        <thead className="bg-muted/50">
                          <tr>
                            <th className="text-left p-1.5">BMS</th>
                            <th className="text-right p-1.5">Antes</th>
                            <th className="text-right p-1.5">Depois</th>
                            <th className="text-right p-1.5">Δ</th>
                          </tr>
                        </thead>
                        <tbody>
                          {confirmFechar.previa.futurasDepois.map((f) => {
                            const d = f.valor_novo - f.valor_anterior;
                            return (
                              <tr key={f.id} className="border-t">
                                <td className="p-1.5 font-mono">{f.numero}</td>
                                <td className="p-1.5 text-right">{brl(f.valor_anterior)}</td>
                                <td className="p-1.5 text-right font-medium">
                                  {brl(f.valor_novo)}
                                </td>
                                <td
                                  className={`p-1.5 text-right ${d > 0 ? "text-warning" : d < 0 ? "text-success" : "text-muted-foreground"}`}
                                >
                                  {d >= 0 ? "+" : ""}
                                  {brl(d)}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                    <div className="text-xs text-muted-foreground mt-2">
                      Soma total após fechamento:{" "}
                      <span className="font-medium">
                        {brl(confirmFechar.previa.somaFinalContrato)}
                      </span>
                      {" · "}Contrato: {brl(valorContrato)}
                      {confirmFechar.previa.divergenciaContrato < 0.05
                        ? " · ✓ bate"
                        : ` · ⚠ Δ ${brl(confirmFechar.previa.divergenciaContrato)}`}
                    </div>
                    {confirmFechar.previa.avisos.length > 0 && (
                      <div className="text-xs text-warning mt-2 space-y-1">
                        {confirmFechar.previa.avisos.map((a, i) => (
                          <div key={i}>⚠ {a}</div>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-xs text-muted-foreground">
                    Não há BMS futuras com status "prevista" — o saldo não será redistribuído.
                  </div>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={fechando}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={fechando}
              onClick={(e) => {
                e.preventDefault();
                confirmarFechamento();
              }}
            >
              {fechando ? "Fechando…" : "Confirmar fechamento"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Sheet open={!!editBms} onOpenChange={(o) => !o && setEditBms(null)}>
        <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Editar BMS {editBms?.numero}</SheetTitle>
          </SheetHeader>
          <div className="mt-4 space-y-3">
            <div className="space-y-1.5">
              <Label>Data de corte</Label>
              <DatePickerField
                value={editForm.data_corte}
                onChange={(v) => setEditForm({ ...editForm, data_corte: v })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Data de emissão da NFS</Label>
              <DatePickerField
                value={editForm.data_emissao_nfs_prevista}
                onChange={(v) => setEditForm({ ...editForm, data_emissao_nfs_prevista: v })}
              />
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label>Data de pagamento prevista</Label>
                <Button type="button" size="sm" variant="ghost" onClick={recalcularPagamentoPadrao}>
                  Recalcular pelo padrão
                </Button>
              </div>
              <DatePickerField
                value={editForm.data_pagamento_prevista}
                onChange={(v) => setEditForm({ ...editForm, data_pagamento_prevista: v })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Observações</Label>
              <Textarea
                value={editForm.observacoes}
                onChange={(e) => setEditForm({ ...editForm, observacoes: e.target.value })}
              />
            </div>
          </div>
          <SheetFooter className="mt-4">
            <Button variant="outline" onClick={() => setEditBms(null)}>
              Cancelar
            </Button>
            <Button onClick={salvarEdicao}>Salvar</Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {(() => {
        const hoje = new Date().toISOString().slice(0, 10);
        const ativas = bmsOrdenadas.filter((b: any) => b.status !== "cancelada");
        const REALIZADAS = new Set(["fechada", "faturada", "paga"]);
        const totalAReceber = ativas
          .filter((b: any) => !REALIZADAS.has(String(b.status)))
          .reduce((a: number, b: any) => a + Number(b.valor_previsto_dinamico || 0), 0);
        const totalRealizado = ativas
          .filter((b: any) => REALIZADAS.has(String(b.status)))
          .reduce((a: number, b: any) => a + Number(b.valor_previsto_dinamico || 0), 0);
        const proxima = ativas
          .filter(
            (b: any) =>
              (b.status === "prevista" || b.status === "aberta") && b.data_pagamento_prevista,
          )
          .sort((a: any, b: any) => Number(a.numero) - Number(b.numero))[0];

        function recebimentoDaBms(b: any) {
          // Preferir vínculo direto BMS → NF; fallback via medicao_id para BMS antigas
          let nfId: string | null = b.nota_fiscal_id ?? null;
          if (!nfId && b.medicao_id) {
            const nf = nfs.find((n) => n.medicao_id === b.medicao_id);
            nfId = nf?.id ?? null;
          }
          if (!nfId) return null;
          const r = receb.find((x) => x.nota_fiscal_id === nfId && x.data_recebimento);
          return r ?? null;
        }

        if (ativas.length === 0) return null;
        return (
          <Card>
            <CardHeader>
              <CardTitle>Fluxo de recebimento</CardTitle>
              <p className="text-xs text-muted-foreground mt-1">
                Derivado das BMS previstas. Datas de NFS e pagamento conforme régua da obra.
              </p>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>BMS</TableHead>
                      <TableHead>Período</TableHead>
                      <TableHead>Corte BMS</TableHead>
                      <TableHead>NFS prevista</TableHead>
                      <TableHead>Pagto previsto</TableHead>
                      <TableHead className="text-right">Valor previsto</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Recebido</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {ativas.map((b: any) => {
                      const fechada = REALIZADAS.has(String(b.status));
                      const r = recebimentoDaBms(b);
                      const cancelada = String(b.status) === "cancelada";
                      const vencido =
                        b.data_pagamento_prevista &&
                        b.data_pagamento_prevista < hoje &&
                        !fechada &&
                        !cancelada &&
                        !r;
                      return (
                        <TableRow key={b.id} className={fechada ? "bg-muted/30" : undefined}>
                          <TableCell className="font-medium">Nº {b.numero}</TableCell>
                          <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                            {b.data_inicio_janela
                              ? format(parseISO(b.data_inicio_janela), "dd/MM/yy")
                              : "—"}
                            {" – "}
                            {b.data_corte ? format(parseISO(b.data_corte), "dd/MM/yy") : "—"}
                          </TableCell>
                          <TableCell className="whitespace-nowrap">
                            {b.data_corte ? format(parseISO(b.data_corte), "dd/MM/yyyy") : "—"}
                          </TableCell>
                          <TableCell className="whitespace-nowrap">
                            {b.data_emissao_nfs_prevista
                              ? format(parseISO(b.data_emissao_nfs_prevista), "dd/MM/yyyy")
                              : "—"}
                          </TableCell>
                          <TableCell className="whitespace-nowrap">
                            <span className="inline-flex items-center gap-1">
                              {b.data_pagamento_prevista
                                ? format(parseISO(b.data_pagamento_prevista), "dd/MM/yyyy")
                                : "—"}
                              {vencido && (
                                <>
                                  <AlertTriangle className="h-3.5 w-3.5 text-warning" />
                                  <span className="text-xs text-warning">Vencido</span>
                                </>
                              )}
                            </span>
                          </TableCell>

                          <TableCell className="text-right font-semibold tabular-nums">
                            {brl(b.valor_previsto_dinamico)}
                          </TableCell>
                          <TableCell>
                            <SharedStatusBadge tipo="bms" status={b.status} />
                          </TableCell>
                          <TableCell className="whitespace-nowrap text-xs">
                            {r
                              ? `${format(parseISO(r.data_recebimento), "dd/MM/yy")} · ${brl(r.valor_recebido)}`
                              : "—"}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-4 pt-4 border-t">
                <div>
                  <div className="text-xs text-muted-foreground">Total a receber</div>
                  <div className="text-lg font-semibold tabular-nums">{brl(totalAReceber)}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Total realizado</div>
                  <div className="text-lg font-semibold tabular-nums">{brl(totalRealizado)}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Próximo pagamento</div>
                  <div className="text-lg font-semibold">
                    {proxima
                      ? `BMS ${proxima.numero} · ${format(parseISO(proxima.data_pagamento_prevista), "dd/MM/yyyy")}`
                      : "—"}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })()}
    </div>
  );
}
