/**
 * PRO-012 · slice-01 — Contagens Cíclicas de Estoque (listagem inicial).
 *
 * Escopo desta slice: listar planos de contagem persistidos localmente
 * e permitir criar um plano vazio. Execução (lançar quantidades,
 * comparar com saldo do repositório e gerar ajustes) entra em slices
 * seguintes do PRO-012.
 */
import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import {
  Plus,
  ClipboardList,
  Play,
  Check,
  Download,
  Upload,
  ChevronRight,
  ChevronDown,
  Search,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  XCircle,
} from "lucide-react";
import * as XLSX from "xlsx";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import DatePickerField from "@/components/common/DatePickerField";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EmptyState } from "@/components/common/EmptyState";
import { fmtDataLocal } from "@/lib/core/date";
import { suprimentosRepo } from "@/lib/repositories/suprimentos";
import { useInsumosAtivosBasico } from "@/hooks/suprimentos/useInsumos";
import { carregarClasseInsumos } from "@/lib/estoque/curva-abc-insumos";
import { Sparkline } from "@/components/ui/sparkline";
import { loadLocal } from "@/lib/utils/local-storage";
import { TrendSummary } from "@/components/suprimentos/TrendSummary";
import {
  listarContagensCiclicas,
  criarContagemCiclica,
  atualizarContagemCiclica,
  recalcularDivergencias,
  gerarAjustesPropostos,
  marcarAjuste,
  amostragemDeterministica,
  calcularMetricas,
  calcularMetricasImportacoes,
  metricasPorLocal,
  STATUS_LABEL,
  STATUS_AJUSTE_LABEL,
  type ContagemCiclica,
  type ItemContagemCiclica,
  type AuditoriaImportacaoRegistro,
  type LinhaImportacaoIgnorada,
} from "@/lib/estoque/contagens-ciclicas";

const CRITERIOS: { value: ContagemCiclica["criterio"]; label: string }[] = [
  { value: "curva_abc_A", label: "Curva ABC · Classe A" },
  { value: "curva_abc_B", label: "Curva ABC · Classe B" },
  { value: "curva_abc_C", label: "Curva ABC · Classe C" },
  { value: "amostra", label: "Amostra aleatória" },
  { value: "manual", label: "Seleção manual" },
];

/** Auditoria pré-salvamento exibida no diálogo (não persistida). */
type AuditoriaImportacao = Omit<AuditoriaImportacaoRegistro, "id" | "importadoEm" | "importadoPor">;

const normalizarTextoBusca = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

const contarIgnoradasPorMotivo = (linhas: LinhaImportacaoIgnorada[]) => {
  const motivos = new Map<string, number>();
  linhas.forEach((linha) => motivos.set(linha.motivo, (motivos.get(linha.motivo) ?? 0) + 1));
  return Array.from(motivos.entries())
    .map(([motivo, total]) => ({ motivo, total }))
    .sort((a, b) => b.total - a.total || a.motivo.localeCompare(b.motivo, "pt-BR"));
};

