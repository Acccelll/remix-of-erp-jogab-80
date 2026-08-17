import { useState, useMemo } from "react";

import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  cronogramaBaselineItensFns as cronogramaBaselineItensRepo,
  cronogramaBaselinesFns as cronogramaBaselinesRepo,
  cronogramaDependenciasFns as cronogramaDependenciasRepo,
  cronogramaFns as cronogramaRepo,
} from "@/hooks/obras/useCronograma";
import { obrasRepo } from "@/lib/repositories/obras";
import { formatBRL } from "@/lib/core/currency";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Checkbox } from "@/components/ui/checkbox";
import { brl } from "@/lib/billing";
import { Badge } from "@/components/ui/badge";
import { recalcularPrevisaoNF } from "@/lib/cronograma/recalculo";
import { parseISO } from "date-fns";
import {
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  CalendarClock,
  FileText,
  HelpCircle,
  Layers,
} from "lucide-react";
import {
  parseMppXml,
  isMppBinary,
  dias,
  parentChain,
  type MppTask,
  type MppDependency,
} from "@/lib/cronograma/mpp";
import { MppNotSupportedDialog } from "@/components/import/MppNotSupportedDialog";
import { parseBmsWorkbook, type BmsWorkbook, type BmsSheet } from "@/lib/bms/excel";
import { format } from "date-fns";
import { BusyOverlay } from "@/components/ui/busy-overlay";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Loader2, AlertTriangle } from "lucide-react";
import { reportError } from "@/lib/core/errors";

type MppReport = {
  ok: boolean;
  errors: string[];
  warnings: string[];
  stats: {
    tarefasLidas: number;
    folhas: number;
    custoTotal: number;
    percentualMedio: number;
  };
};

export function validateMpp(tasks: MppTask[], valorContrato?: number | null): MppReport {
  const errors: string[] = [];
  const warnings: string[] = [];
  const folhas = tasks.filter((t) => !t.hasChildren);
  const folhasComData = folhas.filter((t) => t.start && t.finish);
  const custoTotal = folhas.reduce((a, t) => a + (t.custo || 0), 0);
  const pctMedio = folhas.length
    ? folhas.reduce((a, t) => a + ((t as any).percentComplete || 0), 0) / folhas.length
    : 0;

  if (tasks.length === 0) errors.push("Nenhuma tarefa encontrada no XML.");
  if (folhas.length === 0) errors.push("Nenhuma tarefa-folha (executável) detectada.");
  if (folhas.length > 0 && custoTotal === 0)
    warnings.push("Custo total das folhas é zero — verifique se o XML traz <Cost> ou <FixedCost>.");
  if (folhasComData.length < folhas.length)
    warnings.push(`${folhas.length - folhasComData.length} folha(s) sem datas serão ignoradas.`);
  const semUid = tasks.filter((t) => !t.uid).length;
  if (semUid > 0) errors.push(`${semUid} tarefa(s) sem UID — XML inconsistente.`);

  // Heurística "Cost remanescente": se há avanço médio significativo e custo total é baixo
  // relativo ao contrato, MS Project pode estar exportando custo remanescente, não total.
  if (
    valorContrato &&
    valorContrato > 0 &&
    pctMedio > 5 &&
    custoTotal < 0.9 * Number(valorContrato)
  ) {
    warnings.push(
      `Custo total (${formatBRL(custoTotal)}) é menor que 90% do contrato e há avanço médio de ${pctMedio.toFixed(1)}%. ` +
        "Possível custo remanescente — MS Project exporta <Cost> como remanescente quando há % concluído. Confirme antes de importar.",
    );
  }

  return {
    ok: errors.length === 0,
    errors,
    warnings,
    stats: {
      tarefasLidas: tasks.length,
      folhas: folhas.length,
      custoTotal,
      percentualMedio: pctMedio,
    },
  };
}

