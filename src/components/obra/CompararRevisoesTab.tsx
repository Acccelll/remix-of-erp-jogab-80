import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { format, parseISO, differenceInCalendarDays } from "date-fns";
import { GitCompare, Zap, History, FileClock, FileText, RotateCcw, Trash2 } from "lucide-react";
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
import { computeCpm, diasAtrasoCaminhoCritico } from "@/lib/cronograma/cpm";
import { CALENDARIO_PADRAO } from "@/lib/cronograma/calendario";
import { brl } from "@/lib/billing";
import {
  HierarquiaTree,
  HierarquiaTreeControls,
  buildTree,
  type CronoNode,
} from "@/lib/cronograma/crono-tree";

type Snap = {
  key: string;
  label: string;
  // map por uid_mpp ou item_id
  itens: Map<
    string,
    {
      descricao: string;
      data_inicio: string;
      data_fim: string;
      percentual_previsto: number;
      custo: number;
    }
  >;
};

export function CompararRevisoesTab({ obraId }: { obraId: string }) {
  const qc = useQueryClient();
  const [de, setDe] = useState<string>("baseline_v1");
  const [para, setPara] = useState<string>("atual");
  const [filtro, setFiltro] = useState("");
  const [soMudancas, setSoMudancas] = useState(true);
  const [computing, setComputing] = useState(false);
  const [confirmAcao, setConfirmAcao] = useState<
    | { tipo: "reverter_revisao"; id: string; label: string }
    | { tipo: "excluir_revisao"; id: string; label: string }
    | { tipo: "excluir_baseline"; id: string; label: string }
    | null
  >(null);
  const [executando, setExecutando] = useState(false);

  async function executarAcao() {
    if (!confirmAcao) return;
    setExecutando(true);
    try {
      if (confirmAcao.tipo === "reverter_revisao") {
        const { error } = await (supabase as any).rpc("fn_reverter_revisao_cronograma", {
          p_revisao_id: confirmAcao.id,
        });
        if (error) throw error;
        toast.success(`${confirmAcao.label} revertida — itens restaurados`);
      } else if (confirmAcao.tipo === "excluir_revisao") {
        await supabase
          .from("cronograma_item_revisoes")
          .delete()
          .eq("revisao_id", confirmAcao.id);
        const { error } = await supabase
          .from("cronograma_revisoes")
          .delete()
          .eq("id", confirmAcao.id);
        if (error) throw error;
        toast.success(`${confirmAcao.label} excluída`);
      } else if (confirmAcao.tipo === "excluir_baseline") {
        await supabase
          .from("cronograma_item_baseline")
          .delete()
          .eq("baseline_id", confirmAcao.id);
        const { error } = await supabase
          .from("cronograma_baselines")
          .delete()
          .eq("id", confirmAcao.id);
        if (error) throw error;
        toast.success(`${confirmAcao.label} excluída`);
      }
      qc.invalidateQueries({ queryKey: ["baselines", obraId] });
      qc.invalidateQueries({ queryKey: ["revisoes_all", obraId] });
      qc.invalidateQueries({ queryKey: ["item_baseline", obraId] });
      qc.invalidateQueries({ queryKey: ["item_revisao", obraId] });
      qc.invalidateQueries({ queryKey: ["crono_compare", obraId] });
      qc.invalidateQueries({ queryKey: ["crono", obraId] });
      setConfirmAcao(null);
    } catch (err: any) {
      toast.error(err?.message ?? "Falha ao executar ação");
    } finally {
      setExecutando(false);
    }
  }


  const { data: baselines } = useQuery({
    queryKey: ["baselines", obraId],
    queryFn: async () =>
      (
        await supabase
          .from("cronograma_baselines")
          .select("id, versao, motivo, created_at")
          .eq("obra_id", obraId)
          .order("versao")
      ).data ?? [],
  });
  const { data: revisoes } = useQuery({
    queryKey: ["revisoes_all", obraId],
    queryFn: async () =>
      (
        await supabase
          .from("cronograma_revisoes")
          .select("id, numero, data_corte, observacoes")
          .eq("obra_id", obraId)
          .order("numero")
      ).data ?? [],
  });
  const { data: crono } = useQuery({
    queryKey: ["crono_compare", obraId],
    queryFn: async () =>
      (
        await supabase
          .from("cronograma_itens")
          .select(
            "id, uid_mpp, descricao, data_inicio, data_fim, data_inicio_baseline, data_fim_baseline, custo, custo_baseline, percentual_previsto, percentual_realizado, ativo, folga_dias, critico",
          )
          .eq("obra_id", obraId)
      ).data ?? [],
  });
  const { data: itensBaseline } = useQuery({
    queryKey: ["item_baseline", obraId],
    queryFn: async () =>
      (
        await supabase
          .from("cronograma_item_baseline")
          .select(
            "baseline_id, cronograma_item_id, uid_mpp, descricao, data_inicio, data_fim, custo, percentual_previsto",
          )
          .in(
            "baseline_id",
            (baselines ?? []).map((b) => b.id),
          )
      ).data ?? [],
    enabled: !!baselines?.length,
  });
  const { data: itensRevisoes } = useQuery({
    queryKey: ["item_revisao", obraId],
    queryFn: async () =>
      (
        await supabase
          .from("cronograma_item_revisoes")
          .select(
            "revisao_id, cronograma_item_id, descricao_item, data_inicio_novo, data_fim_novo, custo_novo, percentual_realizado_novo, tipo_mudanca",
          )
          .in(
            "revisao_id",
            (revisoes ?? []).map((r) => r.id),
          )
      ).data ?? [],
    enabled: !!revisoes?.length,
  });

  const snapshots: Snap[] = useMemo(() => {
    const out: Snap[] = [];

    // Baselines
    for (const b of baselines ?? []) {
      const map = new Map();
      for (const li of itensBaseline ?? []) {
        if (li.baseline_id !== b.id) continue;
        const key = String(li.uid_mpp ?? li.cronograma_item_id);
        map.set(key, {
          descricao: li.descricao ?? "",
          data_inicio: li.data_inicio,
          data_fim: li.data_fim,
          percentual_previsto: Number(li.percentual_previsto ?? 0),
          custo: Number(li.custo ?? 0),
        });
      }
      out.push({
        key: `baseline_${b.id}`,
        label: `Baseline v${b.versao}${b.motivo ? ` · ${b.motivo}` : ""}`,
        itens: map,
      });
    }

    // Estado "atual"
    const atualMap = new Map();
    for (const i of crono ?? []) {
      if (i.ativo === false) continue;
      const key = String(i.uid_mpp ?? i.id);
      atualMap.set(key, {
        descricao: i.descricao ?? "",
        data_inicio: i.data_inicio,
        data_fim: i.data_fim,
        percentual_previsto: Number(i.percentual_previsto ?? 0),
        custo: Number(i.custo_baseline ?? i.custo ?? 0),
      });
    }
    out.push({ key: "atual", label: "Estado atual", itens: atualMap });

    return out;
  }, [baselines, itensBaseline, crono]);

  const snapDe = snapshots.find((s) => s.key === de) ?? snapshots[0];
  const snapPara = snapshots.find((s) => s.key === para) ?? snapshots[snapshots.length - 1];

  type Row = {
    key: string;
    descricao: string;
    inicioA?: string;
    fimA?: string;
    pctA?: number;
    custoA?: number;
    inicioB?: string;
    fimB?: string;
    pctB?: number;
    custoB?: number;
    deltaInicio?: number;
    deltaFim?: number;
    deltaPct?: number;
    deltaCusto?: number;
    tipo: "novo" | "removido" | "alterado" | "igual";
  };

  const linhas: Row[] = useMemo(() => {
    if (!snapDe || !snapPara) return [];
    const keys = new Set([...snapDe.itens.keys(), ...snapPara.itens.keys()]);
    const out: Row[] = [];
    for (const k of keys) {
      const a = snapDe.itens.get(k);
      const b = snapPara.itens.get(k);
      if (a && !b) {
        out.push({
          key: k,
          descricao: a.descricao,
          inicioA: a.data_inicio,
          fimA: a.data_fim,
          pctA: a.percentual_previsto,
          custoA: a.custo,
          tipo: "removido",
        });
        continue;
      }
      if (!a && b) {
        out.push({
          key: k,
          descricao: b.descricao,
          inicioB: b.data_inicio,
          fimB: b.data_fim,
          pctB: b.percentual_previsto,
          custoB: b.custo,
          tipo: "novo",
        });
        continue;
      }
      if (!a || !b) continue;
      const dInicio = differenceInCalendarDays(parseISO(b.data_inicio), parseISO(a.data_inicio));
      const dFim = differenceInCalendarDays(parseISO(b.data_fim), parseISO(a.data_fim));
      const dPct = Number((b.percentual_previsto - a.percentual_previsto).toFixed(4));
      const dCusto = Number((b.custo - a.custo).toFixed(2));
      const igual =
        dInicio === 0 && dFim === 0 && Math.abs(dPct) < 0.0001 && Math.abs(dCusto) < 0.01;
      out.push({
        key: k,
        descricao: b.descricao || a.descricao,
        inicioA: a.data_inicio,
        fimA: a.data_fim,
        pctA: a.percentual_previsto,
        custoA: a.custo,
        inicioB: b.data_inicio,
        fimB: b.data_fim,
        pctB: b.percentual_previsto,
        custoB: b.custo,
        deltaInicio: dInicio,
        deltaFim: dFim,
        deltaPct: dPct,
        deltaCusto: dCusto,
        tipo: igual ? "igual" : "alterado",
      });
    }
    return out
      .filter((r) => !soMudancas || r.tipo !== "igual")
      .filter((r) => !filtro || r.descricao.toLowerCase().includes(filtro.toLowerCase()))
      .sort((a, b) => (a.descricao || "").localeCompare(b.descricao || ""));
  }, [snapDe, snapPara, soMudancas, filtro]);

  const resumo = {
    novos: linhas.filter((l) => l.tipo === "novo").length,
    removidos: linhas.filter((l) => l.tipo === "removido").length,
    alterados: linhas.filter((l) => l.tipo === "alterado").length,
    atraso: linhas.reduce((m, l) => Math.max(m, l.deltaFim ?? 0), 0),
    custoDelta: linhas.reduce((a, l) => a + (l.deltaCusto ?? 0), 0),
  };

  async function recalcularCpm() {
    if (!crono?.length) return toast.error("Sem itens no cronograma");
    setComputing(true);
    try {
      const { data: deps } = await supabase
        .from("cronograma_dependencias")
        .select("item_id, predecessor_uid_mpp, tipo, lag_dias")
        .eq("obra_id", obraId);
      const ativos = crono.filter((i) => i.ativo !== false);
      const result = computeCpm(
        ativos.map((i) => ({
          id: i.id,
          uid_mpp: i.uid_mpp,
          data_inicio: i.data_inicio,
          data_fim: i.data_fim,
        })),
        (deps ?? []) as any,
        { calendarioPadrao: CALENDARIO_PADRAO },
      );
      // Persistir em lote (uma update por item — agrupar por valor para reduzir chamadas)
      await Promise.all(
        result.map((r) =>
          supabase
            .from("cronograma_itens")
            .update({ folga_dias: r.folga_dias, critico: r.critico })
            .eq("id", r.id),
        ),
      );
      const criticas = result.filter((r) => r.critico).length;
      const atraso = diasAtrasoCaminhoCritico(
        ativos.map((i) => ({
          id: i.id,
          data_fim: i.data_fim,
          data_fim_baseline: i.data_fim_baseline,
        })),
        result,
      );
      toast.success(
        `CPM recalculado · ${criticas} tarefas críticas · atraso do caminho crítico: ${atraso}d (corridos)`,
      );

      qc.invalidateQueries({ queryKey: ["crono_compare", obraId] });
      qc.invalidateQueries({ queryKey: ["crono", obraId] });
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setComputing(false);
    }
  }

  const criticas = (crono ?? []).filter((i) => i.critico).length;

  // Histórico unificado: baselines + revisões, ordenados por data desc.
  const historico = useMemo(() => {
    const items: {
      tipo: "baseline" | "revisao";
      id: string;
      titulo: string;
      subtitulo?: string;
      data?: string;
      contagem?: number;
    }[] = [];
    for (const b of baselines ?? []) {
      const qtd = (itensBaseline ?? []).filter((i) => i.baseline_id === b.id).length;
      items.push({
        tipo: "baseline",
        id: b.id,
        titulo: `Baseline v${b.versao}`,
        subtitulo: b.motivo ?? undefined,
        data: b.created_at,
        contagem: qtd,
      });
    }
    for (const r of revisoes ?? []) {
      const alter = (itensRevisoes ?? []).filter((i) => i.revisao_id === r.id);
      items.push({
        tipo: "revisao",
        id: r.id,
        titulo: `Revisão #${r.numero}`,
        subtitulo: r.observacoes ?? undefined,
        data: r.data_corte,
        contagem: alter.length,
      });
    }
    return items.sort((a, b) => (b.data ?? "").localeCompare(a.data ?? ""));
  }, [baselines, revisoes, itensBaseline, itensRevisoes]);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="h-4 w-4" /> Histórico de importações
            <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-[10px]">
              {historico.length}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {historico.length === 0 ? (
            <div className="text-sm text-muted-foreground py-4 text-center">
              Nenhuma importação registrada. Importe um XML de MS Project para começar.
            </div>
          ) : (
            <ol className="relative border-l pl-4 space-y-3 ml-2">
              {historico.map((h) => {
                const isBase = h.tipo === "baseline";
                const Icon = isBase ? FileText : FileClock;
                return (
                  <li key={`${h.tipo}-${h.id}`} className="relative">
                    <span
                      className={`absolute -left-[22px] top-1 flex h-4 w-4 items-center justify-center rounded-full ${
                        isBase ? "bg-primary/15 text-primary" : "bg-warning/15 text-warning"
                      }`}
                    >
                      <Icon className="h-2.5 w-2.5" />
                    </span>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">{h.titulo}</span>
                          <Badge
                            variant={isBase ? "default" : "outline"}
                            className="text-[10px] h-4 px-1.5"
                          >
                            {isBase ? "baseline" : "revisão semanal"}
                          </Badge>
                        </div>
                        {h.subtitulo && (
                          <div className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
                            {h.subtitulo}
                          </div>
                        )}
                      </div>
                      <div className="text-right shrink-0 flex flex-col items-end gap-1">
                        <div className="text-xs text-muted-foreground">
                          {h.data ? fmt(h.data) : "—"}
                        </div>
                        <div className="text-[11px] text-muted-foreground">
                          {isBase
                            ? `${h.contagem ?? 0} itens`
                            : `${h.contagem ?? 0} alteraç${(h.contagem ?? 0) === 1 ? "ão" : "ões"}`}
                        </div>
                        <div className="flex gap-1 mt-0.5">
                          {!isBase && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-6 px-2 text-[11px]"
                              onClick={() =>
                                setConfirmAcao({
                                  tipo: "reverter_revisao",
                                  id: h.id,
                                  label: h.titulo,
                                })
                              }
                            >
                              <RotateCcw className="h-3 w-3 mr-1" /> Reverter
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 px-2 text-[11px] text-destructive hover:text-destructive"
                            onClick={() =>
                              setConfirmAcao({
                                tipo: isBase ? "excluir_baseline" : "excluir_revisao",
                                id: h.id,
                                label: h.titulo,
                              })
                            }
                          >
                            <Trash2 className="h-3 w-3 mr-1" /> Excluir
                          </Button>
                        </div>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </CardContent>
      </Card>

      <AlertDialog
        open={!!confirmAcao}
        onOpenChange={(o) => !o && !executando && setConfirmAcao(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmAcao?.tipo === "reverter_revisao"
                ? `Reverter ${confirmAcao.label}?`
                : `Excluir ${confirmAcao?.label}?`}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmAcao?.tipo === "reverter_revisao"
                ? "As datas e percentuais dos itens serão restaurados aos valores anteriores a esta revisão. A revisão em si permanece registrada."
                : confirmAcao?.tipo === "excluir_baseline"
                  ? "A baseline e todos os seus snapshots serão apagados permanentemente. Esta ação não pode ser desfeita."
                  : "A revisão e todos os seus snapshots serão apagados permanentemente. As datas atuais dos itens não são alteradas por esta operação."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={executando}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                executarAcao();
              }}
              disabled={executando}
              className={
                confirmAcao?.tipo !== "reverter_revisao"
                  ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  : undefined
              }
            >
              {executando ? "Executando…" : "Confirmar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>


      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-4 w-4" /> Caminho crítico
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="text-sm text-muted-foreground">
              {criticas > 0 ? (
                <>
                  Hoje há <span className="font-medium text-foreground">{criticas}</span> tarefa(s)
                  com folga ≤ 0 (críticas).
                </>
              ) : (
                "Folgas ainda não calculadas. Recalcule após importar uma revisão para identificar as tarefas críticas."
              )}
            </div>
            <Button size="sm" onClick={recalcularCpm} disabled={computing}>
              <Zap className="h-4 w-4 mr-2" />
              {computing ? "Calculando…" : "Recalcular CPM"}
            </Button>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Cálculo em <strong>dias úteis</strong> (calendário 5×8, seg–sex). Lags em minutos vindos
            do MPP são convertidos automaticamente. Feriados regionais ainda não são considerados.
          </p>
        </CardContent>
      </Card>


      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <GitCompare className="h-4 w-4" /> Comparar revisões
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div className="space-y-1">
              <div className="text-xs text-muted-foreground">De</div>
              <Select value={de} onValueChange={setDe}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {snapshots.map((s) => (
                    <SelectItem key={s.key} value={s.key}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <div className="text-xs text-muted-foreground">Para</div>
              <Select value={para} onValueChange={setPara}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {snapshots.map((s) => (
                    <SelectItem key={s.key} value={s.key}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <div className="text-xs text-muted-foreground">Filtro</div>
              <Input
                value={filtro}
                onChange={(e) => setFiltro(e.target.value)}
                placeholder="Descrição…"
              />
            </div>
            <div className="space-y-1">
              <div className="text-xs text-muted-foreground">Exibição</div>
              <Button
                variant={soMudancas ? "default" : "outline"}
                size="sm"
                onClick={() => setSoMudancas((v) => !v)}
                className="w-full"
              >
                {soMudancas ? "Somente mudanças" : "Todas as linhas"}
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-xs">
            <Stat label="Novos" value={String(resumo.novos)} />
            <Stat label="Removidos" value={String(resumo.removidos)} />
            <Stat label="Alterados" value={String(resumo.alterados)} />
            <Stat label="Maior atraso" value={`${resumo.atraso}d`} />
            <Stat label="Δ Custo" value={brl(resumo.custoDelta)} />
          </div>

          {linhas.length === 0 ? (
            <div className="text-sm text-muted-foreground py-8 text-center">
              Sem diferenças entre as versões selecionadas.
            </div>
          ) : (
            <CompararHierarquia linhas={linhas} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border bg-card p-2">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-sm font-medium mt-0.5">{value}</div>
    </div>
  );
}

function fmt(d: string) {
  try {
    return format(parseISO(d), "dd/MM/yy");
  } catch {
    return d;
  }
}

function deltaCell(v: number | undefined, suf: string) {
  if (v == null) return <span className="text-muted-foreground">—</span>;
  if (v === 0) return <span className="text-muted-foreground">0{suf}</span>;
  const color = v > 0 ? "text-warning" : "text-success";
  return (
    <span className={color}>
      {v > 0 ? "+" : ""}
      {v}
      {suf}
    </span>
  );
}

type CompRow = {
  key: string;
  descricao: string;
  inicioA?: string;
  fimA?: string;
  pctA?: number;
  custoA?: number;
  inicioB?: string;
  fimB?: string;
  pctB?: number;
  custoB?: number;
  deltaInicio?: number;
  deltaFim?: number;
  deltaPct?: number;
  deltaCusto?: number;
  tipo: "novo" | "removido" | "alterado" | "igual";
};

function CompararHierarquia({ linhas }: { linhas: CompRow[] }) {
  // Constrói itens compatíveis com buildTree (precisa de descricao + id).
  const itens = useMemo(
    () => linhas.map((l) => ({ id: l.key, descricao: l.descricao, _row: l })),
    [linhas],
  );
  const roots = useMemo(() => buildTree(itens), [itens]);

  // Agregação de Δ custo (soma) por nó.
  const sumDeltaCusto = (node: CronoNode): number => {
    if (node.children.length === 0 && node.item) return Number(node.item._row?.deltaCusto ?? 0);
    let s = node.item ? Number(node.item._row?.deltaCusto ?? 0) : 0;
    for (const c of node.children) s += sumDeltaCusto(c);
    return s;
  };
  // Maior Δ fim (em módulo) na subárvore.
  const maxDeltaFim = (node: CronoNode): number => {
    if (node.children.length === 0 && node.item) return Number(node.item._row?.deltaFim ?? 0);
    let best = node.item ? Number(node.item._row?.deltaFim ?? 0) : 0;
    for (const c of node.children) {
      const v = maxDeltaFim(c);
      if (Math.abs(v) > Math.abs(best)) best = v;
    }
    return best;
  };

  return (
    <div className="overflow-auto">
      <div className="flex justify-end pb-2">
        <HierarquiaTreeControls roots={roots} />
      </div>
      <HierarquiaTree
        roots={roots}
        valorContrato={0}
        columns={[
          {
            key: "tipo",
            header: "Tipo",
            showOnParents: false,
            render: ({ node }) => {
              const r = node.item?._row as CompRow | undefined;
              if (!r) return null;
              return (
                <Badge
                  variant={
                    r.tipo === "novo"
                      ? "default"
                      : r.tipo === "removido"
                        ? "destructive"
                        : "secondary"
                  }
                >
                  {r.tipo}
                </Badge>
              );
            },
          },
          {
            key: "datasA",
            header: "Datas A",
            showOnParents: false,
            render: ({ node }) => {
              const r = node.item?._row as CompRow | undefined;
              if (!r) return null;
              return (
                <span className="text-xs whitespace-nowrap">
                  {r.inicioA ? fmt(r.inicioA) : "—"} → {r.fimA ? fmt(r.fimA) : "—"}
                </span>
              );
            },
          },
          {
            key: "datasB",
            header: "Datas B",
            showOnParents: false,
            render: ({ node }) => {
              const r = node.item?._row as CompRow | undefined;
              if (!r) return null;
              return (
                <span className="text-xs whitespace-nowrap">
                  {r.inicioB ? fmt(r.inicioB) : "—"} → {r.fimB ? fmt(r.fimB) : "—"}
                </span>
              );
            },
          },
          {
            key: "delIni",
            header: "Δ início",
            align: "right",
            showOnParents: false,
            render: ({ node }) => deltaCell(node.item?._row?.deltaInicio, "d"),
          },
          {
            key: "delFim",
            header: "Δ fim",
            align: "right",
            showOnParents: true,
            render: ({ node, isLeaf }) => {
              const v = isLeaf ? node.item?._row?.deltaFim : maxDeltaFim(node);
              return deltaCell(v, "d");
            },
          },
          {
            key: "delPct",
            header: "Δ %",
            align: "right",
            showOnParents: false,
            render: ({ node }) => deltaCell(node.item?._row?.deltaPct, "%"),
          },
          {
            key: "delCusto",
            header: "Δ custo",
            align: "right",
            showOnParents: true,
            render: ({ node, isLeaf }) => {
              const v = isLeaf ? node.item?._row?.deltaCusto : sumDeltaCusto(node);
              return <span className="tabular-nums text-xs">{v != null ? brl(v) : "—"}</span>;
            },
          },
        ]}
      />
    </div>
  );
}
