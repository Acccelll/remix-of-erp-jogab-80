import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { format, parseISO, differenceInCalendarDays } from "date-fns";
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  FileDown,
  FileSpreadsheet,
  FileText,
  History,
  Plus,
  Printer,
  Upload,
} from "lucide-react";
import { faturamentoRpc, medicaoHistoricoRepo, medicoesRepo } from "@/lib/repositories/medicoes";
import { useAuth } from "@/contexts/auth/useAuth";
import {
  emitirNumeroCustomizado,
  previewNumeroCustomizado,
} from "@/lib/empresa/numeracao-documentos";
import {
  empresaParametrizacaoRepo,
  getInstitucionalHeaderLines,
} from "@/lib/empresa/parametrizacao";

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
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetFooter,
} from "@/components/ui/sheet";
import { Collapsible, CollapsibleTrigger } from "@/components/ui/collapsible";
import { brl } from "@/lib/billing";
import {
  HierarquiaTree,
  HierarquiaTreeControls,
  buildTree,
  aggregate,
  parseDescricao,
  type CronoNode,
} from "@/lib/cronograma/crono-tree";
import {
  gerarBoletimExcel,
  gerarBoletimPdf,
  totaisBoletim,
  type BoletimData,
  type BoletimItem,
} from "@/lib/bms/boletim";
import { uploadBoletim } from "@/lib/bms/boletim-storage";
import { StatusBadge as SharedStatusBadge } from "@/components/obra/StatusBadge";
import { BmsImporter } from "@/components/import/CronogramaSemanalImporter";
import { useObraPermissions } from "@/components/obra/ObraPermissionsContext";
import type { BmsAberturaRequest } from "@/components/obra-detalhe/ObraTabs";

// ============== Medições por item ==============

type LeafRow = {
  item: any;
  pctAnterior: number;
  pctAtual: number;
  base: number;
};

function NovaMedicaoTree({
  leaves,
  linhas,
  setPctAtual,
}: {
  leaves: any[];
  linhas: LeafRow[];
  setPctAtual: (idx: number, v: number) => void;
}) {
  const roots = useMemo(() => buildTree(leaves), [leaves]);
  const byItemId = useMemo(() => {
    const m = new Map<string, { row: LeafRow; idx: number }>();
    linhas.forEach((r, i) => m.set(r.item.id, { row: r, idx: i }));
    return m;
  }, [linhas]);

  const sumBase = (n: CronoNode): number => {
    if (n.children.length === 0 && n.item) return byItemId.get(n.item.id)?.row.base ?? 0;
    let s = n.item ? (byItemId.get(n.item.id)?.row.base ?? 0) : 0;
    for (const c of n.children) s += sumBase(c);
    return s;
  };
  const sumValorPeriodo = (n: CronoNode): number => {
    if (n.children.length === 0 && n.item) {
      const r = byItemId.get(n.item.id)?.row;
      return r ? (r.base * (r.pctAtual - r.pctAnterior)) / 100 : 0;
    }
    let s = 0;
    if (n.item) {
      const r = byItemId.get(n.item.id)?.row;
      if (r) s += (r.base * (r.pctAtual - r.pctAnterior)) / 100;
    }
    for (const c of n.children) s += sumValorPeriodo(c);
    return s;
  };

  return (
    <>
      <div className="flex justify-end px-3 pt-2">
        <HierarquiaTreeControls roots={roots} />
      </div>
      <HierarquiaTree
        roots={roots}
        valorContrato={0}
        columns={[
          {
            key: "base",
            header: "Base (R$)",
            align: "right",
            showOnParents: true,
            render: ({ node }) => (
              <span className="tabular-nums text-xs">{brl(sumBase(node))}</span>
            ),
          },
          {
            key: "pctAnt",
            header: "% Anterior",
            align: "right",
            showOnParents: false,
            render: ({ node }) => {
              const r = byItemId.get(node.item?.id)?.row;
              if (!r) return null;
              return (
                <span className="text-xs text-muted-foreground tabular-nums">
                  {r.pctAnterior.toFixed(2)}%
                </span>
              );
            },
          },
          {
            key: "pctAt",
            header: "% Atual",
            align: "right",
            width: "w-32",
            showOnParents: false,
            render: ({ node }) => {
              const found = byItemId.get(node.item?.id);
              if (!found) return null;
              const { row: r, idx } = found;
              const erro = r.pctAtual < r.pctAnterior;
              const exec = r.pctAtual > r.pctAnterior;
              return (
                <div className="flex items-center gap-1 justify-end">
                  <Input
                    type="number"
                    step="0.001"
                    min={r.pctAnterior}
                    max={100}
                    value={r.pctAtual}
                    onChange={(e) => setPctAtual(idx, Number(e.target.value))}
                    className={`h-8 w-24 text-right ${exec ? "border-success bg-success/10" : ""} ${erro ? "border-destructive" : ""}`}
                  />
                  {erro && <AlertCircle className="h-3 w-3 text-destructive" />}
                </div>
              );
            },
          },
          {
            key: "pctPer",
            header: "% Período",
            align: "right",
            showOnParents: false,
            render: ({ node }) => {
              const r = byItemId.get(node.item?.id)?.row;
              if (!r) return null;
              const pctPeriodo = r.pctAtual - r.pctAnterior;
              const exec = pctPeriodo > 0;
              return (
                <span
                  className={`text-xs tabular-nums ${exec ? "text-success font-medium" : "text-muted-foreground"}`}
                >
                  {pctPeriodo > 0
                    ? `+${pctPeriodo.toFixed(2)}%`
                    : pctPeriodo === 0
                      ? "—"
                      : `${pctPeriodo.toFixed(2)}%`}
                </span>
              );
            },
          },
          {
            key: "valorPer",
            header: "Valor Período",
            align: "right",
            showOnParents: true,
            render: ({ node }) => {
              const v = sumValorPeriodo(node);
              if (v === 0) return <span className="text-xs text-muted-foreground">—</span>;
              return (
                <span className="text-xs tabular-nums text-success font-medium whitespace-nowrap">
                  {brl(v)}
                </span>
              );
            },
          },
        ]}
      />
    </>
  );
}

