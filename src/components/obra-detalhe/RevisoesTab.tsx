// Extraído de FinObraDetalhe.tsx — H1.2 (refactor god-file).
// Aba de revisões semanais do cronograma (importação de MS Project XML).
import React, { Fragment, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { format, parseISO, differenceInCalendarDays } from "date-fns";
import {
  Upload,
  CalendarClock,
  ChevronRight,
  ChevronDown,
  CheckCircle2,
  Trash2,
  History,
  Undo2,
} from "lucide-react";
import {
  cronogramaBaselinesFns as cronogramaBaselinesRepo,
  cronogramaDependenciasFns as cronogramaDependenciasRepo,
  cronogramaFns as cronogramaRepo,
  cronogramaItemRevisoesFns as cronogramaItemRevisoesRepo,
  cronogramaRevisoesFns as cronogramaRevisoesRepo,
} from "@/hooks/obras/useCronograma";
import { itensMedicaoRepo } from "@/lib/repositories/medicoes";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import DatePickerField from "@/components/common/DatePickerField";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetFooter,
} from "@/components/ui/sheet";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
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
import { Switch } from "@/components/ui/switch";
import { brl } from "@/lib/billing";
import {
  parseMppXml,
  parentChain as mppParentChain,
  isMppBinary,
  type MppTask,
} from "@/lib/cronograma/mpp";
import { MppNotSupportedDialog } from "@/components/import/MppNotSupportedDialog";
import { RevisaoDetalhes } from "@/components/obra/RevisaoDetalhes";
import { useObraPermissions } from "@/components/obra/ObraPermissionsContext";

// =================== Revisões semanais do cronograma (MS Project XML) ===================

type DiffRow = {
  tipo: "novo" | "data" | "pct" | "custo" | "removido" | "restaurado";
  itemId?: string;
  uid: string;
  descricao: string;
  inicio_antes?: string | null;
  inicio_novo?: string | null;
  fim_antes?: string | null;
  fim_novo?: string | null;
  pct_antes?: number | null;
  pct_novo?: number | null;
  custo_antes?: number | null;
  custo_novo?: number | null;
  task?: MppTask;
  apply: boolean;
};

type Lote = {
  id: string;
  arquivoNome: string;
  tasksXml: MppTask[];
  diffs: DiffRow[];
  dataCorte: string;
};

