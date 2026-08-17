import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { useFiltrosPersistidos } from "@/hooks/useFiltrosPersistidos";
import { STORAGE_KEYS } from "@/lib/core/storage/keys";

/** Params de filtro observados para persistência do último recorte. */
const FILTROS_URL_APROVACAO = [
  "q",
  "de",
  "ate",
  "status",
  "setores",
  "obras",
  "sort",
  "dir",
  "pgto",
] as const;
import { usePermissions } from "@/contexts/auth/usePermissions";
import { useAuth } from "@/contexts/auth/useAuth";
import { useObrasContext } from "@/contexts/ObrasContext";
import { useColaboradoresContext } from "@/contexts/ColaboradoresContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import DatePickerField from "@/components/common/DatePickerField";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { EvolucaoAprovacoesCard } from "@/components/financeiro/aprovacao/EvolucaoAprovacoesCard";

import { Checkbox } from "@/components/ui/checkbox";
import {
  Plus,
  Search,
  CheckCircle,
  XCircle,
  MessageSquare,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  Loader2,

  Download,
  Copy,
  Pencil,
  Ban,
  MoreVertical,
  RefreshCw,
  Rows2,
  Rows3,
} from "lucide-react";
import { logger } from "@/lib/core/logger";
import {
  useSolicitacoesFinanceiras,
  useSolicitacaoComentarios,
  useSaveSolicitacao,
  useUpdateSolicitacaoStatus,
  useCreateSolicitacaoComentario,
  useInvalidateSolicitacoes,
  type SolicitacaoFinanceira,
  type SolicitacaoComentario,
} from "@/hooks/financeiro/useSolicitacoesFinanceiras";
import { useFormasPagamento } from "@/hooks/financeiro/useFormasPagamento";
import { useSaveDespesa } from "@/hooks/financeiro/useDespesas";
import { supabase } from "@/integrations/supabase/client";
import { criarNotificacao, deveNotificarCriador } from "@/lib/notificacoes";
import { NivelPrioridade, StatusSolicitacao } from "@/types";
import { formatBRLInput, parseBRL, formatBRLFromNumber } from "@/lib/core/currency";
import { Combobox } from "@/components/ui/combobox";
import * as XLSX from "xlsx";
import StatusFilter from "@/components/common/StatusFilter";
import ObrasFilter from "@/components/common/ObrasFilter";
import ColumnFilter from "@/components/common/ColumnFilter";
import CollapsibleSection from "@/components/common/CollapsibleSection";
import InfoDica from "@/components/common/InfoDica";
import { StickyScrollbar } from "@/components/common/StickyScrollbar";
import { PaginationControls } from "@/components/common/PaginationControls";
import { Skeleton } from "@/components/ui/skeleton";
import { RowActions } from "@/components/ui/data-table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { fmtDataHora, fmtDataLocal } from "@/lib/core/date";
import { formatBRL } from "@/lib/core/currency";

import {
  statusLabels,
  statusColors,
  prioridadeLabels,
  prioridadeColors,
} from "@/components/financeiro/aprovacao/types";
import {
  setorLabel,
  setoresVisiveis,
  normalizarSetorLegado,
  podePlayerVerSetorFinanceiro,
} from "@/lib/authz/paginas";

type Solicitacao = SolicitacaoFinanceira;
type Comentario = SolicitacaoComentario;

// Lista em vez de união solta: a mesma fonte tipa o estado e valida o que
// chega pela URL, que é texto de terceiro e pode vir com qualquer coisa.
const SORT_FIELDS = [
  "setor",
  "valor",
  "solicitante",
  "fornecedor",
  "centro_custo",
  "referencia",
  "status",
  "prioridade",
  "created_at",
  "updated_at",
  "data_pagamento",
  "prazo_estimado",
] as const;
type SortField = (typeof SORT_FIELDS)[number];
type SortDir = "asc" | "desc" | null;
type PagPendenteFilter = "todos" | "pendente" | "nao_pendente";

/** Uma coluna da fila. `sort` ausente = coluna não ordenável (o caso de Ações). */
type ColunaFila = {
  id: string;
  label: string;
  sort?: SortField;
  headClassName?: string;
  cellClassName?: string;
  render: (s: Solicitacao) => React.ReactNode;
};

const ITEMS_PER_PAGE_PADRAO = 10;
const ITENS_POR_PAGINA_OPCOES = [10, 25, 50, 100];
/** As duas mais largas e as menos consultadas — a tabela cabe na tela sem elas. */
const COLUNAS_OCULTAS_PADRAO = ["created_at", "updated_at"];

/**
 * Preferências de exibição ficam no navegador, não na URL: descrevem como a
 * pessoa gosta de ver a fila, não o que ela está vendo. Um link compartilhado
 * não deve mudar o gosto de quem recebe.
 */
type PrefsFila = {
  pageSize: number;
  colunasOcultas: string[];
  densidade: "compact" | "comfortable";
};
const PREFS_KEY = "aprovacao:prefs";

const lerPrefs = (): Partial<PrefsFila> => {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(window.localStorage.getItem(PREFS_KEY) ?? "{}") as Partial<PrefsFila>;
  } catch {
    return {};
  }
};

/** Formata YYYY-MM-DD (ou ISO) em DD/MM/YYYY sem deslocamento de fuso horário. */
const formatDateBR = (value?: string | null): string => {
  if (!value) return "—";
  const isoMatch = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (isoMatch) {
    const [, y, m, d] = isoMatch;
    return `${d}/${m}/${y}`;
  }
  const dt = new Date(value);
  if (isNaN(dt.getTime())) return value;
  return fmtDataLocal(dt);
};

