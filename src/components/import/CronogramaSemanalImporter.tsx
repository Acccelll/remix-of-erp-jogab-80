import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { CalendarClock, HelpCircle, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import {
  cronogramaBaselineItensFns as cronogramaBaselineItensRepo,
  cronogramaBaselinesFns as cronogramaBaselinesRepo,
  cronogramaItemRevisoesFns as cronogramaItemRevisoesRepo,
  cronogramaFns as cronogramaRepo,
  cronogramaRevisoesFns as cronogramaRevisoesRepo,
} from "@/hooks/obras/useCronograma";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import DatePickerField from "@/components/common/DatePickerField";
import { Label } from "@/components/ui/label";
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
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { isMppBinary } from "@/lib/cronograma/mpp";
import { MppNotSupportedDialog } from "@/components/import/MppNotSupportedDialog";
import { parseMppXml, validateMpp, normalizar, type MppTask } from "@/lib/cronograma/mpp";
import { formatBRL } from "@/lib/core/currency";

type Linha = {
  itemId: string;
  descricao: string;
  pctAnterior: number;
  pctNovo: number;
  iniAnterior: string | null;
  iniNovo: string | null;
  fimAnterior: string | null;
  fimNovo: string | null;
  matchPor: "uid" | "descricao";
  mudou: boolean;
  // Metadados extraídos do XML (persistidos junto com o restante da revisão)
  actualStart?: string;
  actualFinish?: string;
  duracaoHoras?: number;
  notas?: string;
  constraintTipo?: number;
  constraintData?: string;
  deadline?: string;
  prioridade?: number;
  marco?: boolean;
};

function fmt(d: string | null) {
  if (!d) return "—";
  try {
    return format(new Date(d + "T00:00:00"), "dd/MM/yyyy");
  } catch {
    return d;
  }
}

export function CronogramaSemanalImporter({ obraId }: { obraId: string }) {
  const qc = useQueryClient();
  const [tasks, setTasks] = useState<MppTask[]>([]);
  const [titulo, setTitulo] = useState<string>("");
  const [dataCorte, setDataCorte] = useState<string>(new Date().toISOString().slice(0, 10));
  const [observacoes, setObservacoes] = useState<string>("");
  const [aplicando, setAplicando] = useState(false);
  const [mppDialogOpen, setMppDialogOpen] = useState(false);
  const [aplicado, setAplicado] = useState<{ revisao: number; atualizados: number } | null>(null);
  const [atualizarDatas, setAtualizarDatas] = useState(false);

  const { data: itensObra } = useQuery({
    queryKey: ["crono-ativos", obraId],
    queryFn: async () => await cronogramaRepo.listAtivosProgressoByObra(obraId),
  });

  const semBaseline = (itensObra ?? []).length === 0;

  const { porUid, porDescricao } = useMemo(() => {
    const u = new Map<string, any>();
    const d = new Map<string, any>();
    for (const i of itensObra ?? []) {
      if (i.uid_mpp) u.set(String(i.uid_mpp), i);
      if (i.descricao) d.set(normalizar(i.descricao), i);
    }
    return { porUid: u, porDescricao: d };
  }, [itensObra]);

  const folhas = tasks.filter((t) => !t.hasChildren);

  const { linhas, semCorrespondencia } = useMemo(() => {
    const out: Linha[] = [];
    const orfas: MppTask[] = [];
    for (const t of folhas) {
      let m: any = null;
      let por: "uid" | "descricao" = "uid";
      if (t.uid && porUid.has(String(t.uid))) {
        m = porUid.get(String(t.uid));
      } else if (porDescricao.has(normalizar(t.name))) {
        m = porDescricao.get(normalizar(t.name));
        por = "descricao";
      }
      if (!m) {
        orfas.push(t);
        continue;
      }
      const pctAnt = Number(m.percentual_realizado ?? 0);
      const pctNovo = Number(t.percentComplete ?? 0);
      const iniAnt = m.data_inicio ?? null;
      const iniNovo = t.start ?? null;
      const fimAnt = m.data_fim ?? null;
      const fimNovo = t.finish ?? null;
      const datasMudaram = (iniNovo && iniNovo !== iniAnt) || (fimNovo && fimNovo !== fimAnt);
      const pctMudou = Math.abs(pctAnt - pctNovo) > 0.001;
      const mudou = pctMudou || (atualizarDatas && datasMudaram);
      out.push({
        itemId: m.id,
        descricao: m.descricao,
        pctAnterior: pctAnt,
        pctNovo,
        iniAnterior: iniAnt,
        iniNovo,
        fimAnterior: fimAnt,
        fimNovo,
        matchPor: por,
        mudou: !!mudou,
        actualStart: t.actualStart,
        actualFinish: t.actualFinish,
        duracaoHoras: t.duracaoHoras,
        notas: t.notas,
        constraintTipo: t.constraintTipo,
        constraintData: t.constraintData,
        deadline: t.deadline,
        prioridade: t.prioridade,
        marco: t.isMilestone || undefined,
      });
    }
    return { linhas: out, semCorrespondencia: orfas };
  }, [folhas, porUid, porDescricao, atualizarDatas]);

  const aMudar = linhas.filter((l) => l.mudou);

  function detectarDataDoNome(nome: string): string | null {
    const m = nome.match(/(20\d{2})[.\-_/](\d{1,2})[.\-_/](\d{1,2})/);
    if (!m) return null;
    const [, y, mo, d] = m;
    const yy = Number(y),
      mm = Number(mo),
      dd = Number(d);
    if (mm < 1 || mm > 12 || dd < 1 || dd > 31) return null;
    const dt = new Date(yy, mm - 1, dd);
    if (dt.getFullYear() !== yy || dt.getMonth() !== mm - 1 || dt.getDate() !== dd) return null;
    return `${y}-${String(mm).padStart(2, "0")}-${String(dd).padStart(2, "0")}`;
  }

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setAplicado(null);
    isMppBinary(file).then((isBin) => {
      if (isBin) {
        setMppDialogOpen(true);
        e.target.value = "";
        return;
      }
      const detectada = detectarDataDoNome(file.name);
      if (detectada) {
        setDataCorte(detectada);
        const [yy, mm, dd] = detectada.split("-");
        toast.success(`Data de corte detectada: ${dd}/${mm}/${yy}`);
      }
      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          const text = String(ev.target?.result ?? "");
          const { titulo, tasks } = parseMppXml(text);
          const rep = validateMpp(tasks);
          setTitulo(titulo ?? "");
          setTasks(tasks);
          if (rep.errors.length) toast.error(`XML com ${rep.errors.length} erro(s)`);
          else toast.success(`${tasks.filter((t) => !t.hasChildren).length} folhas detectadas`);
        } catch (err: any) {
          toast.error(`Erro ao ler XML: ${err.message}`);
        }
      };
      reader.readAsText(file);
    });
  }

  async function aplicar() {
    if (!aMudar.length) return toast.error("Nenhuma alteração para aplicar");
    setAplicando(true);
    try {
      // próximo número de revisão
      const numero = (await cronogramaRevisoesRepo.getUltimoNumero(obraId)) + 1;

      // baseline (Rev Principal) vigente — vincula a semanal à última baseline
      const baselineId = await cronogramaBaselinesRepo.getUltimaId(obraId);

      const pctAntMed = linhas.length
        ? linhas.reduce((a, l) => a + l.pctAnterior, 0) / linhas.length
        : 0;
      const pctNovoMed = linhas.length
        ? linhas.reduce((a, l) => a + l.pctNovo, 0) / linhas.length
        : 0;

      const rev = await cronogramaRevisoesRepo.createReturningId({
        obra_id: obraId,
        numero,
        data_corte: dataCorte,
        observacoes: observacoes || null,
        arquivo_nome: titulo || null,
        baseline_id: baselineId,
        totais: {
          itens_atualizados: aMudar.length,
          sem_correspondencia: semCorrespondencia.length,
          pct_medio_anterior: Number(pctAntMed.toFixed(2)),
          pct_medio_novo: Number(pctNovoMed.toFixed(2)),
        },
      });

      // updates em paralelo nos itens
      for (const l of aMudar) {
        const patch: any = { percentual_realizado: l.pctNovo };
        if (atualizarDatas) {
          if (l.iniNovo) {
            patch.data_inicio = l.iniNovo;
            // Datas do arquivo semanal são reprogramadas em relação ao baseline
            patch.data_inicio_reprog = l.iniNovo;
          }
          if (l.fimNovo) {
            patch.data_fim = l.fimNovo;
            patch.data_fim_reprog = l.fimNovo;
          }
        }
        if (l.actualStart !== undefined) patch.data_inicio_real = l.actualStart;
        if (l.actualFinish !== undefined) patch.data_fim_real = l.actualFinish;
        if (l.duracaoHoras !== undefined) patch.duracao_horas = l.duracaoHoras;
        if (l.notas !== undefined) patch.notas = l.notas;
        if (l.constraintTipo !== undefined) patch.constraint_tipo = l.constraintTipo;
        if (l.constraintData !== undefined) patch.constraint_data = l.constraintData;
        if (l.deadline !== undefined) patch.deadline = l.deadline;
        if (l.prioridade !== undefined) patch.prioridade = l.prioridade;
        if (l.marco !== undefined) patch.marco = l.marco;
        await cronogramaRepo.update(l.itemId, patch);
      }

      // snapshots de diff (datas só refletem mudança quando o toggle estava ligado)
      const snaps = aMudar.map((l) => ({
        revisao_id: rev.id,
        cronograma_item_id: l.itemId,
        descricao_item: l.descricao,
        tipo_mudanca: "atualizacao_semanal",
        percentual_realizado_anterior: l.pctAnterior,
        percentual_realizado_novo: l.pctNovo,
        data_inicio_anterior: l.iniAnterior,
        data_inicio_novo: atualizarDatas ? l.iniNovo : l.iniAnterior,
        data_fim_anterior: l.fimAnterior,
        data_fim_novo: atualizarDatas ? l.fimNovo : l.fimAnterior,
      }));
      if (snaps.length) {
        await cronogramaItemRevisoesRepo.insertMany(snaps);
      }

      toast.success(`Revisão v${numero} aplicada`, {
        description: `${aMudar.length} itens atualizados${semCorrespondencia.length ? ` · ${semCorrespondencia.length} sem correspondência` : ""}`,
        duration: 8000,
      });

      setAplicado({ revisao: numero, atualizados: aMudar.length });
      setTasks([]);
      setTitulo("");
      setObservacoes("");
      qc.invalidateQueries({ queryKey: ["crono", obraId] });
      qc.invalidateQueries({ queryKey: ["crono-ativos", obraId] });
      qc.invalidateQueries({ queryKey: ["revisoes", obraId] });
      qc.invalidateQueries({ queryKey: ["bms_prev", obraId] });
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setAplicando(false);
    }
  }

  return (
    <div className="space-y-4">
      <MppNotSupportedDialog open={mppDialogOpen} onOpenChange={setMppDialogOpen} />
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarClock className="h-4 w-4" /> Atualização semanal de progresso
          </CardTitle>
          <p className="text-xs text-muted-foreground mt-1">
            Use <strong>toda semana</strong> com o XML atualizado pelo planejamento. Atualiza o{" "}
            <strong>% realizado</strong> dos itens já existentes — o baseline e o custo permanecem
            intactos. As <strong>datas previstas</strong> só são atualizadas se o toggle abaixo
            estiver ligado. Gera um registro em "Revisões do cronograma".
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {semBaseline ? (
            <div className="rounded-md border border-dashed bg-muted/40 p-4 text-sm text-muted-foreground">
              Esta obra ainda não tem cronograma base. Importe primeiro o{" "}
              <strong>Cronograma base</strong> ao lado.
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="space-y-1.5 md:col-span-2">
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
                <div className="space-y-1.5">
                  <Label>Data de corte da revisão</Label>
                  <DatePickerField value={dataCorte} onChange={(v) => setDataCorte(v)} />
                </div>
              </div>

              <div className="rounded-md border p-3 flex items-start justify-between gap-4 bg-muted/30">
                <div className="space-y-1">
                  <Label htmlFor="toggle-datas" className="text-sm">
                    Atualizar datas previstas das atividades
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    {atualizarDatas
                      ? "As datas de início/fim do cronograma serão substituídas pelas datas do XML semanal."
                      : "Somente o % realizado será atualizado. As datas previstas serão preservadas."}
                  </p>
                </div>
                <Switch
                  id="toggle-datas"
                  checked={atualizarDatas}
                  onCheckedChange={setAtualizarDatas}
                />
              </div>

              {titulo && (
                <p className="text-xs text-muted-foreground">
                  Projeto: <strong>{titulo}</strong> · {folhas.length} folhas no arquivo ·{" "}
                  {linhas.length} casadas · {aMudar.length} com alteração ·{" "}
                  {semCorrespondencia.length} sem correspondência
                </p>
              )}

              {linhas.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-xs uppercase text-muted-foreground">
                    Pré-visualização das alterações
                  </Label>
                  <div className="rounded-md border max-h-[420px] overflow-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="min-w-[260px]">Descrição</TableHead>
                          <TableHead className="text-right">% anterior</TableHead>
                          <TableHead className="text-right">% novo</TableHead>
                          <TableHead>Início</TableHead>
                          <TableHead>Fim</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {linhas.map((l) => (
                          <TableRow key={l.itemId} className={l.mudou ? "" : "opacity-60"}>
                            <TableCell className="text-sm">
                              <div className="line-clamp-2">{l.descricao}</div>
                              {l.matchPor === "descricao" && (
                                <span className="text-[10px] text-warning">
                                  casado por descrição
                                </span>
                              )}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                              {l.pctAnterior.toFixed(2)}%
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                              {l.pctNovo.toFixed(2)}%
                              {l.mudou && Math.abs(l.pctNovo - l.pctAnterior) > 0.001 && (
                                <span
                                  className={`ml-1 text-[10px] ${l.pctNovo > l.pctAnterior ? "text-success" : "text-destructive"}`}
                                >
                                  ({l.pctNovo > l.pctAnterior ? "+" : ""}
                                  {(l.pctNovo - l.pctAnterior).toFixed(2)})
                                </span>
                              )}
                            </TableCell>
                            <TableCell className="text-xs whitespace-nowrap">
                              {fmt(l.iniAnterior)} <ArrowRight className="inline h-3 w-3" />{" "}
                              <span
                                className={
                                  !atualizarDatas && l.iniNovo !== l.iniAnterior
                                    ? "text-muted-foreground line-through"
                                    : l.iniNovo !== l.iniAnterior
                                      ? "font-medium"
                                      : "text-muted-foreground"
                                }
                              >
                                {fmt(l.iniNovo)}
                              </span>
                            </TableCell>
                            <TableCell className="text-xs whitespace-nowrap">
                              {fmt(l.fimAnterior)} <ArrowRight className="inline h-3 w-3" />{" "}
                              <span
                                className={
                                  !atualizarDatas && l.fimNovo !== l.fimAnterior
                                    ? "text-muted-foreground line-through"
                                    : l.fimNovo !== l.fimAnterior
                                      ? "font-medium"
                                      : "text-muted-foreground"
                                }
                              >
                                {fmt(l.fimNovo)}
                              </span>
                            </TableCell>
                            <TableCell>
                              {l.mudou ? (
                                <Badge variant="default">alteração</Badge>
                              ) : (
                                <Badge variant="secondary">sem mudança</Badge>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}

              {semCorrespondencia.length > 0 && (
                <div className="rounded-md border border-warning/40 bg-warning/10 dark:bg-warning/30 p-3 text-xs space-y-1">
                  <div className="font-medium text-warning">
                    {semCorrespondencia.length} tarefa(s) do arquivo sem correspondência no
                    cronograma base — serão ignoradas
                  </div>
                  <ul className="list-disc pl-5 text-warning max-h-32 overflow-auto">
                    {semCorrespondencia.slice(0, 20).map((t) => (
                      <li key={t.uid}>{t.name}</li>
                    ))}
                    {semCorrespondencia.length > 20 && (
                      <li>… e mais {semCorrespondencia.length - 20}</li>
                    )}
                  </ul>
                </div>
              )}

              {tasks.length > 0 && (
                <div className="space-y-1.5">
                  <Label>Observações (opcional)</Label>
                  <Textarea
                    rows={2}
                    value={observacoes}
                    onChange={(e) => setObservacoes(e.target.value)}
                    placeholder="Ex.: medição semana 12 — chuvas atrasaram alvenaria"
                  />
                </div>
              )}

              {aplicado && (
                <div className="rounded-md border border-success/40 bg-success/10 dark:bg-success/30 p-3 text-sm text-success">
                  Revisão v{aplicado.revisao} aplicada — {aplicado.atualizados} itens atualizados.
                </div>
              )}

              {tasks.length > 0 && (
                <div className="flex justify-end">
                  <Button onClick={aplicar} disabled={aplicando || !aMudar.length}>
                    {aplicando ? "Aplicando…" : `Aplicar atualização (${aMudar.length})`}
                  </Button>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Stubs Onda D2 ─────────────────────────────────────────────────
// ─── Importador do Cronograma Principal (baseline) ─────────────────
// Reaproveita o parser do XML, mas grava em `cronograma_itens` +
// `cronograma_baselines` / `cronograma_item_baseline` em vez de gerar
// uma revisão semanal. Para obras que JÁ têm cronograma, redireciona
// para o fluxo de Revisões Semanais (que sabe lidar com upsert).
export function CronogramaImporter({ obraIdFixo }: { obraIdFixo: string }) {
  const qc = useQueryClient();
  const [mppDialogOpen, setMppDialogOpen] = useState(false);
  const [tasks, setTasks] = useState<MppTask[]>([]);
  const [titulo, setTitulo] = useState("");
  const [motivoTipo, setMotivoTipo] = useState<"import_inicial" | "aditivo" | "ajuste_manual">(
    "import_inicial",
  );
  const [motivoLabel, setMotivoLabel] = useState("Cronograma inicial (Rev Principal)");
  const [observacoes, setObservacoes] = useState("");
  const [aplicando, setAplicando] = useState(false);
  const [aplicado, setAplicado] = useState<{ versao: number; itens: number } | null>(null);

  const { data: itensExistentes = [] } = useQuery({
    queryKey: ["crono-baseline-check", obraIdFixo],
    queryFn: async () => await cronogramaRepo.listIdsPorObra(obraIdFixo),
  });

  const { data: baselines = [] } = useQuery({
    queryKey: ["baselines", obraIdFixo],
    queryFn: async () => await cronogramaBaselinesRepo.listResumoByObra(obraIdFixo),
  });

  const folhas = tasks.filter((t) => !t.hasChildren && t.start && t.finish);
  const obraTemCronograma = itensExistentes.length > 0;
  const proximaVersao = (baselines[0]?.versao ?? 0) + 1;

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setAplicado(null);
    isMppBinary(file).then((isBin) => {
      if (isBin) {
        setMppDialogOpen(true);
        e.target.value = "";
        return;
      }
      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          const text = String(ev.target?.result ?? "");
          const { titulo: t, tasks: ts } = parseMppXml(text);
          const rep = validateMpp(ts);
          setTitulo(t ?? "");
          setTasks(ts);
          if (rep.errors.length) toast.error(`XML com ${rep.errors.length} erro(s)`);
          else toast.success(`${ts.filter((x) => !x.hasChildren).length} folhas detectadas`);
        } catch (err: any) {
          toast.error(`Erro ao ler XML: ${err.message}`);
        }
      };
      reader.readAsText(file);
    });
  }

  async function aplicar() {
    if (!folhas.length) return toast.error("Nenhuma tarefa folha no arquivo");
    setAplicando(true);
    try {
      // 1) Cria a baseline (versão incremental)
      const obsCombinada =
        [motivoLabel?.trim(), observacoes?.trim()].filter(Boolean).join(" — ") || null;
      const bl = await cronogramaBaselinesRepo.createReturningIdVersao({
        obra_id: obraIdFixo,
        versao: proximaVersao,
        motivo: motivoTipo,
        observacoes: obsCombinada,
      });

      // 2) Insere itens em `cronograma_itens` com custo_baseline + datas_baseline
      const rows = folhas.map((t, i) => ({
        obra_id: obraIdFixo,
        descricao: (t.wbs ? `${t.wbs} ` : "") + t.name,
        data_inicio: t.start!,
        data_fim: t.finish!,
        ordem: i,
        custo: Number((t.custo || 0).toFixed(2)),
        custo_baseline: Number((t.custo || 0).toFixed(2)),
        percentual_previsto: 0,
        percentual_realizado: Number((t.percentComplete || 0).toFixed(4)),
        uid_mpp: t.uid || null,
        data_inicio_baseline: t.baselineStart ?? t.start!,
        data_fim_baseline: t.baselineFinish ?? t.finish!,
        data_inicio_real: t.actualStart ?? null,
        data_fim_real: t.actualFinish ?? null,
        duracao_horas: t.duracaoHoras ?? null,
        constraint_tipo: t.constraintTipo ?? null,
        constraint_data: t.constraintData ?? null,
        deadline: t.deadline ?? null,
        notas: t.notas ?? null,
        prioridade: t.prioridade ?? null,
        marco: !!t.isMilestone,
        ativo: true,
      }));
      const ins = await cronogramaRepo.insertManyReturningResumo(rows as any);

      // 3) Snapshot dos itens na baseline
      if (ins?.length) {
        const totalCusto = ins.reduce((a, r) => a + Number(r.custo || 0), 0);
        const snaps = ins.map((r: any) => ({
          baseline_id: bl.id,
          cronograma_item_id: r.id,
          descricao: r.descricao,
          custo: Number(r.custo || 0),
          data_inicio: r.data_inicio,
          data_fim: r.data_fim,
          uid_mpp: r.uid_mpp,
          percentual_previsto:
            totalCusto > 0 ? Number(((Number(r.custo || 0) / totalCusto) * 100).toFixed(6)) : 0,
        }));
        await cronogramaBaselineItensRepo.insertMany(snaps);

        // 4) Atualiza percentual_previsto proporcional ao custo
        if (totalCusto > 0) {
          await Promise.all(
            ins.map((r: any) =>
              cronogramaRepo.update(r.id, {
                percentual_previsto: Number(((Number(r.custo || 0) / totalCusto) * 100).toFixed(6)),
              } as any),
            ),
          );
        }
      }

      toast.success(`Baseline v${bl.versao} criada`, {
        description: `${ins?.length ?? 0} itens importados`,
        duration: 8000,
      });
      setAplicado({ versao: bl.versao, itens: ins?.length ?? 0 });
      setTasks([]);
      setTitulo("");
      setObservacoes("");
      qc.invalidateQueries({ queryKey: ["crono", obraIdFixo] });
      qc.invalidateQueries({ queryKey: ["crono-ativos", obraIdFixo] });
      qc.invalidateQueries({ queryKey: ["crono-baseline-check", obraIdFixo] });
      qc.invalidateQueries({ queryKey: ["baselines", obraIdFixo] });
      qc.invalidateQueries({ queryKey: ["bms_prev", obraIdFixo] });
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setAplicando(false);
    }
  }

  if (obraTemCronograma) {
    return (
      <div className="space-y-3">
        <div className="rounded-md border border-warning/40 bg-warning/10 dark:bg-warning/30 p-4 text-sm">
          <div className="font-semibold text-warning mb-1">
            Esta obra já tem cronograma principal importado
          </div>
          <p className="text-warning">
            Para registrar uma <strong>nova versão do Principal</strong> (Rev {proximaVersao}), use
            a aba <strong>Revisões</strong> dentro do Cronograma — ela calcula o diff item a item e
            preserva o histórico. O importador acima só cria a primeira baseline.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <MppNotSupportedDialog open={mppDialogOpen} onOpenChange={setMppDialogOpen} />
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarClock className="h-4 w-4" /> Importar cronograma base (Rev Principal v
            {proximaVersao})
          </CardTitle>
          <p className="text-xs text-muted-foreground mt-1">
            Cria a <strong>baseline inicial</strong> da obra a partir do XML do MS Project: insere
            todos os itens-folha em <code>cronograma_itens</code>, congela custo/datas em{" "}
            <code>cronograma_item_baseline</code> e calcula o <code>percentual_previsto</code>{" "}
            proporcional ao custo. Use o importador <strong>Semanal</strong> ao lado para
            atualizações de progresso.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
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
            <div className="space-y-1.5">
              <Label>Tipo de baseline</Label>
              <select
                value={motivoTipo}
                onChange={(e) => setMotivoTipo(e.target.value as typeof motivoTipo)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="import_inicial">Importação inicial</option>
                <option value="aditivo">Aditivo</option>
                <option value="ajuste_manual">Ajuste manual</option>
              </select>
              <Input
                value={motivoLabel}
                onChange={(e) => setMotivoLabel(e.target.value)}
                placeholder="Descrição (ex.: Rev Principal, Aditivo 3…)"
              />
            </div>
          </div>

          {titulo && (
            <p className="text-xs text-muted-foreground">
              Projeto: <strong>{titulo}</strong> · {folhas.length} folha(s) detectada(s)
            </p>
          )}

          {folhas.length > 0 && (
            <div className="rounded-md border max-h-[360px] overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[300px]">Descrição</TableHead>
                    <TableHead>Início</TableHead>
                    <TableHead>Fim</TableHead>
                    <TableHead className="text-right">Custo</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {folhas.slice(0, 200).map((t) => (
                    <TableRow key={t.uid}>
                      <TableCell className="text-sm">
                        {(t.wbs ? `${t.wbs} ` : "") + t.name}
                      </TableCell>
                      <TableCell className="text-xs whitespace-nowrap">
                        {fmt(t.start ?? null)}
                      </TableCell>
                      <TableCell className="text-xs whitespace-nowrap">
                        {fmt(t.finish ?? null)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-xs">
                        {formatBRL(t.custo ?? 0)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {folhas.length > 200 && (
                <p className="text-xs text-muted-foreground p-2">
                  … exibindo 200 de {folhas.length}. Todos serão importados.
                </p>
              )}
            </div>
          )}

          {tasks.length > 0 && (
            <div className="space-y-1.5">
              <Label>Observações (opcional)</Label>
              <Textarea
                rows={2}
                value={observacoes}
                onChange={(e) => setObservacoes(e.target.value)}
                placeholder="Ex.: baseline aprovada pelo cliente em ..."
              />
            </div>
          )}

          {aplicado && (
            <div className="rounded-md border border-success/40 bg-success/10 dark:bg-success/30 p-3 text-sm text-success">
              Baseline v{aplicado.versao} criada — {aplicado.itens} itens importados.
            </div>
          )}

          {folhas.length > 0 && !aplicado && (
            <div className="flex justify-end">
              <Button onClick={aplicar} disabled={aplicando}>
                {aplicando
                  ? "Importando…"
                  : `Importar ${folhas.length} item(ns) como Rev Principal v${proximaVersao}`}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function PlaceholderImporter({ titulo, descricao }: { titulo: string; descricao: string }) {
  return (
    <div className="rounded border bg-muted/30 p-6 text-sm text-muted-foreground">
      <div className="font-semibold text-foreground">{titulo}</div>
      <p className="mt-2">{descricao}</p>
    </div>
  );
}

export { BmsImporter } from "@/components/import/BmsImporter";

export function NfseImporter({
  obraIdFixo,
  codigoObraFixo,
}: {
  obraIdFixo: string;
  codigoObraFixo?: string;
}) {
  void obraIdFixo;
  void codigoObraFixo;
  return (
    <PlaceholderImporter
      titulo="Importação de NFS-e (em construção)"
      descricao="Use a aba Faturamento para registrar notas fiscais manualmente. O importador de XML NFS-e será habilitado em uma próxima onda."
    />
  );
}
