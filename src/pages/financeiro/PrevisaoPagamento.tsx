import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Trash2, Download, Lock, History, Calculator, Search, X } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ColumnFilterHeader } from "@/components/ui/column-filter-header";
import { SortHeader } from "@/components/ui/sort-header";
import { useTableSort } from "@/hooks/useTableSort";
import { norm } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAuth } from "@/contexts/auth/useAuth";
import { useObras } from "@/hooks/obras/useObras";
import { useSolicitacoesFinanceiras } from "@/hooks/financeiro/useSolicitacoesFinanceiras";

import { brl } from "@/lib/billing";
import { fmtData } from "@/lib/utils";
import { financeiroTotvsRepo as financeiroRepo } from "@/lib/repositories/financeiro";
import {
  agruparPorCentroCusto,
  agruparPorNatureza,
} from "@/lib/financeiro-totvs/agrupamentos";

type CarrinhoItemVivo = {
  itemId: string;
  ref_lancamento: number | null;
  solicitacao_id?: string | null;

  nome: string;
  centro_custo: string;
  centro_nome: string;
  natureza_cod: string;
  natureza_desc: string;
  status_label: string;
  status_cod: number | null;
  data_vencimento: string | null;
  aberto: number;
  origem: string;
  previsto: boolean;
};

function decorar(vivas: any[]): Map<number, {
  nome: string;
  centro_custo: string;
  centro_nome: string;
  natureza_cod: string;
  natureza_desc: string;
  status_label: string;
  status_cod: number | null;
  data_vencimento: string | null;
  aberto: number;
  origem: string;
  previsto: boolean;
}> {
  // Agrupa fatias (uma linha por natureza) por ref_lancamento, mantendo natureza principal.
  const acc = new Map<number, any>();
  for (const r of vivas) {
    const ref = Number(r.ref_lancamento);
    if (!Number.isFinite(ref)) continue;
    const cur = acc.get(ref) ?? {
      ref_lancamento: ref,
      nome: r.contraparte ?? r.nome ?? "—",
      centro_custo: r.centro_custo ?? "",
      centro_nome: r.desc_centro_custo ?? r.centro_custo ?? "—",
      status_label: r.status_label ?? "",
      status_cod: r.status_cod ?? null,
      data_vencimento: r.data_vencimento ?? null,
      valor_liquido: Number(r.valor_liquido ?? 0),
      valor_baixado: Number(r.valor_baixado ?? 0),
      origem: r.origem ?? "totvs",
      previsto: !!r.previsto || r.origem === "sistema",
      naturezas: [] as Array<{ cod: string; desc: string; valor: number }>,
    };
    if (r.cod_natureza || r.desc_natureza) {
      cur.naturezas.push({
        cod: r.cod_natureza ?? "",
        desc: r.desc_natureza ?? "",
        valor: Number(r.valor_rateio ?? 0),
      });
    }
    acc.set(ref, cur);
  }
  const out = new Map<number, any>();
  for (const [ref, l] of acc) {
    l.naturezas.sort((a: any, b: any) => b.valor - a.valor);
    const principal = l.naturezas[0];
    out.set(ref, {
      nome: l.nome,
      centro_custo: l.centro_custo,
      centro_nome: l.centro_nome,
      natureza_cod: principal?.cod ?? "",
      natureza_desc: principal?.desc ?? "",
      status_label: l.status_label,
      status_cod: l.status_cod,
      data_vencimento: l.data_vencimento,
      aberto: Math.max(0, l.valor_liquido - l.valor_baixado),
      origem: l.origem,
      previsto: l.previsto,
    });
  }
  return out;
}