/** Formata timestamp em DD/MM/YYYY HH:mm */
const formatDateTimeBR = (value?: string | null): string => {
  if (!value) return "—";
  const dt = new Date(value);
  if (isNaN(dt.getTime())) return value;
  return dt.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const AprovacaoFinanceira = () => {
  const { hasAccess, can } = usePermissions();
  // Identidade de escrita (criado_por/autor/aprovado_por/...) vem da sessão REAL,
  // nunca do preview "visualizar como usuário" — que só afeta gating de permissão.
  const { currentPlayer } = useAuth();
  const { obras } = useObrasContext();
  const { colaboradores } = useColaboradoresContext();
  const canEdit = hasAccess("financeiro", "compras");
  // PRO-031 · Fase 3 — exportar respeita a ação Ex da matriz fina.
  const canExport = hasAccess("financeiro", "compras") && can("/financeiro/aprovacao", "Ex");
  const canApprove = hasAccess("financeiro", "financeiro");

  // Estados servidor (TanStack Query)
  const {
    data: solicitacoes = [],
    isLoading: loadingSol,
    refetch: refetchSolicitacoes,
  } = useSolicitacoesFinanceiras();
  const {
    data: formasAll = [],
    isLoading: loadingFormas,
    refetch: refetchFormas,
  } = useFormasPagamento();
  const formas = useMemo(() => formasAll.filter((f) => f.ativo), [formasAll]);
  const {
    data: comentarios = [],
    isLoading: loadingCom,
    refetch: refetchComentarios,
  } = useSolicitacaoComentarios();
  const loading = loadingSol || loadingFormas || loadingCom;
  const invalidateSolicitacoes = useInvalidateSolicitacoes();
  const saveSolicitacao = useSaveSolicitacao();
  const updateStatus = useUpdateSolicitacaoStatus();
  const createComentario = useCreateSolicitacaoComentario();
  const saveDespesa = useSaveDespesa();
  // Busca, filtros, ordem e página vivem na URL: recarregar não perde o que
  // você montou, e dá para mandar a fila filtrada pronta para outra pessoa.
  const [searchParams, setSearchParams] = useSearchParams();
  // Sem params no link, o último recorte usado volta do localStorage.
  useFiltrosPersistidos(STORAGE_KEYS.filtrosAprovacaoFinanceira, FILTROS_URL_APROVACAO);
  // Guardado em ref: se entrasse nas dependências do efeito abaixo, cada
  // navegação trocaria sua identidade e reagendaria o próprio efeito.
  const setSearchParamsRef = useRef(setSearchParams);
  setSearchParamsRef.current = setSearchParams;
  const [search, setSearch] = useState(() => searchParams.get("q") ?? "");
  const [dataPagFrom, setDataPagFrom] = useState(() => searchParams.get("de") ?? "");
  const [dataPagTo, setDataPagTo] = useState(() => searchParams.get("ate") ?? "");
  const STATUS_OPTIONS: { value: StatusSolicitacao; label: string }[] = [
    { value: "em_analise", label: "Em Análise" },
    { value: "aprovado", label: "Aprovado" },
    { value: "reprovado", label: "Reprovado" },
    { value: "cancelado", label: "Cancelado" },
  ];
  const [statusSelecionados, setStatusSelecionados] = useState<Set<string>>(() => {
    const daUrl = searchParams.get("status");
    return new Set(
      daUrl ? daUrl.split(",").filter(Boolean) : ["em_analise", "aprovado", "reprovado", "cancelado"],
    );
  });

  // Setores que o usuário pode visualizar (GM: todos; demais: os concedidos em
  // Permissões via `papeisPermissao.setores`). Fonte única: SETORES_SUPABASE.
  const setoresPermitidos = useMemo(() => setoresVisiveis(currentPlayer), [currentPlayer]);
  const SETORES_OPTIONS = useMemo(
    () => setoresPermitidos.map((s) => ({ value: s, label: setorLabel(s) })),
    [setoresPermitidos],
  );
  const [setoresSelecionados, setSetoresSelecionados] = useState<Set<string>>(
    () => new Set((searchParams.get("setores") ?? "").split(",").filter(Boolean)),
  );
  // Inicializa a seleção do filtro com todos os setores permitidos ao carregarem.
  useEffect(() => {
    // Sem a saída antecipada, com a lista ainda vazia cada passada devolveria um
    // Set vazio novo — identidade diferente, novo render, efeito de novo.
    if (!setoresPermitidos.length) return;
    setSetoresSelecionados((prev) => (prev.size === 0 ? new Set(setoresPermitidos) : prev));
  }, [setoresPermitidos]);

  const obrasOptions = useMemo(() => obras.map((o) => ({ id: o.id, nome: o.nome })), [obras]);
  const [obrasSelecionadas, setObrasSelecionadas] = useState<Set<string>>(
    () => new Set((searchParams.get("obras") ?? "").split(",").filter(Boolean)),
  );
  // Inicializa/atualiza seleção de obras conforme lista carrega
  useEffect(() => {
    if (!obras.length) return;
    setObrasSelecionadas((prev) => {
      if (prev.size === 0) {
        return new Set([...obras.map((o) => o.id), "sem"]);
      }
      return prev;
    });
  }, [obras]);

  // Estados de ações em andamento
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [cancelingId, setCancelingId] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);

  // Paginação e exibição
  const [currentPage, setCurrentPage] = useState(() =>
    Math.max(1, Number(searchParams.get("page")) || 1),
  );
  const [pageSize, setPageSize] = useState(() => lerPrefs().pageSize ?? ITEMS_PER_PAGE_PADRAO);
  const [colunasOcultas, setColunasOcultas] = useState<Set<string>>(
    () => new Set(lerPrefs().colunasOcultas ?? COLUNAS_OCULTAS_PADRAO),
  );
  const [densidade, setDensidade] = useState<"compact" | "comfortable">(
    () => lerPrefs().densidade ?? "comfortable",
  );
  const compacto = densidade === "compact";

  useEffect(() => {
    if (typeof window === "undefined") return;
    const prefs: PrefsFila = { pageSize, colunasOcultas: [...colunasOcultas], densidade };
    window.localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  }, [pageSize, colunasOcultas, densidade]);

  // Diálogos
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Solicitacao | null>(null);
  const [viewOnly, setViewOnly] = useState(false);
  const [approveDialog, setApproveDialog] = useState<Solicitacao | null>(null);
  const [rejectDialog, setRejectDialog] = useState<Solicitacao | null>(null);
  const [cancelDialog, setCancelDialog] = useState<Solicitacao | null>(null);
  const [rejectComment, setRejectComment] = useState("");

  // Ordenação
  const [sortField, setSortField] = useState<SortField | null>(() => {
    const daUrl = searchParams.get("sort");
    return SORT_FIELDS.includes(daUrl as SortField) ? (daUrl as SortField) : null;
  });
  const [sortDir, setSortDir] = useState<SortDir>(() => {
    const daUrl = searchParams.get("dir");
    return daUrl === "asc" || daUrl === "desc" ? daUrl : null;
  });

  // Form fields
  const [setor, setSetor] = useState("");
  const [valor, setValor] = useState("");
  const [dataPagamento, setDataPagamento] = useState("");
  const [prazoEstimado, setPrazoEstimado] = useState("");
  const [formaPagId, setFormaPagId] = useState("");
  const [prioridade, setPrioridade] = useState<NivelPrioridade>("normal");
  const [condicaoPag, setCondicaoPag] = useState("");
  const [centroCustoId, setCentroCustoId] = useState("");
  const [solicitante, setSolicitante] = useState("");
  const [fornecedor, setFornecedor] = useState("");
  const [referencia, setReferencia] = useState("");
  const [observacao, setObservacao] = useState("");
  const [pagamentoPendente, setPagamentoPendente] = useState(false);
  const [previsao, setPrevisao] = useState(false);

  // Opções do Setor no formulário: apenas os setores permitidos ao usuário.
  // Ao editar um registro com setor fora da lista (ex.: legado desconhecido),
  // inclui o valor atual para que o Select consiga exibi-lo/preservá-lo.
  const formSetorOptions = useMemo(() => {
    const base = setoresPermitidos.map((v) => ({ value: v, label: setorLabel(v) }));
    if (setor && !base.some((o) => o.value === setor)) {
      base.unshift({ value: setor, label: setorLabel(setor) });
    }
    return base;
  }, [setoresPermitidos, setor]);

  // Filtro: 'todos' | 'pendente' | 'nao_pendente'
  const [pagPendenteFilter, setPagPendenteFilter] = useState<PagPendenteFilter>(() => {
    const daUrl = searchParams.get("pgto");
    return daUrl === "pendente" || daUrl === "nao_pendente" ? daUrl : "todos";
  });

  // Comentários
  const [commentField, setCommentField] = useState<{ solId: string; campo: string } | null>(null);
  const [newComment, setNewComment] = useState("");

  // Espelha o estado de volta na URL. Só entra o que difere do padrão, senão
  // uma visita comum já geraria um endereço quilométrico. `replace` porque
  // digitar na busca não deve encher o histórico do navegador.
  //
  // O `loading` no início evita o pior caso: enquanto obras e setores não
  // chegam, "tudo selecionado" e "nada selecionado" são indistinguíveis, e
  // escrever nessa janela apagaria da URL justamente o filtro que a semeou.
  useEffect(() => {
    if (loading) return;
    const p = new URLSearchParams();
    if (search) p.set("q", search);
    if (statusSelecionados.size < STATUS_OPTIONS.length) {
      p.set("status", [...statusSelecionados].join(","));
    }
    if (setoresSelecionados.size && setoresSelecionados.size < setoresPermitidos.length) {
      p.set("setores", [...setoresSelecionados].join(","));
    }
    if (obrasSelecionadas.size && obrasSelecionadas.size < obrasOptions.length + 1) {
      p.set("obras", [...obrasSelecionadas].join(","));
    }
    if (pagPendenteFilter !== "todos") p.set("pgto", pagPendenteFilter);
    if (dataPagFrom) p.set("de", dataPagFrom);
    if (dataPagTo) p.set("ate", dataPagTo);
    if (sortField && sortDir) {
      p.set("sort", sortField);
      p.set("dir", sortDir);
    }
    if (currentPage > 1) p.set("page", String(currentPage));
    // Só navega se algo mudou de fato. Sem esta comparação o efeito se
    // realimenta: `setSearchParams` troca de identidade a cada navegação, o que
    // reagenda o efeito, que navega de novo — laço infinito.
    if (p.toString() !== searchParams.toString()) {
      setSearchParamsRef.current(p, { replace: true });
    }
  }, [
    loading,
    search,
    statusSelecionados,
    setoresSelecionados,
    obrasSelecionadas,
    pagPendenteFilter,
    dataPagFrom,
    dataPagTo,
    sortField,
    sortDir,
    currentPage,
    STATUS_OPTIONS.length,
    setoresPermitidos.length,
    obrasOptions.length,
    searchParams,
  ]);

  // ========== CARREGAMENTO ==========
  const fetchAll = useCallback(async () => {
    await Promise.all([refetchSolicitacoes(), refetchFormas(), refetchComentarios()]);
  }, [refetchSolicitacoes, refetchFormas, refetchComentarios]);

  // ========== FILTRO, ORDENAÇÃO, PAGINAÇÃO ==========
  const filtered = useMemo(() => {
    let list = solicitacoes.slice();
    // Autorização por setor: não-GM só enxerga solicitações dos setores que lhe
    // foram concedidos em Permissões. GM vê tudo. (Ver podePlayerVerSetorFinanceiro.)
    list = list.filter((s) => podePlayerVerSetorFinanceiro(currentPlayer, s.setor));
    list = list.filter((s) => statusSelecionados.has(s.status));
    list = list.filter((s) => setoresSelecionados.has(normalizarSetorLegado(s.setor)));
    list = list.filter((s) => obrasSelecionadas.has(s.centro_custo_id || "sem"));
    if (pagPendenteFilter === "pendente") {
      list = list.filter((s) => !!s.pagamento_pendente);
    } else if (pagPendenteFilter === "nao_pendente") {
      list = list.filter((s) => !s.pagamento_pendente);
    }
    if (dataPagFrom) {
      list = list.filter((s) => s.data_pagamento && s.data_pagamento >= dataPagFrom);
    }
    if (dataPagTo) {
      list = list.filter((s) => s.data_pagamento && s.data_pagamento <= dataPagTo);
    }
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        (s) =>
          s.setor.toLowerCase().includes(q) ||
          setorLabel(s.setor).toLowerCase().includes(q) ||
          s.solicitante.toLowerCase().includes(q) ||
          (s.fornecedor || "").toLowerCase().includes(q) ||
          (s.referencia || "").toLowerCase().includes(q) ||
          (s.data_pagamento || "").toLowerCase().includes(q) ||
          formatDateBR(s.data_pagamento).toLowerCase().includes(q) ||
          (prioridadeLabels[s.nivel_prioridade as NivelPrioridade] || "")
            .toLowerCase()
            .includes(q) ||
          (s.nivel_prioridade || "").toLowerCase().includes(q) ||
          (obras.find((o) => o.id === s.centro_custo_id)?.nome || "").toLowerCase().includes(q) ||
          (s.observacao || "").toLowerCase().includes(q),
      );
    }
    if (sortField && sortDir) {
      list = [...list].sort((a, b) => {
        let va: any, vb: any;
        if (sortField === "prioridade") {
          va = a.nivel_prioridade;
          vb = b.nivel_prioridade;
        } else if (sortField === "setor") {
          va = setorLabel(a.setor);
          vb = setorLabel(b.setor);
        } else if (sortField === "centro_custo") {
          va = obras.find((o) => o.id === a.centro_custo_id)?.nome || "";
          vb = obras.find((o) => o.id === b.centro_custo_id)?.nome || "";
        } else {
          va = (a as any)[sortField];
          vb = (b as any)[sortField];
        }
        if (typeof va === "string") {
          va = va.toLowerCase();
          vb = (vb || "").toLowerCase();
        }
        if (va == null) va = "";
        if (vb == null) vb = "";
        if (va < vb) return sortDir === "asc" ? -1 : 1;
        if (va > vb) return sortDir === "asc" ? 1 : -1;
        return 0;
      });
    }
    return list;
  }, [
    solicitacoes,
    currentPlayer,
    search,
    statusSelecionados,
    setoresSelecionados,
    obrasSelecionadas,
    sortField,
    sortDir,
    obras,
    dataPagFrom,
    dataPagTo,
    pagPendenteFilter,
  ]);

  const paginatedItems = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, currentPage, pageSize]);

  useEffect(() => {
    setCurrentPage(1);
  }, [
    pageSize,
    search,
    statusSelecionados,
    setoresSelecionados,
    obrasSelecionadas,
    sortField,
    sortDir,
    dataPagFrom,
    dataPagTo,
    pagPendenteFilter,
  ]);

  // ========== ORDENAÇÃO ==========
  const toggleSort = useCallback(
    (field: SortField) => {
      if (sortField === field) {
        setSortDir((d) => (d === "asc" ? "desc" : d === "desc" ? null : "asc"));
        if (sortDir === "desc") setSortField(null);
      } else {
        setSortField(field);
        setSortDir("asc");
      }
    },
    [sortField, sortDir],
  );

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown className="h-3 w-3 ml-1 opacity-40" />;
    return sortDir === "asc" ? (
      <ArrowUp className="h-3 w-3 ml-1" />
    ) : (
      <ArrowDown className="h-3 w-3 ml-1" />
    );
  };

  // ========== CRUD ==========
  const openAdd = useCallback(() => {
    setEditing(null);
    setViewOnly(false);
    setSetor("");
    setValor("");
    setDataPagamento("");
    setPrazoEstimado("");
    setFormaPagId("");
    setPrioridade("normal");
    setCondicaoPag("");
    setCentroCustoId("");
    setSolicitante("");
    setFornecedor("");
    setReferencia("");
    setObservacao("");
    setPagamentoPendente(false);
    setPrevisao(false);
    setFormOpen(true);
  }, []);

  const openEdit = useCallback((s: Solicitacao, readOnly = false) => {
    setEditing(s);
    setViewOnly(readOnly);
    // Canoniza rótulos legados (ex.: "Almoxarifado" → "compras") para o slug.
    setSetor(normalizarSetorLegado(s.setor));
    setValor(formatBRLFromNumber(s.valor));
    setDataPagamento(s.data_pagamento || "");
    setPrazoEstimado(s.prazo_estimado || "");
    setFormaPagId(s.forma_pagamento_id || "");
    setPrioridade(s.nivel_prioridade as NivelPrioridade);
    setCondicaoPag(s.condicao_pagamento || "");
    setCentroCustoId(s.centro_custo_id || "");
    setSolicitante(s.solicitante);
    setFornecedor(s.fornecedor || "");
    setReferencia(s.referencia || "");
    setObservacao(s.observacao || "");
    setPagamentoPendente(!!s.pagamento_pendente);
    setPrevisao(!!s.previsao);
    setFormOpen(true);
  }, []);

  const handleSave = useCallback(async () => {
    if (!setor || !valor || !solicitante) return;
    setSavingId(editing?.id || "new");
    try {
      const payload = {
        setor,
        valor: parseBRL(valor),
        data_pagamento: dataPagamento || null,
        prazo_estimado: prazoEstimado || null,
        forma_pagamento_id: formaPagId || null,
        nivel_prioridade: prioridade,
        condicao_pagamento: condicaoPag || null,
        centro_custo_id: centroCustoId || null,
        solicitante,
        fornecedor: fornecedor || null,
        referencia: referencia || null,
        observacao: observacao || null,
        pagamento_pendente: pagamentoPendente,
        previsao,
        criado_por: currentPlayer?.id || null,
        updated_at: new Date().toISOString(),
      };
      if (editing) {
        await saveSolicitacao.mutateAsync({ id: editing.id, payload });
        toast.success("Solicitação atualizada");
      } else {
        const created = await saveSolicitacao.mutateAsync({
          payload: {
            ...payload,
            status: "em_analise",
          },
        });
        toast.success("Solicitação criada");
        criarNotificacao({
          tipo: "solicitacao_criada",
          role_scope: "financeiro",
          target_id: (created as any)?.id ? String((created as any).id) : null,
          titulo: "Nova solicitação de aprovação",
          mensagem: `${solicitante} criou solicitação — ${setorLabel(setor)} — ${formatBRLFromNumber(parseBRL(valor))}`,
          setor: normalizarSetorLegado(setor),
          autor_login: currentPlayer?.login || null,
          autor_id: currentPlayer?.id || null,
        });
      }
      setFormOpen(false);
      await fetchAll();
    } catch (error: any) {
      logger.error(error);
      toast.error("Erro ao salvar", { description: error.message });
    } finally {
      setSavingId(null);
    }
  }, [
    setor,
    valor,
    solicitante,
    dataPagamento,
    prazoEstimado,
    formaPagId,
    prioridade,
    condicaoPag,
    centroCustoId,
    fornecedor,
    referencia,
    observacao,
    pagamentoPendente,
    previsao,
    editing,
    currentPlayer,
    saveSolicitacao,
    fetchAll,
  ]);

  const handleApprove = useCallback(async () => {
    if (!approveDialog || approvingId) return;
    setApprovingId(approveDialog.id);
    try {
      const s = approveDialog;
      await updateStatus.mutateAsync({
        id: s.id,
        payload: {
          status: "aprovado",
          aprovado_por: currentPlayer?.login || currentPlayer?.id || null,
          data_aprovacao: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      });

      await saveDespesa.mutateAsync({
        payload: {
          descricao: s.referencia || `Solicitação #${s.id}`,
          valor: s.valor,
          data: s.data_pagamento || new Date().toISOString().slice(0, 10),
          categoria: setorLabel(s.setor),
          forma_pagamento_id: s.forma_pagamento_id || null,
          obra_id: s.centro_custo_id || null,
          responsavel: s.solicitante,
          fornecedor: s.fornecedor || null,
          referencia: s.referencia || null,
          observacao: s.observacao || null,
          status: "pendente",
          aprovado_por: currentPlayer?.id, // ID do usuário logado
          data_aprovacao: new Date().toISOString().slice(0, 19).replace("T", " "), // formato 'YYYY-MM-DD HH:mm:ss'
        },
      });

      // Cria também a "despesa prevista" no Fluxo de Dívidas (origem=sistema).
      // Falha aqui não invalida a aprovação — apenas registra warning.
      try {
        const { error: rpcErr } = await supabase.rpc("fn_lancamento_solicitacao_aprovada", {
          p_solicitacao_id: s.id,
          p_obra_id: s.centro_custo_id || null,
          p_centro_custo: null,
          p_valor: s.valor,
          p_data_prevista: s.data_pagamento || new Date().toISOString().slice(0, 10),
          p_descricao: s.referencia || `Solicitação #${s.id}`,
        });
        if (rpcErr) logger.warn("fn_lancamento_solicitacao_aprovada falhou", rpcErr);
      } catch (err) {
        logger.warn("fn_lancamento_solicitacao_aprovada exceção", err as any);
      }

      toast.success("Solicitação aprovada", { description: "Despesa criada automaticamente." });
      criarNotificacao({
        tipo: "solicitacao_aprovada",
        role_scope: "compras",
        target_id: s.id,
        titulo: "Solicitação aprovada",
        mensagem: `${setorLabel(s.setor)} — ${s.solicitante} — ${formatBRLFromNumber(s.valor)}`,
        setor: normalizarSetorLegado(s.setor),
        autor_login: currentPlayer?.login || null,
        autor_id: currentPlayer?.id || null,
      });
      setApproveDialog(null);
      await fetchAll();
    } catch (error: any) {
      logger.error(error);
      toast.error("Erro ao aprovar", { description: error.message });
    } finally {
      setApprovingId(null);
    }
  }, [approveDialog, approvingId, updateStatus, saveDespesa, fetchAll, currentPlayer]);

  const handleReject = useCallback(async () => {
    if (!rejectDialog || !rejectComment || rejectingId) return;
    setRejectingId(rejectDialog.id);
    try {
      await updateStatus.mutateAsync({
        id: rejectDialog.id,
        payload: {
          status: "reprovado",
          comentario_aprovacao: rejectComment,
          recusado_por: currentPlayer?.login || currentPlayer?.id || null,
          data_recusa: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      });
      toast.success("Solicitação recusada");
      criarNotificacao({
        tipo: "solicitacao_reprovada",
        role_scope: "compras",
        target_id: rejectDialog.id,
        titulo: "Solicitação recusada",
        mensagem: `${setorLabel(rejectDialog.setor)} — ${rejectDialog.solicitante} — ${formatBRLFromNumber(rejectDialog.valor)} — ${rejectComment}`,
        setor: normalizarSetorLegado(rejectDialog.setor),
        autor_login: currentPlayer?.login || null,
        autor_id: currentPlayer?.id || null,
      });
      setRejectDialog(null);
      setRejectComment("");
      await fetchAll();
    } catch (error: any) {
      logger.error(error);
      toast.error("Erro ao recusar", { description: error.message });
    } finally {
      setRejectingId(null);
    }
  }, [rejectDialog, rejectComment, rejectingId, updateStatus, fetchAll, currentPlayer]);

  const handleCancel = useCallback(async () => {
    if (!cancelDialog || cancelingId) return;
    setCancelingId(cancelDialog.id);
    try {
      await updateStatus.mutateAsync({
        id: cancelDialog.id,
        payload: {
          status: "cancelado",
          cancelado_por: currentPlayer?.login || currentPlayer?.id || null,
          data_cancelamento: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      });
      toast.success("Solicitação cancelada");
      setCancelDialog(null);
      await fetchAll();
    } catch (error: any) {
      logger.error(error);
      toast.error("Erro ao cancelar", { description: error.message });
    } finally {
      setCancelingId(null);
    }
  }, [cancelDialog, cancelingId, updateStatus, fetchAll, currentPlayer]);

  // ========== COMENTÁRIOS ==========
  const addComment = useCallback(async () => {
    if (!commentField || !newComment) return;
    try {
      await createComentario.mutateAsync({
        solicitacao_id: commentField.solId,
        campo: commentField.campo,
        texto: newComment,
        autor: currentPlayer?.login || "",
      });
      const scope: "compras" | "financeiro" = canApprove ? "compras" : "financeiro";
      criarNotificacao({
        tipo: "solicitacao_comentario",
        role_scope: scope,
        target_id: commentField.solId,
        titulo: "Novo comentário em solicitação",
        mensagem: `${currentPlayer?.login || "Alguém"}: ${newComment.slice(0, 140)}`,
        setor: normalizarSetorLegado(
          solicitacoes.find((x) => x.id === commentField.solId)?.setor ?? null,
        ),
        autor_login: currentPlayer?.login || null,
        autor_id: currentPlayer?.id || null,
      });
      // PRO-030 — o aviso acima vai para o setor oposto inteiro, e só alcança
      // quem criou a solicitação por acidente. Esta segunda notificação é
      // dirigida ao criador. Sem `dedupeKey`: cada comentário é evento novo.
      const criador = solicitacoes.find((s) => s.id === commentField.solId)?.criado_por;
      if (deveNotificarCriador(criador, currentPlayer?.id)) {
        void criarNotificacao({
          tipo: "solicitacao_comentario_minha",
          role_scope: "user",
          destinatario_id: String(criador),
          target_id: commentField.solId,
          titulo: "Novo comentário na sua solicitação",
          mensagem: `${currentPlayer?.login || "Alguém"}: ${newComment.slice(0, 140)}`,
          autor_login: currentPlayer?.login || null,
          autor_id: currentPlayer?.id || null,
        });
      }
      setNewComment("");
    } catch (error: any) {
      logger.error(error);
      toast.error("Erro ao adicionar comentário", { description: error.message });
    }
  }, [commentField, newComment, currentPlayer, canApprove, createComentario, solicitacoes]);

  // ========== UTILITÁRIOS ==========
  const getObraNome = useCallback(
    (id: string | null) => (id ? obras.find((o) => o.id === id)?.nome || id : "—"),
    [obras],
  );

  // ========== DUPLICAR SOLICITAÇÃO ==========
  // Declarado antes de `colunas` de propósito: o array de dependências do
  // useMemo é avaliado na hora, e um `const` definido mais abaixo estouraria
  // em TDZ no primeiro render.
  const handleDuplicate = useCallback(
    async (s: Solicitacao) => {
      try {
        await saveSolicitacao.mutateAsync({
          payload: {
            setor: s.setor,
            valor: s.valor,
            data_pagamento: s.data_pagamento,
            prazo_estimado: s.prazo_estimado,
            forma_pagamento_id: s.forma_pagamento_id,
            nivel_prioridade: s.nivel_prioridade,
            condicao_pagamento: s.condicao_pagamento,
            centro_custo_id: s.centro_custo_id,
            solicitante: s.solicitante,
            fornecedor: s.fornecedor,
            referencia: s.referencia,
            observacao: s.observacao,
            pagamento_pendente: s.pagamento_pendente || false,
            previsao: s.previsao || false,
            status: "em_analise",
            comentario_aprovacao: null,
            criado_por: currentPlayer?.id || s.criado_por,
            updated_at: new Date().toISOString(),
          },
        });
        toast.success("Solicitação duplicada", {
          description: "Nova solicitação criada em análise.",
        });
        await fetchAll();
      } catch (error: any) {
        logger.error(error);
        toast.error("Erro ao duplicar", { description: error.message });
      }
    },
    [currentPlayer, saveSolicitacao, fetchAll],
  );

  // ========== COLUNAS ==========
  // Descritores em vez de 13 <TableHead>/<TableCell> chumbados: é o que permite
  // esconder coluna, manter o colSpan do estado vazio coerente e desenhar as
  // linhas do esqueleto no mesmo formato da tabela.
  const colunas = useMemo<ColunaFila[]>(
    () => [
      {
        id: "setor",
        label: "Setor",
        sort: "setor",
        cellClassName: "font-medium",
        render: (s) => (
          // Rótulo com largura fixa e sem quebra: sem isso o balão acompanhava
          // o texto ("Depto. Pessoal" quebra em duas linhas) e desalinhava.
          <div className="flex items-start gap-1">
            <span className="w-[104px] shrink-0 truncate">{setorLabel(s.setor)}</span>
            <CommentBubble
              solId={s.id}
              campo="setor"
              comentarios={comentarios}
              onOpen={() => {
                setCommentField({ solId: s.id, campo: "setor" });
                setNewComment("");
              }}
            />
          </div>
        ),

      },
      {
        id: "valor",
        label: "Valor",
        sort: "valor",
        // O badge acompanha o destaque âmbar da linha: cor sozinha não é
        // informação acessível — some para daltônicos, em P&B e no leitor de tela.
        render: (s) => (
          <span className="inline-flex items-center gap-1.5">
            {formatBRL(s.valor)}
            {s.previsao && (
              <Badge
                variant="outline"
                className="border-warning/40 text-warning text-[10px] font-medium"
              >
                Previsão
              </Badge>
            )}
          </span>
        ),
      },
      { id: "solicitante", label: "Solicitante", sort: "solicitante", render: (s) => s.solicitante },
      {
        id: "fornecedor",
        label: "Fornecedor",
        sort: "fornecedor",
        render: (s) => s.fornecedor || "—",
      },
      {
        id: "referencia",
        label: "Referência",
        sort: "referencia",
        cellClassName: "max-w-[220px] truncate",
        render: (s) => <span title={s.referencia || ""}>{s.referencia || "—"}</span>,
      },
      {
        id: "centro_custo",
        label: "Centro de Custo",
        sort: "centro_custo",
        render: (s) => getObraNome(s.centro_custo_id),
      },
      {
        id: "data_pagamento",
        label: "Data Pgto.",
        sort: "data_pagamento",
        render: (s) => formatDateBR(s.data_pagamento),
      },
      {
        id: "prazo_estimado",
        label: "Prazo Est.",
        sort: "prazo_estimado",
        render: (s) => formatDateBR(s.prazo_estimado),
      },
      {
        id: "prioridade",
        label: "Prioridade",
        sort: "prioridade",
        render: (s) => (
          <Badge
            variant="outline"
            className={prioridadeColors[s.nivel_prioridade as NivelPrioridade]}
          >
            {prioridadeLabels[s.nivel_prioridade as NivelPrioridade] || s.nivel_prioridade}
          </Badge>
        ),
      },
      {
        id: "status",
        label: "Status",
        sort: "status",
        render: (s) => <Badge className={statusColors[s.status]}>{statusLabels[s.status]}</Badge>,
      },
      {
        id: "created_at",
        label: "Criada em",
        sort: "created_at",
        cellClassName: "whitespace-nowrap text-sm text-muted-foreground",
        render: (s) => formatDateTimeBR(s.created_at),
      },
      {
        id: "updated_at",
        label: "Atualizada em",
        sort: "updated_at",
        cellClassName: "whitespace-nowrap text-sm text-muted-foreground",
        render: (s) => formatDateTimeBR(s.updated_at),
      },
      {
        id: "acoes",
        label: "Ações",
        headClassName: "w-32",
        render: (s) => {
          const isProcessing =
            approvingId === s.id || rejectingId === s.id || cancelingId === s.id;
          const emAnalise = s.status === "em_analise";
          // Copiar serve para qualquer status — refazer uma recusada é o caso
          // mais comum. Editar e cancelar só valem enquanto está em análise.
          const podeMexer = canEdit && emAnalise;
          return (
            // RowActions trava a propagação: sem ele, cada botão dispararia
            // também o clique da linha, que abre a visualização.
            <RowActions>
              {canApprove && emAnalise && (
                <>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setApproveDialog(s)}
                    disabled={isProcessing}
                    className="text-success"
                    title="Aprovar"
                  >
                    {approvingId === s.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <CheckCircle className="h-4 w-4" />
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setRejectDialog(s);
                      setRejectComment("");
                    }}
                    disabled={isProcessing}
                    className="text-destructive"
                    title="Recusar"
                  >
                    {rejectingId === s.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <XCircle className="h-4 w-4" />
                    )}
                  </Button>
                </>
              )}
              {/* O olho saiu: clicar na linha já abre a visualização. */}
              {/* Sem permissão de edição não sobra item nenhum — aí o menu
                  inteiro some, em vez de abrir vazio. */}
              {canEdit && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={isProcessing}
                      aria-label="Mais ações"
                      title="Mais ações"
                    >
                      {cancelingId === s.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <MoreVertical className="h-4 w-4" />
                      )}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48">
                    <DropdownMenuItem onSelect={() => handleDuplicate(s)}>
                      <Copy className="h-4 w-4 mr-2" /> Copiar
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => openEdit(s)} disabled={!podeMexer}>
                      <Pencil className="h-4 w-4 mr-2" /> Editar
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onSelect={() => setCancelDialog(s)}
                      disabled={!podeMexer}
                      className="text-destructive focus:text-destructive"
                    >
                      <Ban className="h-4 w-4 mr-2" /> Cancelar
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </RowActions>
          );
        },
      },
    ],
    [
      comentarios,
      getObraNome,
      canEdit,
      canApprove,
      approvingId,
      rejectingId,
      cancelingId,
      openEdit,
      handleDuplicate,
    ],
  );

  const colunasVisiveis = useMemo(
    () => colunas.filter((c) => !colunasOcultas.has(c.id)),
    [colunas, colunasOcultas],
  );

  const valorTotalFiltrado = useMemo(
    () => filtered.reduce((soma, s) => soma + (Number(s.valor) || 0), 0),
    [filtered],
  );

  // Mesmo texto na faixa recolhida e no card "Filtros Ativos" — se cada um
  // montasse o seu, uma hora divergiriam.
  const resumoFiltros = useMemo(() => {
    const status =
      statusSelecionados.size >= STATUS_OPTIONS.length
        ? "todos os status"
        : `${statusSelecionados.size} status`;
    const setores =
      setoresSelecionados.size >= SETORES_OPTIONS.length
        ? "todos os setores"
        : `${setoresSelecionados.size} setor${setoresSelecionados.size === 1 ? "" : "es"}`;
    const obrasTexto =
      obrasSelecionadas.size >= obrasOptions.length + 1
        ? "todas as obras"
        : `${obrasSelecionadas.size} obra(s)`;
    return `${status}, ${setores}, ${obrasTexto}`;
  }, [
    statusSelecionados,
    setoresSelecionados,
    obrasSelecionadas,
    STATUS_OPTIONS.length,
    SETORES_OPTIONS.length,
    obrasOptions.length,
  ]);

  const alternarColuna = useCallback((id: string) => {
    setColunasOcultas((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  // ========== EXPORTAR XLSX ==========
  const handleExportXlsx = useCallback(() => {
    const rows = filtered.map((s) => ({
      Setor: setorLabel(s.setor),
      Solicitante: s.solicitante,
      Fornecedor: s.fornecedor || "",
      "Centro de Custo": getObraNome(s.centro_custo_id),
      Referência: s.referencia || "",
      Valor: s.valor,
      "Data de Pagamento": formatDateBR(s.data_pagamento),
      "Prazo Estimado": formatDateBR(s.prazo_estimado),
      Prioridade: prioridadeLabels[s.nivel_prioridade as NivelPrioridade] || s.nivel_prioridade,
      Status: statusLabels[s.status],
      "Forma de Pagamento": formas.find((f) => f.id === s.forma_pagamento_id)?.nome || "",
      "Condição de Pagamento": s.condicao_pagamento || "",
      Observação: s.observacao || "",
      "Pagamento Pendente": s.pagamento_pendente ? "Sim" : "Não",
      Previsão: s.previsao ? "Sim" : "Não",
      "Criado em": s.created_at ? fmtDataHora(s.created_at) : "",
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Solicitações");
    const stamp = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(wb, `aprovacao_financeira_${stamp}.xlsx`);
  }, [filtered, getObraNome, formas]);

  // ========== RENDER ==========
  if (!hasAccess("financeiro", "visualizar")) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        Sem acesso ao módulo Financeiro.
      </div>
    );
  }

  // Sem trava de altura: quem rola na vertical é a página, e a fila mostra
  // exatamente os itens escolhidos no rodapé. O que mantém a barra horizontal
  // ao alcance é o StickyScrollbar, não mais a altura presa à viewport.
  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-display text-2xl font-bold flex items-center gap-2">
          <CheckCircle className="h-6 w-6" /> Aprovação Financeira
        </h2>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportXlsx}
            disabled={!canExport || loading || filtered.length === 0}
          >
            <Download className="h-4 w-4 mr-1" /> Exportar XLS
          </Button>
          {canEdit && (
            <Button onClick={openAdd} size="sm" disabled={loading}>
              <Plus className="h-4 w-4 mr-1" /> Nova Solicitação
            </Button>
          )}
        </div>
      </div>
      <Tabs defaultValue="solicitacoes" className="w-full">
        <TabsList>
          <TabsTrigger value="solicitacoes">Solicitações</TabsTrigger>
          <TabsTrigger value="evolucao">Evolução</TabsTrigger>
        </TabsList>
        <TabsContent value="solicitacoes" className="mt-4">
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar setor, solicitante, data, prioridade..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <StatusFilter
          options={STATUS_OPTIONS}
          selected={statusSelecionados}
          onChange={setStatusSelecionados}
          label="Status"
        />
        <StatusFilter
          options={SETORES_OPTIONS}
          selected={setoresSelecionados}
          onChange={setSetoresSelecionados}
          label="Setor"
        />
        <ObrasFilter
          obras={obrasOptions}
          selected={obrasSelecionadas}
          onChange={setObrasSelecionadas}
        />
        <Select value={pagPendenteFilter} onValueChange={(v) => setPagPendenteFilter(v as any)}>
          <SelectTrigger className="h-9 w-[180px] text-xs">
            <SelectValue placeholder="Pagamento Pendente" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Pagto. Pendente</SelectItem>
            <SelectItem value="pendente">Somente pendentes</SelectItem>
            <SelectItem value="nao_pendente">Não pendentes</SelectItem>
          </SelectContent>
        </Select>
        <div className="flex items-center gap-1 ml-auto">
          <Label className="text-xs text-muted-foreground whitespace-nowrap">Pgto. de</Label>
          <DatePickerField
            value={dataPagFrom}
            onChange={(v) => setDataPagFrom(v)}
            className="w-[140px]"
            inputClassName="h-9 text-xs"
          />
          <Label className="text-xs text-muted-foreground whitespace-nowrap">até</Label>
          <DatePickerField
            value={dataPagTo}
            onChange={(v) => setDataPagTo(v)}
            className="w-[140px]"
            inputClassName="h-9 text-xs"
          />
          {(dataPagFrom || dataPagTo) && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setDataPagFrom("");
                setDataPagTo("");
              }}
              className="h-9 px-2 text-xs"
            >
              Limpar
            </Button>
          )}
          <ColumnFilter
            columns={colunas.map((c) => ({ id: c.id, label: c.label }))}
            hiddenColumns={colunasOcultas}
            onToggle={alternarColuna}
          />
          <Button
            variant="outline"
            size="sm"
            onClick={() => setDensidade(compacto ? "comfortable" : "compact")}
            title={compacto ? "Voltar ao espaçamento normal" : "Compactar as linhas"}
            aria-pressed={compacto}
            className="h-9"
          >
            {compacto ? (
              <Rows3 className="h-4 w-4 mr-1" />
            ) : (
              <Rows2 className="h-4 w-4 mr-1" />
            )}
            {compacto ? "Normal" : "Compacto"}
          </Button>
          <Button
            variant="outline"
            size="icon"
            aria-label="Atualizar resultados"
            onClick={fetchAll}
            disabled={loading}
            title="Atualizar resultados"
            className="h-9 w-9"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      {/* Fechada, a seção vira a própria faixa de resumo: o `title` do
          CollapsibleSection é o que sobra quando ela recolhe, então o número
          continua à vista e a tabela ganha ~90px. O estado fica lembrado. */}
      <CollapsibleSection
        storageKey="aprovacao-resumo"
        className="border-0 bg-transparent mb-4"
        title={
          <span className="font-normal text-muted-foreground">
            {filtered.length} solicitações · {formatBRL(valorTotalFiltrado)} · {resumoFiltros}
          </span>
        }
      >
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Total de Solicitações</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{filtered.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Valor Total</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{formatBRL(valorTotalFiltrado)}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Filtros Ativos</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm font-medium">{resumoFiltros}</p>
          </CardContent>
        </Card>
      </div>
      </CollapsibleSection>

      {/* StickyScrollbar no lugar do ScrollArea: a rolagem vertical volta a ser
          da página, e a barra horizontal — que moraria no fim da tabela — vira
          uma barra espelho grudada na base da tela. Nada de `overflow-hidden`
          aqui: viraria o contexto de rolagem da barra e a prenderia ao quadro. */}
      <StickyScrollbar className="border border-border rounded-lg">
        <Table
          // Largura acompanha as colunas à mostra, em vez do 1600px fixo de
          // antes, que esticava as sobreviventes quando algo era escondido.
          style={{ minWidth: colunasVisiveis.length * 125 }}
          containerClassName="overflow-visible"
        >
          <TableHeader>
            <TableRow className="bg-muted/50 hover:bg-muted/50 [&>th]:sticky [&>th]:top-0 [&>th]:bg-muted/95 [&>th]:backdrop-blur [&>th]:z-10">
              {colunasVisiveis.map((c) => (
                <TableHead
                  key={c.id}
                  className={cn(c.sort && "cursor-pointer select-none", c.headClassName)}
                  onClick={c.sort ? () => toggleSort(c.sort!) : undefined}
                >
                  <span className="inline-flex items-center">
                    {c.label}
                    {c.sort && <SortIcon field={c.sort} />}
                  </span>
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              // Esqueleto no formato da tabela: o cabeçalho fica de pé e a
              // página não pula quando os dados chegam.
              Array.from({ length: Math.min(pageSize, 10) }).map((_, i) => (
                <TableRow key={`esqueleto-${i}`}>
                  {colunasVisiveis.map((c) => (
                    <TableCell key={c.id}>
                      <Skeleton className="h-4 w-full" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : paginatedItems.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={colunasVisiveis.length}
                  className="text-center text-muted-foreground py-8"
                >
                  Nenhuma solicitação encontrada.
                </TableCell>
              </TableRow>
            ) : (
              paginatedItems.map((s) => (
                <TableRow
                  key={s.id}
                  onClick={() => openEdit(s, true)}
                  className={cn(
                    "cursor-pointer even:bg-muted/20 hover:bg-muted/40",
                    compacto && "[&>td]:py-1 text-xs",
                    // Valor provisório: âmbar (`--warning`) para financeiro e
                    // solicitante identificarem de relance. As variantes `even:`
                    // e `hover:` são obrigatórias — o zebrado e o hover acima têm
                    // especificidade maior e venceriam um `bg-warning/10` simples.
                    s.previsao && "bg-warning/10 even:bg-warning/10 hover:bg-warning/20",
                  )}
                >
                  {colunasVisiveis.map((c) => (
                    <TableCell key={c.id} className={c.cellClassName}>
                      {c.render(s)}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </StickyScrollbar>

      <PaginationControls
        page={currentPage}
        totalItems={filtered.length}
        pageSize={pageSize}
        onPageChange={setCurrentPage}
        onPageSizeChange={setPageSize}
        pageSizeOptions={ITENS_POR_PAGINA_OPCOES}
        disabled={loading}
        className="mt-4"
      />
        </TabsContent>
        <TabsContent value="evolucao" className="mt-4">
          <EvolucaoAprovacoesCard
            solicitacoes={solicitacoes}
            obrasMap={Object.fromEntries(obras.map((o) => [o.id, o.nome]))}
          />
        </TabsContent>
      </Tabs>

      {/* Diálogo de confirmação de cancelamento */}
      <Dialog open={!!cancelDialog} onOpenChange={(v) => !v && setCancelDialog(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-display">Cancelar Solicitação</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Tem certeza que deseja cancelar esta solicitação? Esta ação não pode ser desfeita.
          </p>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setCancelDialog(null)}
              disabled={cancelingId !== null}
            >
              Voltar
            </Button>
            <Button variant="destructive" onClick={handleCancel} disabled={cancelingId !== null}>
              {cancelingId ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : "Sim, cancelar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Comment popover */}
      {commentField && (
        <Dialog open={!!commentField} onOpenChange={(v) => !v && setCommentField(null)}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle className="font-display">Comentários — {commentField.campo}</DialogTitle>
            </DialogHeader>
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {comentarios
                .filter(
                  (c) => c.solicitacao_id === commentField.solId && c.campo === commentField.campo,
                )
                .map((c) => (
                  <div key={c.id} className="text-sm bg-muted p-2 rounded">
                    <p className="font-medium text-xs text-muted-foreground">
                      {c.autor} — {fmtDataLocal(c.created_at)}
                    </p>
                    <p>{c.texto}</p>
                  </div>
                ))}
            </div>
            <div className="flex gap-2">
              <Input
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="Novo comentário..."
              />
              <Button size="sm" onClick={addComment} disabled={!newComment}>
                Enviar
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Add/Edit/View Dialog */}
      <Dialog open={formOpen} onOpenChange={(v) => !v && setFormOpen(false)}>
        <DialogContent
          className="max-w-lg max-h-[90vh] flex flex-col"
          aria-describedby={undefined}
        >
          <DialogHeader className="shrink-0">
            <DialogTitle className="font-display">
              {viewOnly ? "Visualizar" : editing ? "Editar" : "Nova"} Solicitação
            </DialogTitle>
          </DialogHeader>
          {/* A rolagem desce para o corpo e o teto sobe para o DialogContent.
              Com a Observação crescendo com o texto, é isso que impede o
              diálogo de passar da altura da tela — e deixa uma barra só, em vez
              das duas que o ScrollArea de 60vh formava com a caixa. Mesmo
              arranjo do EmployeeFormDialog. */}
          <div className="flex-1 min-h-0 overflow-y-auto pr-4">
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  {/* `min-h-6` nas duas colunas: a linha do Valor carrega um
                      switch de 24px, e sem o mesmo piso aqui os dois campos
                      começariam em alturas diferentes. */}
                  <Label className="flex min-h-6 items-center">Setor *</Label>
                  <Select value={setor} onValueChange={setSetor} disabled={viewOnly}>
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Selecione..." />
                    </SelectTrigger>
                    <SelectContent>
                      {formSetorOptions.map((s) => (
                        <SelectItem key={s.value} value={s.value}>
                          {s.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  {/* O switch divide a linha com o rótulo porque é deste valor
                      que ele fala — no fim do formulário, ninguém o achava
                      antes de já ter digitado. O rótulo encurta para "Previsto"
                      só na tela: lido junto do "Valor *" ao lado, a frase se
                      completa, e a coluna não comporta as duas palavras. O
                      `flex-wrap` segura telas estreitas, onde a coluna cai para
                      ~150px e o grupo desce em vez de espremer o rótulo. */}
                  <div className="flex min-h-6 flex-wrap items-center justify-between gap-x-2 gap-y-1">
                    <Label htmlFor="sol-valor">Valor *</Label>
                    <div className="flex items-center gap-1.5">
                      <Switch
                        id="sol-previsao"
                        checked={previsao}
                        onCheckedChange={setPrevisao}
                        disabled={viewOnly}
                      />
                      <Label htmlFor="sol-previsao" className="text-xs font-medium">
                        Previsto
                      </Label>
                      <InfoDica
                        compacto
                        texto="O valor ainda é provisório. A linha da solicitação fica destacada em âmbar na fila, para o financeiro e para o solicitante."
                        rotulo="O que é Valor previsto"
                      />
                    </div>
                  </div>
                  <Input
                    id="sol-valor"
                    inputMode="numeric"
                    value={valor}
                    onChange={(e) => setValor(formatBRLInput(e.target.value))}
                    placeholder="R$ 0,00"
                    className="mt-1"
                    disabled={viewOnly}
                  />
                </div>
              </div>
              <div>
                <Label>Solicitante *</Label>
                <Combobox
                  options={colaboradores
                    .filter((c) => c.ativo)
                    .map((c) => ({ value: c.id, label: c.nome }))}
                  value={solicitante}
                  onChange={setSolicitante}
                  placeholder="Selecione ou digite..."
                  searchPlaceholder="Buscar colaborador..."
                  emptyText="Nenhum colaborador encontrado."
                  disabled={viewOnly}
                  className="mt-1"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Fornecedor</Label>
                  <Input
                    value={fornecedor}
                    onChange={(e) => setFornecedor(e.target.value)}
                    className="mt-1"
                    disabled={viewOnly}
                  />
                </div>
                <div>
                  <Label>Referência</Label>
                  <Input
                    value={referencia}
                    onChange={(e) => setReferencia(e.target.value)}
                    className="mt-1"
                    disabled={viewOnly}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Data de Pagamento</Label>
                  <DatePickerField
                    value={dataPagamento}
                    onChange={(v) => setDataPagamento(v)}
                    className="mt-1"
                    disabled={viewOnly}
                  />
                </div>
                <div>
                  <Label>Prazo Estimado</Label>
                  <DatePickerField
                    value={prazoEstimado}
                    onChange={(v) => setPrazoEstimado(v)}
                    className="mt-1"
                    disabled={viewOnly}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Forma de Pagamento</Label>
                  <Select value={formaPagId} onValueChange={setFormaPagId} disabled={viewOnly}>
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Selecione..." />
                    </SelectTrigger>
                    <SelectContent>
                      {formas.map((f) => (
                        <SelectItem key={f.id} value={f.id}>
                          {f.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Prioridade</Label>
                  <Select
                    value={prioridade}
                    onValueChange={(v) => setPrioridade(v as NivelPrioridade)}
                    disabled={viewOnly}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="baixa">Baixa</SelectItem>
                      <SelectItem value="normal">Normal</SelectItem>
                      <SelectItem value="alta">Importante</SelectItem>
                      <SelectItem value="urgente">Urgente</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Condição de Pagamento</Label>
                  <Input
                    value={condicaoPag}
                    onChange={(e) => setCondicaoPag(e.target.value)}
                    className="mt-1"
                    disabled={viewOnly}
                  />
                </div>
                <div>
                  <Label>Centro de Custo (Obra)</Label>
                  <Select
                    value={centroCustoId}
                    onValueChange={setCentroCustoId}
                    disabled={viewOnly}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Selecione..." />
                    </SelectTrigger>
                    <SelectContent>
                      {obras
                        .filter((o) => o.ativa)
                        .map((o) => (
                          <SelectItem key={o.id} value={o.id}>
                            {o.nome}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {/* O "i" fica fora do <label> de propósito: dentro dele, clicar
                  para ler a dica marcaria/desmarcaria o checkbox. */}
              <div className="flex items-center gap-1.5">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <Checkbox
                    checked={pagamentoPendente}
                    onCheckedChange={(v) => setPagamentoPendente(!!v)}
                    disabled={viewOnly}
                  />
                  <span className="text-sm font-medium">Pagamento Pendente</span>
                </label>
                <InfoDica
                  texto="Fornecedor com boleto em aberto."
                  rotulo="O que é Pagamento Pendente"
                />
              </div>
              {/* Observação fecha o formulário: é o único campo de texto livre,
                  e o que cresce. Um checkbox depois dela virava apêndice. */}
              <div>
                <Label htmlFor="sol-observacao">Observação</Label>
                {/* `autoResize` porque a caixa já mora dentro do corpo que
                    rola — sem ele, são duas barras aninhadas. */}
                <Textarea
                  id="sol-observacao"
                  autoResize
                  value={observacao}
                  onChange={(e) => setObservacao(e.target.value)}
                  className="mt-1"
                  disabled={viewOnly}
                />
              </div>
              {viewOnly && editing?.comentario_aprovacao && (
                <div className="bg-muted p-3 rounded-lg">
                  <Label className="text-xs text-muted-foreground">
                    Comentário de aprovação/recusa
                  </Label>
                  <p className="text-sm mt-1">{editing.comentario_aprovacao}</p>
                </div>
              )}
            </div>
          </div>
          <DialogFooter className="shrink-0">
            <Button variant="outline" onClick={() => setFormOpen(false)} disabled={!!savingId}>
              {viewOnly ? "Fechar" : "Cancelar"}
            </Button>
            {!viewOnly && (
              <Button
                onClick={handleSave}
                disabled={!setor || !valor || !solicitante || !!savingId}
              >
                {savingId ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                {editing ? "Salvar" : "Criar"}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Approve Dialog */}
      <Dialog open={!!approveDialog} onOpenChange={(v) => !v && setApproveDialog(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-display">Aprovar Solicitação</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Autorizar a aquisição via setor de Compras?
          </p>
          <p className="text-sm font-medium">
            Valor: {approveDialog ? formatBRL(approveDialog.valor) : ""}
          </p>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setApproveDialog(null)}
              disabled={!!approvingId}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleApprove}
              className="bg-success hover:bg-success/90"
              disabled={!!approvingId}
            >
              {approvingId ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : "Aprovar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog open={!!rejectDialog} onOpenChange={(v) => !v && setRejectDialog(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-display">Recusar Solicitação</DialogTitle>
          </DialogHeader>
          <div>
            <Label>Motivo da recusa *</Label>
            <Textarea
              value={rejectComment}
              onChange={(e) => setRejectComment(e.target.value)}
              className="mt-1"
              placeholder="Descreva o motivo..."
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setRejectDialog(null)}
              disabled={!!rejectingId}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={handleReject}
              disabled={!rejectComment || !!rejectingId}
            >
              {rejectingId ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : "Recusar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

const CommentBubble = React.memo(
  ({
    solId,
    campo,
    comentarios,
    onOpen,
  }: {
    solId: string;
    campo: string;
    comentarios: Comentario[];
    onOpen: () => void;
  }) => {
    const count = comentarios.filter((c) => c.solicitacao_id === solId && c.campo === campo).length;
    return (
      <button
        type="button"
        // A linha da fila abre a visualização da solicitação. Sem travar aqui,
        // o clique no balão abriria os dois diálogos ao mesmo tempo.
        onPointerDown={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation();
          e.preventDefault();
          onOpen();
        }}
        className="relative ml-1 text-muted-foreground hover:text-foreground"
        title="Comentários"
      >

        <MessageSquare className="h-3.5 w-3.5" />
        {count > 0 && (
          <span className="absolute -top-1 -right-1 bg-primary text-primary-foreground text-[9px] rounded-full w-3.5 h-3.5 flex items-center justify-center">
            {count}
          </span>
        )}
      </button>
    );
  },
);

export default AprovacaoFinanceira;
