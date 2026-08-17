import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ChevronDown,
  ChevronRight,
  Landmark,
  ShoppingCart,
  Search,
  Filter,
  X,
  ArrowUpDown,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { obrasRepo } from "@/lib/repositories/obras";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuCheckboxItem,
} from "@/components/ui/dropdown-menu";
import { EmptyState } from "@/components/obra/EmptyState";
import { CustoComprometidoCard } from "@/components/obra/CustoComprometidoCard";
import { brl } from "@/lib/billing";
import {
  kpisObra,
  porMesCompetencia,
  porNatureza,
  type FinLinha,
} from "@/lib/financeiro-totvs/agregacoes";
import { usePlanoContasLabels } from "@/lib/financeiro-totvs/labels";
import { VW_FINANCEIRO_OBRA_COLS } from "@/lib/financeiro-totvs/colunas";
import { useCarrinhoStore } from "@/hooks/financeiro/useCarrinhoStore";
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "@/components/ui/chart";

function StatusBadge({ cod, label }: { cod: number | null; label: string | null }) {
  const txt = label ?? "—";
  const cls: Record<number, string> = {
    3: "bg-success/15 text-success border-success/30",
    15: "bg-warning/15 text-warning border-warning/30",
    18: "bg-muted text-muted-foreground line-through",
    29: "bg-muted text-foreground border-border",
    40: "bg-destructive/15 text-destructive border-destructive/30",
    56: "bg-muted text-muted-foreground border-border",
  };
  return (
    <Badge variant="outline" className={cod != null ? (cls[cod] ?? "") : ""}>
      {txt}
    </Badge>
  );
}

