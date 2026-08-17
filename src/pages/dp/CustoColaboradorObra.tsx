// Custo do Colaborador x Obra — discrimina custo proporcional ao período
// que cada colaborador esteve alocado em uma obra específica dentro de uma competência.
import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Search, Building2, Users, Clock, Wallet, Calculator } from "lucide-react";
import HomemHora from "@/pages/dp/HomemHora";
import { useCatalogos } from "@/contexts/catalogos/useCatalogos";
import { useDpHolerites } from "@/hooks/dp/useDpHolerites";
import { cleanCPF } from "@/lib/utils";
import { formatBRLFromNumber } from "@/lib/core/currency";
import { formatCompetencia } from "@/components/dp/DpFilterBar";
import { QueryState } from "@/components/common/QueryState";
import { EmptyState } from "@/components/common/EmptyState";
import {
  periodosDoColaborador,
  competenciaRange,
  diasIntersecao,
  formatRangeBR,
} from "@/lib/dp/alocacao";
import { useTableSort } from "@/hooks/useTableSort";
import { SortHeader } from "@/components/ui/sort-header";

interface LinhaCusto {
  colabId: string;
  nome: string;
  cargo: string;
  cpf: string;
  periodo: string;
  dias: number;
  diasMes: number;
  proporcao: number;
  salarioProp: number;
  heProp: number;
  outrosProventosProp: number;
  encargosProp: number;
  custoTotalProp: number;
  custoMesIntegral: number;
}

