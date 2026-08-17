import { useEffect, useMemo, useState } from "react";
import { ListChecks, Search, History, X, Calculator } from "lucide-react";
import { toast } from "sonner";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { HistoricoTituloDialog } from "./HistoricoTituloDialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { SortHeader } from "@/components/ui/sort-header";
import { ColumnFilterHeader } from "@/components/ui/column-filter-header";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useTableSort } from "@/hooks/useTableSort";
import { useAuth } from "@/contexts/auth/useAuth";
import { financeiroTotvsRepo } from "@/lib/repositories/financeiro";
import { brl } from "@/lib/billing";
import { fmtData, norm } from "@/lib/utils";
import { PGTO_LABEL } from "./types";

type SortK = "ref" | "nome" | "centro" | "natureza" | "vencimento" | "dias" | "aberto" | "pgto";

export function TitulosDialog({
  open,
  onClose,
  titulo,
  titulos,
}: {
  open: boolean;
  onClose: () => void;
  titulo: string;
  titulos: any[];
}) {
  const { currentPlayer } = useAuth();
  const queryClient = useQueryClient();
  const uid = currentPlayer?.id ?? "";
  const { data: chavesCarrinho } = useQuery({
    queryKey: ["carrinho-aberto-refs", uid],
    queryFn: () => financeiroTotvsRepo.listCarrinhoAbertoChaves(uid),
    enabled: !!uid,
    staleTime: 30_000,
  });
  const setRefsNoCarrinho = useMemo(
    () => new Set<number>((chavesCarrinho?.refs ?? []).map((n) => Number(n))),
    [chavesCarrinho],
  );
  const setSolsNoCarrinho = useMemo(
    () => new Set<string>((chavesCarrinho?.solicitacoes ?? []).map((s) => String(s))),
    [chavesCarrinho],
  );

  const [enviandoSim, setEnviandoSim] = useState(false);
  const [q, setQ] = useState("");
  const [subtotaisOn, setSubtotaisOn] = useState(false);
  const [selecionados, setSelecionados] = useState<Set<string>>(() => new Set());
  const [historicoRef, setHistoricoRef] = useState<number | string | null>(null);
  const [filtroNome, setFiltroNome] = useState<Set<string>>(new Set());
  const [filtroCentro, setFiltroCentro] = useState<Set<string>>(new Set());
  const [filtroNatureza, setFiltroNatureza] = useState<Set<string>>(new Set());
  const [filtroPgto, setFiltroPgto] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!open) {
      setSelecionados(new Set());
      setSubtotaisOn(false);
      setQ("");
      setFiltroNome(new Set());
      setFiltroCentro(new Set());
      setFiltroNatureza(new Set());
      setFiltroPgto(new Set());
    }
  }, [open]);

  const opcoesNome = useMemo(
    () => Array.from(new Set(titulos.map((l) => l.nome ?? ""))).sort(),
    [titulos],
  );
  const opcoesCentro = useMemo(
    () => Array.from(new Set(titulos.map((l) => l.centro_nome ?? ""))).sort(),
    [titulos],
  );
  const opcoesNatureza = useMemo(
    () => Array.from(new Set(titulos.map((l) => l.natureza_desc ?? ""))).sort(),
    [titulos],
  );
  const opcoesPgto = useMemo(
    () =>
      Array.from(
        new Set(
          titulos.map((l) => PGTO_LABEL[(l.pgto ?? "indef") as "avista" | "aprazo" | "indef"]),
        ),
      ).sort(),
    [titulos],
  );

  const algumFiltroColuna =
    filtroNome.size > 0 || filtroCentro.size > 0 || filtroNatureza.size > 0 || filtroPgto.size > 0;

  function limparFiltrosColuna() {
    setFiltroNome(new Set());
    setFiltroCentro(new Set());
    setFiltroNatureza(new Set());
    setFiltroPgto(new Set());
  }

  const filtrados = useMemo(() => {
    const needle = norm(q);
    return titulos.filter((l) => {
      if (needle) {
        const match =
          norm(l.ref_lancamento).includes(needle) ||
          norm(l.nome).includes(needle) ||
          norm(l.centro_nome).includes(needle) ||
          norm(l.centro_custo).includes(needle) ||
          norm(l.natureza_cod).includes(needle) ||
          norm(l.natureza_desc).includes(needle) ||
          norm(l.status_label).includes(needle) ||
          norm(PGTO_LABEL[(l.pgto ?? "indef") as "avista" | "aprazo" | "indef"]).includes(needle);
        if (!match) return false;
      }
      if (filtroNome.size > 0 && !filtroNome.has(l.nome ?? "")) return false;
      if (filtroCentro.size > 0 && !filtroCentro.has(l.centro_nome ?? "")) return false;
      if (filtroNatureza.size > 0 && !filtroNatureza.has(l.natureza_desc ?? "")) return false;
      if (filtroPgto.size > 0) {
        const label = PGTO_LABEL[(l.pgto ?? "indef") as "avista" | "aprazo" | "indef"];
        if (!filtroPgto.has(label)) return false;
      }
      return true;
    });
  }, [q, titulos, filtroNome, filtroCentro, filtroNatureza, filtroPgto]);

  const { sorted, sortKey, sortDir, toggle } = useTableSort<any, SortK>(
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
        case "vencimento":
          return row.data_vencimento ?? "";
        case "dias":
          return Number(row.dias_atraso ?? 0);
        case "aberto":
          return Number(row.aberto ?? 0);
        case "pgto":
          return row.pgto ?? "";
        default:
          return "";
      }
    },
    "aberto",
    "desc",
  );

  const total = useMemo(
    () => filtrados.reduce((s, l) => s + Number(l.aberto ?? 0), 0),
    [filtrados],
  );

  const selStats = useMemo(() => {
    if (selecionados.size === 0) return { n: 0, valor: 0 };
    let valor = 0;
    let n = 0;
    for (const l of titulos) {
      if (selecionados.has(String(l.id))) {
        valor += Number(l.aberto ?? 0);
        n += 1;
      }
    }
    return { n, valor };
  }, [selecionados, titulos]);

  const visIds = useMemo(() => sorted.map((l) => String(l.id)), [sorted]);
  const todosVisSelecionados = visIds.length > 0 && visIds.every((id) => selecionados.has(id));

  function toggleOne(id: string) {
    setSelecionados((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  function toggleVisiveis() {
    setSelecionados((prev) => {
      const next = new Set(prev);
      if (todosVisSelecionados) {
        for (const id of visIds) next.delete(id);
      } else {
        for (const id of visIds) next.add(id);
      }
      return next;
    });
  }
  function selecionarTudo() {
    setSelecionados(new Set(titulos.map((l) => String(l.id))));
  }
  function limparSelecao() {
    setSelecionados(new Set());
  }

  function exportar(apenasSelecionados = false) {
    const fonte = apenasSelecionados
      ? sorted.filter((l) => selecionados.has(String(l.id)))
      : sorted;
    const header =
      "Ref;Nome;Centro;Natureza;Descrição natureza;Status;Pgto;Emissão;Vencimento;Dias atraso;Valor em aberto\n";
    const body = fonte
      .map((l) =>
        [
          l.ref_lancamento,
          (l.nome ?? "").replace(/;/g, ","),
          (l.centro_nome ?? "").replace(/;/g, ","),
          l.natureza_cod ?? "",
          (l.natureza_desc ?? "").replace(/;/g, ","),
          l.status_label ?? "",
          PGTO_LABEL[(l.pgto ?? "indef") as "avista" | "aprazo" | "indef"],
          l.data_emissao ? fmtData(l.data_emissao) : "",
          l.data_vencimento ? fmtData(l.data_vencimento) : "",
          l.dias_atraso ?? "",
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
    a.download = apenasSelecionados ? `titulos-selecionados.csv` : `titulos.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function enviarParaSimulacao() {
    if (!uid) {
      toast.error("Faça login para enviar à simulação");
      return;
    }
    // Títulos do TOTVS vão por `ref_lancamento`; os que vêm da aprovação
    // financeira não têm esse número e vão pelo id da solicitação — antes eles
    // eram enviados como ref 0 e chegavam zerados no carrinho.
    const entradas = sorted
      .filter((l) => selecionados.has(String(l.id)))
      .map((l) => {
        // Aprovações podem chegar pela view com ref_lancamento = 0. A
        // solicitação é a chave canônica e deve sempre ter precedência.
        if (l.solicitacao_id) return { solicitacao_id: String(l.solicitacao_id) };
        const ref = Number(l.ref_lancamento);
        return Number.isFinite(ref) && ref > 0 ? { ref_lancamento: ref } : null;
      })
      .filter(Boolean) as Array<{ ref_lancamento?: number; solicitacao_id?: string }>;
    if (!entradas.length) return;
    setEnviandoSim(true);
    try {
      const c = await financeiroTotvsRepo.getOrCreateCarrinhoAberto(uid);
      const res = await financeiroTotvsRepo.adicionarItensAoCarrinho(c.id, entradas);

      const abrir = {
        label: "Abrir Previsão",
        onClick: () => window.open("/financeiro/previsao-pagamento", "_self"),
      };
      if (res.adicionados === 0) {
        toast.warning("Todos já estão no carrinho", {
          description: `${res.duplicados} título(s) já haviam sido enviados anteriormente.`,
          action: abrir,
        });
      } else if (res.duplicados > 0) {
        toast.success(`${res.adicionados} título(s) adicionados`, {
          description: `${res.duplicados} já estavam no carrinho e foram ignorados.`,
          action: abrir,
        });
      } else {
        toast.success(`${res.adicionados} título(s) adicionados à simulação`, { action: abrir });
      }
      await queryClient.invalidateQueries({ queryKey: ["carrinho-aberto-refs", uid] });
    } catch (e: any) {
      toast.error("Erro ao enviar", { description: e?.message });
    } finally {
      setEnviandoSim(false);
    }
  }

  const colSpan = subtotaisOn ? 9 : 8;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-6xl">
        <DialogHeader>
          <DialogTitle>{titulo}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="relative flex-1 min-w-[260px] max-w-md flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Buscar por ref, nome, centro, natureza, pgto..."
                className="pl-8"
              />
            </div>
            {algumFiltroColuna && (
              <Button
                size="sm"
                variant="ghost"
                onClick={limparFiltrosColuna}
                title="Limpar filtros de coluna"
                className="shrink-0"
              >
                <X className="h-3.5 w-3.5 mr-1" />
                Limpar filtros
              </Button>
            )}
          </div>
          <div className="text-sm text-muted-foreground">
            <strong className="text-foreground">{filtrados.length}</strong> título(s) ·{" "}
            <strong className="text-foreground">{brl(total)}</strong>
            {filtrados.length !== titulos.length && (
              <span className="ml-2 text-xs">
                (de {titulos.length} · {brl(titulos.reduce((s, l) => s + Number(l.aberto ?? 0), 0))}
                )
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant={subtotaisOn ? "default" : "outline"}
              onClick={() => setSubtotaisOn((v) => !v)}
              title="Ativar seleção de títulos para somar subtotal"
            >
              <ListChecks className="h-4 w-4 mr-1" />
              Subtotais
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => exportar(false)}
              disabled={sorted.length === 0}
            >
              Exportar CSV
            </Button>
          </div>
        </div>
        {subtotaisOn && (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border bg-muted/30 px-3 py-2 text-sm">
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" onClick={selecionarTudo}>
                Selecionar tudo
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={limparSelecao}
                disabled={selecionados.size === 0}
              >
                Limpar seleção
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => exportar(true)}
                disabled={selecionados.size === 0}
              >
                Exportar selecionados
              </Button>
              <Button
                size="sm"
                variant="default"
                onClick={enviarParaSimulacao}
                disabled={selecionados.size === 0 || enviandoSim}
                title="Enviar títulos selecionados para a tela de simulação"
              >
                <Calculator className="h-4 w-4 mr-1" />
                Enviar para simulação
              </Button>
            </div>
            <div className="text-sm">
              <strong className="text-foreground">{selStats.n}</strong> selecionado(s) ·{" "}
              <strong className="text-foreground">{brl(selStats.valor)}</strong>
            </div>
          </div>
        )}
        <div
          className="max-h-[60vh] overflow-y-auto overflow-x-scroll border rounded-md"
          style={{ scrollbarGutter: "stable" }}
        >
          <Table className="min-w-[900px]">
            <TableHeader>
              <TableRow>
                {subtotaisOn && (
                  <TableHead className="w-10">
                    <Checkbox
                      checked={todosVisSelecionados}
                      onCheckedChange={toggleVisiveis}
                      aria-label="Selecionar visíveis"
                    />
                  </TableHead>
                )}
                <SortHeader sortKey="ref" currentKey={sortKey} dir={sortDir} onToggle={toggle}>
                  Ref.
                </SortHeader>
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
                  Centro de custo
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
                  Natureza orçamentária
                </ColumnFilterHeader>
                <SortHeader
                  sortKey="vencimento"
                  currentKey={sortKey}
                  dir={sortDir}
                  onToggle={toggle}
                >
                  Vencimento
                </SortHeader>
                <ColumnFilterHeader
                  sortKey="pgto"
                  currentKey={sortKey}
                  dir={sortDir}
                  onToggleSort={toggle}
                  options={opcoesPgto}
                  selected={filtroPgto}
                  onChangeSelected={setFiltroPgto}
                >
                  Pgto
                </ColumnFilterHeader>
                <SortHeader
                  sortKey="dias"
                  currentKey={sortKey}
                  dir={sortDir}
                  onToggle={toggle}
                  align="right"
                >
                  Atraso
                </SortHeader>
                <SortHeader
                  sortKey="aberto"
                  currentKey={sortKey}
                  dir={sortDir}
                  onToggle={toggle}
                  align="right"
                >
                  Em aberto
                </SortHeader>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.map((l) => {
                const id = String(l.id);
                const sel = selecionados.has(id);
                const pgto = (l.pgto ?? "indef") as "avista" | "aprazo" | "indef";
                const pgtoVariant: "default" | "secondary" | "outline" =
                  pgto === "avista" ? "default" : pgto === "aprazo" ? "secondary" : "outline";
                return (
                  <TableRow
                    key={l.id}
                    className={
                      (sel ? "bg-primary/5 " : "") + (l.previsto ? "italic text-primary/80" : "")
                    }
                  >
                    {subtotaisOn && (
                      <TableCell>
                        <Checkbox
                          checked={sel}
                          onCheckedChange={() => toggleOne(id)}
                          aria-label="Selecionar título"
                        />
                      </TableCell>
                    )}
                    <TableCell className="font-mono text-xs">{l.ref_lancamento ?? "—"}</TableCell>
                    <TableCell className="max-w-[26ch] truncate" title={l.nome ?? ""}>
                      <span className="inline-flex items-center gap-1.5">
                        {l.origem === "aprovacao" && (
                          <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                            Aprovação
                          </Badge>
                        )}
                        {l.nome ?? "—"}
                      </span>
                    </TableCell>

                    <TableCell className="max-w-[24ch] truncate" title={l.centro_custo ?? ""}>
                      {l.centro_nome}
                    </TableCell>
                    <TableCell className="max-w-[28ch]">
                      <div className="font-mono text-xs">{l.natureza_cod || "—"}</div>
                      <div
                        className="text-xs text-muted-foreground truncate"
                        title={l.natureza_desc ?? ""}
                      >
                        {l.natureza_desc || "—"}
                        {l.natureza_count > 1 && (
                          <span className="ml-1 text-warning">+{l.natureza_count - 1}</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        <span>{fmtData(l.data_vencimento)}</span>
                        {(setRefsNoCarrinho.has(Number(l.ref_lancamento)) ||
                          (l.solicitacao_id &&
                            setSolsNoCarrinho.has(String(l.solicitacao_id)))) && (
                          <Badge
                            variant="outline"
                            className="text-[9px] px-1 py-0 h-4 border-primary text-primary"
                            title="Este título já foi enviado ao carrinho de Previsão de Pagamento."
                          >
                            No carrinho
                          </Badge>
                        )}
                        {l.previsto && (
                          <Badge
                            variant="outline"
                            className="text-[9px] px-1 py-0 h-4 border-dashed border-primary text-primary"
                            title="Despesa prevista — solicitação financeira aprovada, ainda não consolidada no TOTVS."
                          >
                            Previsto
                          </Badge>
                        )}
                        {l.parcial && (
                          <Badge
                            variant="outline"
                            className="text-[9px] px-1 py-0 h-4 border-warning text-warning"
                            title="Título com baixa parcial"
                          >
                            Parcial
                          </Badge>
                        )}
                        {l.mes_competencia_estimado && (
                          <Badge
                            variant="outline"
                            className="text-[9px] px-1 py-0 h-4 border-muted-foreground/50 text-muted-foreground"
                            title="Competência estimada a partir da data de emissão — sem confirmação do Relatório de Status TOTVS."
                          >
                            ~
                          </Badge>
                        )}
                        {l.sem_atualizacao_recente && (
                          <Badge
                            variant="outline"
                            className="text-[9px] px-1 py-0 h-4 border-destructive/60 text-destructive"
                            title={`Sem atualização há mais de 60 dias${l.ultima_atualizacao ? ` (última: ${new Date(l.ultima_atualizacao).toLocaleDateString("pt-BR")})` : ""}. Reimportar a Matriz ou o Relatório de Status para atualizar.`}
                          >
                            Desatualizado
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={pgtoVariant} className="text-[10px]">
                        {PGTO_LABEL[pgto]}
                        {l.prazo_dias != null && (
                          <span className="ml-1 opacity-70">· {l.prazo_dias}d</span>
                        )}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">{l.dias_atraso ?? "—"}</TableCell>
                    <TableCell className="text-right font-medium">
                      <div className="flex items-center justify-end gap-1">
                        <span>{brl(Number(l.aberto ?? 0))}</span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          title="Ver histórico de importações deste título"
                          onClick={() => setHistoricoRef(l.ref_lancamento)}
                        >
                          <History className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
              {sorted.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={colSpan}
                    className="text-center text-sm text-muted-foreground py-8"
                  >
                    Nenhum título encontrado.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </DialogContent>
      <HistoricoTituloDialog
        open={historicoRef != null}
        onClose={() => setHistoricoRef(null)}
        refLancamento={historicoRef}
      />
    </Dialog>
  );
}