export function FinanceiroTab({ obraId }: { obraId: string }) {
  const { data: obra } = useQuery({
    queryKey: ["obra_cc", obraId],
    queryFn: async () => ({ centro_custo_totvs: await obrasRepo.getCentroCustoTotvs(obraId) }),
  });

  const { data: linhas, isLoading } = useQuery<FinLinha[]>({
    queryKey: ["fin_obra", obraId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vw_financeiro_obra")
        .select(VW_FINANCEIRO_OBRA_COLS)
        .eq("obra_id", obraId);
      if (error) throw error;
      return (data ?? []) as unknown as FinLinha[];
    },
  });

  const semVinculo = !obra?.centro_custo_totvs;
  const semDados = !isLoading && (linhas ?? []).length === 0;

  const kpis = useMemo(() => kpisObra(linhas ?? []), [linhas]);
  const naturezas = useMemo(() => porNatureza(linhas ?? []), [linhas]);
  const serie = useMemo(() => porMesCompetencia(linhas ?? []), [linhas]);

  const [filtroGlobal, setFiltroGlobal] = useState("");
  const [filtrosColunas, setFiltrosColunas] = useState<{
    status: string[];
    sortContraparte: boolean;
  }>({
    status: [],
    sortContraparte: false,
  });
  const { addItem, removeItem, isInCarrinho } = useCarrinhoStore();

  const titulos = useMemo(() => {
    const seen = new Map<string, FinLinha>();
    for (const l of linhas ?? []) {
      if (l.grupo === "3") continue;
      if (l.lancamento_id && !seen.has(l.lancamento_id)) seen.set(l.lancamento_id, l);
    }

    let result = Array.from(seen.values());

    // Filtro Global
    if (filtroGlobal) {
      const search = filtroGlobal.toLowerCase();
      result = result.filter(
        (t) =>
          (t.contraparte ?? "").toLowerCase().includes(search) ||
          String(t.ref_lancamento ?? "")
            .toLowerCase()
            .includes(search),
      );
    }

    // Filtros por Coluna (Status)
    if (filtrosColunas.status.length > 0) {
      result = result.filter((t) => filtrosColunas.status.includes(String(t.status_label ?? "")));
    }

    return result.sort((a, b) => {
      if (filtrosColunas.sortContraparte) {
        return (a.contraparte ?? "").localeCompare(b.contraparte ?? "");
      }
      return (b.data_vencimento ?? "").localeCompare(a.data_vencimento ?? "");
    });
  }, [linhas, filtroGlobal, filtrosColunas]);

  const toggleCarrinho = (t: FinLinha) => {
    const id = t.lancamento_id ?? String(t.ref_lancamento);
    if (isInCarrinho(id)) {
      removeItem(id);
    } else {
      addItem({
        id,
        tipo: t.natureza_tipo === 1 ? "titulo_receber" : "titulo_pagar",
        numero: String(t.ref_lancamento ?? "—"),
        valor: Number(t.valor_liquido ?? 0),
        vencimento: t.data_vencimento ?? "—",
        descricao: `Título ${t.ref_lancamento} - ${t.contraparte}`,
        fornecedor_cliente: t.contraparte ?? undefined,
        obra_id: obraId,
      });
    }
  };

  const statusDisponiveis = useMemo(() => {
    const set = new Set<string>();
    titulos.forEach((t) => {
      if (t.status_label) set.add(t.status_label);
    });
    return Array.from(set).sort();
  }, [titulos]);

  const [pagina, setPagina] = useState(0);
  const porPagina = 20;
  const totalPag = Math.max(1, Math.ceil(titulos.length / porPagina));
  const pagAtual = titulos.slice(pagina * porPagina, (pagina + 1) * porPagina);

  if (semVinculo || semDados) {
    return (
      <EmptyState
        icon={Landmark}
        title={semVinculo ? "Centro de Custo não vinculado" : "Sem dados financeiros"}
        description="Vincule o Centro de Custo TOTVS no cadastro da obra e importe os relatórios financeiros."
      />
    );
  }

  const naturezasObra = naturezas.filter((g) => g.grupo !== "3");
  const naturezasMov = naturezas.filter((g) => g.grupo === "3");

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Card className="md:col-span-1 border-primary/40 bg-primary/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Saldo realizado</CardTitle>
          </CardHeader>
          <CardContent>
            <div
              className={`text-2xl font-semibold overflow-hidden text-ellipsis whitespace-nowrap ${kpis.saldoRealizado >= 0 ? "" : "text-destructive"}`}
              title={brl(kpis.saldoRealizado)}
            >
              {brl(kpis.saldoRealizado)}
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              receita recebida − despesa paga
            </div>
          </CardContent>
        </Card>
        <div className="md:col-span-2 grid grid-cols-2 gap-3">
          <KpiSmall label="Receita recebida" valor={kpis.receitaBaixada} tone="positive" />
          <KpiSmall label="Despesa paga" valor={kpis.despesaPaga} tone="negative" />
          <KpiSmall label="A receber" valor={kpis.receitaAReceber} />
          <KpiSmall
            label="A pagar"
            valor={kpis.despesaAPagar}
            subline={kpis.despesaVencida > 0 ? `${brl(kpis.despesaVencida)} vencido` : undefined}
            tone={kpis.despesaVencida > 0 ? "warn" : undefined}
          />
        </div>
      </div>

      {/* Custo comprometido pelos cards de recurso (fase 6 — leitura) */}
      <CustoComprometidoCard obraId={obraId} />

      {/* Gráfico mensal */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Evolução mensal</CardTitle>
        </CardHeader>
        <CardContent style={{ height: 320 }}>
          {serie.length === 0 ? (
            <div className="text-sm text-muted-foreground">
              Sem competência informada nos títulos.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart
                data={serie.map((s, i, arr) => ({
                  ...s,
                  saldoAcum: arr.slice(0, i + 1).reduce((a, b) => a + b.saldo, 0),
                }))}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="mes" />
                <YAxis tickFormatter={(v) => `R$ ${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(v: any) => brl(Number(v))} />
                <Legend />
                <Bar dataKey="receita" name="Receita" fill="hsl(var(--primary))" />
                <Bar dataKey="despesa" name="Despesa" fill="hsl(var(--destructive))" />
                <Line
                  type="monotone"
                  dataKey="saldoAcum"
                  name="Saldo acumulado"
                  stroke="hsl(var(--foreground))"
                  strokeWidth={2}
                  dot={false}
                />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Por natureza */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Por natureza</CardTitle>
        </CardHeader>
        <CardContent>
          <NaturezaTree grupos={naturezasObra} />
          {naturezasMov.length > 0 && (
            <div className="mt-6 pt-4 border-t opacity-70">
              <div className="text-xs uppercase tracking-wide text-muted-foreground mb-2">
                Movimentações financeiras (separadas)
              </div>
              <NaturezaTree grupos={naturezasMov} />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Tabela de títulos */}
      <Card>
        <CardHeader className="space-y-4">
          <div className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Títulos ({titulos.length})</CardTitle>
            <div className="flex items-center gap-2">
              <div className="relative w-64">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar contraparte ou doc..."
                  className="pl-8 h-9"
                  value={filtroGlobal}
                  onChange={(e) => {
                    setFiltroGlobal(e.target.value);
                    setPagina(0);
                  }}
                />
              </div>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="h-9 gap-2">
                    <Filter className="h-4 w-4" />
                    Status
                    {(filtrosColunas.status?.length ?? 0) > 0 && (
                      <Badge
                        variant="secondary"
                        className="ml-1 h-5 px-1 min-w-[1.25rem] justify-center"
                      >
                        {filtrosColunas.status?.length}
                      </Badge>
                    )}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel>Filtrar por Status</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {statusDisponiveis.map((st) => (
                    <DropdownMenuCheckboxItem
                      key={st}
                      checked={filtrosColunas.status?.includes(st)}
                      onCheckedChange={(checked) => {
                        const current = filtrosColunas.status ?? [];
                        const next = checked ? [...current, st] : current.filter((x) => x !== st);
                        setFiltrosColunas({ ...filtrosColunas, status: next });
                        setPagina(0);
                      }}
                    >
                      {st}
                    </DropdownMenuCheckboxItem>
                  ))}
                  {filtrosColunas.status?.length ? (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="justify-center text-destructive"
                        onClick={() => setFiltrosColunas({ ...filtrosColunas, status: [] })}
                      >
                        Limpar filtro
                      </DropdownMenuItem>
                    </>
                  ) : null}
                </DropdownMenuContent>
              </DropdownMenu>

              {totalPag > 1 && (
                <div className="flex items-center gap-2 text-sm ml-4">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={pagina === 0}
                    onClick={() => setPagina((p) => p - 1)}
                  >
                    Anterior
                  </Button>
                  <span className="text-muted-foreground whitespace-nowrap">
                    {pagina + 1} / {totalPag}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={pagina >= totalPag - 1}
                    onClick={() => setPagina((p) => p + 1)}
                  >
                    Próxima
                  </Button>
                </div>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>
                  <div
                    className="flex items-center gap-1 cursor-pointer hover:text-foreground transition-colors"
                    onClick={() => {
                      const next = !filtrosColunas.sortContraparte;
                      setFiltrosColunas({ ...filtrosColunas, sortContraparte: next });
                    }}
                  >
                    Contraparte
                    <ArrowUpDown className="h-3 w-3" />
                  </div>
                </TableHead>
                <TableHead>Nº doc</TableHead>
                <TableHead>Emissão</TableHead>
                <TableHead>Vencimento</TableHead>
                <TableHead className="text-right">Valor líquido</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[80px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pagAtual.map((t) => {
                const id = t.lancamento_id ?? String(t.ref_lancamento);
                const inCart = isInCarrinho(id);
                return (
                  <TableRow key={id} className={inCart ? "bg-primary/5" : ""}>
                    <TableCell className="max-w-xs truncate">{t.contraparte ?? "—"}</TableCell>
                    <TableCell>{t.ref_lancamento ?? "—"}</TableCell>
                    <TableCell>{t.data_emissao ?? "—"}</TableCell>
                    <TableCell>{t.data_vencimento ?? "—"}</TableCell>
                    <TableCell className="text-right">
                      {brl(Number(t.valor_liquido ?? 0))}
                    </TableCell>
                    <TableCell>
                      <StatusBadge cod={t.status_cod} label={t.status_label} />
                    </TableCell>
                    <TableCell>
                      <Button
                        size="icon"
                        variant={inCart ? "secondary" : "ghost"}
                        className={inCart ? "text-primary" : "text-muted-foreground"}
                        onClick={() => toggleCarrinho(t)}
                        title={inCart ? "Remover do carrinho" : "Adicionar ao carrinho"}
                      >
                        {inCart ? (
                          <ShoppingCart className="h-4 w-4 fill-current" />
                        ) : (
                          <ShoppingCart className="h-4 w-4" />
                        )}
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function KpiSmall({
  label,
  valor,
  tone,
  subline,
}: {
  label: string;
  valor: number;
  tone?: "positive" | "negative" | "warn";
  subline?: string;
}) {
  const color =
    tone === "positive"
      ? "text-success"
      : tone === "negative"
        ? "text-destructive"
        : tone === "warn"
          ? "text-warning"
          : "";
  return (
    <Card>
      <CardContent className="py-4">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className={`text-xl font-semibold ${color}`}>{brl(valor)}</div>
        {subline && <div className="text-[11px] text-warning mt-0.5">{subline}</div>}
      </CardContent>
    </Card>
  );
}

function NaturezaTree({ grupos }: { grupos: ReturnType<typeof porNatureza> }) {
  const [openG, setOpenG] = useState<Record<string, boolean>>({});
  const [openS, setOpenS] = useState<Record<string, boolean>>({});
  const { label } = usePlanoContasLabels();

  if (grupos.length === 0) return <div className="text-sm text-muted-foreground">Sem rateios.</div>;

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Natureza</TableHead>
          <TableHead className="text-right">Pago</TableHead>
          <TableHead className="text-right">Em aberto</TableHead>
          <TableHead className="text-right">Total</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {grupos.map((g) => {
          const gOpen = openG[g.grupo] ?? false;
          return (
            <Row key={g.grupo}>
              <TableRow className="bg-muted/40">
                <TableCell>
                  <button
                    className="inline-flex items-center gap-1 font-medium"
                    onClick={() => setOpenG((s) => ({ ...s, [g.grupo]: !gOpen }))}
                  >
                    {gOpen ? (
                      <ChevronDown className="h-4 w-4" />
                    ) : (
                      <ChevronRight className="h-4 w-4" />
                    )}
                    {label(g.grupo)}
                  </button>
                </TableCell>
                <TableCell className="text-right">{brl(g.valor_pago)}</TableCell>
                <TableCell className="text-right">{brl(g.valor_aberto)}</TableCell>
                <TableCell className="text-right font-medium">{brl(g.valor_total)}</TableCell>
              </TableRow>
              {gOpen &&
                g.subgrupos.map((sg) => {
                  const sKey = `${g.grupo}|${sg.subgrupo}`;
                  const sOpen = openS[sKey] ?? false;
                  return (
                    <Row key={sKey}>
                      <TableRow>
                        <TableCell className="pl-8">
                          <button
                            className="inline-flex items-center gap-1"
                            onClick={() => setOpenS((s) => ({ ...s, [sKey]: !sOpen }))}
                          >
                            {sOpen ? (
                              <ChevronDown className="h-4 w-4" />
                            ) : (
                              <ChevronRight className="h-4 w-4" />
                            )}
                            {label(sg.subgrupo)}
                          </button>
                        </TableCell>
                        <TableCell className="text-right">{brl(sg.valor_pago)}</TableCell>
                        <TableCell className="text-right">{brl(sg.valor_aberto)}</TableCell>
                        <TableCell className="text-right">{brl(sg.valor_total)}</TableCell>
                      </TableRow>
                      {sOpen &&
                        sg.naturezas.map((n) => (
                          <TableRow key={n.cod_natureza}>
                            <TableCell className="pl-14 text-sm">
                              <span className="text-muted-foreground mr-2">{n.cod_natureza}</span>
                              {n.desc_natureza ?? ""}
                            </TableCell>
                            <TableCell className="text-right text-sm">
                              {brl(n.valor_pago)}
                            </TableCell>
                            <TableCell className="text-right text-sm">
                              {brl(n.valor_aberto)}
                            </TableCell>
                            <TableCell className="text-right text-sm">
                              {brl(n.valor_total)}
                            </TableCell>
                          </TableRow>
                        ))}
                    </Row>
                  );
                })}
            </Row>
          );
        })}
      </TableBody>
    </Table>
  );
}

// Wrapper to allow returning fragments inside TableBody without React key warnings.
function Row({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
