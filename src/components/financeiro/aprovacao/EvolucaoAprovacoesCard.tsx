import { useEffect, useMemo, useState } from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "@/components/ui/chart";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, Search, X, ShoppingCart, ListChecks, Archive, Download, History, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ColumnFilterHeader } from "@/components/ui/column-filter-header";
import { useTableSort } from "@/hooks/useTableSort";
import { AgingCard } from "@/components/financeiro/dividas/AgingCard";
import { statusLabels, prioridadeLabels } from "@/components/financeiro/aprovacao/types";
import { norm } from "@/lib/utils";
import { formatBRL } from "@/lib/core/currency";
import { fmtCurtoBRL } from "@/lib/core/money";
import type { SolicitacaoFinanceira } from "@/hooks/financeiro/useSolicitacoesFinanceiras";
import type { StatusSolicitacao, NivelPrioridade } from "@/types";

function mesLabel(iso: string) {
  return `${iso.slice(5, 7)}/${iso.slice(0, 4)}`;
}

function bucketMes(s: SolicitacaoFinanceira): string | null {
  const base = s.data_pagamento || s.prazo_estimado || s.created_at;
  if (!base) return null;
  const iso = String(base).slice(0, 10);
  if (iso.length < 7) return null;
  return iso.slice(0, 7) + "-01";
}

const FAIXAS_VENCIDO = [
  { faixa: "1-30", ordem: 1, min: 1, max: 30 },
  { faixa: "31-60", ordem: 2, min: 31, max: 60 },
  { faixa: "61-90", ordem: 3, min: 61, max: 90 },
  { faixa: "91-180", ordem: 4, min: 91, max: 180 },
  { faixa: "180+", ordem: 5, min: 181, max: null as number | null },
];
const FAIXAS_AVENCER = [
  { faixa: "Vence hoje", ordem: 0, min: 0, max: 0 },
  { faixa: "1-7", ordem: 1, min: 1, max: 7 },
  { faixa: "8-15", ordem: 2, min: 8, max: 15 },
  { faixa: "16-30", ordem: 3, min: 16, max: 30 },
  { faixa: "31-60", ordem: 4, min: 31, max: 60 },
  { faixa: "61-90", ordem: 5, min: 61, max: 90 },
  { faixa: "90+", ordem: 6, min: 91, max: null as number | null },
];

function hojeIso() {
  return new Date().toISOString().slice(0, 10);
}
function diasEntre(a: string, b: string) {
  const ta = new Date(`${a}T00:00:00Z`).getTime();
  const tb = new Date(`${b}T00:00:00Z`).getTime();
  return Math.floor((ta - tb) / 86400000);
}
/** Data de referência para aging: data_pagamento ou prazo_estimado. */
function dataRef(s: SolicitacaoFinanceira): string | null {
  return (s.data_pagamento || s.prazo_estimado || "").slice(0, 10) || null;
}
function pagamentoAberto(s: SolicitacaoFinanceira): boolean {
  // Considera "em aberto" tudo que ainda deve pagamento: em análise ou aprovado pendente.
  if (s.status === "em_analise") return true;
  if (s.status === "aprovado" && s.pagamento_pendente) return true;
  return false;
}

type SortK =
  | "setor"
  | "solicitante"
  | "fornecedor"
  | "prazo"
  | "valor"
  | "status"
  | "prioridade"
  | "centro";

/** Card de evolução de aprovações financeiras (módulo interno).
 * Mostra KPIs, série temporal, aging (vencidos/a vencer) e tabela completa
 * com busca, filtros por coluna (estilo Excel), subtotais e "carrinho"
 * de seleção com totais. */