export function MedicoesTab({
  obra,
  crono,
  medicoes,
  itensMedicao,
  revisoes,
  bmsAbertura,
  onAberturaConsumida,
  onChange,
}: {
  obra: any;
  crono: any[];
  medicoes: any[];
  itensMedicao: any[];
  revisoes?: any[];
  bmsAbertura?: BmsAberturaRequest;
  onAberturaConsumida?: () => void;
  onChange: () => void;
}) {
  const { canEdit } = useObraPermissions();
  const { currentPlayer } = useAuth();
  const meLogin = currentPlayer?.login ?? "";
  const empresaId = typeof obra?.empresa_id === "string" ? obra.empresa_id : null;

  const { data: canAprovarMedicao = false } = useQuery({
    queryKey: ["medicao-can-aprovar", obra.id, currentPlayer?.id],
    enabled: !!obra.id && !!currentPlayer?.id,
    staleTime: 60_000,
    queryFn: async () => {
      try {
        return await medicoesRepo.canAprovar(obra.id);
      } catch {
        return false;
      }
    },
  });

  const { data: historicoMedicao = [], refetch: refetchHistoricoMedicao } = useQuery({
    queryKey: ["historico-medicao", obra.id],
    enabled: !!obra.id,
    staleTime: 30_000,
    queryFn: async () => {
      try {
        return await medicaoHistoricoRepo.listByObra(obra.id);
      } catch {
        return [];
      }
    },
  });

  const historicoPorMedicao = useMemo(() => {
    const map = new Map<string, any[]>();
    for (const h of historicoMedicao) {
      const rows = map.get(h.medicao_id) ?? [];
      rows.push(h);
      map.set(h.medicao_id, rows);
    }
    return map;
  }, [historicoMedicao]);

  const valorContrato = Number(obra.valor_contrato || 0);
  const [open, setOpen] = useState(false);
  const [bmsLink, setBmsLink] = useState<{ id: string; numero: number } | null>(null);
  const [avisoSemRevisao, setAvisoSemRevisao] = useState<string | null>(null);
  const [form, setForm] = useState<{
    numero: string;
    data_inicio: string;
    data_corte: string;
    observacoes: string;
  }>({
    numero: "",
    data_inicio: "",
    data_corte: "",
    observacoes: "",
  });

  // Folhas do cronograma (sem filhos)
  const leaves = useMemo(() => {
    const roots = buildTree(crono);
    const out: any[] = [];
    const walk = (n: CronoNode) => {
      if (n.children.length === 0 && n.item) out.push(n.item);
      else for (const c of n.children) walk(c);
    };
    roots.forEach(walk);
    return out.length > 0 ? out : crono.filter((c) => c); // fallback se não conseguir parsear
  }, [crono]);

  const [linhas, setLinhas] = useState<LeafRow[]>([]);
  const previewNumeroMedicao = useMemo(
    () => (open && !bmsLink ? previewNumeroCustomizado(empresaId, "medicao") : null),
    [empresaId, open, bmsLink?.id],
  );
  const usarNumeracaoMedicaoParametrizada = !bmsLink && !!previewNumeroMedicao;
  const numeroMedicaoPendente = !form.numero && !usarNumeracaoMedicaoParametrizada;

  function abrirNova() {
    const rows: LeafRow[] = leaves.map((item) => {
      const custo = Number(item.custo || 0);
      const base =
        custo > 0 ? custo : (Number(item.percentual_previsto || 0) / 100) * valorContrato;
      const pctAnterior = Number(item.percentual_realizado || 0);
      return { item, pctAnterior, pctAtual: pctAnterior, base };
    });
    setLinhas(rows);
    setForm({ numero: "", data_inicio: "", data_corte: "", observacoes: "" });
    setBmsLink(null);
    setAvisoSemRevisao(null);
    setOpen(true);
  }

  // Quando solicitada uma abertura de BMS, pré-carrega o sheet com os dados sugeridos.
  useEffect(() => {
    if (!bmsAbertura) return;
    const bms = bmsAbertura.bms;
    const corte = parseISO(bms.data_corte);
    const inicioJanela = parseISO(bms.data_inicio_janela);
    const rows: LeafRow[] = leaves.map((item) => {
      const custo = Number(item.custo || 0);
      const base =
        custo > 0 ? custo : (Number(item.percentual_previsto || 0) / 100) * valorContrato;
      const pctAnterior = Number(item.percentual_realizado || 0);
      // % esperado linear até a data de corte, relativo ao próprio item.
      let pctEsperado = pctAnterior;
      if (item.data_inicio && item.data_fim) {
        const ini = parseISO(item.data_inicio);
        const fim = parseISO(item.data_fim);
        const dur = Math.max(1, differenceInCalendarDays(fim, ini) + 1);
        const passou = differenceInCalendarDays(corte, ini) + 1;
        const frac = Math.max(0, Math.min(1, passou / dur));
        pctEsperado = Math.min(100, frac * 100);
      }
      const sugerido = Math.max(pctAnterior, pctEsperado);
      return { item, pctAnterior, pctAtual: Math.min(100, sugerido), base };
    });
    setLinhas(rows);
    setForm({
      numero: `BMS ${bms.numero}`,
      data_inicio: bms.data_inicio_janela,
      data_corte: bms.data_corte,
      observacoes: `Abertura da BMS prevista nº ${bms.numero}`,
    });
    setBmsLink({ id: bms.id, numero: bms.numero });
    // Aviso quando não houver revisão de cronograma dentro da janela.
    const temRev = (revisoes ?? []).some((r: any) => {
      if (!r.data_corte) return false;
      const dc = parseISO(r.data_corte);
      return dc >= inicioJanela && dc <= corte;
    });
    setAvisoSemRevisao(
      temRev
        ? null
        : "Nenhuma atualização de cronograma nesta janela — usando o último estado conhecido. Você pode atualizar o cronograma agora.",
    );
    setOpen(true);
    onAberturaConsumida?.();
  }, [bmsAbertura?.key]);

  function setPctAtual(idx: number, v: number) {
    setLinhas((ls) => ls.map((l, i) => (i === idx ? { ...l, pctAtual: v } : l)));
  }

  const totalPeriodo = linhas.reduce(
    (acc, l) => acc + (l.base * (l.pctAtual - l.pctAnterior)) / 100,
    0,
  );
  const acumAnterior = linhas.reduce((acc, l) => acc + (l.base * l.pctAnterior) / 100, 0);
  const acumApos = linhas.reduce((acc, l) => acc + (l.base * l.pctAtual) / 100, 0);
  const temErro = linhas.some((l) => l.pctAtual < l.pctAnterior);

  async function salvar() {
    if (numeroMedicaoPendente) return toast.error("Informe o número da medição");
    if (!form.data_corte) return toast.error("Informe a data de corte");
    if (temErro) return toast.error("Há itens com % atual menor que % anterior");

    const valorTotal = totalPeriodo;
    const comExecucao = linhas.filter((l) => l.pctAtual > l.pctAnterior);
    let numeroFinal = form.numero.trim();
    let rollbackNumero: (() => void) | undefined;

    if (usarNumeracaoMedicaoParametrizada) {
      const emitido = emitirNumeroCustomizado(empresaId, "medicao");
      if (!emitido) return toast.error("Informe o número da medição");
      numeroFinal = emitido.numero;
      rollbackNumero = emitido.rollback;
    }

    // H1.3 — gravação atômica no banco (medição + itens + % cronograma + vínculo BMS).
    const { data: medId, error } = await faturamentoRpc.criarMedicaoAtomica({
      p_obra_id: obra.id,
      p_numero: numeroFinal,
      p_data_inicio: form.data_inicio || null,
      p_data_corte: form.data_corte,
      p_observacoes: form.observacoes || null,
      p_valor_total: valorTotal,
      p_itens: comExecucao.map((l) => ({
        cronograma_item_id: l.item.id,
        percentual_anterior: l.pctAnterior,
        percentual_atual: l.pctAtual,
        valor_anterior: (l.base * l.pctAnterior) / 100,
        valor_atual: (l.base * l.pctAtual) / 100,
      })),
      p_bms_id: bmsLink?.id ?? null,
    });

    if (error || !medId) {
      rollbackNumero?.();
      return toast.error(error?.message ?? "Erro ao criar medição");
    }

    toast.success(`Medição ${numeroFinal} criada · ${brl(valorTotal)}`);
    setOpen(false);
    setBmsLink(null);
    setAvisoSemRevisao(null);
    onChange();
  }

  async function enviar(m: any) {
    if (!meLogin) return toast.error("Sessão inválida");
    try {
      await medicoesRepo.enviarParaAprovacao(m.id, meLogin);
    } catch (e: any) {
      return toast.error(e?.message ?? "Erro ao enviar para aprovação");
    }
    toast.success("Medição enviada para aprovação");
    refetchHistoricoMedicao();
    onChange();
  }
  async function aprovar(m: any) {
    if (!meLogin) return toast.error("Sessão inválida");
    if (!canAprovarMedicao) return toast.error("Apenas fiscalização pode aprovar medições");
    try {
      await medicoesRepo.aprovar(m.id, meLogin);
    } catch (e: any) {
      return toast.error(e?.message ?? "Erro ao aprovar");
    }
    toast.success(`Medição aprovada por ${meLogin}`);
    refetchHistoricoMedicao();
    onChange();
  }
  async function rejeitar(m: any) {
    if (!meLogin) return toast.error("Sessão inválida");
    if (!canAprovarMedicao) return toast.error("Apenas fiscalização pode rejeitar medições");
    const motivo = window.prompt("Motivo da rejeição (opcional):") ?? undefined;
    try {
      await medicoesRepo.rejeitar(m.id, meLogin, motivo);
    } catch (e: any) {
      return toast.error(e?.message ?? "Erro ao rejeitar");
    }
    toast.success("Medição rejeitada");
    refetchHistoricoMedicao();
    onChange();
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Medições</CardTitle>
        <div className="flex items-center gap-2">
          <Sheet>
            <SheetTrigger asChild>
              <Button size="sm" variant="outline" disabled={!canEdit}>
                <Upload className="h-4 w-4 mr-2" />
                Importar BMS
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-full sm:max-w-4xl overflow-y-auto">
              <SheetHeader>
                <SheetTitle>Importar BMS (Excel)</SheetTitle>
              </SheetHeader>
              <div className="mt-4">
                <BmsImporter obraIdFixo={obra.id} />
              </div>
            </SheetContent>
          </Sheet>
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button size="sm" disabled={!canEdit} onClick={abrirNova}>
                <Plus className="h-4 w-4 mr-2" />
                Medição
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-full sm:max-w-4xl overflow-y-auto">
              <SheetHeader>
                <SheetTitle>
                  {bmsLink ? `Abertura · BMS ${bmsLink.numero}` : "Nova medição"}
                </SheetTitle>
                {avisoSemRevisao && (
                  <div className="mt-2 text-xs rounded-md border border-warning/40 bg-warning/10 text-warning  px-3 py-2">
                    {avisoSemRevisao}
                  </div>
                )}
              </SheetHeader>

              <div className="mt-4 space-y-4">
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1.5">
                    <Label>Número *</Label>
                    <Input
                      value={form.numero}
                      onChange={(e) => setForm({ ...form, numero: e.target.value })}
                      placeholder={
                        previewNumeroMedicao ? `Automático: ${previewNumeroMedicao}` : "BMS 11"
                      }
                      disabled={usarNumeracaoMedicaoParametrizada}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Data início *</Label>
                    <DatePickerField
                      value={form.data_inicio}
                      onChange={(v) => setForm({ ...form, data_inicio: v })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Data corte/fim *</Label>
                    <DatePickerField
                      value={form.data_corte}
                      onChange={(v) => setForm({ ...form, data_corte: v })}
                    />
                  </div>
                  <div className="space-y-1.5 col-span-3">
                    <Label>Observações</Label>
                    <Textarea
                      value={form.observacoes}
                      onChange={(e) => setForm({ ...form, observacoes: e.target.value })}
                      rows={2}
                    />
                  </div>
                </div>

                {linhas.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-8 text-center">
                    Importe um cronograma para a obra antes de medir.
                  </p>
                ) : (
                  <div className="border rounded-md">
                    <NovaMedicaoTree leaves={leaves} linhas={linhas} setPctAtual={setPctAtual} />
                    <div className="border-t bg-muted/30 px-4 py-3 space-y-1 sticky bottom-0">
                      <div className="flex justify-between items-center font-semibold">
                        <span>Total desta medição:</span>
                        <span className={totalPeriodo > 0 ? "text-success" : ""}>
                          {brl(totalPeriodo)}
                        </span>
                      </div>
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>Acumulado anterior:</span>
                        <span>{brl(acumAnterior)}</span>
                      </div>
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>Acumulado após:</span>
                        <span>{brl(acumApos)}</span>
                      </div>
                    </div>
                  </div>
                )}

                {totalPeriodo === 0 && linhas.length > 0 && (
                  <p className="text-sm text-warning flex items-center gap-2">
                    <AlertCircle className="h-4 w-4" />
                    Nenhum serviço foi executado neste período.
                  </p>
                )}
                {temErro && (
                  <p className="text-sm text-destructive flex items-center gap-2">
                    <AlertCircle className="h-4 w-4" />
                    Há itens com % atual menor que % anterior — corrija antes de salvar.
                  </p>
                )}
              </div>

              <SheetFooter className="mt-6">
                <Button variant="outline" onClick={() => setOpen(false)}>
                  Cancelar
                </Button>
                <Button
                  onClick={salvar}
                  disabled={temErro || numeroMedicaoPendente || !form.data_corte}
                >
                  Salvar medição
                </Button>
              </SheetFooter>
            </SheetContent>
          </Sheet>
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nº</TableHead>
                <TableHead>Período</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead>Status</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {medicoes.map((m) => (
                <MedicaoRow
                  key={m.id}
                  m={m}
                  obra={obra}
                  itens={itensMedicao.filter((im) => im.medicao_id === m.id)}
                  crono={crono}
                  valorContrato={valorContrato}
                  onEnviar={() => enviar(m)}
                  onAprovar={() => aprovar(m)}
                  onRejeitar={() => rejeitar(m)}
                  canAprovarMedicao={canAprovarMedicao}
                  historico={historicoPorMedicao.get(m.id) ?? []}
                />
              ))}

              {medicoes.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                    Sem medições
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

function MedicaoRow({
  m,
  obra,
  itens,
  crono,
  valorContrato,
  onEnviar,
  onAprovar,
  onRejeitar,
  canAprovarMedicao,
  historico,
}: {
  m: any;
  obra: any;
  itens: any[];
  crono?: any[];
  valorContrato: number;
  onEnviar: () => void;
  onAprovar: () => void;
  onRejeitar: () => void;
  canAprovarMedicao: boolean;
  historico: any[];
}) {
  const { canEdit } = useObraPermissions();
  const [open, setOpen] = useState(false);

  const [openBol, setOpenBol] = useState(false);
  const periodo = m.data_inicio
    ? `${format(parseISO(m.data_inicio), "dd/MM/yy")} – ${format(parseISO(m.data_corte), "dd/MM/yy")}`
    : format(parseISO(m.data_corte), "dd/MM/yy");

  // Atividades de nível 1 do cronograma — usadas quando a medição não traz itens detalhados
  // (típico de BMS importadas que trazem só status geral). Mostra nome + % realizado agregado.
  const nivel1 = useMemo(() => {
    if (!crono || crono.length === 0) return [];
    const roots = buildTree(crono);
    return roots.map((r) => ({ node: r, agg: aggregate(r, valorContrato) }));
  }, [crono, valorContrato]);

  return (
    <>
      <TableRow>
        <TableCell className="font-medium">{m.numero}</TableCell>
        <TableCell className="text-xs">{periodo}</TableCell>
        <TableCell className="text-right whitespace-nowrap">{brl(m.valor)}</TableCell>
        <TableCell>
          <SharedStatusBadge tipo="medicao" status={m.status} />
          {m.status === "aprovada" && (m.aprovada_por || m.aprovada_em) && (
            <div className="text-[10px] text-muted-foreground mt-0.5">
              por {m.aprovada_por ?? "—"}
              {m.aprovada_em ? ` · ${format(parseISO(m.aprovada_em), "dd/MM/yy HH:mm")}` : ""}
            </div>
          )}
          {m.status === "enviada" && m.enviada_por && (
            <div className="text-[10px] text-muted-foreground mt-0.5">
              enviada por {m.enviada_por}
            </div>
          )}
          {m.status === "rejeitada" && (m.rejeitada_por || m.rejeicao_motivo) && (
            <div className="text-[10px] text-destructive mt-0.5">
              {m.rejeitada_por ? `por ${m.rejeitada_por}` : ""}
              {m.rejeicao_motivo ? ` · ${m.rejeicao_motivo}` : ""}
            </div>
          )}
        </TableCell>
        <TableCell className="text-right whitespace-nowrap space-x-1">
          <Collapsible open={open} onOpenChange={setOpen}>
            <CollapsibleTrigger asChild>
              <Button size="sm" variant="ghost">
                {open ? (
                  <ChevronDown className="h-3 w-3 mr-1" />
                ) : (
                  <ChevronRight className="h-3 w-3 mr-1" />
                )}
                Ver itens ({itens.length})
              </Button>
            </CollapsibleTrigger>
          </Collapsible>
          {(m.status === "aprovada" || m.status === "faturada") && (
            <Button size="sm" variant="outline" onClick={() => setOpenBol(true)}>
              <FileDown className="h-3 w-3 mr-1" />
              Boletim
            </Button>
          )}
          {(m.status === "rascunho" || m.status === "em_revisao" || m.status === "rejeitada") && (
            <Button size="sm" variant="outline" disabled={!canEdit} onClick={onEnviar}>
              <CheckCircle2 className="h-3 w-3 mr-1" />
              Enviar para aprovação
            </Button>
          )}
          {m.status === "enviada" && (
            <>
              <Button size="sm" disabled={!canAprovarMedicao} onClick={onAprovar}>
                <CheckCircle2 className="h-3 w-3 mr-1" />
                Aprovar
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={!canAprovarMedicao}
                onClick={onRejeitar}
              >
                Rejeitar
              </Button>
            </>
          )}
        </TableCell>
      </TableRow>
      {open && (
        <TableRow>
          <TableCell colSpan={5} className="bg-muted/30 p-0">
            <div className="px-4 py-3">
              {itens.length === 0 ? (
                nivel1.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    Esta medição não possui itens detalhados.
                  </p>
                ) : (
                  <>
                    <p className="text-xs text-muted-foreground mb-2">
                      Sem itens detalhados — exibindo status geral das atividades de nível 1 do
                      cronograma.
                    </p>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-20">EDT</TableHead>
                          <TableHead>Atividade</TableHead>
                          <TableHead className="text-right">% Previsto</TableHead>
                          <TableHead className="text-right">% Realizado</TableHead>
                          <TableHead className="text-right">Valor base</TableHead>
                          <TableHead className="text-right">Executado</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {nivel1.map(({ node, agg }) => (
                          <TableRow key={node.wbs}>
                            <TableCell className="font-mono text-xs text-muted-foreground">
                              {node.wbs}
                            </TableCell>
                            <TableCell className="text-sm font-medium">{node.name}</TableCell>
                            <TableCell className="text-right text-xs">
                              {agg.pct.toFixed(2)}%
                            </TableCell>
                            <TableCell className="text-right text-xs">
                              {agg.base > 0
                                ? ((agg.executado / agg.base) * 100).toFixed(2)
                                : "0.00"}
                              %
                            </TableCell>
                            <TableCell className="text-right text-xs whitespace-nowrap">
                              {brl(agg.base)}
                            </TableCell>
                            <TableCell className="text-right text-xs whitespace-nowrap">
                              {brl(agg.executado)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </>
                )
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-20">EDT</TableHead>
                      <TableHead>Descrição</TableHead>
                      <TableHead className="text-right">% Anterior</TableHead>
                      <TableHead className="text-right">% Atual</TableHead>
                      <TableHead className="text-right">% Período</TableHead>
                      <TableHead className="text-right">Valor Período</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {itens.map((im) => {
                      const ci = im.cronograma_itens;
                      const custo = Number(ci?.custo || 0);
                      const baseCrono =
                        custo > 0
                          ? custo
                          : (Number(ci?.percentual_previsto || 0) / 100) * valorContrato;
                      const pctPer = Number(im.percentual_atual) - Number(im.percentual_anterior);
                      // BMS-imported rows: usar bms_descricao/bms_item_codigo + valor_atual/valor_anterior diretos.
                      const isBmsImport = !ci && (im.bms_descricao || im.bms_item_codigo);
                      const codigo = ci
                        ? parseDescricao(String(ci.descricao ?? "")).wbs || "—"
                        : im.bms_item_codigo || "—";
                      const descricao = ci
                        ? parseDescricao(String(ci.descricao ?? "")).name || "—"
                        : im.bms_descricao || "—";
                      const valorPeriodo = isBmsImport
                        ? Number(im.valor_atual || 0) - Number(im.valor_anterior || 0)
                        : (baseCrono * pctPer) / 100;
                      return (
                        <TableRow key={im.id}>
                          <TableCell className="font-mono text-xs text-muted-foreground">
                            {codigo}
                          </TableCell>
                          <TableCell className="text-sm">{descricao}</TableCell>
                          <TableCell className="text-right text-xs">
                            {Number(im.percentual_anterior).toFixed(2)}%
                          </TableCell>
                          <TableCell className="text-right text-xs">
                            {Number(im.percentual_atual).toFixed(2)}%
                          </TableCell>
                          <TableCell className="text-right text-xs text-success">
                            +{pctPer.toFixed(2)}%
                          </TableCell>
                          <TableCell className="text-right text-xs whitespace-nowrap">
                            {brl(valorPeriodo)}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
              {historico.length > 0 && (
                <div className="mt-4 border-t pt-3">
                  <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground mb-2">
                    <History className="h-3.5 w-3.5" />
                    Histórico de aprovação
                  </div>
                  <div className="space-y-1.5">
                    {historico.map((h) => (
                      <div
                        key={h.id}
                        className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground"
                      >
                        <span className="font-medium text-foreground">
                          {h.acao === "aprovar"
                            ? "Aprovada"
                            : h.acao === "rejeitar"
                              ? "Rejeitada"
                              : "Enviada"}
                        </span>
                        <span>
                          {h.status_anterior ?? "—"} → {h.status_novo}
                        </span>
                        <span>por {h.responsavel_login ?? "—"}</span>
                        <span>{format(parseISO(h.created_at), "dd/MM/yy HH:mm")}</span>
                        {h.motivo && <span className="text-destructive">· {h.motivo}</span>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </TableCell>
        </TableRow>
      )}
      <BoletimDialog
        open={openBol}
        onOpenChange={setOpenBol}
        m={m}
        obra={obra}
        itens={itens}
        valorContrato={valorContrato}
      />
    </>
  );
}

// ====== Boletim de Medição (visualização + Excel/PDF) ======
function buildBoletimItems(itens: any[], valorContrato: number): BoletimItem[] {
  return itens.map((im) => {
    const ci = im.cronograma_itens;
    const custo = Number(ci?.custo || 0);
    const base = custo > 0 ? custo : (Number(ci?.percentual_previsto || 0) / 100) * valorContrato;
    const pctAnt = Number(im.percentual_anterior || 0);
    const pctAtu = Number(im.percentual_atual || 0);
    const vAnt = (base * pctAnt) / 100;
    const vAcum = (base * pctAtu) / 100;
    const desc = String(ci?.descricao ?? "—");
    const parsed = parseDescricao(desc);
    return {
      codigo: parsed.wbs || String(ci?.ordem ?? ""),
      descricao: parsed.name || desc,
      unidade: undefined,
      quantidade: undefined,
      preco_unitario: undefined,
      valor_total: base,
      pct_anterior: pctAnt,
      pct_atual: pctAtu,
      valor_anterior: vAnt,
      valor_acumulado: vAcum,
      valor_periodo: vAcum - vAnt,
      saldo: base - vAcum,
    };
  });
}

function BoletimDialog({
  open,
  onOpenChange,
  m,
  obra,
  itens,
  valorContrato,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  m: any;
  obra: any;
  itens: any[];
  valorContrato: number;
}) {
  const data: BoletimData = useMemo(
    () => ({
      obra: {
        codigo: obra?.codigo,
        nome: obra?.nome ?? "",
        cliente: obra?.clientes?.nome,
        cliente_cnpj: obra?.clientes?.cnpj,
        pedido_contrato: obra?.pedido_contrato,
        valor_contrato: Number(obra?.valor_contrato || valorContrato || 0),
      },
      medicao: {
        numero: m.numero,
        data_inicio: m.data_inicio,
        data_corte: m.data_corte,
        data_aprovacao: m.data_aprovacao,
      },
      itens: buildBoletimItems(itens, valorContrato),
    }),
    [m, obra, itens, valorContrato],
  );

  const totais = totaisBoletim(data.itens);
  const periodo = `${data.medicao.data_inicio ? format(parseISO(data.medicao.data_inicio), "dd/MM/yyyy") : "—"} a ${format(parseISO(data.medicao.data_corte), "dd/MM/yyyy")}`;
  const fileBase = `BMS_${obra?.codigo ?? "obra"}_${String(m.numero).replace(/[^\w-]+/g, "_")}`;
  const storageBase = `${obra?.id}/${String(m.numero).replace(/[^\w-]+/g, "_")}`;

  async function baixarExcel() {
    try {
      const blob = await gerarBoletimExcel(data);
      triggerDownload(blob, `${fileBase}.xlsx`);
      try {
        await uploadBoletim(blob, `${storageBase}.xlsx`);
      } catch {
        /* upload opcional */
      }
      toast.success("Excel gerado");
    } catch (e: any) {
      toast.error(e.message ?? "Erro ao gerar Excel");
    }
  }
  async function baixarPdf() {
    try {
      const empresaId = typeof obra?.empresa_id === "string" ? obra.empresa_id : null;
      const logoDataUrl = empresaId
        ? (empresaParametrizacaoRepo.get(empresaId).logoUrl ?? undefined)
        : undefined;
      const institucionalLines = getInstitucionalHeaderLines(empresaId);
      const blob = await gerarBoletimPdf(data, { logoDataUrl, institucionalLines });
      triggerDownload(blob, `${fileBase}.pdf`);
      try {
        await uploadBoletim(blob, `${storageBase}.pdf`);
      } catch {
        /* upload opcional */
      }
      toast.success("PDF gerado");
    } catch (e: any) {
      toast.error(e.message ?? "Erro ao gerar PDF");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Boletim de Medição · {data.medicao.numero}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs border rounded-md p-3 bg-muted/30">
            <div>
              <span className="font-semibold">Obra:</span> {data.obra.codigo} · {data.obra.nome}
            </div>
            <div>
              <span className="font-semibold">Cliente:</span> {data.obra.cliente ?? "—"}
            </div>
            <div>
              <span className="font-semibold">Contrato:</span> {data.obra.pedido_contrato ?? "—"}
            </div>
            <div>
              <span className="font-semibold">CNPJ:</span> {data.obra.cliente_cnpj ?? "—"}
            </div>
            <div>
              <span className="font-semibold">Período:</span> {periodo}
            </div>
            <div>
              <span className="font-semibold">Data corte:</span>{" "}
              {format(parseISO(data.medicao.data_corte), "dd/MM/yyyy")}
            </div>
            <div>
              <span className="font-semibold">Valor contrato:</span> {brl(data.obra.valor_contrato)}
            </div>
            <div>
              <span className="font-semibold">BMS Nº:</span> {data.medicao.numero}
            </div>
          </div>

          <div className="border rounded-md overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-20">Item</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead className="text-right">% Ant.</TableHead>
                  <TableHead className="text-right">% Período</TableHead>
                  <TableHead className="text-right">% Acum.</TableHead>
                  <TableHead className="text-right">Valor Período</TableHead>
                  <TableHead className="text-right">Valor Acum.</TableHead>
                  <TableHead className="text-right">Saldo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.itens.map((i, idx) => (
                  <TableRow key={idx}>
                    <TableCell className="font-mono text-xs">{i.codigo || "—"}</TableCell>
                    <TableCell className="text-xs">{i.descricao}</TableCell>
                    <TableCell className="text-right text-xs">
                      {i.pct_anterior.toFixed(2)}%
                    </TableCell>
                    <TableCell className="text-right text-xs text-success">
                      {(i.pct_atual - i.pct_anterior).toFixed(2)}%
                    </TableCell>
                    <TableCell className="text-right text-xs">{i.pct_atual.toFixed(2)}%</TableCell>
                    <TableCell className="text-right text-xs whitespace-nowrap">
                      {brl(i.valor_periodo)}
                    </TableCell>
                    <TableCell className="text-right text-xs whitespace-nowrap">
                      {brl(i.valor_acumulado)}
                    </TableCell>
                    <TableCell className="text-right text-xs whitespace-nowrap">
                      {brl(i.saldo)}
                    </TableCell>
                  </TableRow>
                ))}
                {data.itens.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={8}
                      className="text-center text-muted-foreground py-6 text-xs"
                    >
                      Sem itens nesta medição
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
            <div className="border-t bg-muted/30 px-4 py-3 grid grid-cols-3 gap-2 text-xs">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total Período:</span>
                <strong>{brl(totais.valor_periodo)}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Acumulado:</span>
                <strong>{brl(totais.valor_acumulado)}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Saldo:</span>
                <strong>{brl(totais.saldo)}</strong>
              </div>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={baixarExcel}>
            <FileSpreadsheet className="h-4 w-4 mr-2" />
            Exportar Excel
          </Button>
          <Button onClick={baixarPdf}>
            <Printer className="h-4 w-4 mr-2" />
            Exportar PDF
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 0);
}