export default function PrevisaoPagamento() {
  const { currentPlayer } = useAuth();
  const usuarioId = currentPlayer?.id ?? "";
  const [loading, setLoading] = useState(true);
  const [carrinho, setCarrinho] = useState<{ id: string; titulo: string } | null>(null);
  const [itens, setItens] = useState<CarrinhoItemVivo[]>([]);
  const [fechados, setFechados] = useState<Awaited<ReturnType<typeof financeiroRepo.listCarrinhosFechados>>>([]);
  const [detalheAberto, setDetalheAberto] = useState<{ id: string; titulo: string } | null>(null);
  const [detalheItens, setDetalheItens] = useState<any[]>([]);
  const [fechando, setFechando] = useState(false);
  const [q, setQ] = useState("");
  const [filtroNome, setFiltroNome] = useState<Set<string>>(new Set());
  const [filtroCentro, setFiltroCentro] = useState<Set<string>>(new Set());
  const [filtroNatureza, setFiltroNatureza] = useState<Set<string>>(new Set());
  const [filtroStatus, setFiltroStatus] = useState<Set<string>>(new Set());
  const { data: obras = [] } = useObras();
  const { data: solicitacoesApi = [] } = useSolicitacoesFinanceiras();
  const solicitacaoPorId = useMemo(
    () => new Map<string, any>((solicitacoesApi as any[]).map((s: any) => [String(s.id), s])),
    [solicitacoesApi],
  );
  const nomeObraPorId = useMemo(
    () => new Map<string, string>((obras as any[]).map((o: any) => [String(o.id), o.nome ?? o.codigo ?? "—"])),
    [obras],
  );



  const carregar = useCallback(async () => {
    if (!usuarioId) return;
    setLoading(true);
    try {
      const c = await financeiroRepo.getOrCreateCarrinhoAberto(usuarioId);
      setCarrinho({ id: c.id, titulo: c.titulo });
      const itensCarrinho = await financeiroRepo.listCarrinhoItens(c.id);
      const refs = itensCarrinho
        .filter((i) => i.ref_lancamento != null)
        .map((i) => Number(i.ref_lancamento));
      const solIds = itensCarrinho
        .filter((i) => !!i.solicitacao_id)
        .map((i) => String(i.solicitacao_id));
      const [vivas, sols] = await Promise.all([
        financeiroRepo.listCarrinhoTitulosAoVivo(refs),
        financeiroRepo.listCarrinhoSolicitacoesAoVivo(solIds),
      ]);
      const decor = decorar(vivas);
      const decorSol = new Map<string, any>((sols ?? []).map((s: any) => [String(s.id), s]));
      const linhas: CarrinhoItemVivo[] = itensCarrinho.map((it) => {
        if (it.solicitacao_id) {
          // Título vindo da aprovação financeira (sem ref_lancamento no TOTVS).
          const s =
            decorSol.get(String(it.solicitacao_id)) ??
            solicitacaoPorId.get(String(it.solicitacao_id));
          const centroId = s?.centro_custo_id ?? "";
          return {
            itemId: it.id,
            ref_lancamento: null,
            solicitacao_id: String(it.solicitacao_id),
            nome: s?.fornecedor || s?.solicitante || "Solicitação financeira",
            centro_custo: centroId,
            centro_nome: nomeObraPorId.get(centroId) ?? (centroId ? centroId : "—"),
            natureza_cod: "",
            natureza_desc: "Aprovação financeira",
            status_label: s?.status ?? "aprovado",
            status_cod: null,
            data_vencimento: s?.data_pagamento ?? s?.prazo_estimado ?? null,
            aberto: Number(s?.valor ?? 0),
            origem: "sistema",
            previsto: true,
          };
        }
        const d = decor.get(Number(it.ref_lancamento));
        return {
          itemId: it.id,
          ref_lancamento: Number(it.ref_lancamento),
          solicitacao_id: null,
          nome: d?.nome ?? "—",
          centro_custo: d?.centro_custo ?? "",
          centro_nome: d?.centro_nome ?? "—",
          natureza_cod: d?.natureza_cod ?? "",
          natureza_desc: d?.natureza_desc ?? "",
          status_label: d?.status_label ?? "—",
          status_cod: d?.status_cod ?? null,
          data_vencimento: d?.data_vencimento ?? null,
          aberto: d?.aberto ?? 0,
          origem: d?.origem ?? "totvs",
          previsto: d?.previsto ?? false,
        };
      });
      setItens(linhas);
      const list = await financeiroRepo.listCarrinhosFechados(usuarioId);
      setFechados(list);
    } catch (e: any) {
      toast.error("Erro ao carregar simulação", { description: e?.message });
    } finally {
      setLoading(false);
    }
  }, [usuarioId, nomeObraPorId, solicitacaoPorId]);


  useEffect(() => {
    carregar();
  }, [carregar]);

  const total = useMemo(() => itens.reduce((s, i) => s + i.aberto, 0), [itens]);
  const porCentro = useMemo(() => agruparPorCentroCusto(itens), [itens]);
  const porNatureza = useMemo(() => agruparPorNatureza(itens), [itens]);
  const qtdPrevistos = itens.filter((i) => i.previsto).length;

  const opcoesNome = useMemo(
    () => Array.from(new Set(itens.map((i) => i.nome ?? ""))).sort(),
    [itens],
  );
  const opcoesCentro = useMemo(
    () => Array.from(new Set(itens.map((i) => i.centro_nome ?? ""))).sort(),
    [itens],
  );
  const opcoesNatureza = useMemo(
    () => Array.from(new Set(itens.map((i) => i.natureza_desc ?? ""))).sort(),
    [itens],
  );
  const opcoesStatus = useMemo(
    () => Array.from(new Set(itens.map((i) => i.status_label ?? ""))).sort(),
    [itens],
  );
  const algumFiltroColuna =
    filtroNome.size > 0 ||
    filtroCentro.size > 0 ||
    filtroNatureza.size > 0 ||
    filtroStatus.size > 0;
  function limparFiltrosColuna() {
    setFiltroNome(new Set());
    setFiltroCentro(new Set());
    setFiltroNatureza(new Set());
    setFiltroStatus(new Set());
  }
  const filtrados = useMemo(() => {
    const needle = norm(q);
    return itens.filter((l) => {
      if (needle) {
        const match =
          norm(l.ref_lancamento).includes(needle) ||
          norm(l.nome).includes(needle) ||
          norm(l.centro_nome).includes(needle) ||
          norm(l.centro_custo).includes(needle) ||
          norm(l.natureza_cod).includes(needle) ||
          norm(l.natureza_desc).includes(needle) ||
          norm(l.status_label).includes(needle);
        if (!match) return false;
      }
      if (filtroNome.size > 0 && !filtroNome.has(l.nome ?? "")) return false;
      if (filtroCentro.size > 0 && !filtroCentro.has(l.centro_nome ?? "")) return false;
      if (filtroNatureza.size > 0 && !filtroNatureza.has(l.natureza_desc ?? "")) return false;
      if (filtroStatus.size > 0 && !filtroStatus.has(l.status_label ?? "")) return false;
      return true;
    });
  }, [itens, q, filtroNome, filtroCentro, filtroNatureza, filtroStatus]);

  type SortK = "ref" | "nome" | "centro" | "natureza" | "status" | "vencimento" | "aberto";
  const { sorted, sortKey, sortDir, toggle } = useTableSort<CarrinhoItemVivo, SortK>(
    filtrados,
    (row, key) => {
      switch (key) {
        case "ref":
          return Number(row.ref_lancamento ?? 0);
        case "nome":
          return row.nome ?? "";
        case "centro":
          return row.centro_nome ?? "";
        case "natureza":
          return `${row.natureza_cod ?? ""} ${row.natureza_desc ?? ""}`;
        case "status":
          return row.status_label ?? "";
        case "vencimento":
          return row.data_vencimento ?? "";
        case "aberto":
          return Number(row.aberto ?? 0);
        default:
          return "";
      }
    },
    "vencimento",
    "asc",
  );
  const totalFiltrado = useMemo(
    () => filtrados.reduce((s, l) => s + Number(l.aberto ?? 0), 0),
    [filtrados],
  );

  async function removerItem(itemId: string) {
    try {
      await financeiroRepo.removerItemCarrinho(itemId);
      setItens((prev) => prev.filter((i) => i.itemId !== itemId));
      toast.success("Item removido da simulação");
    } catch (e: any) {
      toast.error("Erro ao remover", { description: e?.message });
    }
  }

  function exportarCsv() {
    const header =
      "Ref;Nome;Centro;Natureza;Descrição natureza;Status;Vencimento;Previsto;Valor em aberto\n";
    const body = itens
      .map((l) =>
        [
          l.ref_lancamento,
          (l.nome ?? "").replace(/;/g, ","),
          (l.centro_nome ?? "").replace(/;/g, ","),
          l.natureza_cod,
          (l.natureza_desc ?? "").replace(/;/g, ","),
          l.status_label ?? "",
          l.data_vencimento ? fmtData(l.data_vencimento) : "",
          l.previsto ? "sim" : "não",
          Number(l.aberto ?? 0)
            .toFixed(2)
            .replace(".", ","),
        ].join(";"),
      )
      .join("\n");
    const blob = new Blob(["\uFEFF" + header + body], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `simulacao-pagamento.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function fecharSimulacao() {
    if (!carrinho || !usuarioId) return;
    if (!confirm(`Fechar esta simulação com ${itens.length} título(s)? Um novo carrinho vazio será aberto.`)) return;
    setFechando(true);
    try {
      await financeiroRepo.fecharCarrinho(
        carrinho.id,
        usuarioId,
        itens.map((i) => ({
          ref_lancamento: i.ref_lancamento,
          solicitacao_id: i.solicitacao_id ?? null,

          nome: i.nome,
          centro_custo: i.centro_custo,
          centro_nome: i.centro_nome,
          natureza_cod: i.natureza_cod,
          natureza_desc: i.natureza_desc,
          status_label: i.status_label,
          valor_congelado: i.aberto,
          previsto: i.previsto,
        })),
      );
      toast.success("Simulação fechada", { description: "Um novo carrinho vazio foi criado." });
      await carregar();
    } catch (e: any) {
      toast.error("Erro ao fechar", { description: e?.message });
    } finally {
      setFechando(false);
    }
  }

  async function abrirDetalhe(id: string, titulo: string) {
    setDetalheAberto({ id, titulo });
    try {
      const its = await financeiroRepo.listCarrinhoFechadoItens(id);
      setDetalheItens(its);
    } catch (e: any) {
      toast.error("Erro ao carregar detalhe", { description: e?.message });
    }
  }

  if (!usuarioId) {
    return (
      <div className="p-6">
        <p className="text-muted-foreground">Faça login para usar a simulação de pagamento.</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Calculator className="h-6 w-6" />
            Previsão de Pagamento
          </h1>
          <p className="text-sm text-muted-foreground">
            Simulação analítica sobre títulos selecionados no Fluxo de Dívidas. Nenhuma alteração é feita nos dados reais.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={exportarCsv} disabled={itens.length === 0}>
            <Download className="h-4 w-4 mr-1" /> Exportar CSV
          </Button>
          <Button variant="default" size="sm" onClick={fecharSimulacao} disabled={fechando || itens.length === 0}>
            <Lock className="h-4 w-4 mr-1" /> Fechar simulação
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Total simulado</CardTitle></CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{brl(total)}</div>
            <div className="text-xs text-muted-foreground">{itens.length} título(s){qtdPrevistos > 0 ? ` · ${qtdPrevistos} previsto(s)` : ""}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Por centro de custo</CardTitle></CardHeader>
          <CardContent className="max-h-40 overflow-auto">
            {porCentro.length === 0 ? (
              <p className="text-xs text-muted-foreground">Sem itens.</p>
            ) : (
              <ul className="text-xs space-y-1">
                {porCentro.slice(0, 8).map((g) => (
                  <li key={g.codigo} className="flex justify-between gap-2">
                    <span className="truncate">{g.nome}</span>
                    <strong>{brl(g.valor)}</strong>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Por natureza</CardTitle></CardHeader>
          <CardContent className="max-h-40 overflow-auto">
            {porNatureza.length === 0 ? (
              <p className="text-xs text-muted-foreground">Sem itens.</p>
            ) : (
              <ul className="text-xs space-y-1">
                {porNatureza.slice(0, 8).map((g) => (
                  <li key={g.codigo} className="flex justify-between gap-2">
                    <span className="truncate">{g.codigo} · {g.nome}</span>
                    <strong>{brl(g.valor)}</strong>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2 flex-row items-center justify-between">
          <CardTitle className="text-base">{carrinho?.titulo ?? "Simulação atual"}</CardTitle>
          <span className="text-xs text-muted-foreground">
            <Link to="/financeiro/dividas" className="underline">Voltar ao Fluxo de Dívidas</Link>
          </span>
        </CardHeader>
        <CardContent>
          {loading ? (
            <Skeleton className="h-40 w-full" />
          ) : itens.length === 0 ? (
            <div className="text-sm text-muted-foreground py-6 text-center">
              Nenhum título na simulação. Selecione títulos no Fluxo de Dívidas e use "Enviar para simulação".
            </div>
          ) : (
            <>
            <div className="flex flex-wrap items-center justify-between gap-3 pb-3">
              <div className="relative flex-1 min-w-[260px] max-w-md flex items-center gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    placeholder="Buscar por ref, nome, centro, natureza, status..."
                    className="pl-8"
                  />
                </div>
                {algumFiltroColuna && (
                  <Button size="sm" variant="ghost" onClick={limparFiltrosColuna} className="shrink-0">
                    <X className="h-3.5 w-3.5 mr-1" /> Limpar filtros
                  </Button>
                )}
              </div>
              <div className="text-sm text-muted-foreground">
                <strong className="text-foreground">{filtrados.length}</strong> título(s) ·{" "}
                <strong className="text-foreground">{brl(totalFiltrado)}</strong>
                {filtrados.length !== itens.length && (
                  <span className="ml-2 text-xs">(de {itens.length} · {brl(total)})</span>
                )}
              </div>
            </div>
            <div className="max-h-[50vh] overflow-auto border rounded-md">
              <Table>
                <TableHeader>
                  <TableRow>
                    <SortHeader sortKey="ref" currentKey={sortKey} dir={sortDir} onToggle={toggle}>Ref.</SortHeader>
                    <ColumnFilterHeader
                      sortKey="nome"
                      currentKey={sortKey}
                      dir={sortDir}
                      onToggleSort={toggle}
                      options={opcoesNome}
                      selected={filtroNome}
                      onChangeSelected={setFiltroNome}
                    >
                      Nome
                    </ColumnFilterHeader>
                    <ColumnFilterHeader
                      sortKey="centro"
                      currentKey={sortKey}
                      dir={sortDir}
                      onToggleSort={toggle}
                      options={opcoesCentro}
                      selected={filtroCentro}
                      onChangeSelected={setFiltroCentro}
                    >
                      Centro
                    </ColumnFilterHeader>
                    <ColumnFilterHeader
                      sortKey="natureza"
                      currentKey={sortKey}
                      dir={sortDir}
                      onToggleSort={toggle}
                      options={opcoesNatureza}
                      selected={filtroNatureza}
                      onChangeSelected={setFiltroNatureza}
                    >
                      Natureza
                    </ColumnFilterHeader>
                    <ColumnFilterHeader
                      sortKey="status"
                      currentKey={sortKey}
                      dir={sortDir}
                      onToggleSort={toggle}
                      options={opcoesStatus}
                      selected={filtroStatus}
                      onChangeSelected={setFiltroStatus}
                    >
                      Status
                    </ColumnFilterHeader>
                    <SortHeader sortKey="vencimento" currentKey={sortKey} dir={sortDir} onToggle={toggle}>Vencimento</SortHeader>
                    <SortHeader sortKey="aberto" currentKey={sortKey} dir={sortDir} onToggle={toggle} align="right">Em aberto</SortHeader>
                    <TableHead className="w-10"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sorted.map((l) => (
                    <TableRow key={l.itemId} className={l.previsto ? "italic" : ""}>
                      <TableCell className="font-mono text-xs">
                        {l.ref_lancamento ?? (l.solicitacao_id ? "APROV" : "—")}
                      </TableCell>

                      <TableCell>
                        {l.nome}
                        {l.previsto && (
                          <Badge variant="outline" className="ml-2 border-dashed">Previsto</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-xs">{l.centro_nome}</TableCell>
                      <TableCell className="text-xs">{l.natureza_cod} · {l.natureza_desc}</TableCell>
                      <TableCell className="text-xs">{l.status_label}</TableCell>
                      <TableCell className="text-xs">{l.data_vencimento ? fmtData(l.data_vencimento) : "—"}</TableCell>
                      <TableCell className="text-right font-medium">{brl(l.aberto)}</TableCell>
                      <TableCell>
                        <Button size="icon" variant="ghost" onClick={() => removerItem(l.itemId)} title="Remover da simulação">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {sorted.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center text-sm text-muted-foreground py-8">
                        Nenhum título encontrado com os filtros aplicados.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><History className="h-4 w-4" /> Simulações anteriores</CardTitle></CardHeader>
        <CardContent>
          {fechados.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma simulação fechada ainda.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Título</TableHead>
                  <TableHead>Fechada em</TableHead>
                  <TableHead className="text-right">Títulos</TableHead>
                  <TableHead className="text-right">Total congelado</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {fechados.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell>{c.titulo}</TableCell>
                    <TableCell className="text-xs">{c.fechado_em ? fmtData(c.fechado_em) : "—"}</TableCell>
                    <TableCell className="text-right">{c.qtd}</TableCell>
                    <TableCell className="text-right font-medium">{brl(c.total)}</TableCell>
                    <TableCell>
                      <Button size="sm" variant="outline" onClick={() => abrirDetalhe(c.id, c.titulo)}>Ver detalhe</Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!detalheAberto} onOpenChange={(o) => !o && setDetalheAberto(null)}>
        <DialogContent className="max-w-5xl">
          <DialogHeader>
            <DialogTitle>{detalheAberto?.titulo} · valores congelados</DialogTitle>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-auto border rounded-md">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ref.</TableHead>
                  <TableHead>Nome</TableHead>
                  <TableHead>Centro</TableHead>
                  <TableHead>Natureza</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Valor congelado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {detalheItens.map((it: any) => (
                  <TableRow key={it.id} className={it.previsto ? "italic" : ""}>
                    <TableCell className="font-mono text-xs">{it.ref_lancamento}</TableCell>
                    <TableCell>
                      {it.nome ?? "—"}
                      {it.previsto && <Badge variant="outline" className="ml-2 border-dashed">Previsto</Badge>}
                    </TableCell>
                    <TableCell className="text-xs">{it.centro_nome ?? it.centro_custo ?? "—"}</TableCell>
                    <TableCell className="text-xs">{it.natureza_cod ?? ""} · {it.natureza_desc ?? ""}</TableCell>
                    <TableCell className="text-xs">{it.status_label ?? "—"}</TableCell>
                    <TableCell className="text-right font-medium">{brl(Number(it.valor_congelado ?? 0))}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