export function EvolucaoAprovacoesCard({
  solicitacoes,
  titulo = "Evolução de Aprovações Financeiras",
  descricao = "Módulo interno de aprovação — não inclui títulos importados do TOTVS.",
  obrasMap,
}: {
  solicitacoes: SolicitacaoFinanceira[];
  titulo?: string;
  descricao?: string;
  obrasMap?: Record<string, string>;
}) {
  const hoje = hojeIso();

  const stats = useMemo(() => {
    const kpi = {
      em_analise: { valor: 0, qtd: 0 },
      aprovado: { valor: 0, qtd: 0, pago: 0, pendente: 0 },
      reprovado: { valor: 0, qtd: 0 },
      cancelado: { valor: 0, qtd: 0 },
      total: { valor: 0, qtd: 0 },
    };
    const porMes = new Map<
      string,
      { em_analise: number; aprovado: number; reprovado: number; pago: number }
    >();
    for (const s of solicitacoes) {
      const v = Number(s.valor ?? 0) || 0;
      kpi.total.qtd += 1;
      kpi.total.valor += v;
      const k = s.status as keyof typeof kpi;
      if (k in kpi && k !== "total") {
        (kpi as any)[k].valor += v;
        (kpi as any)[k].qtd += 1;
      }
      if (s.status === "aprovado") {
        if (s.pagamento_pendente) kpi.aprovado.pendente += v;
        else kpi.aprovado.pago += v;
      }
      const mes = bucketMes(s);
      if (!mes) continue;
      const acc = porMes.get(mes) ?? { em_analise: 0, aprovado: 0, reprovado: 0, pago: 0 };
      if (s.status === "em_analise") acc.em_analise += v;
      else if (s.status === "aprovado") {
        acc.aprovado += v;
        if (!s.pagamento_pendente) acc.pago += v;
      } else if (s.status === "reprovado") acc.reprovado += v;
      porMes.set(mes, acc);
    }
    const serie = Array.from(porMes.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([data, v]) => ({ data, ...v, label: mesLabel(data) }));
    return { kpi, serie };
  }, [solicitacoes]);

  // ---- Aging ----
  const aging = useMemo(() => {
    const vencidos = FAIXAS_VENCIDO.map((f) => ({ ...f, titulos: 0, valor: 0 }));
    const aVencer = FAIXAS_AVENCER.map((f) => ({ ...f, titulos: 0, valor: 0 }));
    let totalVenc = { titulos: 0, valor: 0 };
    let totalFut = { titulos: 0, valor: 0 };
    for (const s of solicitacoes) {
      if (!pagamentoAberto(s)) continue;
      const ref = dataRef(s);
      if (!ref) continue;
      const dias = diasEntre(ref, hoje); // ref - hoje: negativo = vencido, positivo = a vencer
      const v = Number(s.valor ?? 0) || 0;
      if (dias < 0) {
        const atraso = Math.abs(dias);
        const bucket = vencidos.find((f) => atraso >= f.min && (f.max == null || atraso <= f.max));
        if (bucket) {
          bucket.titulos += 1;
          bucket.valor += v;
          totalVenc.titulos += 1;
          totalVenc.valor += v;
        }
      } else {
        const bucket = aVencer.find((f) => dias >= f.min && (f.max == null || dias <= f.max));
        if (bucket) {
          bucket.titulos += 1;
          bucket.valor += v;
          totalFut.titulos += 1;
          totalFut.valor += v;
        }
      }
    }
    return { vencidos, aVencer, totalVenc, totalFut };
  }, [solicitacoes, hoje]);

  // ---- Tabela: filtros + ordenação + carrinho ----
  const [q, setQ] = useState("");
  const [subtotaisOn, setSubtotaisOn] = useState(false);
  const [selecionados, setSelecionados] = useState<Set<string>>(() => new Set());
  // Seleção temporária dentro do chip (staging antes de "Enviar ao Carrinho").
  const [chipSel, setChipSel] = useState<Set<string>>(() => new Set());
  // Marcação de itens dentro do carrinho (para ações em lote — distinto de "remover").
  const [cartMarcados, setCartMarcados] = useState<Set<string>>(() => new Set());
  const [filtroSetor, setFiltroSetor] = useState<Set<string>>(new Set());
  const [filtroSolic, setFiltroSolic] = useState<Set<string>>(new Set());
  const [filtroForn, setFiltroForn] = useState<Set<string>>(new Set());
  const [filtroStatus, setFiltroStatus] = useState<Set<string>>(new Set());
  const [filtroPrior, setFiltroPrior] = useState<Set<string>>(new Set());
  const [filtroCentro, setFiltroCentro] = useState<Set<string>>(new Set());
  const [agingSel, setAgingSel] = useState<{ tipo: "vencido" | "avencer"; faixa: string } | null>(
    null,
  );

  // ---- Carrinho: pesquisa, filtros excel, subtotais, histórico ----
  const [cq, setCq] = useState("");
  const [cSubtotaisOn, setCSubtotaisOn] = useState(false);
  const [cFiltroSetor, setCFiltroSetor] = useState<Set<string>>(new Set());
  const [cFiltroSolic, setCFiltroSolic] = useState<Set<string>>(new Set());
  const [cFiltroForn, setCFiltroForn] = useState<Set<string>>(new Set());
  const [cFiltroStatus, setCFiltroStatus] = useState<Set<string>>(new Set());
  const [cFiltroPrior, setCFiltroPrior] = useState<Set<string>>(new Set());
  const [cFiltroCentro, setCFiltroCentro] = useState<Set<string>>(new Set());
  const [historicoOpen, setHistoricoOpen] = useState(false);
  const HIST_KEY = "aprovacao:carrinho:historico";
  type CarrinhoFechado = {
    id: string;
    fechado_em: string;
    total: number;
    itens: {
      id: string;
      setor: string;
      solicitante: string;
      fornecedor: string | null;
      centro: string;
      referencia: string | null;
      status: string;
      prioridade: string;
      valor: number;
      prazo: string;
    }[];
  };
  const [historico, setHistorico] = useState<CarrinhoFechado[]>(() => {
    try {
      const raw = localStorage.getItem(HIST_KEY);
      return raw ? (JSON.parse(raw) as CarrinhoFechado[]) : [];
    } catch {
      return [];
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem(HIST_KEY, JSON.stringify(historico));
    } catch {
      /* noop */
    }
  }, [historico]);

  const centroNome = (id: string | null) => (id ? (obrasMap?.[id] ?? id) : "—");

  const opcoes = useMemo(() => {
    const setor = new Set<string>(),
      solic = new Set<string>(),
      forn = new Set<string>(),
      status = new Set<string>(),
      prior = new Set<string>(),
      centro = new Set<string>();
    for (const s of solicitacoes) {
      setor.add(s.setor || "");
      solic.add(s.solicitante || "");
      forn.add(s.fornecedor || "");
      status.add(statusLabels[s.status as StatusSolicitacao] || s.status);
      prior.add(prioridadeLabels[s.nivel_prioridade as NivelPrioridade] || s.nivel_prioridade);
      centro.add(centroNome(s.centro_custo_id));
    }
    const sort = (set: Set<string>) => Array.from(set).sort();
    return {
      setor: sort(setor),
      solic: sort(solic),
      forn: sort(forn),
      status: sort(status),
      prior: sort(prior),
      centro: sort(centro),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [solicitacoes, obrasMap]);

  const algumFiltro =
    filtroSetor.size > 0 ||
    filtroSolic.size > 0 ||
    filtroForn.size > 0 ||
    filtroStatus.size > 0 ||
    filtroPrior.size > 0 ||
    filtroCentro.size > 0;

  function limparFiltros() {
    setFiltroSetor(new Set());
    setFiltroSolic(new Set());
    setFiltroForn(new Set());
    setFiltroStatus(new Set());
    setFiltroPrior(new Set());
    setFiltroCentro(new Set());
  }

  function passaFiltroColuna(sel: Set<string>, valor: string) {
    if (sel.size === 0) return true;
    if (sel.has("__none__")) return false;
    return sel.has(valor);
  }

  function passaAging(s: SolicitacaoFinanceira): boolean {
    if (!agingSel) return true;
    if (!pagamentoAberto(s)) return false;
    const ref = dataRef(s);
    if (!ref) return false;
    const dias = diasEntre(ref, hoje);
    if (agingSel.tipo === "vencido") {
      if (dias >= 0) return false;
      const atraso = Math.abs(dias);
      const f = FAIXAS_VENCIDO.find((x) => x.faixa === agingSel.faixa);
      return !!f && atraso >= f.min && (f.max == null || atraso <= f.max);
    }
    if (dias < 0) return false;
    const f = FAIXAS_AVENCER.find((x) => x.faixa === agingSel.faixa);
    return !!f && dias >= f.min && (f.max == null || dias <= f.max);
  }

  const filtrados = useMemo(() => {
    const needle = norm(q);
    return solicitacoes.filter((s) => {
      if (!passaAging(s)) return false;
      if (needle) {
        const hay = [
          s.setor,
          s.solicitante,
          s.fornecedor,
          s.referencia,
          s.observacao,
          centroNome(s.centro_custo_id),
        ]
          .map((x) => norm(x))
          .join(" ");
        if (!hay.includes(needle)) return false;
      }
      if (!passaFiltroColuna(filtroSetor, s.setor || "")) return false;
      if (!passaFiltroColuna(filtroSolic, s.solicitante || "")) return false;
      if (!passaFiltroColuna(filtroForn, s.fornecedor || "")) return false;
      if (
        !passaFiltroColuna(filtroStatus, statusLabels[s.status as StatusSolicitacao] || s.status)
      )
        return false;
      if (
        !passaFiltroColuna(
          filtroPrior,
          prioridadeLabels[s.nivel_prioridade as NivelPrioridade] || s.nivel_prioridade,
        )
      )
        return false;
      if (!passaFiltroColuna(filtroCentro, centroNome(s.centro_custo_id))) return false;
      return true;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    solicitacoes,
    q,
    filtroSetor,
    filtroSolic,
    filtroForn,
    filtroStatus,
    filtroPrior,
    filtroCentro,
    agingSel,
    hoje,
    obrasMap,
  ]);

  const { sorted, sortKey, sortDir, toggle } = useTableSort<SolicitacaoFinanceira, SortK>(
    filtrados,
    (row, k) => {
      switch (k) {
        case "setor":
          return row.setor;
        case "solicitante":
          return row.solicitante;
        case "fornecedor":
          return row.fornecedor ?? "";
        case "prazo":
          return row.data_pagamento || row.prazo_estimado || "";
        case "valor":
          return Number(row.valor ?? 0);
        case "status":
          return statusLabels[row.status as StatusSolicitacao] || row.status;
        case "prioridade":
          return prioridadeLabels[row.nivel_prioridade as NivelPrioridade] || row.nivel_prioridade;
        case "centro":
          return centroNome(row.centro_custo_id);
      }
    },
    "prazo",
    "asc",
  );

  // subtotais por status
  const totalGeral = useMemo(
    () => filtrados.reduce((s, r) => s + Number(r.valor ?? 0), 0),
    [filtrados],
  );
  const totalSel = useMemo(
    () =>
      filtrados
        .filter((r) => selecionados.has(r.id))
        .reduce((s, r) => s + Number(r.valor ?? 0), 0),
    [filtrados, selecionados],
  );
  // Carrinho é global (independe do filtro/aging atual).
  const totalCarrinho = useMemo(
    () =>
      solicitacoes
        .filter((r) => selecionados.has(r.id))
        .reduce((s, r) => s + Number(r.valor ?? 0), 0),
    [solicitacoes, selecionados],
  );

  function toggleSel(id: string) {
    setSelecionados((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }
  function toggleChipSel(id: string) {
    setChipSel((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }
  function toggleAllChip() {
    if (sorted.length > 0 && sorted.every((r) => chipSel.has(r.id))) setChipSel(new Set());
    else setChipSel(new Set(sorted.map((r) => r.id)));
  }
  function enviarChipAoCarrinho() {
    if (chipSel.size === 0) return;
    setSelecionados((prev) => {
      const n = new Set(prev);
      chipSel.forEach((id) => n.add(id));
      return n;
    });
    setChipSel(new Set());
  }

  function toggleCartMarcado(id: string) {
    setCartMarcados((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }
  function removerDoCarrinho(id: string) {
    setSelecionados((prev) => {
      const n = new Set(prev);
      n.delete(id);
      return n;
    });
    setCartMarcados((prev) => {
      if (!prev.has(id)) return prev;
      const n = new Set(prev);
      n.delete(id);
      return n;
    });
  }
  function removerMarcadosDoCarrinho() {
    if (cartMarcados.size === 0) return;
    setSelecionados((prev) => {
      const n = new Set(prev);
      cartMarcados.forEach((id) => n.delete(id));
      return n;
    });
    setCartMarcados(new Set());
  }

  // Itens do carrinho (globais)
  const carrinhoItens = useMemo(
    () => solicitacoes.filter((r) => selecionados.has(r.id)),
    [solicitacoes, selecionados],
  );

  const carrinhoOpcoes = useMemo(() => {
    const setor = new Set<string>(),
      solic = new Set<string>(),
      forn = new Set<string>(),
      status = new Set<string>(),
      prior = new Set<string>(),
      centro = new Set<string>();
    for (const s of carrinhoItens) {
      setor.add(s.setor || "");
      solic.add(s.solicitante || "");
      forn.add(s.fornecedor || "");
      status.add(statusLabels[s.status as StatusSolicitacao] || s.status);
      prior.add(prioridadeLabels[s.nivel_prioridade as NivelPrioridade] || s.nivel_prioridade);
      centro.add(centroNome(s.centro_custo_id));
    }
    const sort = (set: Set<string>) => Array.from(set).sort();
    return {
      setor: sort(setor),
      solic: sort(solic),
      forn: sort(forn),
      status: sort(status),
      prior: sort(prior),
      centro: sort(centro),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [carrinhoItens, obrasMap]);

  const carrinhoAlgumFiltro =
    cFiltroSetor.size > 0 ||
    cFiltroSolic.size > 0 ||
    cFiltroForn.size > 0 ||
    cFiltroStatus.size > 0 ||
    cFiltroPrior.size > 0 ||
    cFiltroCentro.size > 0;

  const carrinhoFiltrado = useMemo(() => {
    const needle = norm(cq);
    return carrinhoItens.filter((s) => {
      if (needle) {
        const hay = [
          s.setor,
          s.solicitante,
          s.fornecedor,
          s.referencia,
          s.observacao,
          centroNome(s.centro_custo_id),
        ]
          .map((x) => norm(x))
          .join(" ");
        if (!hay.includes(needle)) return false;
      }
      if (!passaFiltroColuna(cFiltroSetor, s.setor || "")) return false;
      if (!passaFiltroColuna(cFiltroSolic, s.solicitante || "")) return false;
      if (!passaFiltroColuna(cFiltroForn, s.fornecedor || "")) return false;
      if (
        !passaFiltroColuna(cFiltroStatus, statusLabels[s.status as StatusSolicitacao] || s.status)
      )
        return false;
      if (
        !passaFiltroColuna(
          cFiltroPrior,
          prioridadeLabels[s.nivel_prioridade as NivelPrioridade] || s.nivel_prioridade,
        )
      )
        return false;
      if (!passaFiltroColuna(cFiltroCentro, centroNome(s.centro_custo_id))) return false;
      return true;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    carrinhoItens,
    cq,
    cFiltroSetor,
    cFiltroSolic,
    cFiltroForn,
    cFiltroStatus,
    cFiltroPrior,
    cFiltroCentro,
    obrasMap,
  ]);

  const carrinhoSort = useTableSort<SolicitacaoFinanceira, SortK>(
    carrinhoFiltrado,
    (row, k) => {
      switch (k) {
        case "setor":
          return row.setor;
        case "solicitante":
          return row.solicitante;
        case "fornecedor":
          return row.fornecedor ?? "";
        case "prazo":
          return row.data_pagamento || row.prazo_estimado || "";
        case "valor":
          return Number(row.valor ?? 0);
        case "status":
          return statusLabels[row.status as StatusSolicitacao] || row.status;
        case "prioridade":
          return prioridadeLabels[row.nivel_prioridade as NivelPrioridade] || row.nivel_prioridade;
        case "centro":
          return centroNome(row.centro_custo_id);
      }
    },
    "prazo",
    "asc",
  );
  const totalCarrinhoFiltrado = useMemo(
    () =>
      carrinhoFiltrado
        .filter((r) => cartMarcados.has(r.id))
        .reduce((s, r) => s + Number(r.valor ?? 0), 0),
    [carrinhoFiltrado, cartMarcados],
  );

  function limparFiltrosCarrinho() {
    setCFiltroSetor(new Set());
    setCFiltroSolic(new Set());
    setCFiltroForn(new Set());
    setCFiltroStatus(new Set());
    setCFiltroPrior(new Set());
    setCFiltroCentro(new Set());
  }

  function exportarCSV(itens: SolicitacaoFinanceira[], nomeArquivo: string) {
    if (itens.length === 0) return;
    const header =
      "Setor;Solicitante;Fornecedor;Centro;Referência;Prioridade;Status;Prazo;Valor\n";
    const linhas = itens
      .map((s) => {
        const prazo = s.data_pagamento || s.prazo_estimado || "";
        const prazoBR = prazo
          ? `${prazo.slice(8, 10)}/${prazo.slice(5, 7)}/${prazo.slice(0, 4)}`
          : "";
        return [
          (s.setor ?? "").replace(/;/g, ","),
          (s.solicitante ?? "").replace(/;/g, ","),
          (s.fornecedor ?? "").replace(/;/g, ","),
          centroNome(s.centro_custo_id).replace(/;/g, ","),
          (s.referencia ?? "").replace(/;/g, ","),
          prioridadeLabels[s.nivel_prioridade as NivelPrioridade] || s.nivel_prioridade,
          statusLabels[s.status as StatusSolicitacao] || s.status,
          prazoBR,
          Number(s.valor ?? 0).toFixed(2).replace(".", ","),
        ].join(";");
      })
      .join("\n");
    const blob = new Blob(["\uFEFF" + header + linhas], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = nomeArquivo;
    a.click();
    URL.revokeObjectURL(url);
  }

  function exportarHistorico(entrada: CarrinhoFechado) {
    const header =
      "Setor;Solicitante;Fornecedor;Centro;Referência;Prioridade;Status;Prazo;Valor\n";
    const linhas = entrada.itens
      .map((s) =>
        [
          (s.setor ?? "").replace(/;/g, ","),
          (s.solicitante ?? "").replace(/;/g, ","),
          (s.fornecedor ?? "").replace(/;/g, ","),
          (s.centro ?? "").replace(/;/g, ","),
          (s.referencia ?? "").replace(/;/g, ","),
          s.prioridade,
          s.status,
          s.prazo,
          Number(s.valor ?? 0).toFixed(2).replace(".", ","),
        ].join(";"),
      )
      .join("\n");
    const blob = new Blob(["\uFEFF" + header + linhas], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `carrinho-${entrada.fechado_em.slice(0, 19).replace(/[:T]/g, "-")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function fecharCarrinho() {
    if (carrinhoItens.length === 0) return;
    const entrada: CarrinhoFechado = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      fechado_em: new Date().toISOString(),
      total: carrinhoItens.reduce((s, r) => s + Number(r.valor ?? 0), 0),
      itens: carrinhoItens.map((s) => {
        const prazo = s.data_pagamento || s.prazo_estimado || "";
        return {
          id: s.id,
          setor: s.setor,
          solicitante: s.solicitante,
          fornecedor: s.fornecedor,
          centro: centroNome(s.centro_custo_id),
          referencia: s.referencia,
          status: statusLabels[s.status as StatusSolicitacao] || s.status,
          prioridade:
            prioridadeLabels[s.nivel_prioridade as NivelPrioridade] || s.nivel_prioridade,
          valor: Number(s.valor ?? 0),
          prazo: prazo
            ? `${prazo.slice(8, 10)}/${prazo.slice(5, 7)}/${prazo.slice(0, 4)}`
            : "",
        };
      }),
    };
    setHistorico((prev) => [entrada, ...prev]);
    setSelecionados(new Set());
    limparFiltrosCarrinho();
    setCq("");
    toast.success("Carrinho fechado e adicionado ao histórico", {
      action: { label: "Exportar CSV", onClick: () => exportarHistorico(entrada) },
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-primary" />
          {titulo}
        </CardTitle>
        <p className="text-xs text-muted-foreground">{descricao}</p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KpiMini
            label="Em análise"
            valor={stats.kpi.em_analise.valor}
            qtd={stats.kpi.em_analise.qtd}
            tone="warn"
          />
          <KpiMini
            label="Aprovado"
            valor={stats.kpi.aprovado.valor}
            qtd={stats.kpi.aprovado.qtd}
            tone="success"
            footer={`Pgto pendente: ${formatBRL(stats.kpi.aprovado.pendente)}`}
          />
          <KpiMini
            label="Reprovado / Cancelado"
            valor={stats.kpi.reprovado.valor + stats.kpi.cancelado.valor}
            qtd={stats.kpi.reprovado.qtd + stats.kpi.cancelado.qtd}
            tone="danger"
          />
          <KpiMini
            label="Total do módulo"
            valor={stats.kpi.total.valor}
            qtd={stats.kpi.total.qtd}
            tone="neutral"
          />
        </div>

        {stats.serie.length === 0 ? (
          <div className="text-sm text-muted-foreground text-center py-8 border rounded-md">
            Nenhuma solicitação registrada ainda.
          </div>
        ) : (
          <div className="h-[360px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={stats.serie} margin={{ top: 8, right: 16, left: 8, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="label" stroke="hsl(var(--muted-foreground))" />
                <YAxis
                  stroke="hsl(var(--muted-foreground))"
                  tickFormatter={(v) => fmtCurtoBRL(Number(v))}
                  width={72}
                />
                <Tooltip
                  formatter={(v, name) => [formatBRL(Number(v)), String(name)]}
                  contentStyle={{
                    background: "hsl(var(--popover))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: 8,
                  }}
                />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="em_analise"
                  name="Em análise"
                  stroke="hsl(var(--warning, 38 92% 50%))"
                  strokeWidth={2}
                  dot
                />
                <Line
                  type="monotone"
                  dataKey="aprovado"
                  name="Aprovado"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  dot
                />
                <Line
                  type="monotone"
                  dataKey="pago"
                  name="Pago"
                  stroke="hsl(var(--muted-foreground))"
                  strokeWidth={1.5}
                  strokeDasharray="4 4"
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="reprovado"
                  name="Reprovado"
                  stroke="hsl(var(--destructive))"
                  strokeWidth={2}
                  dot
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <AgingCard
            titulo="Aging vencidos (aprovações em aberto)"
            aging={aging.vencidos}
            total={aging.totalVenc}
            empty="Nenhuma solicitação vencida em aberto."
            onSel={(faixa) => setAgingSel({ tipo: "vencido", faixa })}
            legenda="Vencidos = solicitações em análise ou aprovadas com pagamento pendente, com data_pagamento/prazo já passados."
          />
          <AgingCard
            titulo="Aging a vencer"
            aging={aging.aVencer}
            total={aging.totalFut}
            empty="Nenhuma solicitação a vencer."
            onSel={(faixa) => setAgingSel({ tipo: "avencer", faixa })}
            variantDestaque={(o) => o === 0}
          />
        </div>
        {agingSel && (
          <div className="flex items-center gap-2 text-sm">
            <Badge variant="secondary" className="gap-1 px-2 py-1">
              Filtrando por aging: {agingSel.tipo === "vencido" ? "Vencidos" : "A vencer"} ·{" "}
              {agingSel.faixa}
              <button
                type="button"
                onClick={() => setAgingSel(null)}
                className="ml-1 hover:text-foreground/80"
                aria-label="Limpar aging"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          </div>
        )}

        <Dialog open={!!agingSel} onOpenChange={(v) => !v && setAgingSel(null)}>
          <DialogContent className="max-w-6xl">
            <DialogHeader>
              <DialogTitle>
                {agingSel?.tipo === "vencido" ? "Vencidos" : "A vencer"} · {agingSel?.faixa} —{" "}
                {filtrados.length} de {solicitacoes.length} · Total: {formatBRL(totalGeral)}
              </DialogTitle>
            </DialogHeader>

            <div className="flex items-center gap-2 flex-wrap">
              <div className="relative flex-1 min-w-[200px] max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar setor, solicitante, fornecedor, referência..."
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  className="pl-9 h-8 text-sm"
                />
              </div>
              <Button
                variant={subtotaisOn ? "default" : "outline"}
                size="sm"
                onClick={() => setSubtotaisOn((v) => !v)}
              >
                <ListChecks className="h-4 w-4 mr-1" /> Subtotais por status
              </Button>
              <Button
                variant="default"
                size="sm"
                onClick={enviarChipAoCarrinho}
                disabled={chipSel.size === 0}
                title="Enviar itens selecionados ao carrinho"
              >
                <ShoppingCart className="h-4 w-4 mr-1" /> Enviar ao Carrinho ({chipSel.size})
              </Button>
              {(algumFiltro || q) && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    limparFiltros();
                    setQ("");
                  }}
                >
                  <X className="h-4 w-4 mr-1" /> Limpar filtros
                </Button>
              )}
            </div>

            <div className="max-h-[55vh] overflow-auto border rounded-md">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50 sticky top-0 z-10">
                    <TableHead className="w-8">
                      <Checkbox
                        checked={sorted.length > 0 && sorted.every((r) => chipSel.has(r.id))}
                        onCheckedChange={toggleAllChip}
                      />
                    </TableHead>
                    <ColumnFilterHeader<SortK> sortKey="setor" currentKey={sortKey} dir={sortDir} onToggleSort={toggle} options={opcoes.setor} selected={filtroSetor} onChangeSelected={setFiltroSetor}>Setor</ColumnFilterHeader>
                    <ColumnFilterHeader<SortK> sortKey="solicitante" currentKey={sortKey} dir={sortDir} onToggleSort={toggle} options={opcoes.solic} selected={filtroSolic} onChangeSelected={setFiltroSolic}>Solicitante</ColumnFilterHeader>
                    <ColumnFilterHeader<SortK> sortKey="fornecedor" currentKey={sortKey} dir={sortDir} onToggleSort={toggle} options={opcoes.forn} selected={filtroForn} onChangeSelected={setFiltroForn}>Fornecedor</ColumnFilterHeader>
                    <ColumnFilterHeader<SortK> sortKey="centro" currentKey={sortKey} dir={sortDir} onToggleSort={toggle} options={opcoes.centro} selected={filtroCentro} onChangeSelected={setFiltroCentro}>Centro</ColumnFilterHeader>
                    <ColumnFilterHeader<SortK> sortKey="prioridade" currentKey={sortKey} dir={sortDir} onToggleSort={toggle} options={opcoes.prior} selected={filtroPrior} onChangeSelected={setFiltroPrior}>Prioridade</ColumnFilterHeader>
                    <ColumnFilterHeader<SortK> sortKey="status" currentKey={sortKey} dir={sortDir} onToggleSort={toggle} options={opcoes.status} selected={filtroStatus} onChangeSelected={setFiltroStatus}>Status</ColumnFilterHeader>
                    <TableHead>Prazo/Pgto</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sorted.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center text-muted-foreground py-6">Nenhuma solicitação encontrada.</TableCell>
                    </TableRow>
                  ) : (
                    renderRows(sorted, { subtotaisOn, selecionados: chipSel, toggleSel: toggleChipSel, centroNome })
                  )}
                </TableBody>
              </Table>
            </div>

            {(() => {
              const selNoChip = sorted.filter((r) => chipSel.has(r.id));
              const totalSel = selNoChip.reduce((acc, r) => acc + (r.valor || 0), 0);
              return (
                <div className="flex items-center justify-between gap-2 bg-muted/40 border rounded-md px-3 py-2 text-sm mt-2">
                  <span>Selecionados neste aging: <strong>{selNoChip.length}</strong> de {sorted.length}</span>
                  <span>Subtotal da seleção: <strong>{formatBRL(totalSel)}</strong></span>
                </div>
              );
            })()}
          </DialogContent>
        </Dialog>

        <div className="bg-muted/40 border rounded-md p-3 text-sm space-y-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              <ShoppingCart className="h-4 w-4 text-primary" />
              <span>Carrinho: <strong>{selecionados.size}</strong> solicitação(ões) · <strong>{formatBRL(totalCarrinho)}</strong></span>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Button variant="outline" size="sm" onClick={() => setHistoricoOpen(true)} title="Ver histórico de carrinhos fechados">
                <History className="h-4 w-4 mr-1" /> Histórico
                {historico.length > 0 && <Badge variant="secondary" className="ml-1 text-[10px]">{historico.length}</Badge>}
              </Button>
              <Button variant="outline" size="sm" onClick={() => exportarCSV(carrinhoFiltrado, "carrinho.csv")} disabled={carrinhoFiltrado.length === 0}>
                <Download className="h-4 w-4 mr-1" /> Exportar CSV
              </Button>
              <Button variant="default" size="sm" onClick={fecharCarrinho} disabled={selecionados.size === 0} title="Fechar carrinho e gerar histórico">
                <Archive className="h-4 w-4 mr-1" /> Fechar Carrinho
              </Button>
              {selecionados.size > 0 && (
                <Button variant="ghost" size="sm" onClick={() => setSelecionados(new Set())}>
                  <Trash2 className="h-4 w-4 mr-1" /> Esvaziar
                </Button>
              )}
            </div>
          </div>

          {selecionados.size > 0 && (
            <div className="flex items-center gap-2 flex-wrap text-xs text-muted-foreground">
              <span>Marcados: <strong className="text-foreground">{cartMarcados.size}</strong> de {selecionados.size}</span>
              {cartMarcados.size > 0 && (
                <>
                  <Button variant="destructive" size="sm" onClick={removerMarcadosDoCarrinho} title="Remover itens marcados do carrinho">
                    <X className="h-4 w-4 mr-1" /> Remover marcados ({cartMarcados.size})
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setCartMarcados(new Set())} title="Desmarcar todos">Desmarcar</Button>
                </>
              )}
            </div>
          )}

          {selecionados.size > 0 && (
            <>
              <div className="flex items-center gap-2 flex-wrap">
                <div className="relative flex-1 min-w-[200px] max-w-sm">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input placeholder="Buscar no carrinho..." value={cq} onChange={(e) => setCq(e.target.value)} className="pl-9 h-8 text-sm" />
                </div>
                <Button variant={cSubtotaisOn ? "default" : "outline"} size="sm" onClick={() => setCSubtotaisOn((v) => !v)}>
                  <ListChecks className="h-4 w-4 mr-1" /> Subtotais por status
                </Button>
                {(carrinhoAlgumFiltro || cq) && (
                  <Button variant="ghost" size="sm" onClick={() => { limparFiltrosCarrinho(); setCq(""); }}>
                    <X className="h-4 w-4 mr-1" /> Limpar filtros
                  </Button>
                )}
                <span className="text-xs text-muted-foreground ml-auto">
                  {carrinhoFiltrado.length} de {carrinhoItens.length} · Subtotal (marcados {cartMarcados.size}): <strong className="text-foreground">{formatBRL(totalCarrinhoFiltrado)}</strong>
                </span>
              </div>

              <div className="max-h-[45vh] overflow-auto border rounded-md bg-background">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50 sticky top-0 z-10">
                      <TableHead className="w-8"></TableHead>
                      <ColumnFilterHeader<SortK> sortKey="setor" currentKey={carrinhoSort.sortKey} dir={carrinhoSort.sortDir} onToggleSort={carrinhoSort.toggle} options={carrinhoOpcoes.setor} selected={cFiltroSetor} onChangeSelected={setCFiltroSetor}>Setor</ColumnFilterHeader>
                      <ColumnFilterHeader<SortK> sortKey="solicitante" currentKey={carrinhoSort.sortKey} dir={carrinhoSort.sortDir} onToggleSort={carrinhoSort.toggle} options={carrinhoOpcoes.solic} selected={cFiltroSolic} onChangeSelected={setCFiltroSolic}>Solicitante</ColumnFilterHeader>
                      <ColumnFilterHeader<SortK> sortKey="fornecedor" currentKey={carrinhoSort.sortKey} dir={carrinhoSort.sortDir} onToggleSort={carrinhoSort.toggle} options={carrinhoOpcoes.forn} selected={cFiltroForn} onChangeSelected={setCFiltroForn}>Fornecedor</ColumnFilterHeader>
                      <ColumnFilterHeader<SortK> sortKey="centro" currentKey={carrinhoSort.sortKey} dir={carrinhoSort.sortDir} onToggleSort={carrinhoSort.toggle} options={carrinhoOpcoes.centro} selected={cFiltroCentro} onChangeSelected={setCFiltroCentro}>Centro</ColumnFilterHeader>
                      <ColumnFilterHeader<SortK> sortKey="prioridade" currentKey={carrinhoSort.sortKey} dir={carrinhoSort.sortDir} onToggleSort={carrinhoSort.toggle} options={carrinhoOpcoes.prior} selected={cFiltroPrior} onChangeSelected={setCFiltroPrior}>Prioridade</ColumnFilterHeader>
                      <ColumnFilterHeader<SortK> sortKey="status" currentKey={carrinhoSort.sortKey} dir={carrinhoSort.sortDir} onToggleSort={carrinhoSort.toggle} options={carrinhoOpcoes.status} selected={cFiltroStatus} onChangeSelected={setCFiltroStatus}>Status</ColumnFilterHeader>
                      <TableHead>Prazo/Pgto</TableHead>
                      <TableHead className="text-right">Valor</TableHead>
                      <TableHead className="w-12 text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {carrinhoSort.sorted.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={10} className="text-center text-muted-foreground py-6">Nenhum item corresponde aos filtros.</TableCell>
                      </TableRow>
                    ) : (
                      renderRows(carrinhoSort.sorted, { subtotaisOn: cSubtotaisOn, selecionados: cartMarcados, toggleSel: toggleCartMarcado, centroNome, onRemove: removerDoCarrinho })
                    )}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </div>

        <Dialog open={historicoOpen} onOpenChange={setHistoricoOpen}>
          <DialogContent className="max-w-4xl">
            <DialogHeader><DialogTitle>Histórico de carrinhos fechados</DialogTitle></DialogHeader>
            {historico.length === 0 ? (
              <div className="text-sm text-muted-foreground text-center py-6">Nenhum carrinho fechado ainda.</div>
            ) : (
              <div className="max-h-[60vh] overflow-auto border rounded-md">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50 sticky top-0 z-10">
                      <TableHead>Fechado em</TableHead>
                      <TableHead className="text-right">Itens</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead className="w-56 text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {historico.map((h) => {
                      const d = new Date(h.fechado_em);
                      return (
                        <TableRow key={h.id}>
                          <TableCell className="text-xs">{d.toLocaleString("pt-BR")}</TableCell>
                          <TableCell className="text-right">{h.itens.length}</TableCell>
                          <TableCell className="text-right font-medium">{formatBRL(h.total)}</TableCell>
                          <TableCell className="text-right">
                            <Button variant="outline" size="sm" className="mr-2" onClick={() => exportarHistorico(h)}><Download className="h-4 w-4 mr-1" /> CSV</Button>
                            <Button variant="ghost" size="sm" onClick={() => setHistorico((prev) => prev.filter((x) => x.id !== h.id))}><Trash2 className="h-4 w-4" /></Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </DialogContent>
        </Dialog>

        <p className="text-xs text-muted-foreground">
          Bucket mensal por <strong>data de pagamento</strong> (ou prazo estimado / criação como fallback). Valores em BRL.
        </p>
      </CardContent>
    </Card>
  );
}

function renderRows(
  sorted: SolicitacaoFinanceira[],
  ctx: {
    subtotaisOn: boolean;
    selecionados: Set<string>;
    toggleSel: (id: string) => void;
    centroNome: (id: string | null) => string;
    onRemove?: (id: string) => void;
  },
) {
  const { subtotaisOn, selecionados, toggleSel, centroNome, onRemove } = ctx;
  const rows: JSX.Element[] = [];
  let grupoAtual: string | null = null;
  let grupoAcc = { qtd: 0, valor: 0 };
  const flushSub = () => {
    if (subtotaisOn && grupoAtual != null && grupoAcc.qtd > 0) {
      rows.push(
        <TableRow key={`sub-${grupoAtual}`} className="bg-muted/30 font-medium">
          <TableCell colSpan={7} className="text-right">
            Subtotal — {statusLabels[grupoAtual as StatusSolicitacao] || grupoAtual} (marcados {grupoAcc.qtd})
          </TableCell>
          <TableCell />
          <TableCell className="text-right">{formatBRL(grupoAcc.valor)}</TableCell>
          {onRemove && <TableCell />}
        </TableRow>,
      );
    }
  };
  const list = subtotaisOn ? [...sorted].sort((a, b) => a.status.localeCompare(b.status)) : sorted;
  for (const s of list) {
    if (subtotaisOn && s.status !== grupoAtual) {
      flushSub();
      grupoAtual = s.status;
      grupoAcc = { qtd: 0, valor: 0 };
    }
    if (selecionados.has(s.id)) {
      grupoAcc.qtd += 1;
      grupoAcc.valor += Number(s.valor ?? 0);
    }
    const prazo = s.data_pagamento || s.prazo_estimado || "";
    rows.push(
      <TableRow key={s.id} className="hover:bg-muted/40">
        <TableCell><Checkbox checked={selecionados.has(s.id)} onCheckedChange={() => toggleSel(s.id)} /></TableCell>
        <TableCell>{s.setor}</TableCell>
        <TableCell>{s.solicitante}</TableCell>
        <TableCell>{s.fornecedor ?? "—"}</TableCell>
        <TableCell className="max-w-[180px] truncate">{centroNome(s.centro_custo_id)}</TableCell>
        <TableCell><Badge variant="outline" className="text-[10px]">{prioridadeLabels[s.nivel_prioridade as NivelPrioridade] || s.nivel_prioridade}</Badge></TableCell>
        <TableCell><Badge variant="secondary" className="text-[10px]">{statusLabels[s.status as StatusSolicitacao] || s.status}</Badge></TableCell>
        <TableCell className="text-xs">{prazo ? prazo.slice(8, 10) + "/" + prazo.slice(5, 7) + "/" + prazo.slice(0, 4) : "—"}</TableCell>
        <TableCell className="text-right font-medium">{formatBRL(Number(s.valor ?? 0))}</TableCell>
        {onRemove && (
          <TableCell className="text-right">
            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => onRemove(s.id)} title="Remover do carrinho"><X className="h-4 w-4" /></Button>
          </TableCell>
        )}
      </TableRow>,
    );
  }
  if (subtotaisOn) flushSub();
  return rows;
}

function KpiMini({
  label,
  valor,
  qtd,
  tone,
  footer,
}: {
  label: string;
  valor: number;
  qtd: number;
  tone: "warn" | "success" | "danger" | "neutral";
  footer?: string;
}) {
  const toneCls =
    tone === "warn"
      ? "text-amber-600"
      : tone === "success"
        ? "text-emerald-600"
        : tone === "danger"
          ? "text-destructive"
          : "text-foreground";
  return (
    <div className="border rounded-lg p-3 space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">{label}</span>
        <Badge variant="outline" className="text-[10px]">{qtd}</Badge>
      </div>
      <div className={`text-lg font-semibold ${toneCls}`}>{formatBRL(valor)}</div>
      {footer && <div className="text-[11px] text-muted-foreground">{footer}</div>}
    </div>
  );
}