export default function ContagensCiclicas() {
  const [rows, setRows] = useState<ContagemCiclica[]>([]);
  // slice-23 — ordenação por tendência ou total de ignoradas.
  // slice-26 — persistida em localStorage.
  type SortIgn = { key: "delta" | "total"; dir: "asc" | "desc" } | null;
  const SORT_KEY = "contagens-ciclicas:sortIgn";
  const PIORA_KEY = "contagens-ciclicas:apenasPiora";
  const [sortIgn, setSortIgn] = useState<SortIgn>(() => loadLocal<SortIgn>(SORT_KEY, null));
  // slice-25 — filtro rápido "somente em piora" (delta > 0 na série).
  const [apenasPiora, setApenasPiora] = useState<boolean>(() =>
    loadLocal<boolean>(PIORA_KEY, false),
  );
  useEffect(() => {
    try {
      localStorage.setItem(SORT_KEY, JSON.stringify(sortIgn));
    } catch {
      /* quota/ssr */
    }
  }, [sortIgn]);
  useEffect(() => {
    try {
      localStorage.setItem(PIORA_KEY, JSON.stringify(apenasPiora));
    } catch {
      /* quota/ssr */
    }
  }, [apenasPiora]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [local, setLocal] = useState("");
  const [criterio, setCriterio] = useState<ContagemCiclica["criterio"]>("curva_abc_A");
  const [responsavel, setResponsavel] = useState("");
  const [dataPlanejada, setDataPlanejada] = useState(() => new Date().toISOString().slice(0, 10));
  const [amostraPct, setAmostraPct] = useState<number>(10);
  const [insumosSel, setInsumosSel] = useState<string[]>([]);
  const [insumoSearch, setInsumoSearch] = useState("");

  const reload = () => setRows(listarContagensCiclicas());
  useEffect(reload, []);

  const { data: insumos = [] } = useInsumosAtivosBasico();
  const insumoInfo = useMemo(() => {
    const m = new Map<string, { codigo: string; descricao: string; unidade: string | null }>();
    insumos.forEach((i) =>
      m.set(i.id, { codigo: i.codigo, descricao: i.descricao, unidade: i.unidade ?? null }),
    );
    return m;
  }, [insumos]);

  const insumoIdPorCodigo = useMemo(() => {
    const m = new Map<string, string>();
    insumos.forEach((i) => m.set(i.codigo.trim().toLowerCase(), i.id));
    return m;
  }, [insumos]);

  const insumosFiltrados = useMemo(() => {
    const s = insumoSearch.trim().toLowerCase();
    const base = [...insumos].sort((a, b) => a.descricao.localeCompare(b.descricao, "pt-BR"));
    if (!s) return base.slice(0, 50);
    return base
      .filter((i) => i.descricao.toLowerCase().includes(s) || i.codigo.toLowerCase().includes(s))
      .slice(0, 50);
  }, [insumos, insumoSearch]);

  // Execução
  const [execOpen, setExecOpen] = useState(false);
  const [execId, setExecId] = useState<string | null>(null);
  const [execItens, setExecItens] = useState<ItemContagemCiclica[]>([]);
  const [execLoading, setExecLoading] = useState(false);
  const [importAudit, setImportAudit] = useState<AuditoriaImportacao | null>(null);
  /** slice-15 — auditoria alvo para auto-scroll/destaque ao abrir via drilldown. */
  const [focusAuditoriaId, setFocusAuditoriaId] = useState<string | null>(null);
  /** slice-16 — auditorias com painel de ignoradas expandido. */
  const [expandedAudits, setExpandedAudits] = useState<Set<string>>(new Set());
  /** slice-17 — filtro rápido por auditoria expandida. */
  const [auditIgnoredFilters, setAuditIgnoredFilters] = useState<Record<string, string>>({});
  /** slice-19 — chave por contagem para persistência dos filtros no localStorage. */
  const auditFiltersStorageKey = (contagemId: string) =>
    `contagens-ciclicas:audit-filters:${contagemId}`;
  const carregarFiltrosPersistidos = (contagemId: string): Record<string, string> => {
    try {
      const raw = window.localStorage.getItem(auditFiltersStorageKey(contagemId));
      if (!raw) return {};
      const parsed = JSON.parse(raw) as unknown;
      if (!parsed || typeof parsed !== "object") return {};
      const out: Record<string, string> = {};
      for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
        if (typeof v === "string" && v.trim()) out[k] = v;
      }
      return out;
    } catch {
      return {};
    }
  };
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const execContagem = rows.find((c) => c.id === execId) ?? null;

  const toggleExpandAudit = (id: string) => {
    setExpandedAudits((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const setAuditIgnoredFilter = (id: string, value: string) => {
    setAuditIgnoredFilters((prev) => {
      if (value.trim()) return { ...prev, [id]: value };
      const { [id]: _removed, ...rest } = prev;
      return rest;
    });
  };

  // slice-15 — auto-scroll até a auditoria alvo quando o diálogo abre via drilldown.
  // slice-16 — auto-expande a auditoria alvo para revelar as ignoradas.
  useEffect(() => {
    if (!execOpen || !focusAuditoriaId) return;
    setExpandedAudits((prev) => {
      if (prev.has(focusAuditoriaId)) return prev;
      const next = new Set(prev);
      next.add(focusAuditoriaId);
      return next;
    });
    let cancelled = false;
    const attempt = (tries: number) => {
      if (cancelled) return;
      const el = document.querySelector<HTMLElement>(`[data-audit-id="${focusAuditoriaId}"]`);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
      } else if (tries < 20) {
        window.setTimeout(() => attempt(tries + 1), 60);
      }
    };
    attempt(0);
    return () => {
      cancelled = true;
    };
  }, [execOpen, focusAuditoriaId, execContagem?.auditoriasImportacao?.length]);

  // slice-19 — persiste filtros por contagem para acelerar auditorias recorrentes.
  useEffect(() => {
    if (!execOpen || !execId) return;
    try {
      const key = auditFiltersStorageKey(execId);
      if (Object.keys(auditIgnoredFilters).length === 0) {
        window.localStorage.removeItem(key);
      } else {
        window.localStorage.setItem(key, JSON.stringify(auditIgnoredFilters));
      }
    } catch {
      /* storage indisponível — ignora silenciosamente */
    }
  }, [auditIgnoredFilters, execId, execOpen]);

  const canCreate = useMemo(() => {
    if (!local.trim() || !responsavel.trim() || !dataPlanejada) return false;
    if (criterio === "amostra" && (!amostraPct || amostraPct <= 0 || amostraPct > 100))
      return false;
    if (criterio === "manual" && insumosSel.length === 0) return false;
    return true;
  }, [local, responsavel, dataPlanejada, criterio, amostraPct, insumosSel]);

  const criar = () => {
    if (!canCreate) return;
    criarContagemCiclica({
      local: local.trim(),
      criterio,
      responsavel: responsavel.trim(),
      dataPlanejada,
      amostraPct: criterio === "amostra" ? amostraPct : undefined,
      insumosSelecionados: criterio === "manual" ? insumosSel : undefined,
    });
    toast.success("Contagem cíclica criada");
    setDialogOpen(false);
    setLocal("");
    setResponsavel("");
    setInsumosSel([]);
    setInsumoSearch("");
    reload();
  };

  const abrirExecucao = async (c: ContagemCiclica, focusAuditoria?: string) => {
    setExecId(c.id);
    setExecOpen(true);
    setImportAudit(null);
    setFocusAuditoriaId(focusAuditoria ?? null);
    // slice-19 — recupera filtros persistidos por contagem.
    setAuditIgnoredFilters(carregarFiltrosPersistidos(c.id));
    if (c.status === "planejada") {
      setExecLoading(true);
      try {
        const classeAlvo: "A" | "B" | "C" | null =
          c.criterio === "curva_abc_A"
            ? "A"
            : c.criterio === "curva_abc_B"
              ? "B"
              : c.criterio === "curva_abc_C"
                ? "C"
                : null;
        const [saldos, classeMap] = await Promise.all([
          suprimentosRepo.listEstoqueSaldos(),
          classeAlvo ? carregarClasseInsumos() : Promise.resolve(null),
        ]);
        const doLocal = (saldos ?? []).filter(
          (s: { local: string }) => String(s.local).toLowerCase() === c.local.toLowerCase(),
        );
        let filtrados =
          classeAlvo && classeMap
            ? doLocal.filter(
                (s: { insumo_id: string }) => classeMap.get(String(s.insumo_id)) === classeAlvo,
              )
            : doLocal;
        if (c.criterio === "manual") {
          const set = new Set(c.insumosSelecionados ?? []);
          filtrados = doLocal.filter((s: { insumo_id: string }) => set.has(String(s.insumo_id)));
        } else if (c.criterio === "amostra") {
          const pct = c.amostraPct ?? 10;
          filtrados = amostragemDeterministica(
            doLocal as { insumo_id: string; saldo: number; local: string }[],
            pct,
            c.id,
          );
        }
        if (filtrados.length === 0) {
          toast.warning(
            "Nenhum insumo selecionado pelo critério. Revise o local e os parâmetros do plano.",
          );
        }
        const itens: ItemContagemCiclica[] = filtrados.map(
          (s: { insumo_id: string; saldo: number }) => ({
            insumoId: String(s.insumo_id),
            saldoEsperado: Number(s.saldo ?? 0),
            saldoContado: null,
            divergencia: null,
          }),
        );
        const atualizado = atualizarContagemCiclica(c.id, {
          status: "em_andamento",
          dataInicio: new Date().toISOString(),
          itens,
        });
        if (atualizado) {
          setExecItens(atualizado.itens);
          reload();
        }
      } catch {
        toast.error("Falha ao carregar saldos do local");
      } finally {
        setExecLoading(false);
      }
    } else {
      setExecItens(c.itens);
    }
  };

  const setContado = (insumoId: string, valor: string) => {
    setImportAudit(null);
    setExecItens((prev) => {
      const next = prev.map((i) =>
        i.insumoId === insumoId ? { ...i, saldoContado: valor === "" ? null : Number(valor) } : i,
      );
      return recalcularDivergencias(next);
    });
  };

  const salvarExecucao = (concluir: boolean) => {
    if (!execId || !execContagem) return;
    const itens = recalcularDivergencias(execItens);
    const patch: Parameters<typeof atualizarContagemCiclica>[1] = { itens };
    if (concluir) {
      patch.status = "concluida";
      patch.dataConclusao = new Date().toISOString();
      // Gera propostas de ajuste preservando status prévio
      patch.ajustes = gerarAjustesPropostos({ ...execContagem, itens });
    }
    atualizarContagemCiclica(execId, patch);
    toast.success(concluir ? "Contagem concluída" : "Contagem salva");
    setExecOpen(false);
    setExecId(null);
    setImportAudit(null);
    reload();
  };

  const fecharExecucao = () => {
    setExecOpen(false);
    setExecId(null);
    setImportAudit(null);
    setFocusAuditoriaId(null);
    setExpandedAudits(new Set());
    setAuditIgnoredFilters({});
  };

  const aplicarAjuste = (insumoId: string, status: "aplicado" | "dispensado" | "pendente") => {
    if (!execId) return;
    const atualizada = marcarAjuste(execId, insumoId, {
      status,
      aplicadoPor: status === "aplicado" ? execContagem?.responsavel : undefined,
    });
    if (atualizada) {
      reload();
      toast.success(
        status === "aplicado"
          ? "Ajuste marcado como aplicado"
          : status === "dispensado"
            ? "Ajuste dispensado"
            : "Ajuste reaberto",
      );
    }
  };

  const exportarXlsx = (c: ContagemCiclica, itens: ItemContagemCiclica[]) => {
    const slug = (s: string) => s.replace(/[^a-zA-Z0-9]+/g, "_").toLowerCase();
    const itensRows = itens.map((it) => {
      const info = insumoInfo.get(it.insumoId);
      return {
        codigo: info?.codigo ?? "",
        descricao: info?.descricao ?? "",
        unidade: info?.unidade ?? "",
        saldo_esperado: it.saldoEsperado ?? 0,
        saldo_contado: it.saldoContado ?? "",
        divergencia: it.divergencia ?? "",
        observacao: it.observacao ?? "",
      };
    });
    const ajustesRows = (c.ajustes ?? []).map((a) => {
      const info = insumoInfo.get(a.insumoId);
      return {
        codigo: info?.codigo ?? "",
        descricao: info?.descricao ?? "",
        unidade: info?.unidade ?? "",
        tipo: a.tipo,
        quantidade: a.quantidade,
        status: STATUS_AJUSTE_LABEL[a.status],
        aplicado_em: a.aplicadoEm ?? "",
        aplicado_por: a.aplicadoPor ?? "",
        observacao: a.observacao ?? "",
      };
    });
    const resumo = [
      { campo: "Local", valor: c.local },
      {
        campo: "Critério",
        valor: CRITERIOS.find((k) => k.value === c.criterio)?.label ?? c.criterio,
      },
      { campo: "Responsável", valor: c.responsavel },
      { campo: "Data planejada", valor: c.dataPlanejada },
      { campo: "Data início", valor: c.dataInicio ?? "" },
      { campo: "Data conclusão", valor: c.dataConclusao ?? "" },
      { campo: "Status", valor: STATUS_LABEL[c.status] },
      { campo: "Itens", valor: itens.length },
      { campo: "Ajustes", valor: (c.ajustes ?? []).length },
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(resumo), "Resumo");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(itensRows), "Itens");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(ajustesRows), "Ajustes");
    XLSX.writeFile(wb, `contagem_${slug(c.local)}_${c.dataPlanejada}.xlsx`);
    toast.success("Contagem exportada");
  };

  const exportarHistoricoAuditorias = (c: ContagemCiclica) => {
    const slug = (s: string) => s.replace(/[^a-zA-Z0-9]+/g, "_").toLowerCase();
    const registros = [...(c.auditoriasImportacao ?? [])].sort((a, b) =>
      a.importadoEm.localeCompare(b.importadoEm),
    );
    if (registros.length === 0) {
      toast.warning("Nenhuma auditoria de importação registrada");
      return;
    }
    const resumo = registros.map((r, i) => ({
      "#": i + 1,
      importado_em: r.importadoEm,
      importado_por: r.importadoPor ?? "",
      arquivo: r.arquivo,
      aba: r.aba,
      linhas: r.linhas,
      linhas_validas: r.linhasValidas,
      aplicados: r.aplicados,
      divergentes: r.divergenciasImportadas,
      sem_divergencia: r.semDivergencia,
      sem_alteracao: r.semAlteracao,
      ignoradas: r.ignoradas.length,
    }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(resumo), "Resumo");
    const usados = new Set<string>(["Resumo"]);
    registros.forEach((r, i) => {
      const stamp = r.importadoEm.replace(/[:.]/g, "-").slice(0, 19);
      let nome = `imp_${String(i + 1).padStart(2, "0")}_${stamp}`.slice(0, 28);
      let dedup = nome;
      let n = 2;
      while (usados.has(dedup)) dedup = `${nome.slice(0, 25)}_${n++}`;
      usados.add(dedup);
      const rows = r.ignoradas.length
        ? r.ignoradas.map((ig) => ({
            linha: ig.linha,
            codigo: ig.codigo,
            motivo: ig.motivo,
          }))
        : [{ linha: "", codigo: "", motivo: "sem linhas ignoradas" }];
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), dedup);
    });
    XLSX.writeFile(wb, `auditorias_${slug(c.local)}_${c.dataPlanejada}.xlsx`);
    toast.success(`${registros.length} auditoria(s) exportada(s)`);
  };

  /** slice-18 — exporta apenas as ignoradas de uma auditoria respeitando o filtro visual. */
  const exportarIgnoradasAuditoria = (
    c: ContagemCiclica,
    auditoria: AuditoriaImportacaoRegistro,
    linhas: LinhaImportacaoIgnorada[],
    filtro: string,
  ) => {
    const slug = (s: string) => s.replace(/[^a-zA-Z0-9]+/g, "_").toLowerCase();
    if (linhas.length === 0) {
      toast.warning("Nenhuma linha ignorada corresponde ao filtro");
      return;
    }
    const meta = [
      { campo: "Contagem", valor: c.local },
      { campo: "Data planejada", valor: c.dataPlanejada },
      { campo: "Importado em", valor: auditoria.importadoEm },
      { campo: "Importado por", valor: auditoria.importadoPor ?? "" },
      { campo: "Arquivo", valor: auditoria.arquivo },
      { campo: "Aba", valor: auditoria.aba },
      { campo: "Filtro aplicado", valor: filtro || "(sem filtro)" },
      { campo: "Total ignoradas", valor: auditoria.ignoradas.length },
      { campo: "Ignoradas exportadas", valor: linhas.length },
    ];
    const rows = linhas.map((ig) => ({ linha: ig.linha, codigo: ig.codigo, motivo: ig.motivo }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(meta), "Contexto");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), "Ignoradas");
    const stamp = auditoria.importadoEm.replace(/[:.]/g, "-").slice(0, 19);
    XLSX.writeFile(wb, `ignoradas_${slug(c.local)}_${stamp}.xlsx`);
    toast.success(`${linhas.length} linha(s) ignorada(s) exportada(s)`);
  };

  const normalizarCabecalho = (s: string) =>
    s
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .toLowerCase();

  const valorLinha = (row: Record<string, unknown>, keys: string[]) => {
    const entries = Object.entries(row).map(([k, v]) => [normalizarCabecalho(k), v] as const);
    for (const key of keys) {
      const found = entries.find(([k]) => k === key);
      if (found) return found[1];
    }
    return undefined;
  };

  const numeroImportado = (value: unknown): number | null => {
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value !== "string") return null;
    const s = value.trim();
    if (!s) return null;
    const normalized = s.replace(/\./g, "").replace(",", ".");
    const n = Number(normalized);
    return Number.isFinite(n) ? n : null;
  };

  const importarXlsx = async (file: File) => {
    if (!execContagem || execContagem.status === "concluida") return;
    try {
      const data = await file.arrayBuffer();
      const wb = XLSX.read(data, { type: "array" });
      const sheetName = wb.SheetNames.find((n) => n.toLowerCase() === "itens") ?? wb.SheetNames[0];
      const sheet = wb.Sheets[sheetName];
      if (!sheet) {
        toast.error("Arquivo XLSX sem abas válidas");
        return;
      }

      const parsed = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
      const saldosPorInsumo = new Map<string, number>();
      const ignoradas: LinhaImportacaoIgnorada[] = [];
      let linhasValidas = 0;

      parsed.forEach((row, idx) => {
        const linha = idx + 2;
        const codigo = String(valorLinha(row, ["codigo", "cod", "insumo_codigo"]) ?? "")
          .trim()
          .toLowerCase();
        const saldo = numeroImportado(
          valorLinha(row, ["saldo_contado", "contado", "quantidade_contada", "qtd_contada"]),
        );
        if (!codigo) {
          ignoradas.push({ linha, codigo: "—", motivo: "sem código" });
          return;
        }
        if (saldo == null) {
          ignoradas.push({ linha, codigo, motivo: "saldo contado inválido" });
          return;
        }
        const insumoId = insumoIdPorCodigo.get(codigo);
        if (!insumoId) {
          ignoradas.push({ linha, codigo, motivo: "código não cadastrado" });
          return;
        }
        saldosPorInsumo.set(insumoId, saldo);
        linhasValidas++;
      });

      if (saldosPorInsumo.size === 0) {
        toast.warning("Nenhuma linha importável encontrada");
        return;
      }

      let aplicados = 0;
      let divergenciasImportadas = 0;
      let semDivergencia = 0;
      let semAlteracao = 0;
      const next = recalcularDivergencias(
        execItens.map((it) => {
          if (!saldosPorInsumo.has(it.insumoId)) return it;
          const saldoContado = saldosPorInsumo.get(it.insumoId)!;
          const changed = it.saldoContado !== saldoContado;
          if (changed) aplicados++;
          else semAlteracao++;
          const divergencia =
            it.saldoEsperado == null ? null : Number((saldoContado - it.saldoEsperado).toFixed(4));
          if (divergencia == null || divergencia === 0) semDivergencia++;
          else divergenciasImportadas++;
          return { ...it, saldoContado };
        }),
      );
      setExecItens(next);
      const auditoria: AuditoriaImportacao = {
        arquivo: file.name,
        aba: sheetName,
        linhas: parsed.length,
        linhasValidas,
        aplicados,
        divergenciasImportadas,
        semDivergencia,
        semAlteracao,
        ignoradas,
      };
      setImportAudit(auditoria);
      // slice-10 — retenção local do histórico de auditorias por contagem
      const registro: AuditoriaImportacaoRegistro = {
        id: `imp_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
        importadoEm: new Date().toISOString(),
        importadoPor: execContagem.responsavel,
        ...auditoria,
      };
      const historico = [...(execContagem.auditoriasImportacao ?? []), registro];
      atualizarContagemCiclica(execContagem.id, { auditoriasImportacao: historico });
      reload();
      toast.success(`${aplicados} saldo(s) importado(s) de ${linhasValidas} linha(s) válida(s)`);
    } catch {
      toast.error("Falha ao importar XLSX");
    }
  };

  const metricas = useMemo(() => calcularMetricas(rows), [rows]);
  const porLocal = useMemo(() => metricasPorLocal(rows), [rows]);

  // slice-13 — filtros por local + drilldown por motivo de ignorada
  const [filtroLocalImp, setFiltroLocalImp] = useState<string>("__all__");
  const [motivoDrill, setMotivoDrill] = useState<string | null>(null);
  const locaisComImportacao = useMemo(() => {
    const set = new Set<string>();
    for (const c of rows) {
      if ((c.auditoriasImportacao?.length ?? 0) > 0) set.add(c.local);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [rows]);
  const rowsImpFiltrados = useMemo(
    () => (filtroLocalImp === "__all__" ? rows : rows.filter((c) => c.local === filtroLocalImp)),
    [rows, filtroLocalImp],
  );
  const metricasImp = useMemo(
    () => calcularMetricasImportacoes(rowsImpFiltrados),
    [rowsImpFiltrados],
  );
  const drilldownContagens = useMemo(() => {
    if (!motivoDrill) return [];
    const linhas: {
      contagemId: string;
      auditoriaId: string;
      local: string;
      dataPlanejada: string;
      arquivo: string;
      importadoEm: string;
      total: number;
    }[] = [];
    for (const c of rowsImpFiltrados) {
      for (const r of c.auditoriasImportacao ?? []) {
        const total = r.ignoradas.filter((ig) => ig.motivo === motivoDrill).length;
        if (total > 0) {
          linhas.push({
            contagemId: c.id,
            auditoriaId: r.id,
            local: c.local,
            dataPlanejada: c.dataPlanejada,
            arquivo: r.arquivo,
            importadoEm: r.importadoEm,
            total,
          });
        }
      }
    }
    return linhas.sort((a, b) => b.importadoEm.localeCompare(a.importadoEm));
  }, [rowsImpFiltrados, motivoDrill]);

  /** slice-21 — tendência das últimas N=10 importações por motivo (top 3). */
  const tendenciasPorMotivo = useMemo(() => {
    const N = 10;
    const auditorias: { importadoEm: string; motivos: Map<string, number> }[] = [];
    for (const c of rowsImpFiltrados) {
      for (const r of c.auditoriasImportacao ?? []) {
        const motivos = new Map<string, number>();
        for (const ig of r.ignoradas) {
          motivos.set(ig.motivo, (motivos.get(ig.motivo) ?? 0) + 1);
        }
        auditorias.push({ importadoEm: r.importadoEm, motivos });
      }
    }
    auditorias.sort((a, b) => a.importadoEm.localeCompare(b.importadoEm));
    const ultimas = auditorias.slice(-N);
    const out = new Map<string, number[]>();
    for (const m of metricasImp.ignoradasPorMotivo.slice(0, 3)) {
      out.set(
        m.motivo,
        ultimas.map((a) => a.motivos.get(m.motivo) ?? 0),
      );
    }
    return { serie: out, amostras: ultimas.length };
  }, [rowsImpFiltrados, metricasImp.ignoradasPorMotivo]);

  const fmtPct = (n: number) => `${(n * 100).toFixed(1)}%`;

  // slice-23 — pré-cálculo de tendência (série últimas 10) + total + delta por contagem.
  const rowsTendencia = useMemo(() => {
    return rows.map((c) => {
      const auds = [...(c.auditoriasImportacao ?? [])]
        .sort((a, b) => a.importadoEm.localeCompare(b.importadoEm))
        .slice(-10);
      const serie = auds.map((a) => a.ignoradas.length);
      const total = serie.reduce((s, n) => s + n, 0);
      const delta = serie.length >= 2 ? serie[serie.length - 1] - serie[0] : 0;
      return { c, serie, total, delta };
    });
  }, [rows]);

  const rowsOrdenadas = useMemo(() => {
    if (!sortIgn) return rowsTendencia;
    const mult = sortIgn.dir === "asc" ? 1 : -1;
    return [...rowsTendencia].sort((a, b) => mult * (a[sortIgn.key] - b[sortIgn.key]));
  }, [rowsTendencia, sortIgn]);

  const rowsExibidas = useMemo(
    () =>
      apenasPiora ? rowsOrdenadas.filter((r) => r.serie.length >= 2 && r.delta > 0) : rowsOrdenadas,
    [rowsOrdenadas, apenasPiora],
  );
  const resumoTendencia = useMemo(() => {
    let piora = 0;
    let melhora = 0;
    let estavel = 0;
    for (const r of rowsTendencia) {
      if (r.serie.length < 2) continue;
      if (r.delta > 0) piora++;
      else if (r.delta < 0) melhora++;
      else estavel++;
    }
    return { piora, melhora, estavel, total: piora + melhora + estavel };
  }, [rowsTendencia]);
  // slice-34 — reuso de TrendSummary com recorte de 28 dias.
  const resumoTendencia28d = useMemo(() => {
    const limite = Date.now() - 28 * 24 * 60 * 60 * 1000;
    let piora = 0;
    let melhora = 0;
    let estavel = 0;
    for (const r of rowsTendencia) {
      if (r.serie.length < 2) continue;
      const ts = new Date(r.c.dataPlanejada).getTime();
      if (!Number.isFinite(ts) || ts < limite) continue;
      if (r.delta > 0) piora++;
      else if (r.delta < 0) melhora++;
      else estavel++;
    }
    return { piora, melhora, estavel, total: piora + melhora + estavel };
  }, [rowsTendencia]);
  const totalPiora = resumoTendencia.piora;
  const temPreferenciaTabela = Boolean(sortIgn || apenasPiora);

  const limparPreferenciasTabela = () => {
    setSortIgn(null);
    setApenasPiora(false);
  };

  const cycleSort = (key: "delta" | "total") => {
    setSortIgn((prev) => {
      if (!prev || prev.key !== key) return { key, dir: "desc" };
      if (prev.dir === "desc") return { key, dir: "asc" };
      return null;
    });
  };
  const sortIcon = (key: "delta" | "total") => {
    if (sortIgn?.key !== key) return <ArrowUpDown className="h-3 w-3" />;
    return sortIgn.dir === "desc" ? (
      <ArrowDown className="h-3 w-3" />
    ) : (
      <ArrowUp className="h-3 w-3" />
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h2 className="font-display text-xl font-bold flex items-center gap-2">
            <ClipboardList className="h-5 w-5" /> Contagens Cíclicas
          </h2>
          <p className="text-xs text-muted-foreground">
            Planos de contagem por local e critério (Curva ABC, amostra ou manual).
          </p>
        </div>
        <Button size="sm" onClick={() => setDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-1" /> Nova contagem
        </Button>
      </div>

      {rows.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <div className="rounded-md border p-3">
            <p className="text-[11px] uppercase text-muted-foreground">Acurácia</p>
            <p className="text-xl font-bold tabular-nums">{fmtPct(metricas.acuracia)}</p>
            <p className="text-[11px] text-muted-foreground">
              {metricas.itensSemDivergencia}/{metricas.itensContados} itens sem divergência
            </p>
          </div>
          <div className="rounded-md border p-3">
            <p className="text-[11px] uppercase text-muted-foreground">Planos</p>
            <p className="text-xl font-bold tabular-nums">{metricas.totalPlanos}</p>
            <p className="text-[11px] text-muted-foreground">
              {metricas.concluidas} concl. · {metricas.emAndamento} em and. · {metricas.planejadas}{" "}
              plan.
            </p>
          </div>
          <div className="rounded-md border p-3">
            <p className="text-[11px] uppercase text-muted-foreground">Ajustes pendentes</p>
            <p className="text-xl font-bold tabular-nums text-destructive">
              {metricas.ajustesPendentes}
            </p>
            <p className="text-[11px] text-muted-foreground">
              {metricas.ajustesAplicados} aplicados no total
            </p>
          </div>
          <div className="rounded-md border p-3">
            <p className="text-[11px] uppercase text-muted-foreground">Itens contados</p>
            <p className="text-xl font-bold tabular-nums">{metricas.itensContados}</p>
            <p className="text-[11px] text-muted-foreground">soma de todos os planos</p>
          </div>
        </div>
      )}

      {locaisComImportacao.length > 0 && (
        <div className="rounded-md border">
          <div className="flex flex-wrap items-center justify-between gap-2 p-2 bg-muted/40">
            <div>
              <p className="text-xs font-semibold uppercase text-muted-foreground">
                Qualidade das importações XLSX
              </p>
              <p className="text-[11px] text-muted-foreground">
                {metricasImp.totalImportacoes} importação(ões) em{" "}
                {metricasImp.contagensComImportacao} contagem(ns)
                {metricasImp.ultimaImportacaoEm
                  ? ` · última em ${fmtDataLocal(metricasImp.ultimaImportacaoEm)}`
                  : ""}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Label className="text-[11px] text-muted-foreground">Local</Label>
              <Select
                value={filtroLocalImp}
                onValueChange={(v) => {
                  setFiltroLocalImp(v);
                  setMotivoDrill(null);
                }}
              >
                <SelectTrigger className="h-8 w-[220px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">Todos os locais</SelectItem>
                  {locaisComImportacao.map((l) => (
                    <SelectItem key={l} value={l}>
                      {l}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          {metricasImp.totalImportacoes === 0 ? (
            <div className="p-3 text-xs text-muted-foreground">
              Nenhuma importação para o local selecionado.
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-2 p-2">
                <div className="rounded-md border p-2">
                  <p className="text-[11px] uppercase text-muted-foreground">Taxa de aplicação</p>
                  <p className="text-lg font-bold tabular-nums">
                    {fmtPct(metricasImp.taxaAplicacao)}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {metricasImp.totalAplicados}/{metricasImp.totalLinhasValidas} válidas
                  </p>
                </div>
                <div className="rounded-md border p-2">
                  <p className="text-[11px] uppercase text-muted-foreground">Linhas válidas</p>
                  <p className="text-lg font-bold tabular-nums">
                    {fmtPct(metricasImp.taxaValidas)}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {metricasImp.totalLinhasValidas}/{metricasImp.totalLinhas} linhas
                  </p>
                </div>
                <div className="rounded-md border p-2">
                  <p className="text-[11px] uppercase text-muted-foreground">Divergentes</p>
                  <p className="text-lg font-bold tabular-nums text-destructive">
                    {metricasImp.totalDivergentes}
                  </p>
                  <p className="text-[11px] text-muted-foreground">soma de todas as importações</p>
                </div>
                <div className="rounded-md border p-2">
                  <p className="text-[11px] uppercase text-muted-foreground">Ignoradas</p>
                  <p className="text-lg font-bold tabular-nums">{metricasImp.totalIgnoradas}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {metricasImp.ignoradasPorMotivo.length} motivo(s)
                  </p>
                  {/* slice-20 — top 3 motivos com atalho para drilldown. */}
                  {metricasImp.ignoradasPorMotivo.length > 0 && (
                    <div className="mt-1 space-y-1">
                      {metricasImp.ignoradasPorMotivo.slice(0, 3).map((m) => {
                        const active = motivoDrill === m.motivo;
                        const serie = tendenciasPorMotivo.serie.get(m.motivo) ?? [];
                        return (
                          <div key={`top-${m.motivo}`} className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => setMotivoDrill(active ? null : m.motivo)}
                              className="focus:outline-none"
                              title={`Drilldown por "${m.motivo}"`}
                              aria-pressed={active}
                            >
                              <Badge
                                variant={active ? "default" : "secondary"}
                                className="text-[10px] cursor-pointer"
                              >
                                {m.motivo}
                                <span className="ml-1 tabular-nums font-semibold">{m.total}</span>
                              </Badge>
                            </button>
                            <Sparkline
                              values={serie}
                              className="text-primary"
                              ariaLabel={`Tendência últimas ${serie.length} importações do motivo ${m.motivo}`}
                            />
                          </div>
                        );
                      })}
                      {metricasImp.ignoradasPorMotivo.length > 3 && (
                        <Badge variant="outline" className="text-[10px]">
                          +{metricasImp.ignoradasPorMotivo.length - 3} motivos
                        </Badge>
                      )}
                      {tendenciasPorMotivo.amostras > 0 && (
                        <p className="text-[10px] text-muted-foreground">
                          últimas {tendenciasPorMotivo.amostras} importação(ões)
                        </p>
                      )}
                    </div>
                  )}
                </div>

                <div className="rounded-md border p-2">
                  <p className="text-[11px] uppercase text-muted-foreground">Linhas processadas</p>
                  <p className="text-lg font-bold tabular-nums">{metricasImp.totalLinhas}</p>
                  <p className="text-[11px] text-muted-foreground">todas as abas</p>
                </div>
              </div>
              {metricasImp.ignoradasPorMotivo.length > 0 && (
                <div className="border-t p-2">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-[11px] uppercase text-muted-foreground">
                      Ignoradas por motivo {motivoDrill ? "· filtrado" : "· clique para detalhar"}
                    </p>
                    {motivoDrill && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 text-[11px]"
                        onClick={() => setMotivoDrill(null)}
                      >
                        limpar drilldown
                      </Button>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {metricasImp.ignoradasPorMotivo.map((m) => {
                      const active = motivoDrill === m.motivo;
                      return (
                        <button
                          key={m.motivo}
                          type="button"
                          onClick={() => setMotivoDrill(active ? null : m.motivo)}
                          className="focus:outline-none"
                        >
                          <Badge
                            variant={active ? "default" : "outline"}
                            className="text-[11px] cursor-pointer"
                          >
                            {m.motivo}:{" "}
                            <span className="ml-1 tabular-nums font-semibold">{m.total}</span>
                          </Badge>
                        </button>
                      );
                    })}
                  </div>
                  {motivoDrill && (
                    <div className="mt-2 max-h-48 overflow-auto rounded-md border">
                      <table className="w-full text-xs">
                        <thead className="bg-muted/40 text-muted-foreground">
                          <tr>
                            <th className="p-2 text-left">Local</th>
                            <th className="p-2 text-left">Data plan.</th>
                            <th className="p-2 text-left">Importado em</th>
                            <th className="p-2 text-left">Arquivo</th>
                            <th className="p-2 text-right">Ignoradas</th>
                          </tr>
                        </thead>
                        <tbody>
                          {drilldownContagens.length === 0 ? (
                            <tr>
                              <td colSpan={5} className="p-3 text-center text-muted-foreground">
                                Sem ocorrências para "{motivoDrill}".
                              </td>
                            </tr>
                          ) : (
                            drilldownContagens.map((d, i) => {
                              const contagem = rows.find((c) => c.id === d.contagemId);
                              const abrir = () => {
                                if (contagem) void abrirExecucao(contagem, d.auditoriaId);
                              };
                              return (
                                <tr
                                  key={`${d.contagemId}-${d.importadoEm}-${i}`}
                                  className="border-t cursor-pointer hover:bg-muted/40 focus:bg-muted/50 focus:outline-none"
                                  tabIndex={0}
                                  role="button"
                                  title="Abrir contagem para revisar linhas ignoradas"
                                  onClick={abrir}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter" || e.key === " ") {
                                      e.preventDefault();
                                      abrir();
                                    }
                                  }}
                                >
                                  <td className="p-2">{d.local}</td>
                                  <td className="p-2 tabular-nums">{d.dataPlanejada}</td>
                                  <td className="p-2 tabular-nums">
                                    {fmtDataLocal(d.importadoEm)}
                                  </td>
                                  <td className="p-2">
                                    <div className="truncate max-w-[240px]" title={d.arquivo}>
                                      {d.arquivo}
                                    </div>
                                  </td>
                                  <td className="p-2 text-right tabular-nums">{d.total}</td>
                                </tr>
                              );
                            })
                          )}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {porLocal.length > 1 && (
        <div className="rounded-md border">
          <div className="p-2 bg-muted/40 text-xs font-semibold uppercase text-muted-foreground">
            Por local
          </div>
          <div className="w-full overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="p-2 text-left">Local</th>
                  <th className="p-2 text-right">Planos</th>
                  <th className="p-2 text-right">Contados</th>
                  <th className="p-2 text-right">Acurácia</th>
                  <th className="p-2 text-right">Ajustes pend.</th>
                  <th className="p-2 text-left">Última conclusão</th>
                </tr>
              </thead>
              <tbody>
                {porLocal.map((l) => (
                  <tr key={l.local} className="border-t">
                    <td className="p-2">{l.local}</td>
                    <td className="p-2 text-right tabular-nums">{l.planos}</td>
                    <td className="p-2 text-right tabular-nums">{l.itensContados}</td>
                    <td className="p-2 text-right tabular-nums">{fmtPct(l.acuracia)}</td>
                    <td
                      className={`p-2 text-right tabular-nums ${l.ajustesPendentes > 0 ? "text-destructive" : ""}`}
                    >
                      {l.ajustesPendentes}
                    </td>
                    <td className="p-2">
                      {l.ultimaConclusao ? fmtDataLocal(l.ultimaConclusao) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {rows.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title="Nenhuma contagem cíclica"
          description="Crie um plano para começar a contar itens periodicamente e detectar divergências de saldo."
        />
      ) : (
        <>
          {/* slice-30/31/32 — resumo de tendência via componente reutilizável. */}
          <TrendSummary
            piora={resumoTendencia.piora}
            estavel={resumoTendencia.estavel}
            melhora={resumoTendencia.melhora}
            totalLabel="com histórico"
            onTogglePiora={() => setApenasPiora((v) => !v)}
            piorAtiva={apenasPiora}
          />
          {/* slice-34 — segundo recorte (últimos 28 dias) reaproveitando o mesmo componente, sem toggle. */}
          <TrendSummary
            label="Últimas 4 semanas"
            showWhenEmpty
            totalLabel="planejadas"
            piora={resumoTendencia28d.piora}
            estavel={resumoTendencia28d.estavel}
            melhora={resumoTendencia28d.melhora}
          />
          {/* slice-25 — filtro rápido "somente em piora". */}
          <div className="flex items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2">
              <Button
                type="button"
                size="sm"
                variant={apenasPiora ? "default" : "outline"}
                onClick={() => setApenasPiora((v) => !v)}
                aria-pressed={apenasPiora}
                title="Exibir apenas contagens cuja série de ignoradas está em piora"
                disabled={!apenasPiora && totalPiora === 0}
              >
                <ArrowUp className="h-3.5 w-3.5 mr-1" />
                Somente em piora
                <span className="ml-1 tabular-nums opacity-80">({totalPiora})</span>
              </Button>
              {temPreferenciaTabela && (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={limparPreferenciasTabela}
                  title="Limpar filtro e ordenação da tabela"
                >
                  <XCircle className="h-3.5 w-3.5 mr-1" />
                  Limpar
                </Button>
              )}
            </div>
            <span className="text-muted-foreground tabular-nums">
              {rowsExibidas.length} de {rowsTendencia.length}
            </span>
          </div>
          <div className="rounded-md border">
            <div className="w-full overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="p-2 text-left">Local</th>
                    <th className="p-2 text-left">Critério</th>
                    <th className="p-2 text-left">Responsável</th>
                    <th className="p-2 text-left">Planejada</th>
                    <th className="p-2 text-left">Itens</th>
                    <th className="p-2 text-left">Status</th>
                    <th className="p-2 text-left" title="Tendência das últimas 10 importações">
                      <div className="flex items-center gap-2">
                        <span>Tendência ign.</span>
                        <button
                          type="button"
                          onClick={() => cycleSort("delta")}
                          className="inline-flex items-center gap-0.5 rounded px-1 py-0.5 text-[10px] normal-case hover:bg-muted"
                          title="Ordenar por tendência (último − primeiro)"
                          aria-label="Ordenar por tendência"
                          aria-pressed={sortIgn?.key === "delta"}
                        >
                          Δ {sortIcon("delta")}
                        </button>
                        <button
                          type="button"
                          onClick={() => cycleSort("total")}
                          className="inline-flex items-center gap-0.5 rounded px-1 py-0.5 text-[10px] normal-case hover:bg-muted"
                          title="Ordenar por total de ignoradas"
                          aria-label="Ordenar por total de ignoradas"
                          aria-pressed={sortIgn?.key === "total"}
                        >
                          Σ {sortIcon("total")}
                        </button>
                      </div>
                    </th>
                    <th className="p-2 text-right">Ação</th>
                  </tr>
                </thead>
                <tbody>
                  {rowsExibidas.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="p-6 text-center text-sm text-muted-foreground">
                        {apenasPiora
                          ? "Nenhuma contagem em piora no momento. Ajuste o filtro para ver mais registros."
                          : "Nenhum registro corresponde aos critérios atuais."}
                        <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
                          {apenasPiora && rowsOrdenadas.length > 0 && (
                            <Button
                              type="button"
                              size="sm"
                              variant="secondary"
                              onClick={() => setApenasPiora(false)}
                              title="Remover apenas o filtro 'Somente em piora'"
                            >
                              <ArrowUpDown className="h-3.5 w-3.5 mr-1" />
                              Desativar filtro "Somente em piora"
                            </Button>
                          )}
                          {temPreferenciaTabela && (
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={limparPreferenciasTabela}
                            >
                              <XCircle className="h-3.5 w-3.5 mr-1" />
                              Limpar filtros e ordenação
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ) : (
                    rowsExibidas.map(({ c, serie, total, delta }) => (
                      <tr key={c.id} className="border-t">
                        <td className="p-2">{c.local}</td>
                        <td className="p-2">
                          {CRITERIOS.find((k) => k.value === c.criterio)?.label ?? c.criterio}
                        </td>
                        <td className="p-2">{c.responsavel}</td>
                        <td className="p-2">{fmtDataLocal(c.dataPlanejada)}</td>
                        <td className="p-2">{c.itens.length}</td>
                        <td className="p-2">
                          <Badge variant="outline">{STATUS_LABEL[c.status]}</Badge>
                        </td>
                        {/* slice-22 sparkline · slice-23 pré-cálculo · slice-24 badge de direção. */}
                        <td className="p-2">
                          {serie.length === 0 ? (
                            <span className="text-[11px] text-muted-foreground">—</span>
                          ) : (
                            <div className="flex items-center gap-2">
                              <Sparkline
                                values={serie}
                                className={
                                  total === 0 ? "text-muted-foreground" : "text-destructive"
                                }
                                ariaLabel={`Tendência de ignoradas nas últimas ${serie.length} importações`}
                              />
                              <span className="text-[11px] tabular-nums text-muted-foreground">
                                {total}
                              </span>
                              {serie.length >= 2 && (
                                <span
                                  className={
                                    "inline-flex items-center gap-0.5 rounded px-1 py-0.5 text-[10px] tabular-nums " +
                                    (delta > 0
                                      ? "bg-destructive/10 text-destructive"
                                      : delta < 0
                                        ? "bg-success/10 text-success"
                                        : "bg-muted text-muted-foreground")
                                  }
                                  title={
                                    delta > 0
                                      ? "Piora: mais ignoradas na última importação que no início da série"
                                      : delta < 0
                                        ? "Melhora: menos ignoradas na última importação que no início da série"
                                        : "Estável no intervalo observado"
                                  }
                                  aria-label={`Variação ${delta > 0 ? "de piora" : delta < 0 ? "de melhora" : "estável"}: ${delta > 0 ? "+" : ""}${delta}`}
                                >
                                  {delta > 0 ? (
                                    <ArrowUp className="h-3 w-3" />
                                  ) : delta < 0 ? (
                                    <ArrowDown className="h-3 w-3" />
                                  ) : (
                                    <ArrowUpDown className="h-3 w-3" />
                                  )}
                                  {delta > 0 ? `+${delta}` : delta}
                                </span>
                              )}
                            </div>
                          )}
                        </td>

                        <td className="p-2 text-right">
                          {c.status !== "cancelada" && (
                            <Button
                              size="sm"
                              variant={c.status === "concluida" ? "outline" : "default"}
                              onClick={() => abrirExecucao(c)}
                            >
                              {c.status === "planejada" ? (
                                <>
                                  <Play className="h-3.5 w-3.5 mr-1" /> Iniciar
                                </>
                              ) : c.status === "em_andamento" ? (
                                <>
                                  <Play className="h-3.5 w-3.5 mr-1" /> Continuar
                                </>
                              ) : (
                                "Ver"
                              )}
                            </Button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova contagem cíclica</DialogTitle>
            <DialogDescription>
              Registre o plano. A execução (itens contados e ajustes) será feita em uma etapa
              seguinte.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label htmlFor="cc-local">Local</Label>
              <Input
                id="cc-local"
                value={local}
                onChange={(e) => setLocal(e.target.value)}
                placeholder="Ex.: Almox. Obra Alfa"
              />
            </div>
            <div>
              <Label>Critério</Label>
              <Select
                value={criterio}
                onValueChange={(v) => setCriterio(v as ContagemCiclica["criterio"])}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CRITERIOS.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="cc-resp">Responsável</Label>
              <Input
                id="cc-resp"
                value={responsavel}
                onChange={(e) => setResponsavel(e.target.value)}
                placeholder="Login ou nome"
              />
            </div>
            <div>
              <Label htmlFor="cc-data">Data planejada</Label>
              <DatePickerField
                id="cc-data"
                value={dataPlanejada}
                onChange={(v) => setDataPlanejada(v)}
              />
            </div>

            {criterio === "amostra" && (
              <div>
                <Label htmlFor="cc-pct">% da amostra (do total no local)</Label>
                <Input
                  id="cc-pct"
                  type="number"
                  min={1}
                  max={100}
                  step={1}
                  value={amostraPct}
                  onChange={(e) => setAmostraPct(Number(e.target.value))}
                />
                <p className="text-[11px] text-muted-foreground mt-1">
                  Amostragem reproduzível a partir do id da contagem.
                </p>
              </div>
            )}

            {criterio === "manual" && (
              <div>
                <Label>Insumos ({insumosSel.length} selecionados)</Label>
                <Input
                  placeholder="Buscar por código ou descrição…"
                  value={insumoSearch}
                  onChange={(e) => setInsumoSearch(e.target.value)}
                  className="mb-2"
                />
                <div className="max-h-48 overflow-auto rounded-md border">
                  {insumosFiltrados.length === 0 ? (
                    <p className="p-3 text-xs text-muted-foreground">Nenhum insumo encontrado.</p>
                  ) : (
                    <ul className="text-sm">
                      {insumosFiltrados.map((i) => {
                        const checked = insumosSel.includes(i.id);
                        return (
                          <li
                            key={i.id}
                            className="flex items-center gap-2 px-2 py-1 hover:bg-accent cursor-pointer"
                            onClick={() =>
                              setInsumosSel((prev) =>
                                checked ? prev.filter((x) => x !== i.id) : [...prev, i.id],
                              )
                            }
                          >
                            <input type="checkbox" readOnly checked={checked} />
                            <span className="font-mono text-[11px] text-muted-foreground">
                              {i.codigo}
                            </span>
                            <span className="truncate">{i.descricao}</span>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={criar} disabled={!canCreate}>
              Criar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={execOpen}
        onOpenChange={(v) => {
          if (!v) fecharExecucao();
        }}
      >
        <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>
              Contagem — {execContagem?.local}
              {execContagem && (
                <Badge variant="outline" className="ml-2">
                  {STATUS_LABEL[execContagem.status]}
                </Badge>
              )}
            </DialogTitle>
            <DialogDescription>
              Saldo esperado congelado no início da contagem. Lance o saldo contado para calcular a
              divergência.
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-auto rounded-md border">
            {execLoading ? (
              <p className="p-4 text-sm text-muted-foreground">Carregando saldos…</p>
            ) : execItens.length === 0 ? (
              <p className="p-4 text-sm text-muted-foreground">
                Nenhum saldo encontrado para o local "{execContagem?.local}".
              </p>
            ) : (
              <div className="w-full overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/40 text-xs uppercase text-muted-foreground sticky top-0">
                    <tr>
                      <th className="p-2 text-left">Insumo</th>
                      <th className="p-2 text-right">Esperado</th>
                      <th className="p-2 text-right w-32">Contado</th>
                      <th className="p-2 text-right">Divergência</th>
                    </tr>
                  </thead>
                  <tbody>
                    {execItens.map((it) => {
                      const info = insumoInfo.get(it.insumoId);
                      const div = it.divergencia;
                      return (
                        <tr key={it.insumoId} className="border-t">
                          <td className="p-2">
                            <div className="font-mono text-[11px] text-muted-foreground">
                              {info?.codigo ?? it.insumoId.slice(0, 8)}
                            </div>
                            <div>{info?.descricao ?? "—"}</div>
                          </td>
                          <td className="p-2 text-right tabular-nums">
                            {it.saldoEsperado ?? 0} {info?.unidade ?? ""}
                          </td>
                          <td className="p-2 text-right">
                            <Input
                              type="number"
                              step="any"
                              disabled={execContagem?.status === "concluida"}
                              value={it.saldoContado ?? ""}
                              onChange={(e) => setContado(it.insumoId, e.target.value)}
                              className="h-8 text-right"
                            />
                          </td>
                          <td
                            className={`p-2 text-right tabular-nums ${
                              div == null
                                ? "text-muted-foreground"
                                : div === 0
                                  ? "text-success"
                                  : "text-destructive"
                            }`}
                          >
                            {div == null ? "—" : div > 0 ? `+${div}` : div}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {importAudit && (
            <div className="mt-3 rounded-md border bg-muted/30 p-3 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-semibold">Auditoria da importação XLSX</p>
                  <p className="text-xs text-muted-foreground">
                    {importAudit.arquivo} · aba {importAudit.aba}
                  </p>
                </div>
                <Badge variant="outline">pré-salvamento</Badge>
              </div>
              <div className="mt-2 grid grid-cols-2 md:grid-cols-5 gap-2 text-xs">
                <div className="rounded-md border bg-background p-2">
                  <p className="text-muted-foreground">Linhas</p>
                  <p className="font-semibold tabular-nums">{importAudit.linhas}</p>
                </div>
                <div className="rounded-md border bg-background p-2">
                  <p className="text-muted-foreground">Válidas</p>
                  <p className="font-semibold tabular-nums">{importAudit.linhasValidas}</p>
                </div>
                <div className="rounded-md border bg-background p-2">
                  <p className="text-muted-foreground">Aplicadas</p>
                  <p className="font-semibold tabular-nums">{importAudit.aplicados}</p>
                </div>
                <div className="rounded-md border bg-background p-2">
                  <p className="text-muted-foreground">Divergentes</p>
                  <p className="font-semibold tabular-nums text-destructive">
                    {importAudit.divergenciasImportadas}
                  </p>
                </div>
                <div className="rounded-md border bg-background p-2">
                  <p className="text-muted-foreground">Ignoradas</p>
                  <p className="font-semibold tabular-nums">{importAudit.ignoradas.length}</p>
                </div>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                {importAudit.semDivergencia} item(ns) sem divergência e {importAudit.semAlteracao}{" "}
                sem alteração de valor.
              </p>
              {importAudit.ignoradas.length > 0 && (
                <div className="mt-2 max-h-24 overflow-auto rounded-md border bg-background">
                  <table className="w-full text-xs">
                    <thead className="bg-muted/40 text-muted-foreground">
                      <tr>
                        <th className="p-1 text-left">Linha</th>
                        <th className="p-1 text-left">Código</th>
                        <th className="p-1 text-left">Motivo</th>
                      </tr>
                    </thead>
                    <tbody>
                      {importAudit.ignoradas.slice(0, 20).map((r) => (
                        <tr key={`${r.linha}-${r.codigo}-${r.motivo}`} className="border-t">
                          <td className="p-1 tabular-nums">{r.linha}</td>
                          <td className="p-1 font-mono">{r.codigo}</td>
                          <td className="p-1">{r.motivo}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {execContagem && (execContagem.auditoriasImportacao?.length ?? 0) > 0 && (
            <div className="mt-3 rounded-md border">
              <div className="flex items-center justify-between p-2 bg-muted/40">
                <p className="text-xs font-semibold uppercase text-muted-foreground">
                  Histórico de importações XLSX ({execContagem.auditoriasImportacao!.length})
                </p>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-muted-foreground">retenção local</span>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => exportarHistoricoAuditorias(execContagem)}
                  >
                    <Download className="h-3 w-3 mr-1" /> Exportar histórico
                  </Button>
                </div>
              </div>
              <div className="max-h-48 overflow-auto">
                <table className="w-full text-xs">
                  <thead className="bg-muted/20 text-muted-foreground">
                    <tr>
                      <th className="p-2 w-6"></th>
                      <th className="p-2 text-left">Quando</th>
                      <th className="p-2 text-left">Arquivo · aba</th>
                      <th className="p-2 text-left">Por</th>
                      <th className="p-2 text-right">Linhas</th>
                      <th className="p-2 text-right">Válidas</th>
                      <th className="p-2 text-right">Aplicadas</th>
                      <th className="p-2 text-right">Divergentes</th>
                      <th className="p-2 text-right">Ignoradas</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...execContagem.auditoriasImportacao!]
                      .sort((a, b) => b.importadoEm.localeCompare(a.importadoEm))
                      .map((r) => {
                        const isOpen = expandedAudits.has(r.id);
                        const canExpand = r.ignoradas.length > 0;
                        const filterValue = auditIgnoredFilters[r.id] ?? "";
                        const filterTerm = normalizarTextoBusca(filterValue.trim());
                        const motivosAuditoria = contarIgnoradasPorMotivo(r.ignoradas);
                        const ignoradasFiltradas = filterTerm
                          ? r.ignoradas.filter((ig) =>
                              normalizarTextoBusca(`${ig.codigo} ${ig.motivo}`).includes(
                                filterTerm,
                              ),
                            )
                          : r.ignoradas;
                        return (
                          <Fragment key={r.id}>
                            <tr
                              key={r.id}
                              data-audit-id={r.id}
                              className={`border-t transition-colors ${
                                focusAuditoriaId === r.id
                                  ? "bg-primary/10 ring-1 ring-primary/40"
                                  : ""
                              }`}
                            >
                              <td className="p-1 text-center">
                                {canExpand ? (
                                  <button
                                    type="button"
                                    onClick={() => toggleExpandAudit(r.id)}
                                    className="inline-flex h-5 w-5 items-center justify-center rounded hover:bg-muted focus:outline-none focus:ring-1 focus:ring-primary"
                                    aria-label={
                                      isOpen ? "Recolher ignoradas" : "Expandir ignoradas"
                                    }
                                    aria-expanded={isOpen}
                                  >
                                    {isOpen ? (
                                      <ChevronDown className="h-3 w-3" />
                                    ) : (
                                      <ChevronRight className="h-3 w-3" />
                                    )}
                                  </button>
                                ) : null}
                              </td>
                              <td className="p-2 tabular-nums">{fmtDataLocal(r.importadoEm)}</td>
                              <td className="p-2">
                                <div className="truncate max-w-[200px]" title={r.arquivo}>
                                  {r.arquivo}
                                </div>
                                <div className="text-[10px] text-muted-foreground">{r.aba}</div>
                              </td>
                              <td className="p-2">{r.importadoPor ?? "—"}</td>
                              <td className="p-2 text-right tabular-nums">{r.linhas}</td>
                              <td className="p-2 text-right tabular-nums">{r.linhasValidas}</td>
                              <td className="p-2 text-right tabular-nums">{r.aplicados}</td>
                              <td className="p-2 text-right tabular-nums text-destructive">
                                {r.divergenciasImportadas}
                              </td>
                              <td className="p-2 text-right tabular-nums">{r.ignoradas.length}</td>
                            </tr>
                            {isOpen && canExpand && (
                              <tr key={`${r.id}-detalhe`} className="border-t bg-muted/20">
                                <td></td>
                                <td colSpan={8} className="p-2">
                                  <div className="space-y-2">
                                    <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                                      <div className="flex flex-wrap gap-1">
                                        {motivosAuditoria.map((m) => (
                                          <Badge
                                            key={`${r.id}-${m.motivo}`}
                                            variant="outline"
                                            className="text-[10px]"
                                          >
                                            {m.motivo}:{" "}
                                            <span className="ml-1 tabular-nums">{m.total}</span>
                                          </Badge>
                                        ))}
                                      </div>
                                      <div className="flex w-full items-center gap-2 md:w-auto">
                                        <div className="relative w-full md:w-64">
                                          <Search className="absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
                                          <Input
                                            value={filterValue}
                                            onChange={(e) =>
                                              setAuditIgnoredFilter(r.id, e.target.value)
                                            }
                                            placeholder="Filtrar código ou motivo"
                                            className="h-7 pl-7 text-xs"
                                            aria-label="Filtrar linhas ignoradas por código ou motivo"
                                          />
                                        </div>
                                        <Button
                                          type="button"
                                          size="sm"
                                          variant="outline"
                                          className="h-7 gap-1 px-2 text-[11px]"
                                          onClick={() =>
                                            exportarIgnoradasAuditoria(
                                              execContagem!,
                                              r,
                                              ignoradasFiltradas,
                                              filterTerm,
                                            )
                                          }
                                          disabled={ignoradasFiltradas.length === 0}
                                          aria-label="Exportar linhas ignoradas filtradas"
                                          title={
                                            filterTerm
                                              ? `Exportar ${ignoradasFiltradas.length} linha(s) filtrada(s)`
                                              : `Exportar todas as ${ignoradasFiltradas.length} ignoradas`
                                          }
                                        >
                                          <Download className="h-3 w-3" />
                                          Exportar
                                          <span className="tabular-nums">
                                            ({ignoradasFiltradas.length})
                                          </span>
                                        </Button>
                                      </div>
                                    </div>
                                    <div className="max-h-40 overflow-auto rounded border bg-background">
                                      <table className="w-full text-[11px]">
                                        <thead className="bg-muted/40 text-muted-foreground">
                                          <tr>
                                            <th className="p-1 text-left">Linha</th>
                                            <th className="p-1 text-left">Código</th>
                                            <th className="p-1 text-left">Motivo</th>
                                          </tr>
                                        </thead>
                                        <tbody>
                                          {ignoradasFiltradas.length === 0 ? (
                                            <tr>
                                              <td
                                                colSpan={3}
                                                className="p-2 text-center text-muted-foreground"
                                              >
                                                Nenhuma linha ignorada corresponde ao filtro.
                                              </td>
                                            </tr>
                                          ) : (
                                            ignoradasFiltradas.map((ig, idx) => (
                                              <tr
                                                key={`${r.id}-ig-${ig.linha}-${ig.codigo}-${idx}`}
                                                className="border-t"
                                              >
                                                <td className="p-1 tabular-nums">{ig.linha}</td>
                                                <td className="p-1 font-mono">{ig.codigo}</td>
                                                <td className="p-1">{ig.motivo}</td>
                                              </tr>
                                            ))
                                          )}
                                        </tbody>
                                      </table>
                                    </div>
                                  </div>
                                </td>
                              </tr>
                            )}
                          </Fragment>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {execContagem?.status === "concluida" && (execContagem.ajustes?.length ?? 0) > 0 && (
            <div className="mt-3 rounded-md border">
              <div className="p-2 bg-muted/40 text-xs font-semibold uppercase text-muted-foreground">
                Ajustes propostos ({execContagem.ajustes!.length})
              </div>
              <div className="w-full overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-xs uppercase text-muted-foreground">
                    <tr>
                      <th className="p-2 text-left">Insumo</th>
                      <th className="p-2 text-left">Tipo</th>
                      <th className="p-2 text-right">Quantidade</th>
                      <th className="p-2 text-left">Status</th>
                      <th className="p-2 text-right">Ação</th>
                    </tr>
                  </thead>
                  <tbody>
                    {execContagem.ajustes!.map((a) => {
                      const info = insumoInfo.get(a.insumoId);
                      return (
                        <tr key={a.insumoId} className="border-t">
                          <td className="p-2">
                            <div className="font-mono text-[11px] text-muted-foreground">
                              {info?.codigo ?? a.insumoId.slice(0, 8)}
                            </div>
                            <div>{info?.descricao ?? "—"}</div>
                          </td>
                          <td className="p-2">
                            <Badge
                              variant="outline"
                              className={a.tipo === "entrada" ? "text-success" : "text-destructive"}
                            >
                              {a.tipo}
                            </Badge>
                          </td>
                          <td className="p-2 text-right tabular-nums">
                            {a.quantidade} {info?.unidade ?? ""}
                          </td>
                          <td className="p-2">
                            <Badge variant="outline">{STATUS_AJUSTE_LABEL[a.status]}</Badge>
                            {a.aplicadoEm && (
                              <div className="text-[10px] text-muted-foreground">
                                {new Date(a.aplicadoEm).toLocaleString()}
                                {a.aplicadoPor ? ` · ${a.aplicadoPor}` : ""}
                              </div>
                            )}
                          </td>
                          <td className="p-2 text-right space-x-1">
                            {a.status === "pendente" ? (
                              <>
                                <Button
                                  size="sm"
                                  variant="default"
                                  onClick={() => aplicarAjuste(a.insumoId, "aplicado")}
                                >
                                  Aplicar
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => aplicarAjuste(a.insumoId, "dispensado")}
                                >
                                  Dispensar
                                </Button>
                              </>
                            ) : (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => aplicarAjuste(a.insumoId, "pendente")}
                              >
                                Reabrir
                              </Button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <p className="p-2 text-[11px] text-muted-foreground border-t">
                Registro local de auditoria. A emissão do movimento no repositório oficial de
                estoque depende da RPC <code>fn_estoque_ajuste</code> (não disponível neste
                ambiente).
              </p>
            </div>
          )}
          <DialogFooter>
            <input
              ref={importInputRef}
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void importarXlsx(file);
                e.currentTarget.value = "";
              }}
            />
            <Button variant="outline" onClick={fecharExecucao}>
              Fechar
            </Button>
            {execContagem && execContagem.status === "concluida" && (
              <Button variant="outline" onClick={() => exportarXlsx(execContagem, execItens)}>
                <Download className="h-4 w-4 mr-1" /> Exportar XLSX
              </Button>
            )}
            {execContagem?.status !== "concluida" && (
              <>
                <Button
                  variant="outline"
                  onClick={() => importInputRef.current?.click()}
                  disabled={execItens.length === 0}
                >
                  <Upload className="h-4 w-4 mr-1" /> Importar XLSX
                </Button>
                <Button variant="secondary" onClick={() => salvarExecucao(false)}>
                  Salvar parcial
                </Button>
                <Button onClick={() => salvarExecucao(true)}>
                  <Check className="h-4 w-4 mr-1" /> Concluir
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