export default function CustoColaboradorObra() {
  const [view, setView] = useState<"custo" | "homem-hora">("custo");

  const { colaboradores, obras } = useCatalogos();
  const { rows, loading, competencias } = useDpHolerites();

  const obrasOrdenadas = useMemo(
    () => [...obras].filter((o) => o.ativa !== false).sort((a, b) => a.nome.localeCompare(b.nome)),
    [obras],
  );

  const [obraId, setObraId] = useState<string>("todos");
  const [competencia, setCompetencia] = useState<string>("");
  const [search, setSearch] = useState("");

  const effCompetencia = competencia || competencias[0] || "";
  const effObraId = obraId || "todos";
  const obraSelecionada = obrasOrdenadas.find((o) => o.id === effObraId);

  const linhas: LinhaCusto[] = useMemo(() => {
    if (!effCompetencia) return [];
    if (effObraId !== "todos" && !obraSelecionada) return [];

    const { inicio, fim, dias: diasMes } = competenciaRange(effCompetencia);
    const ateData = new Date(Math.max(fim.getTime(), Date.now()));
    const sc = cleanCPF(search);
    const sl = search.toLowerCase().trim();

    const result: LinhaCusto[] = [];

    rows
      .filter((h) => h.competencia === effCompetencia)
      .forEach((h) => {
        const colab = colaboradores.find(
          (c) => h.colaborador_id === c.id || cleanCPF(c.cpf) === h.cpf,
        );

        let periodos = colab ? periodosDoColaborador(colab, obras, ateData) : [];

        if (periodos.length === 0) {
          const nomeObraHolerite = h.centro_custo_nome_lido || "";
          const obraFallback = obrasOrdenadas.find(
            (o) => o.nome.trim().toLowerCase() === nomeObraHolerite.trim().toLowerCase(),
          );
          if (obraFallback) {
            periodos = [
              {
                obraId: obraFallback.id,
                obraNome: obraFallback.nome,
                inicio,
                fim,
              },
            ];
          }
        }

        let diasNaObra = 0;
        let inicioReal: Date | null = null;
        let fimReal: Date | null = null;
        periodos
          .filter((p) => effObraId === "todos" || p.obraId === obraSelecionada?.id)
          .forEach((p) => {
            const d = diasIntersecao(p.inicio, p.fim, inicio, fim);
            if (d > 0) {
              diasNaObra += d;
              const ini = new Date(Math.max(p.inicio.getTime(), inicio.getTime()));
              const fi = new Date(Math.min(p.fim.getTime(), fim.getTime()));
              if (!inicioReal || ini < inicioReal) inicioReal = ini;
              if (!fimReal || fi > fimReal) fimReal = fi;
            }
          });

        // Limita ao máximo de dias do mês (para tratar possíveis sobreposições erradas de cadastro)
        diasNaObra = Math.min(diasNaObra, diasMes);

        if (diasNaObra <= 0) return;

        const nome = (colab?.nome || h.nome_lido || "—").trim();
        const cargo = (colab?.funcao || h.cargo_lido || "—").trim();
        if (sl) {
          const hitCpf = sc && h.cpf.includes(sc);
          const hitNome = nome.toLowerCase().includes(sl);
          if (!hitCpf && !hitNome) return;
        }

        const proporcao = diasNaObra / diasMes;
        const salarioBase = h.salario_base || 0;
        const proventosMes = h.proventos || 0;
        const heMes = h.horas_extras_valor || 0;
        const custoMes = h.custo_total || 0;
        const salarioProp = salarioBase * proporcao;
        const heProp = heMes * proporcao;
        const outrosProventosProp = Math.max(0, proventosMes - salarioBase - heMes) * proporcao;
        const custoTotalProp = custoMes * proporcao;
        // encargos = tudo que sobra do custo (encargos patronais + FGTS + provisões + encargos sobre provisões).
        // Garante salario + HE + outros + encargos = custo_total.
        const encargosProp = Math.max(0, custoMes - proventosMes) * proporcao;

        result.push({
          colabId: colab?.id || h.colaborador_id || h.cpf,
          nome,
          cargo,
          cpf: h.cpf,
          periodo: inicioReal && fimReal ? formatRangeBR(inicioReal, fimReal) : "—",
          dias: diasNaObra,
          diasMes,
          proporcao,
          salarioProp,
          heProp,
          outrosProventosProp,
          encargosProp,
          custoTotalProp,
          custoMesIntegral: custoMes,
        });
      });

    return result.sort((a, b) => b.custoTotalProp - a.custoTotalProp);
  }, [
    rows,
    colaboradores,
    obras,
    obrasOrdenadas,
    effCompetencia,
    effObraId,
    obraSelecionada,
    search,
  ]);

  const kpis = useMemo(() => {
    const custoTotal = linhas.reduce((s, l) => s + l.custoTotalProp, 0);
    const he = linhas.reduce((s, l) => s + l.heProp, 0);
    const headcount = linhas.length;
    const media = headcount ? custoTotal / headcount : 0;
    return { custoTotal, he, headcount, media };
  }, [linhas]);

  type LinhaK =
    | "nome"
    | "periodo"
    | "dias"
    | "proporcao"
    | "salarioProp"
    | "heProp"
    | "outrosProventosProp"
    | "encargosProp"
    | "custoTotalProp";
  const linhaSort = useTableSort(linhas, (l, k: LinhaK) => (l as any)[k], "custoTotalProp", "desc");

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">Custo de Mão de Obra Direta</h1>
          <p className="text-sm text-muted-foreground">
            Custo proporcional ao período de alocação do colaborador na obra, cruzando histórico de
            mobilização com a folha de pagamento.
          </p>
        </div>
        <div className="flex items-center gap-1 bg-muted/50 rounded-lg p-1 w-fit">
          <button
            onClick={() => setView("custo")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              view === "custo"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Building2 className="h-3.5 w-3.5" /> Custo por colaborador
          </button>
          <button
            onClick={() => setView("homem-hora")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              view === "homem-hora"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Calculator className="h-3.5 w-3.5" /> Homem/Hora
          </button>
        </div>
      </div>

      {view === "homem-hora" ? (
        <div className="-mx-6 -mb-4">
          <HomemHora />
        </div>
      ) : (
        <>
          <Card>
            <CardContent className="pt-6 flex flex-wrap gap-3 items-center">
              <div className="min-w-[240px]">
                <label className="text-xs text-muted-foreground">Obra</label>
                <Select value={effObraId} onValueChange={setObraId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a obra" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos</SelectItem>
                    {obrasOrdenadas.map((o) => (
                      <SelectItem key={o.id} value={o.id}>
                        {o.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="min-w-[180px]">
                <label className="text-xs text-muted-foreground">Competência</label>
                <Select value={effCompetencia} onValueChange={setCompetencia}>
                  <SelectTrigger>
                    <SelectValue placeholder="Competência" />
                  </SelectTrigger>
                  <SelectContent>
                    {competencias.map((c) => (
                      <SelectItem key={c} value={c}>
                        {formatCompetencia(c)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="relative flex-1 min-w-[220px]">
                <label className="text-xs text-muted-foreground">Buscar colaborador</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Nome ou CPF"
                    className="pl-9"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <Kpi
              icon={<Building2 className="h-4 w-4" />}
              label={
                effObraId === "todos" ? "Custo total no período" : "Custo total da obra no período"
              }
              value={formatBRLFromNumber(kpis.custoTotal)}
              highlight
            />
            <Kpi
              icon={<Clock className="h-4 w-4" />}
              label="Horas extras acumuladas"
              value={formatBRLFromNumber(kpis.he)}
            />
            <Kpi
              icon={<Users className="h-4 w-4" />}
              label="Colaboradores no período"
              value={String(kpis.headcount)}
            />
            <Kpi
              icon={<Wallet className="h-4 w-4" />}
              label="Custo médio por colaborador"
              value={formatBRLFromNumber(kpis.media)}
            />
          </div>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">
                Discriminação de custos
                {effObraId === "todos" ? (
                  <span className="text-muted-foreground font-normal"> — Todas as Obras</span>
                ) : obraSelecionada ? (
                  <span className="text-muted-foreground font-normal">
                    {" "}
                    — {obraSelecionada.nome}
                  </span>
                ) : null}
              </CardTitle>
            </CardHeader>
            <CardContent className="overflow-auto max-h-[600px]">
              <QueryState
                isLoading={loading}
                data={linhas}
                isEmpty={(r) => r.length === 0}
                empty={
                  <EmptyState
                    title="Sem alocações"
                    description="Nenhum colaborador alocado nesta obra durante a competência selecionada."
                  />
                }
              >
                {() => (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <SortHeader
                        sortKey="nome"
                        currentKey={linhaSort.sortKey}
                        dir={linhaSort.sortDir}
                        onToggle={linhaSort.toggle}
                      >
                        Colaborador
                      </SortHeader>
                      <SortHeader
                        sortKey="periodo"
                        currentKey={linhaSort.sortKey}
                        dir={linhaSort.sortDir}
                        onToggle={linhaSort.toggle}
                      >
                        Período na obra
                      </SortHeader>
                      <SortHeader
                        sortKey="dias"
                        align="right"
                        currentKey={linhaSort.sortKey}
                        dir={linhaSort.sortDir}
                        onToggle={linhaSort.toggle}
                      >
                        Dias
                      </SortHeader>
                      <SortHeader
                        sortKey="proporcao"
                        align="right"
                        currentKey={linhaSort.sortKey}
                        dir={linhaSort.sortDir}
                        onToggle={linhaSort.toggle}
                      >
                        % do mês
                      </SortHeader>
                      <SortHeader
                        sortKey="salarioProp"
                        align="right"
                        currentKey={linhaSort.sortKey}
                        dir={linhaSort.sortDir}
                        onToggle={linhaSort.toggle}
                      >
                        Salário prop.
                      </SortHeader>
                      <SortHeader
                        sortKey="heProp"
                        align="right"
                        currentKey={linhaSort.sortKey}
                        dir={linhaSort.sortDir}
                        onToggle={linhaSort.toggle}
                      >
                        Horas extras
                      </SortHeader>
                      <SortHeader
                        sortKey="outrosProventosProp"
                        align="right"
                        currentKey={linhaSort.sortKey}
                        dir={linhaSort.sortDir}
                        onToggle={linhaSort.toggle}
                      >
                        Outros proventos
                      </SortHeader>
                      <SortHeader
                        sortKey="encargosProp"
                        align="right"
                        currentKey={linhaSort.sortKey}
                        dir={linhaSort.sortDir}
                        onToggle={linhaSort.toggle}
                      >
                        Encargos + benefícios
                      </SortHeader>
                      <SortHeader
                        sortKey="custoTotalProp"
                        align="right"
                        currentKey={linhaSort.sortKey}
                        dir={linhaSort.sortDir}
                        onToggle={linhaSort.toggle}
                      >
                        Custo total
                      </SortHeader>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {linhaSort.sorted.map((l) => (
                      <TableRow key={l.colabId + l.periodo}>
                        <TableCell>
                          <div className="font-medium">{l.nome}</div>
                          <div className="text-xs text-muted-foreground">{l.cargo}</div>
                        </TableCell>
                        <TableCell>{l.periodo}</TableCell>
                        <TableCell className="text-right">
                          {l.dias}/{l.diasMes}
                        </TableCell>
                        <TableCell className="text-right">
                          <Badge variant={l.proporcao >= 0.99 ? "default" : "secondary"}>
                            {(l.proporcao * 100).toFixed(0)}%
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          {formatBRLFromNumber(l.salarioProp)}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatBRLFromNumber(l.heProp)}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatBRLFromNumber(l.outrosProventosProp)}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatBRLFromNumber(l.encargosProp)}
                        </TableCell>
                        <TableCell className="text-right font-semibold">
                          {formatBRLFromNumber(l.custoTotalProp)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                )}
              </QueryState>
            </CardContent>
          </Card>

          <p className="text-xs text-muted-foreground">
            Regra de proporcionalidade:{" "}
            <strong>custo_imputado = custo_mes × (dias_na_obra ÷ dias_da_competência)</strong>. Dias
            são derivados do histórico de mobilizações do colaborador. Quando não há histórico
            registrado no mês, considera-se o centro de custo do holerite como alocação integral.
          </p>
        </>
      )}
    </div>
  );
}

function Kpi({
  icon,
  label,
  value,
  highlight,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <Card className={highlight ? "bg-primary/5 border-primary/30" : ""}>
      <CardHeader className="pb-2">
        <CardTitle className="text-xs text-muted-foreground flex items-center gap-2">
          {icon} {label}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className={`text-2xl font-bold ${highlight ? "text-primary" : ""}`}>{value}</div>
      </CardContent>
    </Card>
  );
}