export function RevisoesTab({
  obra,
  crono,
  revisoes,
  onChange,
}: {
  obra: any;
  crono: any[];
  revisoes: any[];
  onChange: () => void;
}) {
  const { canEdit } = useObraPermissions();
  const [open, setOpen] = useState(false);
  const [lotes, setLotes] = useState<Lote[]>([]);
  const [loteAtivoId, setLoteAtivoId] = useState<string | null>(null);
  const [obs, setObs] = useState<string>("");
  const [atualizarPct, setAtualizarPct] = useState<boolean>(true);
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState<{
    atual: number;
    total: number;
    nome: string;
  } | null>(null);
  const [mppDialogOpen, setMppDialogOpen] = useState(false);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [filtroDiff, setFiltroDiff] = useState("");
  const [tiposVisiveis, setTiposVisiveis] = useState<Set<DiffRow["tipo"]> | null>(null);
  const [verTodasRev, setVerTodasRev] = useState(false);
  const [revExpandida, setRevExpandida] = useState<string | null>(null);
  const [atrasosAbertos, setAtrasosAbertos] = useState(false);
  const [atrasosLimite, setAtrasosLimite] = useState(50);
  const [atrasosFiltro, setAtrasosFiltro] = useState("");
  const [revertendoId, setRevertendoId] = useState<string | null>(null);
  const [confirmReverter, setConfirmReverter] = useState<any | null>(null);

  function resetSheet() {
    setStep(1);
    setLotes([]);
    setLoteAtivoId(null);
    setObs("");
    setFiltroDiff("");
    setTiposVisiveis(null);
    setImportProgress(null);
  }

  const obraId = obra.id;
  const valorContrato = Number(obra.valor_contrato || 0);

  // Baselines (Rev Principal) — usadas para agrupar o histórico semanal
  const { data: baselines = [] } = useQuery({
    queryKey: ["baselines", obraId],
    queryFn: async () => cronogramaBaselinesRepo.listByObraFull(obraId),
  });
  const baselinePorId = useMemo(() => {
    const m = new Map<string, any>();
    for (const b of baselines) m.set(b.id, b);
    return m;
  }, [baselines]);
  const baselineAtual = baselines[0];

  // Atraso por item: data_fim atual - data_fim_baseline
  const atrasos = (crono ?? [])
    .filter((c) => c.ativo !== false && c.data_fim_baseline && c.data_fim)
    .map((c) => ({
      id: c.id,
      descricao: c.descricao,
      baseline: c.data_fim_baseline as string,
      atual: c.data_fim as string,
      delta: differenceInCalendarDays(parseISO(c.data_fim), parseISO(c.data_fim_baseline)),
    }))
    .filter((a) => a.delta !== 0);
  const atrasados = atrasos.filter((a) => a.delta > 0);
  const atrasoMax = atrasos.reduce((m, a) => Math.max(m, a.delta), 0);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    e.target.value = "";

    const novosLotes: Lote[] = [];
    let primeiroBinario = false;
    for (const file of files) {
      const isBin = await isMppBinary(file);
      if (isBin) {
        console.info("mpp_upload_attempt");
        primeiroBinario = true;
        continue;
      }
      try {
        const text = await file.text();
        const { tasks } = parseMppXml(text);
        const leaves = tasks.filter((t) => !t.hasChildren && t.start && t.finish);
        const d = computeDiff(leaves, tasks, crono ?? []);
        novosLotes.push({
          id:
            typeof crypto !== "undefined" && (crypto as any).randomUUID
              ? (crypto as any).randomUUID()
              : Math.random().toString(36).slice(2),
          arquivoNome: file.name,
          tasksXml: tasks,
          diffs: d,
          dataCorte: (() => {
            const m = file.name.match(/(20\d{2})[.\-_/](\d{1,2})[.\-_/](\d{1,2})/);
            if (m) {
              const [, y, mo, d] = m;
              const yy = Number(y),
                mm = Number(mo),
                dd = Number(d);
              if (mm >= 1 && mm <= 12 && dd >= 1 && dd <= 31) {
                const dt = new Date(yy, mm - 1, dd);
                if (dt.getFullYear() === yy && dt.getMonth() === mm - 1 && dt.getDate() === dd) {
                  return `${y}-${String(mm).padStart(2, "0")}-${String(dd).padStart(2, "0")}`;
                }
              }
            }
            return format(new Date(), "yyyy-MM-dd");
          })(),
        });
      } catch (err: any) {
        toast.error(`Erro ao ler ${file.name}: ${err.message}`);
      }
    }
    if (primeiroBinario) setMppDialogOpen(true);
    if (novosLotes.length) {
      setLotes((prev) => {
        const combined = [...prev, ...novosLotes];
        if (!loteAtivoId) setLoteAtivoId(combined[0].id);
        return combined;
      });
      const totalMud = novosLotes.reduce((a, l) => a + l.diffs.length, 0);
      toast.success(
        `${novosLotes.length} arquivo(s) preparado(s) · ${totalMud} mudanças detectadas`,
      );
      setStep(2);
    }
  }

  function removerLote(id: string) {
    setLotes((prev) => {
      const novo = prev.filter((l) => l.id !== id);
      if (loteAtivoId === id) setLoteAtivoId(novo[0]?.id ?? null);
      return novo;
    });
  }

  function atualizarDataLote(id: string, dataCorte: string) {
    setLotes((prev) => prev.map((l) => (l.id === id ? { ...l, dataCorte } : l)));
  }

  // Diff: casa por uid_mpp, com fallback (wbs+nome) — usado para itens importados antes desta feature.
  function computeDiff(leaves: MppTask[], allTasks: MppTask[], itens: any[]): DiffRow[] {
    const byUid = new Map(allTasks.map((t) => [t.uid, t]));
    const itensAtivos = itens.filter((i) => i.ativo !== false);
    const itensInativos = itens.filter((i) => i.ativo === false);

    const byItemUid = new Map<string, any>();
    for (const i of itensAtivos) if (i.uid_mpp) byItemUid.set(String(i.uid_mpp), i);

    // fallback por wbs+nome (one-shot backfill)
    function findFallback(t: MppTask) {
      const chain = mppParentChain(t, byUid)
        .map((p) => (p.wbs ? `${p.wbs} ${p.name}` : p.name))
        .join(" › ");
      const wbsPrefix = t.wbs ? `${t.wbs} ` : "";
      const target = (wbsPrefix + t.name + (chain ? `  ·  [${chain}]` : "")).trim();
      return itensAtivos.find((i) => !i.uid_mpp && String(i.descricao ?? "").trim() === target);
    }

    const result: DiffRow[] = [];
    const matched = new Set<string>();

    for (const t of leaves) {
      let item = byItemUid.get(t.uid);
      if (!item) item = findFallback(t);
      if (!item) {
        // verifica se é uma tarefa que estava inativa
        const restaurado = itensInativos.find((i) => i.uid_mpp === t.uid);
        if (restaurado) {
          result.push({
            tipo: "restaurado",
            itemId: restaurado.id,
            uid: t.uid,
            descricao: descricaoTarefa(t, byUid),
            task: t,
            apply: true,
          });
          matched.add(restaurado.id);
          continue;
        }
        result.push({
          tipo: "novo",
          uid: t.uid,
          descricao: descricaoTarefa(t, byUid),
          inicio_novo: t.start,
          fim_novo: t.finish,
          pct_novo: t.percentComplete,
          custo_novo: t.custo,
          task: t,
          apply: true,
        });
        continue;
      }
      matched.add(item.id);

      const inicioMudou = String(item.data_inicio) !== String(t.start);
      const fimMudou = String(item.data_fim) !== String(t.finish);
      const pctMudou = Math.abs(Number(item.percentual_realizado || 0) - t.percentComplete) > 0.01;
      // Onda 1.3: XML nunca altera custo de itens existentes (custo é congelado pela baseline).

      if (inicioMudou || fimMudou) {
        result.push({
          tipo: "data",
          itemId: item.id,
          uid: t.uid,
          descricao: item.descricao,
          inicio_antes: item.data_inicio,
          inicio_novo: t.start,
          fim_antes: item.data_fim,
          fim_novo: t.finish,
          task: t,
          apply: true,
        });
      }
      if (pctMudou) {
        result.push({
          tipo: "pct",
          itemId: item.id,
          uid: t.uid,
          descricao: item.descricao,
          pct_antes: Number(item.percentual_realizado || 0),
          pct_novo: t.percentComplete,
          task: t,
          apply: true,
        });
      }
      // Bloco de detecção de mudança de custo removido (Onda 1.3).
    }

    // Removidos: itens ativos que não bateram com nenhuma tarefa
    for (const i of itensAtivos) {
      if (matched.has(i.id)) continue;
      result.push({
        tipo: "removido",
        itemId: i.id,
        uid: i.uid_mpp ?? "",
        descricao: i.descricao,
        apply: true,
      });
    }

    return result;
  }

  function descricaoTarefa(t: MppTask, byUid: Map<string, MppTask>): string {
    const chain = mppParentChain(t, byUid)
      .map((p) => (p.wbs ? `${p.wbs} ${p.name}` : p.name))
      .join(" › ");
    const wbsPrefix = t.wbs ? `${t.wbs} ` : "";
    return wbsPrefix + t.name + (chain ? `  ·  [${chain}]` : "");
  }

  function toggleRow(loteId: string, idx: number, value: boolean) {
    setLotes((prev) =>
      prev.map((l) =>
        l.id === loteId
          ? { ...l, diffs: l.diffs.map((r, i) => (i === idx ? { ...r, apply: value } : r)) }
          : l,
      ),
    );
  }
  function toggleAll(loteId: string, tipo: DiffRow["tipo"], value: boolean) {
    setLotes((prev) =>
      prev.map((l) =>
        l.id === loteId
          ? { ...l, diffs: l.diffs.map((r) => (r.tipo === tipo ? { ...r, apply: value } : r)) }
          : l,
      ),
    );
  }

  // Aplica um lote. cronoAtual reflete o estado do banco antes deste lote
  // (refetched a cada iteração para encadear corretamente). Retorna o novo número.
  async function aplicarLote(lote: Lote, ultimoNumero: number, cronoAtual: any[]): Promise<number> {
    const aplicar = lote.diffs.filter((d) => d.apply);
    const itensRevisao: any[] = [];
    const itensAtivos = cronoAtual.filter((i) => i.ativo !== false);
    const ordemBase = itensAtivos.length;
    let ordemNext = ordemBase;

    // 1) Novos itens — pula duplicatas por uid_mpp se já existem (cascata entre lotes)
    const uidsExistentes = new Set(
      cronoAtual
        .map((i) => i.uid_mpp)
        .filter(Boolean)
        .map(String),
    );
    const novos = aplicar.filter((d) => d.tipo === "novo" && !(d.uid && uidsExistentes.has(d.uid)));
    if (novos.length) {
      const rows = novos.map((d) => ({
        obra_id: obraId,
        descricao: d.descricao,
        data_inicio: d.inicio_novo!,
        data_fim: d.fim_novo!,
        ordem: ordemNext++,
        custo: Number((d.custo_novo || 0).toFixed(2)),
        custo_baseline: Number((d.custo_novo || 0).toFixed(2)),
        percentual_previsto: 0,
        percentual_realizado: atualizarPct ? Number((d.pct_novo || 0).toFixed(4)) : 0,
        uid_mpp: d.uid || null,
        data_inicio_baseline: d.inicio_novo!,
        data_fim_baseline: d.fim_novo!,
        ativo: true,
      }));
      const ins = await cronogramaRepo.insertManyReturningItens(rows as any);
      ins?.forEach((row: any) => {
        itensRevisao.push({
          cronograma_item_id: row.id,
          descricao_item: row.descricao,
          tipo_mudanca: "novo",
          data_inicio_anterior: null,
          data_inicio_novo: row.data_inicio,
          data_fim_anterior: null,
          data_fim_novo: row.data_fim,
          custo_anterior: null,
          custo_novo: row.custo,
          percentual_realizado_anterior: null,
          percentual_realizado_novo: row.percentual_realizado,
        });
      });
    }

    // G4.1: persistir dependências (predecessors) dos novos itens
    if (novos.length) {
      const novosSalvos = await cronogramaRepo.listIdsByUidsMpp(
        obraId,
        novos.map((d) => d.uid).filter(Boolean) as string[],
      );
      const byUid = new Map(
        (novosSalvos ?? [])
          .filter((i: any) => i.uid_mpp)
          .map((i: any) => [String(i.uid_mpp), i.id]),
      );
      const deps: any[] = [];
      for (const d of novos) {
        const itemId = byUid.get(String(d.uid));
        if (!itemId || !d.task) continue;
        for (const p of d.task.predecessors ?? []) {
          deps.push({
            obra_id: obraId,
            item_id: itemId,
            predecessor_uid_mpp: p.predecessorUid,
            tipo: p.tipo,
            lag_dias: p.lagDias,
          });
        }
      }
      if (deps.length) await cronogramaDependenciasRepo.insertMany(deps);
    }

    // 2) Updates por item existente
    for (const d of aplicar) {
      if (!d.itemId) continue;
      if (d.tipo === "novo") continue;

      const item = cronoAtual.find((i) => i.id === d.itemId);
      if (!item) continue;
      const update: any = {};
      const log: any = {
        cronograma_item_id: d.itemId,
        descricao_item: item?.descricao ?? d.descricao,
        tipo_mudanca: d.tipo,
      };

      if (d.tipo === "data") {
        update.data_inicio = d.inicio_novo;
        update.data_fim = d.fim_novo;
        log.data_inicio_anterior = d.inicio_antes;
        log.data_inicio_novo = d.inicio_novo;
        log.data_fim_anterior = d.fim_antes;
        log.data_fim_novo = d.fim_novo;
        if (item && !item.data_inicio_baseline) update.data_inicio_baseline = d.inicio_antes;
        if (item && !item.data_fim_baseline) update.data_fim_baseline = d.fim_antes;
      } else if (d.tipo === "pct") {
        if (atualizarPct) {
          const novo = Number(d.pct_novo || 0);
          const atual = Number(d.pct_antes || 0);
          if (novo >= atual) update.percentual_realizado = novo;
        }
        log.percentual_realizado_anterior = d.pct_antes;
        log.percentual_realizado_novo = d.pct_novo;
      } else if (d.tipo === "custo") {
        // Onda 1.3: XML não altera custo de itens existentes.
      } else if (d.tipo === "removido") {
        update.ativo = false;
      } else if (d.tipo === "restaurado") {
        update.ativo = true;
        if (d.task) {
          update.data_inicio = d.task.start;
          update.data_fim = d.task.finish;
        }
      }

      if (Object.keys(update).length) {
        await cronogramaRepo.update(d.itemId, update as any);
      }
      itensRevisao.push(log);
    }

    // 3) Recalcular percentual_previsto proporcional ao custo_baseline
    const vivos = await cronogramaRepo.listCustosByObra(obraId);
    const baseRef = (i: any) => Number(i.custo_baseline ?? i.custo ?? 0);
    const totalCusto = (vivos ?? []).reduce((a, i) => a + baseRef(i), 0);
    if (totalCusto > 0) {
      await cronogramaRepo.updatePercentualPrevistoBulk(
        (vivos ?? []).map((i: any) => ({
          id: i.id,
          percentual: Number(((baseRef(i) / totalCusto) * 100).toFixed(6)),
        })),
      );
    }

    // 4) Cabeçalho da revisão
    const numero = ultimoNumero + 1;
    const totais = {
      itens_total: lote.tasksXml.filter((t) => !t.hasChildren).length,
      novos: novos.length,
      alterados_data: aplicar.filter((d) => d.tipo === "data").length,
      alterados_pct: aplicar.filter((d) => d.tipo === "pct").length,
      alterados_custo: aplicar.filter((d) => d.tipo === "custo").length,
      removidos: aplicar.filter((d) => d.tipo === "removido").length,
      restaurados: aplicar.filter((d) => d.tipo === "restaurado").length,
      custo_total: lote.tasksXml
        .filter((t) => !t.hasChildren)
        .reduce((a, t) => a + (t.custo || 0), 0),
    };
    const blAtualId = await cronogramaBaselinesRepo.getUltimaId(obraId);
    const rev = await cronogramaRevisoesRepo.createReturningId({
      obra_id: obraId,
      numero,
      data_corte: lote.dataCorte,
      arquivo_nome: lote.arquivoNome || null,
      observacoes: obs || null,
      baseline_id: blAtualId ?? null,
      totais,
    });

    // 5) Snapshots
    if (itensRevisao.length) {
      const rows = itensRevisao.map((r) => ({ ...r, revisao_id: rev!.id }));
      await cronogramaItemRevisoesRepo.insertMany(rows);
    }

    return numero;
  }

  async function confirmar() {
    if (!lotes.length) {
      toast.error("Nenhum arquivo carregado");
      return;
    }
    const totalDiffs = lotes.reduce((a, l) => a + l.diffs.filter((d) => d.apply).length, 0);
    if (totalDiffs === 0) {
      toast.error("Nenhuma mudança marcada para aplicar");
      return;
    }
    setImporting(true);
    let totalNovos = 0;
    try {
      let ultimoNumero = revisoes.reduce((m, r) => Math.max(m, Number(r.numero || 0)), 0);
      let cronoAtual: any[] = crono ?? [];
      for (let idx = 0; idx < lotes.length; idx++) {
        const lote = lotes[idx];
        setImportProgress({ atual: idx + 1, total: lotes.length, nome: lote.arquivoNome });
        ultimoNumero = await aplicarLote(lote, ultimoNumero, cronoAtual);
        totalNovos += lote.diffs.filter((d) => d.apply && d.tipo === "novo").length;
        // refetch crono para o próximo lote
        if (idx < lotes.length - 1) {
          cronoAtual = (await cronogramaRepo.listByObra(obraId)) as any[];
        }
      }

      toast.success(`${lotes.length} revisão(ões) registrada(s)`);
      if (totalNovos > 0) {
        toast.warning(
          `${totalNovos} item(ns) novo(s) adicionado(s) à baseline. Mudanças contratuais devem ser registradas como aditivo (aba Aditivos). Alteração registrada no histórico.`,
          { duration: 8000 },
        );
      }
      setOpen(false);
      resetSheet();
      onChange();
    } catch (err: any) {
      toast.error(err.message ?? "Erro ao aplicar revisão");
    } finally {
      setImporting(false);
      setImportProgress(null);
    }
  }

  const maxNumero = revisoes.reduce((m, r) => Math.max(m, Number(r.numero || 0)), 0);

  async function reverterRevisao(rev: any) {
    if (Number(rev.numero) !== maxNumero) {
      toast.error("Reverta primeiro a revisão mais recente.");
      return;
    }
    setRevertendoId(rev.id);
    try {
      const snaps = await cronogramaItemRevisoesRepo.listSnapshotsByRevisao(rev.id);

      const novos = (snaps ?? []).filter((s: any) => s.tipo_mudanca === "novo");
      const novosIds = novos.map((s: any) => s.cronograma_item_id).filter(Boolean) as string[];

      // Bloqueia se algum item "novo" tem medição lançada
      if (novosIds.length) {
        const temMedicao = await itensMedicaoRepo.existsByItemIds(novosIds);
        if (temMedicao) {
          toast.error(
            "Há itens desta revisão com medição lançada. Cancele/exclua a medição antes de reverter, ou use 'Limpar importados'.",
            { duration: 8000 },
          );
          return;
        }
      }

      // Aplica reversão item a item (não-novos)
      for (const s of snaps ?? []) {
        if (s.tipo_mudanca === "novo") continue;
        if (!s.cronograma_item_id) continue;
        const upd: any = {};
        if (s.tipo_mudanca === "data") {
          upd.data_inicio = s.data_inicio_anterior;
          upd.data_fim = s.data_fim_anterior;
        } else if (s.tipo_mudanca === "pct") {
          upd.percentual_realizado = s.percentual_realizado_anterior ?? 0;
        } else if (s.tipo_mudanca === "custo") {
          upd.custo = s.custo_anterior ?? 0;
        } else if (s.tipo_mudanca === "removido") {
          upd.ativo = true;
        } else if (s.tipo_mudanca === "restaurado") {
          upd.ativo = false;
        }
        if (Object.keys(upd).length) {
          await cronogramaRepo.update(s.cronograma_item_id, upd);
        }
      }

      // Apaga dependências e itens criados pela revisão
      if (novosIds.length) {
        await cronogramaDependenciasRepo.removeByItemIds(novosIds);
        await cronogramaRepo.removeMany(novosIds);
      }

      // Recalcula percentual_previsto proporcional ao custo_baseline
      const vivos = await cronogramaRepo.listCustosByObra(obraId);
      const baseRef = (i: any) => Number(i.custo_baseline ?? i.custo ?? 0);
      const totalCusto = (vivos ?? []).reduce((a, i) => a + baseRef(i), 0);
      if (totalCusto > 0) {
        await cronogramaRepo.updatePercentualPrevistoBulk(
          (vivos ?? []).map((i: any) => ({
            id: i.id,
            percentual: Number(((baseRef(i) / totalCusto) * 100).toFixed(6)),
          })),
        );
      }

      // Remove snapshots + cabeçalho da revisão
      await cronogramaItemRevisoesRepo.removeByRevisao(rev.id);
      await cronogramaRevisoesRepo.remove(rev.id);

      toast.success(`Revisão #${rev.numero} revertida`);
      setConfirmReverter(null);
      onChange();
    } catch (e: any) {
      toast.error("Falha ao reverter: " + (e?.message ?? "erro desconhecido"));
    } finally {
      setRevertendoId(null);
    }
  }

  const grupos: { tipo: DiffRow["tipo"]; label: string; cor: string }[] = [
    { tipo: "novo", label: "Novos", cor: "bg-primary/15 text-primary" },
    { tipo: "data", label: "Datas alteradas", cor: "bg-warning/15 text-warning" },
    { tipo: "pct", label: "% realizado", cor: "bg-success/15 text-success" },
    { tipo: "custo", label: "Custo alterado", cor: "bg-purple-500/15 text-purple-700" },
    { tipo: "removido", label: "Removidos", cor: "bg-destructive/15 text-destructive" },
    { tipo: "restaurado", label: "Restaurados", cor: "bg-sky-500/15 text-sky-700" },
  ];

  return (
    <div className="space-y-4">
      {/* Faixa compacta de KPIs + ação */}
      <Card>
        <CardContent className="py-3 flex flex-wrap items-center gap-x-8 gap-y-2 justify-between">
          <div className="flex flex-wrap items-center gap-x-8 gap-y-2">
            <div>
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                Atraso máximo
              </div>
              <div className="text-base font-semibold">
                {atrasoMax} {atrasoMax === 1 ? "dia" : "dias"}{" "}
                <span className="text-xs font-normal text-muted-foreground">
                  · {atrasados.length} atrasada(s)
                </span>
              </div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                Revisões
              </div>
              <div className="text-base font-semibold">
                {revisoes.length}{" "}
                <span className="text-xs font-normal text-muted-foreground">
                  ·{" "}
                  {revisoes[0]
                    ? `última ${format(parseISO(revisoes[0].data_corte), "dd/MM/yyyy")}`
                    : "nenhuma"}
                </span>
              </div>
            </div>
          </div>
          <Sheet
            open={open}
            onOpenChange={(v) => {
              setOpen(v);
              if (!v) resetSheet();
            }}
          >
            <MppNotSupportedDialog open={mppDialogOpen} onOpenChange={setMppDialogOpen} />
            <SheetTrigger asChild>
              <Button disabled={!canEdit}>
                <Upload className="h-4 w-4 mr-2" />
                Nova revisão
              </Button>
            </SheetTrigger>
            <SheetContent
              side="right"
              className="w-[95vw] sm:max-w-[900px] overflow-y-auto flex flex-col"
            >
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2">
                  <CalendarClock className="h-4 w-4" /> Importar revisão semanal
                </SheetTitle>
                {/* Stepper */}
                <div className="flex items-center gap-2 mt-3 text-xs">
                  {[
                    { n: 1, l: "Arquivo" },
                    { n: 2, l: "Revisar mudanças" },
                    { n: 3, l: "Confirmar" },
                  ].map((s, i) => (
                    <div key={s.n} className="flex items-center gap-2">
                      <div
                        className={`h-6 w-6 rounded-full flex items-center justify-center text-[11px] font-medium ${step === s.n ? "bg-primary text-primary-foreground" : step > s.n ? "bg-success/15 text-success" : "bg-muted text-muted-foreground"}`}
                      >
                        {s.n}
                      </div>
                      <span className={step === s.n ? "font-medium" : "text-muted-foreground"}>
                        {s.l}
                      </span>
                      {i < 2 && <ChevronRight className="h-3 w-3 text-muted-foreground" />}
                    </div>
                  ))}
                </div>
              </SheetHeader>

              <div className="flex-1 mt-4">
                {step === 1 && (
                  <div className="space-y-4">
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <Label>Arquivos .xml do MS Project</Label>
                        <button
                          type="button"
                          onClick={() => setMppDialogOpen(true)}
                          className="text-xs text-muted-foreground hover:text-foreground underline-offset-2 hover:underline"
                        >
                          Tem .mpp? Veja como converter
                        </button>
                      </div>
                      <label className="block border-2 border-dashed border-muted-foreground/25 rounded-lg p-6 text-center cursor-pointer hover:border-primary/50 hover:bg-accent/50 transition-colors">
                        <Upload className="h-7 w-7 mx-auto mb-2 text-muted-foreground" />
                        <div className="text-sm font-medium">
                          {lotes.length
                            ? "Adicionar mais arquivos"
                            : "Clique para escolher um ou mais arquivos XML"}
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                          Selecione vários para importar diversas revisões de uma vez (em sequência
                          cronológica).
                        </div>
                        <Input
                          type="file"
                          accept=".xml,.mpp"
                          multiple
                          onChange={onFile}
                          className="hidden"
                        />
                      </label>
                    </div>

                    {lotes.length > 0 && (
                      <div className="space-y-2">
                        <div className="text-xs uppercase tracking-wide text-muted-foreground">
                          {lotes.length} arquivo(s) pronto(s) — defina a data de corte de cada um
                        </div>
                        {lotes.map((l, idx) => {
                          const n = l.diffs.filter((d) => d.apply).length;
                          return (
                            <div
                              key={l.id}
                              className="rounded-md border p-3 flex items-center gap-3"
                            >
                              <div className="text-xs font-mono w-6 text-center text-muted-foreground">
                                #{idx + 1}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="text-sm font-medium truncate" title={l.arquivoNome}>
                                  {l.arquivoNome}
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  {n} mudança(s) detectada(s)
                                </div>
                              </div>
                              <div>
                                <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">
                                  Data de corte
                                </Label>
                                <DatePickerField
                                  value={l.dataCorte}
                                  onChange={(v) => atualizarDataLote(l.id, v)}
                                  className="w-[150px]"
                                  inputClassName="h-8"
                                />
                              </div>
                              <Button
                                variant="ghost"
                                size="icon"
                                aria-label="Remover revisão"
                                onClick={() => removerLote(l.id)}
                                title="Remover"
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {step === 2 &&
                  lotes.length > 0 &&
                  (() => {
                    const ativos = tiposVisiveis ?? new Set(grupos.map((g) => g.tipo));
                    const loteAtual = lotes.find((l) => l.id === loteAtivoId) ?? lotes[0];
                    const diffsLote = loteAtual.diffs;
                    const contagem: Record<DiffRow["tipo"], number> = {
                      novo: 0,
                      data: 0,
                      pct: 0,
                      custo: 0,
                      removido: 0,
                      restaurado: 0,
                    };
                    for (const d of diffsLote) contagem[d.tipo]++;
                    const totalAplicar = diffsLote.filter((d) => d.apply).length;
                    return (
                      <div className="space-y-4">
                        {lotes.length > 1 && (
                          <Tabs value={loteAtual.id} onValueChange={setLoteAtivoId}>
                            <TabsList className="w-full overflow-x-auto flex-wrap h-auto">
                              {lotes.map((l, idx) => {
                                const marcadas = l.diffs.filter((d) => d.apply).length;
                                return (
                                  <TabsTrigger key={l.id} value={l.id} className="text-xs">
                                    <span className="font-mono mr-1">#{idx + 1}</span>
                                    <span className="max-w-[140px] truncate">{l.arquivoNome}</span>
                                    <Badge
                                      variant="secondary"
                                      className="ml-2 h-4 px-1.5 text-[10px]"
                                    >
                                      {marcadas}
                                    </Badge>
                                  </TabsTrigger>
                                );
                              })}
                            </TabsList>
                          </Tabs>
                        )}

                        {diffsLote.length === 0 ? (
                          <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
                            <CheckCircle2 className="h-8 w-8 mx-auto mb-2 text-success" />
                            Sem mudanças neste arquivo.
                          </div>
                        ) : (
                          <>
                            <div className="flex flex-wrap items-center gap-2">
                              {grupos.map((g) => {
                                const n = contagem[g.tipo];
                                if (!n) return null;
                                const on = ativos.has(g.tipo);
                                return (
                                  <button
                                    key={g.tipo}
                                    type="button"
                                    onClick={() => {
                                      setTiposVisiveis((prev) => {
                                        const cur = new Set(prev ?? grupos.map((x) => x.tipo));
                                        if (cur.has(g.tipo)) cur.delete(g.tipo);
                                        else cur.add(g.tipo);
                                        return cur;
                                      });
                                    }}
                                    className={`text-xs px-2.5 py-1 rounded-full border transition ${on ? g.cor + " border-transparent" : "text-muted-foreground border-border opacity-60 hover:opacity-100"}`}
                                  >
                                    {g.label} · {n}
                                  </button>
                                );
                              })}
                              <div className="ml-auto text-xs text-muted-foreground">
                                {totalAplicar} de {diffsLote.length} marcadas
                              </div>
                            </div>

                            <Input
                              placeholder="Buscar tarefa por descrição…"
                              value={filtroDiff}
                              onChange={(e) => setFiltroDiff(e.target.value)}
                              className="h-9"
                            />

                            <div className="space-y-2">
                              {grupos.map((g) => {
                                if (!ativos.has(g.tipo)) return null;
                                const linhas = diffsLote
                                  .map((d, i) => ({ d, i }))
                                  .filter((x) => x.d.tipo === g.tipo)
                                  .filter(
                                    (x) =>
                                      !filtroDiff ||
                                      x.d.descricao
                                        .toLowerCase()
                                        .includes(filtroDiff.toLowerCase()),
                                  );
                                if (!linhas.length) return null;
                                const todosOn = linhas.every((x) => x.d.apply);
                                return (
                                  <Collapsible key={g.tipo} defaultOpen={false}>
                                    <Card>
                                      <CollapsibleTrigger asChild>
                                        <CardHeader className="py-2.5 cursor-pointer hover:bg-accent/40 flex flex-row items-center justify-between">
                                          <CardTitle className="text-sm flex items-center gap-2">
                                            <ChevronRight className="h-4 w-4 transition-transform data-[state=open]:rotate-90 [[data-state=open]_&]:rotate-90" />
                                            <Badge className={g.cor + " border-none"}>
                                              {g.label}
                                            </Badge>
                                            <span className="text-muted-foreground font-normal">
                                              {linhas.length}
                                            </span>
                                          </CardTitle>
                                          <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              toggleAll(loteAtual.id, g.tipo, !todosOn);
                                            }}
                                          >
                                            {todosOn ? "Desmarcar todos" : "Marcar todos"}
                                          </Button>
                                        </CardHeader>
                                      </CollapsibleTrigger>
                                      <CollapsibleContent>
                                        <CardContent className="pt-0">
                                          <Table>
                                            <TableHeader>
                                              <TableRow>
                                                <TableHead className="w-8"></TableHead>
                                                <TableHead>Tarefa</TableHead>
                                                <TableHead>Antes</TableHead>
                                                <TableHead>Depois</TableHead>
                                              </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                              {linhas.slice(0, 200).map(({ d, i }) => (
                                                <TableRow key={i}>
                                                  <TableCell>
                                                    <input
                                                      type="checkbox"
                                                      checked={d.apply}
                                                      onChange={(e) =>
                                                        toggleRow(loteAtual.id, i, e.target.checked)
                                                      }
                                                    />
                                                  </TableCell>
                                                  <TableCell
                                                    className="max-w-[380px] truncate"
                                                    title={d.descricao}
                                                  >
                                                    {d.descricao}
                                                  </TableCell>
                                                  <TableCell className="text-xs whitespace-nowrap">
                                                    {formatBefore(d)}
                                                  </TableCell>
                                                  <TableCell className="text-xs whitespace-nowrap">
                                                    {formatAfter(d)}
                                                  </TableCell>
                                                </TableRow>
                                              ))}
                                            </TableBody>
                                          </Table>
                                          {linhas.length > 200 && (
                                            <p className="text-xs text-muted-foreground mt-2">
                                              Mostrando 200 de {linhas.length}. Use a busca acima
                                              para refinar.
                                            </p>
                                          )}
                                        </CardContent>
                                      </CollapsibleContent>
                                    </Card>
                                  </Collapsible>
                                );
                              })}
                            </div>
                          </>
                        )}
                      </div>
                    );
                  })()}

                {step === 3 && lotes.length > 0 && (
                  <div className="space-y-4">
                    {lotes.length > 1 && (
                      <div className="rounded-md border bg-muted/30 p-3 text-xs text-muted-foreground">
                        As {lotes.length} revisões serão aplicadas em sequência, na ordem listada.
                        Cada uma vira uma entrada própria no histórico. Itens "novos" duplicados por{" "}
                        <span className="font-mono">uid_mpp</span> de lotes anteriores são ignorados
                        automaticamente.
                      </div>
                    )}

                    {lotes.map((l, idx) => {
                      const aplicar = l.diffs.filter((d) => d.apply);
                      return (
                        <Card key={l.id}>
                          <CardHeader className="py-3">
                            <CardTitle className="text-sm flex items-center justify-between">
                              <span className="flex items-center gap-2">
                                <span className="font-mono text-xs text-muted-foreground">
                                  #{idx + 1}
                                </span>
                                <span className="truncate max-w-[420px]" title={l.arquivoNome}>
                                  {l.arquivoNome}
                                </span>
                              </span>
                              <span className="text-xs font-normal text-muted-foreground">
                                {aplicar.length} de {l.diffs.length} marcadas · corte{" "}
                                {(() => {
                                  try {
                                    return l.dataCorte
                                      ? format(parseISO(l.dataCorte), "dd/MM/yyyy")
                                      : "—";
                                  } catch {
                                    return l.dataCorte || "—";
                                  }
                                })()}
                              </span>
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="pt-0 pb-3">
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                              {grupos.map((g) => {
                                const n = aplicar.filter((d) => d.tipo === g.tipo).length;
                                if (!n) return null;
                                return (
                                  <div
                                    key={g.tipo}
                                    className="rounded-md border p-2 flex items-center justify-between"
                                  >
                                    <Badge className={g.cor + " border-none"}>{g.label}</Badge>
                                    <span className="font-semibold tabular-nums">{n}</span>
                                  </div>
                                );
                              })}
                              {aplicar.length === 0 && (
                                <div className="col-span-full text-xs text-muted-foreground">
                                  Nenhuma mudança marcada — esta revisão será registrada vazia.
                                </div>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}

                    <Card>
                      <CardContent className="pt-6 space-y-3">
                        <div className="flex items-start gap-3">
                          <Switch
                            checked={atualizarPct}
                            onCheckedChange={setAtualizarPct}
                            id="att-pct"
                          />
                          <Label
                            htmlFor="att-pct"
                            className="cursor-pointer text-sm font-normal leading-snug"
                          >
                            Atualizar % realizado pelo PercentComplete do XML
                            <div className="text-xs text-muted-foreground mt-0.5">
                              Aplica a todas as revisões deste lote. Nunca rebaixa um lançamento
                              manual maior.
                            </div>
                          </Label>
                        </div>
                        <div>
                          <Label>Observações (opcional, aplicadas a todas)</Label>
                          <Textarea
                            value={obs}
                            onChange={(e) => setObs(e.target.value)}
                            rows={2}
                            placeholder="Ex.: revisões pós reunião mensal"
                          />
                        </div>
                      </CardContent>
                    </Card>

                    {importProgress && (
                      <div className="rounded-md border bg-muted/30 p-3 text-xs">
                        Aplicando {importProgress.atual}/{importProgress.total}:{" "}
                        <span className="font-medium">{importProgress.nome}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <SheetFooter className="mt-4 flex-row justify-between sm:justify-between">
                <Button
                  variant="ghost"
                  disabled={step === 1 || importing}
                  onClick={() => setStep((s) => (s > 1 ? ((s - 1) as 1 | 2 | 3) : s))}
                >
                  Voltar
                </Button>
                {step < 3 ? (
                  <Button
                    disabled={
                      lotes.length === 0 ||
                      (step === 2 && lotes.every((l) => l.diffs.length === 0)) ||
                      (step === 2 && lotes.some((l) => !l.dataCorte))
                    }
                    onClick={() => setStep((s) => (s < 3 ? ((s + 1) as 1 | 2 | 3) : s))}
                  >
                    Avançar
                  </Button>
                ) : (
                  <Button
                    disabled={
                      lotes.length === 0 ||
                      lotes.some((l) => !l.dataCorte) ||
                      lotes.reduce((a, l) => a + l.diffs.filter((d) => d.apply).length, 0) === 0 ||
                      importing
                    }
                    onClick={confirmar}
                  >
                    {importing
                      ? importProgress
                        ? `Aplicando ${importProgress.atual}/${importProgress.total}…`
                        : "Aplicando…"
                      : lotes.length > 1
                        ? `Confirmar ${lotes.length} revisões`
                        : "Confirmar revisão"}
                  </Button>
                )}
              </SheetFooter>
            </SheetContent>
          </Sheet>
        </CardContent>
      </Card>

      {/* Histórico resumido */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <History className="h-4 w-4" /> Histórico de revisões
          </CardTitle>
          {revisoes.length > 3 && (
            <Button variant="ghost" size="sm" onClick={() => setVerTodasRev((v) => !v)}>
              {verTodasRev ? "Mostrar últimas 3" : `Ver todas (${revisoes.length})`}
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {revisoes.length === 0 ? (
            <div className="text-sm text-muted-foreground">
              Nenhuma revisão registrada ainda. Clique em "Nova revisão" para importar a primeira.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8"></TableHead>
                  <TableHead className="w-12">#</TableHead>
                  <TableHead>Data de corte</TableHead>
                  <TableHead>Arquivo</TableHead>
                  <TableHead>Mudanças</TableHead>
                  <TableHead>Importada em</TableHead>
                  <TableHead className="w-24 text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(() => {
                  const lista = verTodasRev ? revisoes : revisoes.slice(0, 3);
                  const grupos: { blId: string | null; versao: number | null; revs: any[] }[] = [];
                  for (const r of lista) {
                    const blId = (r as any).baseline_id ?? null;
                    const last = grupos[grupos.length - 1];
                    if (last && last.blId === blId) last.revs.push(r);
                    else
                      grupos.push({
                        blId,
                        versao: blId ? (baselinePorId.get(blId)?.versao ?? null) : null,
                        revs: [r],
                      });
                  }
                  const renderRow = (r: any) => {
                    const t = r.totais ?? {};
                    const chips = [
                      t.novos ? `+${t.novos} novas` : null,
                      t.alterados_data ? `${t.alterados_data} datas` : null,
                      t.alterados_pct ? `${t.alterados_pct} %` : null,
                      t.removidos ? `${t.removidos} removidas` : null,
                    ].filter(Boolean);
                    const aberta = revExpandida === r.id;
                    const podeReverter = Number(r.numero) === maxNumero;
                    return (
                      <Fragment key={r.id}>
                        <TableRow
                          className="cursor-pointer hover:bg-accent/40"
                          onClick={() => setRevExpandida((cur) => (cur === r.id ? null : r.id))}
                        >
                          <TableCell>
                            {aberta ? (
                              <ChevronDown className="h-4 w-4 text-muted-foreground" />
                            ) : (
                              <ChevronRight className="h-4 w-4 text-muted-foreground" />
                            )}
                          </TableCell>
                          <TableCell>{r.numero}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {r.arquivo_nome ? (
                                <Badge
                                  variant="outline"
                                  className="bg-[color:var(--info)]/15 text-[color:var(--info)] border-[color:var(--info)]/20"
                                >
                                  XML
                                </Badge>
                              ) : (
                                <Badge
                                  variant="outline"
                                  className="bg-muted text-muted-foreground border-transparent"
                                >
                                  Manual
                                </Badge>
                              )}
                              <span>{format(parseISO(r.data_corte), "dd/MM/yyyy")}</span>
                            </div>
                          </TableCell>
                          <TableCell
                            className="max-w-[260px] truncate"
                            title={r.arquivo_nome ?? ""}
                          >
                            {r.arquivo_nome ?? "—"}
                          </TableCell>
                          <TableCell
                            className="text-xs text-muted-foreground"
                            title={`Novos ${t.novos ?? 0} · Datas ${t.alterados_data ?? 0} · % ${t.alterados_pct ?? 0} · Removidos ${t.removidos ?? 0}`}
                          >
                            {chips.length ? chips.join(" · ") : "sem mudanças"}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {format(parseISO(r.created_at), "dd/MM/yy HH:mm")}
                          </TableCell>
                          <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                            <Button
                              variant="ghost"
                              size="sm"
                              disabled={!canEdit || !podeReverter || revertendoId === r.id}
                              title={
                                !canEdit
                                  ? "Sem permissão para reverter"
                                  : podeReverter
                                    ? "Reverter esta revisão"
                                    : `Reverta primeiro a revisão #${maxNumero}`
                              }
                              onClick={() => setConfirmReverter(r)}
                            >
                              <Undo2 className="h-4 w-4 mr-1" />
                              Reverter
                            </Button>
                          </TableCell>
                        </TableRow>
                        {aberta && (
                          <TableRow className="bg-muted/30 hover:bg-muted/30">
                            <TableCell colSpan={7} className="p-0">
                              <RevisaoDetalhes revisaoId={r.id} />
                            </TableCell>
                          </TableRow>
                        )}
                      </Fragment>
                    );
                  };
                  const out: React.ReactNode[] = [];
                  for (const g of grupos) {
                    const isAtual = baselineAtual && g.blId === baselineAtual.id;
                    out.push(
                      <TableRow
                        key={`grp-${g.blId ?? "none"}`}
                        className="bg-muted/50 hover:bg-muted/50"
                      >
                        <TableCell colSpan={7} className="py-1.5">
                          <div className="flex items-center gap-2 text-xs font-medium">
                            <Badge
                              variant="outline"
                              className="bg-primary/10 text-primary border-primary/20"
                            >
                              Cronograma Principal{" "}
                              {g.versao != null ? `· Rev ${g.versao}` : "(sem vínculo)"}
                            </Badge>
                            {isAtual && (
                              <span className="text-[10px] text-muted-foreground uppercase tracking-wider">
                                vigente
                              </span>
                            )}
                            <span className="text-muted-foreground">
                              · {g.revs.length} revisão(ões) semanal(is)
                            </span>
                          </div>
                        </TableCell>
                      </TableRow>,
                    );
                    for (const r of g.revs) out.push(renderRow(r));
                  }
                  return out;
                })()}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={!!confirmReverter} onOpenChange={(v) => !v && setConfirmReverter(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reverter revisão #{confirmReverter?.numero}?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm">
                <div>
                  <span className="text-muted-foreground">Data de corte:</span>{" "}
                  {confirmReverter && format(parseISO(confirmReverter.data_corte), "dd/MM/yyyy")}
                  {confirmReverter?.arquivo_nome ? (
                    <>
                      {" "}
                      · <span className="font-mono text-xs">{confirmReverter.arquivo_nome}</span>
                    </>
                  ) : null}
                </div>
                {confirmReverter && (
                  <div className="text-xs text-muted-foreground">
                    {[
                      confirmReverter.totais?.novos
                        ? `+${confirmReverter.totais.novos} novas`
                        : null,
                      confirmReverter.totais?.alterados_data
                        ? `${confirmReverter.totais.alterados_data} datas`
                        : null,
                      confirmReverter.totais?.alterados_pct
                        ? `${confirmReverter.totais.alterados_pct} %`
                        : null,
                      confirmReverter.totais?.alterados_custo
                        ? `${confirmReverter.totais.alterados_custo} custo`
                        : null,
                      confirmReverter.totais?.removidos
                        ? `${confirmReverter.totais.removidos} removidas`
                        : null,
                      confirmReverter.totais?.restaurados
                        ? `${confirmReverter.totais.restaurados} restauradas`
                        : null,
                    ]
                      .filter(Boolean)
                      .join(" · ") || "sem mudanças registradas"}
                  </div>
                )}
                <div className="rounded-md border border-destructive/30 bg-destructive/5 p-2 text-xs text-destructive">
                  Esta ação desfaz as mudanças aplicadas por esta revisão: itens criados serão
                  removidos do cronograma, e datas, % e custos voltarão aos valores anteriores. Não
                  é reversível.
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={!!revertendoId}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={!!revertendoId}
              onClick={(e) => {
                e.preventDefault();
                if (confirmReverter) reverterRevisao(confirmReverter);
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {revertendoId ? "Revertendo…" : "Reverter revisão"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function formatBefore(d: DiffRow): string {
  if (d.tipo === "novo") return "—";
  if (d.tipo === "removido") return "(ativo)";
  if (d.tipo === "restaurado") return "(inativo)";
  if (d.tipo === "data") return `${d.inicio_antes ?? "—"} → ${d.fim_antes ?? "—"}`;
  if (d.tipo === "pct") return `${Number(d.pct_antes ?? 0).toFixed(1)}%`;
  if (d.tipo === "custo") return brl(d.custo_antes ?? 0);
  return "";
}
function formatAfter(d: DiffRow): string {
  if (d.tipo === "removido") return "(inativo)";
  if (d.tipo === "restaurado") return "(ativo)";
  if (d.tipo === "novo" || d.tipo === "data")
    return `${d.inicio_novo ?? "—"} → ${d.fim_novo ?? "—"}`;
  if (d.tipo === "pct") return `${Number(d.pct_novo ?? 0).toFixed(1)}%`;
  if (d.tipo === "custo") return brl(d.custo_novo ?? 0);
  return "";
}