export function CronogramaImporter({ obraIdFixo }: { obraIdFixo?: string } = {}) {
  const [tasks, setTasks] = useState<MppTask[]>([]);
  const [titulo, setTitulo] = useState<string>("");
  const [obraIdState, setObraIdState] = useState<string>("");
  const obraId = obraIdFixo ?? obraIdState;
  const setObraId = setObraIdState;
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [importing, setImporting] = useState(false);
  const [substituir, setSubstituir] = useState<boolean>(true);
  const [ponderacao, setPonderacao] = useState<"custo" | "dias">("custo");
  const [done, setDone] = useState<number | null>(null);
  const [report, setReport] = useState<MppReport | null>(null);
  const [mppDialogOpen, setMppDialogOpen] = useState(false);
  const [mppCalendars, setMppCalendars] = useState<import("@/lib/cronograma/mpp").MppCalendar[]>(
    [],
  );
  const [mppCalendarUidPadrao, setMppCalendarUidPadrao] = useState<string | undefined>(undefined);

  const { data: obras } = useQuery({
    queryKey: ["obras-lista"],
    queryFn: () => obrasRepo.listMinContrato(),
  });
  const obraSelecionada = obras?.find((o) => o.id === obraId);
  const valorContrato = Number(obraSelecionada?.valor_contrato ?? 0);

  // index helpers
  const byUid = new Map(tasks.map((t) => [t.uid, t]));
  const childrenOf = new Map<string, MppTask[]>();
  for (const t of tasks) {
    if (!t.parentUid) continue;
    const arr = childrenOf.get(t.parentUid) ?? [];
    arr.push(t);
    childrenOf.set(t.parentUid, arr);
  }

  function descendants(uid: string): MppTask[] {
    const out: MppTask[] = [];
    const stack = [...(childrenOf.get(uid) ?? [])];
    while (stack.length) {
      const x = stack.pop()!;
      out.push(x);
      for (const c of childrenOf.get(x.uid) ?? []) stack.push(c);
    }
    return out;
  }

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setDone(null);
    isMppBinary(file).then((isBin) => {
      if (isBin) {
        console.info("mpp_upload_attempt");
        setMppDialogOpen(true);
        e.target.value = "";
        return;
      }
      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          const text = String(ev.target?.result ?? "");
          const parsedMpp = parseMppXml(text);
          const { titulo, tasks } = parsedMpp;
          setMppCalendars(parsedMpp.calendars);
          setMppCalendarUidPadrao(parsedMpp.calendarUidPadrao);
          const rep = validateMpp(tasks, valorContrato);
          setReport(rep);
          setTitulo(titulo ?? "");
          setTasks(tasks);
          // pré-seleciona folhas (incluindo marcos de 0 dias — preserva ART etc.)
          const initSel: Record<string, boolean> = {};
          tasks.forEach((t) => {
            if (!t.hasChildren) initSel[t.uid] = true;
          });
          setSelected(initSel);
          setCollapsed(new Set());
          if (rep.errors.length) toast.error(`XML com ${rep.errors.length} erro(s) — veja painel`);
          else if (rep.warnings.length)
            toast.warning(`${tasks.length} tarefas, ${rep.warnings.length} aviso(s)`);
          else toast.success(`${tasks.length} tarefas detectadas (${rep.stats.folhas} folhas)`);
        } catch (err: any) {
          toast.error(`Erro ao ler XML: ${err.message}`);
          setReport({
            ok: false,
            errors: [String(err.message)],
            warnings: [],
            stats: { tarefasLidas: 0, folhas: 0, custoTotal: 0, percentualMedio: 0 },
          });
        }
      };
      reader.readAsText(file);
    });
  }

  // Somente folhas (tarefas mais profundas de cada ramo) entram nos totais e
  // na importação. Resumos são apenas contexto visual / hierarquia do Project.
  const escolhidas = tasks.filter((t) => !t.hasChildren && selected[t.uid] && t.start && t.finish);
  const totalDias = escolhidas.reduce((acc, t) => acc + dias(t.start!, t.finish!), 0) || 1;
  const totalCusto = escolhidas.reduce((acc, t) => acc + (t.custo || 0), 0);
  // se a opção for "custo" mas a seleção não tiver nenhum valor, cai para "dias"
  const modoEfetivo: "custo" | "dias" = ponderacao === "custo" && totalCusto > 0 ? "custo" : "dias";

  function pctOf(t: MppTask): number {
    if (t.hasChildren) return 0;
    if (!t.start || !t.finish) return 0;
    if (modoEfetivo === "custo") return totalCusto > 0 ? ((t.custo || 0) / totalCusto) * 100 : 0;
    return (dias(t.start, t.finish) / totalDias) * 100;
  }

  // Roll-up de custo apenas para exibição em linhas de resumo (não entra no total).
  const rollupCusto = new Map<string, number>();
  for (const t of tasks) {
    if (t.hasChildren) {
      const desc = descendants(t.uid).filter((d) => !d.hasChildren);
      rollupCusto.set(
        t.uid,
        desc.reduce((acc, d) => acc + (d.custo || 0), 0),
      );
    }
  }

  function setAll(predicate: (t: MppTask) => boolean) {
    const next: Record<string, boolean> = {};
    tasks.forEach((t) => {
      if (!t.hasChildren && predicate(t)) next[t.uid] = true;
    });
    setSelected(next);
  }

  function toggleSelect(t: MppTask, value: boolean) {
    // Resumos não são selecionáveis — apenas folhas contribuem.
    if (t.hasChildren) return;
    setSelected((s) => ({ ...s, [t.uid]: value }));
  }

  function toggleCollapse(uid: string) {
    setCollapsed((s) => {
      const n = new Set(s);
      if (n.has(uid)) n.delete(uid);
      else n.add(uid);
      return n;
    });
  }

  // visíveis: oculta descendentes de nós colapsados
  const visibleTasks: MppTask[] = [];
  {
    const hiddenAncestors = new Set<string>();
    for (const t of tasks) {
      let hidden = false;
      let p = t.parentUid;
      while (p) {
        if (collapsed.has(p) || hiddenAncestors.has(p)) {
          hidden = true;
          break;
        }
        p = byUid.get(p)?.parentUid;
      }
      if (!hidden) visibleTasks.push(t);
      else hiddenAncestors.add(t.uid);
    }
  }

  async function importar() {
    if (!obraId) return toast.error("Selecione a obra de destino");
    if (escolhidas.length === 0) return toast.error("Nenhuma tarefa selecionada com datas válidas");
    setImporting(true);
    try {
      if (substituir) {
        const count = await cronogramaRepo.countByObra(obraId);
        if (count > 0) {
          toast.info(`Substituindo ${count} itens existentes do cronograma...`);
        }
        await cronogramaRepo.removeByObra(obraId);
      }
      const rows = escolhidas.map((t, i) => {
        const wbs = t.wbs ? `${t.wbs} ` : "";
        const chain = parentChain(t, byUid)
          .map((p) => (p.wbs ? `${p.wbs} ${p.name}` : p.name))
          .join(" › ");
        const contexto = chain ? `  ·  [${chain}]` : "";
        return {
          obra_id: obraId,
          descricao: wbs + t.name + contexto,
          data_inicio: t.start!,
          data_fim: t.finish!,
          ordem: i,
          custo: Number((t.custo || 0).toFixed(2)),
          custo_baseline: Number((t.custo || 0).toFixed(2)),
          percentual_previsto: Number(pctOf(t).toFixed(6)),
          uid_mpp: t.uid || null,
          data_inicio_baseline: t.start!,
          data_fim_baseline: t.finish!,
          ativo: true,
          calendario_uid_mpp: t.calendarUid ?? null,
        };
      });
      await cronogramaRepo.insertMany(rows as any);

      // Onda 1.2: criar baseline v1 (ou próxima versão) congelada com os itens recém-importados
      const itensSalvos = await cronogramaRepo.listSnapshotSourceByObra(obraId);
      const proximaVersao = (await cronogramaBaselinesRepo.getUltimaVersao(obraId)) + 1;
      const novaBl = await cronogramaBaselinesRepo.createReturningId({
        obra_id: obraId,
        versao: proximaVersao,
        motivo: "import_inicial",
      });

      if (itensSalvos && itensSalvos.length) {
        const linhas = itensSalvos.map((ci: any) => ({
          baseline_id: novaBl.id,
          cronograma_item_id: ci.id,
          uid_mpp: ci.uid_mpp,
          descricao: ci.descricao,
          custo: Number(ci.custo_baseline ?? ci.custo ?? 0),
          data_inicio: ci.data_inicio_baseline ?? ci.data_inicio,
          data_fim: ci.data_fim_baseline ?? ci.data_fim,
          percentual_previsto: Number(ci.percentual_previsto ?? 0),
        }));
        await cronogramaBaselineItensRepo.insertMany(linhas);
      }

      // G4.1: gravar dependências (caminho crítico) entre itens importados
      if (itensSalvos && itensSalvos.length) {
        const byUid = new Map(
          itensSalvos.filter((i: any) => i.uid_mpp).map((i: any) => [String(i.uid_mpp), i.id]),
        );
        const deps: any[] = [];
        for (const t of escolhidas) {
          const itemId = byUid.get(String(t.uid));
          if (!itemId) continue;
          for (const p of t.predecessors ?? []) {
            deps.push({
              obra_id: obraId,
              item_id: itemId,
              predecessor_uid_mpp: p.predecessorUid,
              predecessor_item_id: byUid.get(String(p.predecessorUid)) ?? null,
              tipo: p.tipo,
              lag_dias: p.lagDias,
              lag_minutos: p.lagMinutos,
            });
          }
        }
        if (deps.length) {
          try {
            await cronogramaDependenciasRepo.insertMany(deps);
          } catch (depErr: any) {
            reportError("cronograma.import.depend-ncias-n-o-gravadas", depErr.message);
          }
        }
      }

      // Fase 2: persistir calendários do MPP antes de recalcular o CPM
      try {
        if (mppCalendars.length > 0) {
          const { persistirCalendariosMpp } =
            await import("@/lib/cronograma/persistir-calendarios");
          await persistirCalendariosMpp(obraId, mppCalendars, mppCalendarUidPadrao);
        }
      } catch (e: any) {
        reportError("cronograma.import.calend-rios-n-o-persistidos", e?.message);
      }

      // Fase 1+3: caminho crítico + importância automáticos após importar
      let cpmInfo = "";
      try {
        const { recalcularCpmObra } = await import("@/lib/cronograma/recalcular-cpm");
        const r = await recalcularCpmObra(obraId);
        cpmInfo = ` · ${r.criticas} crítica(s)`;
      } catch (e: any) {
        reportError("cronograma.import.cpm-n-o-recalculado", e?.message);
      }

      setDone(rows.length);
      toast.success(`Importação concluída`, {
        description: `${rows.length} itens importados · baseline v${proximaVersao} criada${cpmInfo}`,
        duration: 8000,
      });

    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="space-y-4">
      <BusyOverlay open={importing} message="Importando cronograma…" />
      <MppNotSupportedDialog open={mppDialogOpen} onOpenChange={setMppDialogOpen} />
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarClock className="h-4 w-4" /> Cronograma base (carga inicial / re-baseline)
          </CardTitle>
          <p className="text-xs text-muted-foreground mt-1">
            Use na <strong>primeira carga</strong> ou quando o escopo do contrato mudar. Substitui
            os itens da obra e congela um novo baseline. Para atualizar progresso semanalmente, use
            o card "Atualização semanal de progresso".
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className={obraIdFixo ? "space-y-3" : "grid grid-cols-1 md:grid-cols-2 gap-3"}>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label>Arquivo .xml</Label>
                <button
                  type="button"
                  onClick={() => setMppDialogOpen(true)}
                  className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
                >
                  <HelpCircle className="h-3 w-3" /> Tem .mpp? Veja como converter
                </button>
              </div>
              <Input type="file" accept=".xml,.mpp" onChange={onFile} />
            </div>
            {!obraIdFixo && (
              <div className="space-y-1.5">
                <Label>Obra de destino</Label>
                <Select value={obraId} onValueChange={setObraId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a obra" />
                  </SelectTrigger>
                  <SelectContent>
                    {(obras ?? []).map((o) => (
                      <SelectItem key={o.id} value={o.id}>
                        {o.codigo} — {o.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          {titulo && (
            <p className="text-xs text-muted-foreground">
              Projeto: <strong>{titulo}</strong> · {tasks.length} tarefas ·{" "}
              {tasks.filter((t) => !t.hasChildren).length} folhas
            </p>
          )}
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={substituir} onCheckedChange={(v) => setSubstituir(!!v)} />
            <span>
              <strong>Substituir cronograma existente</strong> da obra (destrutivo — apaga todos os
              itens atuais antes de inserir os novos)
            </span>
          </label>
          <div className="space-y-1.5">
            <Label>Ponderação do % previsto</Label>
            <Select value={ponderacao} onValueChange={(v) => setPonderacao(v as "custo" | "dias")}>
              <SelectTrigger className="md:w-[280px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="custo">Por custo (R$) — recomendado</SelectItem>
                <SelectItem value="dias">Por duração (dias)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <p className="text-xs text-muted-foreground">
            A árvore espelha a EDT do MS Project. Marcos (0 dias, ex.: ART) são preservados com 0%
            previsto. O % previsto é proporcional ao <strong>custo</strong> (R$) de cada tarefa
            dentro da seleção — caso o XML não traga custos, cai automaticamente para duração em
            dias.
          </p>
        </CardContent>
      </Card>

      {report && (
        <Card>
          <CardContent className="pt-6 space-y-3">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
              <div>
                <div className="text-xs text-muted-foreground uppercase">Tarefas lidas</div>
                <div className="font-semibold">{report.stats.tarefasLidas}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground uppercase">Folhas</div>
                <div className="font-semibold">{report.stats.folhas}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground uppercase">Custo total</div>
                <div className="font-semibold">{brl(report.stats.custoTotal)}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground uppercase">% médio</div>
                <div className="font-semibold">{report.stats.percentualMedio.toFixed(1)}%</div>
              </div>
            </div>
            {report.errors.length > 0 && (
              <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 space-y-1">
                <div className="text-sm font-medium text-destructive">Erros bloqueantes</div>
                <ul className="text-xs list-disc pl-5 text-destructive">
                  {report.errors.map((e, i) => (
                    <li key={i}>{e}</li>
                  ))}
                </ul>
              </div>
            )}
            {report.warnings.length > 0 && (
              <div className="rounded-md border border-warning/50/40 bg-warning/5 p-3 space-y-1">
                <div className="text-sm font-medium text-warning dark:text-warning/80">Avisos</div>
                <ul className="text-xs list-disc pl-5 text-warning dark:text-warning/80">
                  {report.warnings.map((w, i) => (
                    <li key={i}>{w}</li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {tasks.length > 0 && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-3 flex-wrap">
            <div>
              <CardTitle>Tarefas do cronograma ({tasks.length})</CardTitle>
              <p className="text-xs text-muted-foreground mt-1">
                {escolhidas.length} folhas · {brl(totalCusto)} · {totalDias} dias · ponderação por{" "}
                <strong>{modoEfetivo === "custo" ? "custo" : "duração"}</strong>
              </p>
              {obraId && (
                <p className="text-xs mt-1">
                  Contrato: <strong>{brl(valorContrato)}</strong> ·{" "}
                  {valorContrato > 0 ? (
                    <>
                      Selecionado cobre{" "}
                      <strong
                        className={
                          totalCusto > valorContrato * 1.001
                            ? "text-destructive"
                            : totalCusto >= valorContrato * 0.999
                              ? "text-success dark:text-success/80"
                              : "text-warning dark:text-warning/80"
                        }
                      >
                        {((totalCusto / valorContrato) * 100).toFixed(2)}%
                      </strong>{" "}
                      do contrato · diferença {brl(totalCusto - valorContrato)}
                    </>
                  ) : (
                    <span className="text-muted-foreground">obra sem valor de contrato</span>
                  )}
                </p>
              )}
            </div>
            <div className="flex gap-2 flex-wrap">
              <Button variant="outline" size="sm" onClick={() => setAll(() => true)}>
                Todas as folhas
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  setAll((t) => !!t.start && !!t.finish && dias(t.start, t.finish) > 0)
                }
              >
                Folhas c/ duração
              </Button>
              <Button variant="outline" size="sm" onClick={() => setSelected({})}>
                Limpar
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  setCollapsed(new Set(tasks.filter((t) => t.hasChildren).map((t) => t.uid)))
                }
              >
                Recolher tudo
              </Button>
              <Button variant="outline" size="sm" onClick={() => setCollapsed(new Set())}>
                Expandir tudo
              </Button>
              <Button
                onClick={importar}
                disabled={importing || !obraId || (report ? !report.ok : false)}
              >
                <Upload className="h-4 w-4 mr-2" />
                {importing ? "Importando…" : "Importar cronograma"}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8"></TableHead>
                  <TableHead className="w-20">EDT</TableHead>
                  <TableHead>Tarefa</TableHead>
                  <TableHead>Início</TableHead>
                  <TableHead>Fim</TableHead>
                  <TableHead className="text-right">Dias</TableHead>
                  <TableHead className="text-right">Custo</TableHead>
                  <TableHead className="text-right">% previsto</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {visibleTasks.map((t) => {
                  const d = t.start && t.finish ? dias(t.start, t.finish) : 0;
                  const pct = selected[t.uid] ? pctOf(t) : 0;
                  const isSummary = t.hasChildren || t.isSummary;
                  const isCollapsed = collapsed.has(t.uid);

                  return (
                    <TableRow key={t.uid} className={isSummary ? "bg-muted/40" : ""}>
                      <TableCell>
                        {isSummary ? (
                          <span className="inline-block w-4" />
                        ) : (
                          <Checkbox
                            checked={!!selected[t.uid]}
                            onCheckedChange={(v) => toggleSelect(t, !!v)}
                          />
                        )}
                      </TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {t.wbs}
                      </TableCell>
                      <TableCell>
                        <div
                          className="flex items-center"
                          style={{ paddingLeft: `${(t.outlineLevel - 1) * 18}px` }}
                        >
                          {t.hasChildren ? (
                            <button
                              type="button"
                              onClick={() => toggleCollapse(t.uid)}
                              className="mr-1 inline-flex h-4 w-4 items-center justify-center text-xs text-muted-foreground hover:text-foreground"
                              aria-label={isCollapsed ? "Expandir" : "Recolher"}
                            >
                              {isCollapsed ? "▸" : "▾"}
                            </button>
                          ) : (
                            <span className="mr-1 inline-block w-4 text-center text-xs text-muted-foreground">
                              {t.isMilestone ? "◆" : "·"}
                            </span>
                          )}
                          <span
                            className={
                              isSummary
                                ? "font-semibold"
                                : t.isMilestone
                                  ? "text-muted-foreground"
                                  : ""
                            }
                          >
                            {t.name}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="whitespace-nowrap">{t.start ?? "—"}</TableCell>
                      <TableCell className="whitespace-nowrap">{t.finish ?? "—"}</TableCell>
                      <TableCell className="text-right">
                        {isSummary ? "—" : d || (t.isMilestone ? "0" : "—")}
                      </TableCell>
                      <TableCell
                        className={`text-right whitespace-nowrap ${isSummary ? "text-muted-foreground italic" : ""}`}
                      >
                        {isSummary
                          ? rollupCusto.get(t.uid)
                            ? brl(rollupCusto.get(t.uid)!)
                            : "—"
                          : t.custo
                            ? brl(t.custo)
                            : "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        {!isSummary && pct ? pct.toFixed(1) + "%" : "—"}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {done != null && (
        <Card>
          <CardContent className="pt-6 flex items-center gap-2 text-success dark:text-success/80">
            <CheckCircle2 className="h-4 w-4" /> {done} itens importados para a obra selecionada.
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ============== NFS-e (Excel) ==============

type NfseRow = {
  numero: string;
  codigo_obra: string;
  data_emissao?: string;
  competencia?: string;
  valor_servicos: number;
  inss_retido: number;
  iss_retido: number;
  outras_retencoes: number;
  valor_liquido: number;
  tomador_nome?: string;
  tomador_cnpj?: string;
  codigo_verificacao?: string;
  // resolvidos durante preview:
  obra_id?: string;
  obra_label?: string;
  status: "ok" | "obra_nao_encontrada" | "duplicada" | "sem_chave" | "outra_obra";
  motivo?: string;
};
