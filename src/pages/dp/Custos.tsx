// Custo do Colaborador — fator K, encargos, custo por obra/cargo, e o holerite
// por trás de cada número.
//
// Esta página absorveu a antiga Folha de Pagamento (`/dp/fopag`): as duas liam
// `dp_holerite` pelo mesmo hook, com os mesmos filtros, e recalculavam os
// mesmos agregados em duplicata — divergindo no resultado (a Folha somava
// encargos sem o RAT, então a decomposição não fechava com o total que ela
// mesma exibia). Ver docs/FOPAG_CUSTOS_FUSAO.md.
import { Fragment, useCallback, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  AppTooltip,
  CHART_COLORS,
} from "@/components/ui/chart";
import {
  ChevronDown,
  ChevronRight,
  Download,
  FileSpreadsheet,
  Search,
  X,
} from "lucide-react";
import InfoDica from "@/components/common/InfoDica";
import ImportHoleriteDialog from "@/components/dp/ImportHoleriteDialog";
import HoleriteDetailDialog from "@/components/dp/HoleriteDetailDialog";
import DpFilterBar, { type DpFilters } from "@/components/dp/DpFilterBar";
import {
  useDpHolerites,
  applyFilters,
  defaultFilters,
  type DpHoleriteRowEnriched,
} from "@/hooks/dp/useDpHolerites";
import {
  agregarCusto,
  encargosPatronais,
  provisoesTotais,
  outrosProventos,
  fatorKDe,
  reconcilia,
  residuoReconciliacao,
} from "@/lib/dp/custo-folha";
import { useCatalogos } from "@/contexts/catalogos/useCatalogos";
import { cleanCPF } from "@/lib/utils";
import { formatBRLFromNumber } from "@/lib/core/currency";
import { maskCPFDisplay } from "@/lib/dp/parser-holerite-xls";
import { QueryState } from "@/components/common/QueryState";
import { Kpi } from "@/components/common/Kpi";
import { useTableSort } from "@/hooks/useTableSort";
import { SortHeader } from "@/components/ui/sort-header";
import { ColumnFilterHeader } from "@/components/ui/column-filter-header";

// Discriminação dos componentes de cada KPI composto (tooltip do "i").
const COMPOSICAO_INFO = {
  custo:
    "Tudo somado: salário base + horas extras + outros proventos + encargos patronais + FGTS + provisões (13º e férias, com os encargos delas).",
  fatorK:
    "Custo total ÷ salário base, ponderado pela folha. A média dos K individuais distorce quando os salários são muito diferentes.",
  encargos: "INSS patronal (empresa) + RAT/SAT + INSS Terceiros (Sistema S).",
  fgts: "FGTS mensal depositado pela empresa (8% sobre a base de FGTS).",
  provisoes:
    "Provisão de 13º e de férias (+1/3), incluindo o INSS e o FGTS incidentes sobre essas provisões.",
  // Única parcela cujo nome não se explica: ela é apurada por diferença, então
  // a lista de verbas é ilustrativa, não exaustiva. Ver `outrosProventos` em
  // lib/dp/custo-folha.ts.
  outros:
    "Tudo que o holerite paga além do salário base e das horas extras: periculosidade, insalubridade, adicional noturno, prêmios, DSR. É apurado por diferença (proventos − salário base − horas extras), então cobre qualquer verba de provento que venha na importação.",
} as const;

type ParcelaKpi = "custo" | "proventos" | "encargos" | "fgts" | "provisoes";

/** Uma fatia da "Composição do custo". `info` alimenta o "i" da legenda. */
type ParcelaComposicao = { key: string; nome: string; valor: number; info?: string };

type ObraRow = { obra: string; headcount: number; salario: number; custo: number; fk: number };
/** Faixas do empilhado "Custo por obra" — mesmas parcelas da composição. */
type ObraFatias = {
  obra: string;
  salario: number;
  he: number;
  outros: number;
  encargos: number;
  provisoes: number;
};
type CargoRow = { cargo: string; headcount: number; fk: number; custo: number; colabs: ColabAgg[] };
type ColabAgg = {
  colabId: string;
  nome: string;
  cpf: string;
  obra: string;
  salario: number;
  custo: number;
  fk: number | null;
};
type OpRow = {
  id: string;
  raw: DpHoleriteRowEnriched;
  nome: string;
  cpf: string;
  cargo: string;
  obra: string;
  salarioBase: number;
  he: number;
  outros: number;
  encargos: number;
  fgts: number;
  provisoes: number;
  custoTotal: number;
  fatorK: number | null;
};

type BreakdownEntry = {
  id: string;
  nome: string;
  cpf: string;
  obra: string;
  valor: number;
  raw?: DpHoleriteRowEnriched;
};
type Breakdown = { titulo: string; total: number; entries: BreakdownEntry[] } | null;

// Faixas do empilhado por obra. A hora extra sai do salário e ganha faixa
// própria: é a parcela que mais varia de obra para obra, e somada ao salário
// base ela sumia justamente onde interessa comparar. As cores acompanham a
// "Composição do custo" ao lado — mesma parcela, mesma cor nos dois gráficos;
// encargos e FGTS seguem numa faixa só, com a cor dos encargos.
const OBRA_SERIES = [
  { key: "salario", nome: "Salário base", cor: CHART_COLORS.categorical[0] },
  { key: "he", nome: "Horas extras", cor: CHART_COLORS.categorical[1] },
  {
    key: "outros",
    nome: "Outros proventos",
    cor: CHART_COLORS.categorical[2],
    info: COMPOSICAO_INFO.outros,
  },
  { key: "encargos", nome: "Encargos + FGTS", cor: CHART_COLORS.categorical[3] },
  { key: "provisoes", nome: "Provisões", cor: CHART_COLORS.categorical[5] },
] as const satisfies readonly {
  key: Exclude<keyof ObraFatias, "obra">;
  nome: string;
  cor: string;
  info?: string;
}[];

const totalObra = (o: ObraFatias) => o.salario + o.he + o.outros + o.encargos + o.provisoes;

export default function Custos() {
  const {
    rows,
    adiantamentos,
    getAdiantamento,
    loading,
    reload,
    competencias,
    obras,
    cargos: cargosHolerite,
  } = useDpHolerites();
  const { colaboradores } = useCatalogos();
  const [filters, setFilters] = useState<DpFilters | null>(null);
  const [expandedCargo, setExpandedCargo] = useState<string | null>(null);
  const [verColaborador, setVerColaborador] = useState(false);
  const [breakdown, setBreakdown] = useState<Breakdown>(null);
  const [detail, setDetail] = useState<DpHoleriteRowEnriched | null>(null);

  const effective = filters ?? defaultFilters(competencias);
  const filtered = useMemo(() => applyFilters(rows, effective), [rows, effective]);
  const filteredAdiantamentos = useMemo(
    () => applyFilters(adiantamentos, effective),
    [adiantamentos, effective],
  );

  // Map cpf -> colaborador (banco de dados) — fonte de verdade para cargo e nome.
  // É a mesma fonte que `applyFilters` usa no filtro de cargo (`funcaoCadastro`);
  // exibir `cargo_lido` aqui faria a tela contradizer o próprio filtro.
  const colabByCpf = useMemo(() => {
    const m = new Map<string, (typeof colaboradores)[number]>();
    colaboradores.forEach((c) => {
      const k = cleanCPF(c.cpf);
      if (k) m.set(k, c);
    });
    return m;
  }, [colaboradores]);

  const cargoOf = useCallback(
    (r: DpHoleriteRowEnriched) => (colabByCpf.get(r.cpf)?.funcao || r.cargo_lido || "—").trim(),
    [colabByCpf],
  );
  const nomeOf = useCallback(
    (r: DpHoleriteRowEnriched) => (colabByCpf.get(r.cpf)?.nome || r.nome_lido || "—").trim(),
    [colabByCpf],
  );

  const agg = useMemo(() => agregarCusto(filtered), [filtered]);
  const fecha = useMemo(() => reconcilia(filtered), [filtered]);
  const residuo = useMemo(() => residuoReconciliacao(filtered), [filtered]);
  const pessoas = useMemo(() => new Set(filtered.map((r) => r.cpf)).size, [filtered]);
  const obrasNoRecorte = useMemo(
    () => new Set(filtered.map((r) => r.obraResolvida || "—")).size,
    [filtered],
  );

  const totalsColaborador = useMemo(() => {
    const liquidoHolerite = filtered.reduce((s, r) => s + r.liquido, 0);
    const adiantamento = filteredAdiantamentos.reduce((s, r) => s + r.liquido, 0);
    return {
      liquido: liquidoHolerite + adiantamento,
      liquidoHolerite,
      adiantamento,
      descontos: filtered.reduce((s, r) => s + r.descontos, 0),
    };
  }, [filtered, filteredAdiantamentos]);

  // ── Detalhamento de cada KPI (quem compõe o número) ──────────────────────
  const entry = useCallback(
    (r: DpHoleriteRowEnriched, valor: number): BreakdownEntry => ({
      id: r.id,
      nome: nomeOf(r),
      cpf: r.cpf,
      obra: r.obraResolvida || "—",
      valor,
      raw: r,
    }),
    [nomeOf],
  );

  const abrirBreakdown = useCallback(
    (qual: ParcelaKpi | "liquido" | "salarioDia5" | "adiantamento" | "descontos") => {
      const de = (titulo: string, total: number, valor: (r: DpHoleriteRowEnriched) => number) =>
        setBreakdown({ titulo, total, entries: filtered.map((r) => entry(r, valor(r))) });

      switch (qual) {
        case "custo":
          return de("Custo total da empresa", agg.custoTotal, (r) => r.custo_total);
        case "proventos":
          return de(
            "Salário base + horas extras + outros proventos",
            agg.proventos,
            (r) => r.salario_base + r.horas_extras_valor + outrosProventos(r),
          );
        case "encargos":
          return de(
            "Encargos patronais (INSS empresa + RAT/SAT + Terceiros)",
            agg.encargos,
            encargosPatronais,
          );
        case "fgts":
          return de("FGTS sobre a folha", agg.fgts, (r) => r.fgts);
        case "provisoes":
          return de("Provisões de 13º e férias, com encargos", agg.provisoes, provisoesTotais);
        case "salarioDia5":
          return de("Salário líquido (dia 5)", totalsColaborador.liquidoHolerite, (r) => r.liquido);
        case "descontos":
          return de("Descontos do colaborador", totalsColaborador.descontos, (r) => r.descontos);
        case "adiantamento":
          return setBreakdown({
            titulo: "Adiantamento (dia 20)",
            total: totalsColaborador.adiantamento,
            entries: filteredAdiantamentos.map((a) => entry(a, a.liquido)),
          });
        case "liquido":
          return setBreakdown({
            titulo: "Líquido total pago (salário + adiantamento)",
            total: totalsColaborador.liquido,
            entries: [
              ...filtered.map((r) =>
                entry(r, r.liquido + (getAdiantamento(r.cpf, r.competencia)?.liquido || 0)),
              ),
              // Adiantamentos sem holerite correspondente na competência.
              ...filteredAdiantamentos
                .filter(
                  (a) => !filtered.some((r) => r.cpf === a.cpf && r.competencia === a.competencia),
                )
                .map((a) => entry(a, a.liquido)),
            ],
          });
      }
    },
    [agg, filtered, filteredAdiantamentos, entry, getAdiantamento, totalsColaborador],
  );

  // ── Composição do custo ──────────────────────────────────────────────────
  // Barra empilhada horizontal em vez de pizza: com seis parcelas e rótulos
  // longos, comparar fatias de pizza é exatamente onde ela falha.
  // `info` é opcional e só a parcela que o nome não explica sozinha carrega:
  // as demais ou são óbvias ou já têm o "i" no KPI logo acima.
  const composicao = useMemo(() => {
    const parcelas: ParcelaComposicao[] = [
      { key: "salario", nome: "Salário base", valor: agg.salarioBase },
      { key: "he", nome: "Horas extras", valor: agg.he },
      { key: "outros", nome: "Outros proventos", valor: agg.outros, info: COMPOSICAO_INFO.outros },
      { key: "encargos", nome: "Encargos patronais", valor: agg.encargos },
      { key: "fgts", nome: "FGTS", valor: agg.fgts },
      { key: "provisoes", nome: "Provisões (13º + férias)", valor: agg.provisoes },
    ];
    return parcelas.map((p, i) => ({ ...p, cor: CHART_COLORS.categorical[i] }));
  }, [agg]);
  const composicaoBar = useMemo(
    () => [Object.fromEntries(composicao.map((p) => [p.key, p.valor]))],
    [composicao],
  );

  // ── Custo por obra ───────────────────────────────────────────────────────
  const porObra: ObraRow[] = useMemo(() => {
    const m = new Map<
      string,
      { obra: string; cpfs: Set<string>; salario: number; custo: number }
    >();
    filtered.forEach((r) => {
      const k = r.obraResolvida || "—";
      const cur = m.get(k) || { obra: k, cpfs: new Set<string>(), salario: 0, custo: 0 };
      // Headcount conta PESSOAS, não linhas: com "todas as competências" a mesma
      // pessoa aparece uma vez por mês e inflaria a contagem.
      cur.cpfs.add(r.cpf);
      cur.salario += r.salario_base;
      cur.custo += r.custo_total;
      m.set(k, cur);
    });
    return Array.from(m.values()).map((o) => ({
      obra: o.obra,
      headcount: o.cpfs.size,
      salario: o.salario,
      custo: o.custo,
      fk: o.salario > 0 ? o.custo / o.salario : 0,
    }));
  }, [filtered]);

  const obraChart = useMemo(() => {
    // Mesmas parcelas de `agregarCusto`: a barra de cada obra fecha com o custo
    // total dela, do mesmo jeito que a faixa de reconciliação fecha com o da
    // empresa.
    const m = new Map<string, ObraFatias>();
    filtered.forEach((r) => {
      const k = r.obraResolvida || "—";
      const cur = m.get(k) || { obra: k, salario: 0, he: 0, outros: 0, encargos: 0, provisoes: 0 };
      cur.salario += r.salario_base;
      cur.he += r.horas_extras_valor;
      cur.outros += outrosProventos(r);
      cur.encargos += encargosPatronais(r) + r.fgts;
      cur.provisoes += provisoesTotais(r);
      m.set(k, cur);
    });
    return Array.from(m.values())
      .sort((a, b) => totalObra(b) - totalObra(a))
      .slice(0, 10);
  }, [filtered]);

  // Só entram na legenda as faixas que têm valor no recorte: obra sem hora
  // extra (ou sem outros proventos) não ganha uma cor que não aparece em barra
  // nenhuma.
  const obraSeries = useMemo(
    () => OBRA_SERIES.filter((s) => obraChart.some((o) => o[s.key] > 0)),
    [obraChart],
  );

  // ── Custo por cargo (cargo do cadastro) ──────────────────────────────────
  const porCargo: CargoRow[] = useMemo(() => {
    type Acc = { cargo: string; salario: number; custo: number; colabsMap: Map<string, ColabAgg> };
    const m = new Map<string, Acc>();
    filtered.forEach((r) => {
      const k = cargoOf(r);
      const cur = m.get(k) || { cargo: k, salario: 0, custo: 0, colabsMap: new Map() };
      cur.salario += r.salario_base;
      cur.custo += r.custo_total;
      const colabKey = colabByCpf.get(r.cpf)?.id || r.cpf;
      const ce = cur.colabsMap.get(colabKey) || {
        colabId: colabKey,
        nome: nomeOf(r),
        cpf: r.cpf,
        obra: r.obraResolvida || "—",
        salario: 0,
        custo: 0,
        fk: null,
      };
      ce.salario += r.salario_base;
      ce.custo += r.custo_total;
      cur.colabsMap.set(colabKey, ce);
      m.set(k, cur);
    });
    return Array.from(m.values()).map((c) => ({
      cargo: c.cargo,
      headcount: c.colabsMap.size,
      fk: c.salario > 0 ? c.custo / c.salario : 0,
      custo: c.custo,
      colabs: Array.from(c.colabsMap.values())
        .map((x) => ({ ...x, fk: fatorKDe(x.salario, x.custo) }))
        .sort((a, b) => b.custo - a.custo),
    }));
  }, [filtered, cargoOf, nomeOf, colabByCpf]);

  // ── Tabela operacional por colaborador ───────────────────────────────────
  const opRows: OpRow[] = useMemo(
    () =>
      filtered.map((r) => ({
        id: r.id,
        raw: r,
        nome: nomeOf(r),
        cpf: r.cpf,
        cargo: cargoOf(r),
        obra: r.obraResolvida || "—",
        salarioBase: r.salario_base,
        he: r.horas_extras_valor,
        outros: outrosProventos(r),
        encargos: encargosPatronais(r),
        fgts: r.fgts,
        provisoes: provisoesTotais(r),
        custoTotal: r.custo_total,
        fatorK: fatorKDe(r.salario_base, r.custo_total),
      })),
    [filtered, nomeOf, cargoOf],
  );

  type ObraK = "obra" | "headcount" | "salario" | "custo" | "fk";
  const obraSort = useTableSort<ObraRow, ObraK>(porObra, (r, k) => r[k], "custo", "desc");

  type CargoK = "cargo" | "headcount" | "custo" | "fk";
  const cargoSort = useTableSort<CargoRow, CargoK>(porCargo, (r, k) => r[k], "headcount", "desc");

  type OpK =
    | "nome"
    | "cargo"
    | "obra"
    | "salarioBase"
    | "he"
    | "outros"
    | "encargos"
    | "fgts"
    | "provisoes"
    | "custoTotal"
    | "fatorK";
  const opSort = useTableSort<OpRow, OpK>(opRows, (r, k) => r[k], "custoTotal", "desc");

  const toggleExpand = (cargo: string) => setExpandedCargo((c) => (c === cargo ? null : cargo));

  const exportCSV = () => {
    const header = [
      "Nome",
      "CPF",
      "Cargo",
      "Obra",
      "Salário Base",
      "Horas Extras",
      "Outros Proventos",
      "Encargos Patronais",
      "FGTS",
      "Provisões",
      "Custo Total Empresa",
      "Fator K",
    ];
    const money = (n: number) => n.toFixed(2).replace(".", ",");
    const lines = opSort.sorted.map((r) => [
      r.nome,
      maskCPFDisplay(r.cpf),
      r.cargo,
      r.obra,
      money(r.salarioBase),
      money(r.he),
      money(r.outros),
      money(r.encargos),
      money(r.fgts),
      money(r.provisoes),
      money(r.custoTotal),
      r.fatorK != null ? r.fatorK.toFixed(2).replace(".", ",") : "",
    ]);
    const csv = [header, ...lines].map((cols) => cols.map((c) => `"${c}"`).join(";")).join("\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `custo_colaborador_${effective.competencia || "geral"}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const semDados = rows.length === 0 && adiantamentos.length === 0;

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Custo do Colaborador</h1>
          <p className="text-sm text-muted-foreground">
            Markup real da mão de obra — salário, encargos, FGTS e provisões, com o holerite por
            trás de cada número.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={exportCSV} disabled={!filtered.length}>
            <Download className="h-4 w-4 mr-2" />
            Exportar CSV
          </Button>
          <ImportHoleriteDialog />
        </div>
      </div>

      <DpFilterBar
        filters={effective}
        setFilters={setFilters}
        competencias={competencias}
        obras={obras}
        cargos={cargosHolerite}
      />

      <QueryState
        isLoading={loading}
        data={rows}
        isEmpty={() => semDados}
        empty={<SemDados onImported={reload} />}
      >
        {() => (
          <div className="space-y-4">
            {rows.length === 0 && adiantamentos.length > 0 && (
              <Card className="border-warning/40 bg-warning/5">
                <CardContent className="py-3 text-sm">
                  Nenhum holerite (dia 5) importado nesta base. Exibindo apenas os{" "}
                  <strong>adiantamentos (dia 20)</strong>. Importe a folha do dia 5 para ver custo
                  total da empresa, encargos patronais, FGTS e provisões.
                </CardContent>
              </Card>
            )}

            {filtered.length > 0 && (
              <>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                  <Kpi
                    className="md:col-span-2"
                    highlight
                    size="lg"
                    tone="primary"
                    valueClassName="text-3xl"
                    label={
                      <span className="flex items-center gap-1.5">
                        Custo total da empresa
                        <InfoDica texto={COMPOSICAO_INFO.custo} />
                      </span>
                    }
                    value={formatBRLFromNumber(agg.custoTotal)}
                    hint="Salário + HE + outros + encargos + FGTS + provisões — clique para detalhar"
                    onClick={() => abrirBreakdown("custo")}
                  />
                  <Kpi
                    size="lg"
                    valueClassName="text-3xl"
                    label={
                      <span className="flex items-center gap-1.5">
                        Fator K médio
                        <InfoDica texto={COMPOSICAO_INFO.fatorK} />
                      </span>
                    }
                    value={`${agg.fatorK.toFixed(2)}x`}
                    hint={
                      <>
                        Cada R$ 1,00 de salário base custa{" "}
                        <strong>{formatBRLFromNumber(agg.fatorK)}</strong> à empreiteira.
                      </>
                    }
                  />
                  <Kpi
                    label="Salário + HE + outros"
                    value={formatBRLFromNumber(agg.proventos)}
                    hint={pctDoCusto(agg.proventos, agg.custoTotal)}
                    onClick={() => abrirBreakdown("proventos")}
                  />
                  <Kpi
                    label={
                      <span className="flex items-center gap-1.5">
                        Encargos patronais
                        <InfoDica texto={COMPOSICAO_INFO.encargos} />
                      </span>
                    }
                    value={formatBRLFromNumber(agg.encargos)}
                    hint={pctDoCusto(agg.encargos, agg.custoTotal)}
                    onClick={() => abrirBreakdown("encargos")}
                  />
                  <Kpi
                    label={
                      <span className="flex items-center gap-1.5">
                        FGTS
                        <InfoDica texto={COMPOSICAO_INFO.fgts} />
                      </span>
                    }
                    value={formatBRLFromNumber(agg.fgts)}
                    hint={pctDoCusto(agg.fgts, agg.custoTotal)}
                    onClick={() => abrirBreakdown("fgts")}
                  />
                  <Kpi
                    label={
                      <span className="flex items-center gap-1.5">
                        Provisões (13º + férias)
                        <InfoDica texto={COMPOSICAO_INFO.provisoes} />
                      </span>
                    }
                    value={formatBRLFromNumber(agg.provisoes)}
                    hint={pctDoCusto(agg.provisoes, agg.custoTotal)}
                    onClick={() => abrirBreakdown("provisoes")}
                  />
                  <Kpi
                    label="Recorte"
                    value={`${pessoas} · ${obrasNoRecorte}`}
                    hint={`colaboradores · obras — ${filtered.length} holerite(s)`}
                  />
                </div>

                <ReconciliacaoBar
                  composicao={composicao}
                  custoTotal={agg.custoTotal}
                  fecha={fecha}
                  residuo={residuo}
                />
              </>
            )}

            <Card>
              <button
                type="button"
                onClick={() => setVerColaborador((v) => !v)}
                className="w-full flex items-center justify-between p-4 hover:bg-muted/40 transition-colors"
              >
                <div className="flex items-center gap-2 text-left">
                  <span className="text-sm font-medium">Visão do colaborador</span>
                  <span className="text-[10px] text-muted-foreground">
                    — líquido, adiantamento e descontos; informativo, não entra no custo da empresa
                  </span>
                </div>
                <span className="text-xs text-muted-foreground shrink-0">
                  {verColaborador ? "esconder ▲" : "mostrar ▼"}
                </span>
              </button>
              {verColaborador && (
                <CardContent className="pt-4 grid grid-cols-2 md:grid-cols-4 gap-3 border-t">
                  <Kpi
                    label="Líquido total pago"
                    value={formatBRLFromNumber(totalsColaborador.liquido)}
                    hint="salário do dia 5 + adiantamento do dia 20"
                    onClick={() => abrirBreakdown("liquido")}
                  />
                  <Kpi
                    label="Salário líquido (dia 5)"
                    value={formatBRLFromNumber(totalsColaborador.liquidoHolerite)}
                    hint="depois de todos os descontos"
                    onClick={() => abrirBreakdown("salarioDia5")}
                  />
                  <Kpi
                    label="Adiantamento (dia 20)"
                    value={formatBRLFromNumber(totalsColaborador.adiantamento)}
                    onClick={() => abrirBreakdown("adiantamento")}
                  />
                  <Kpi
                    label="Descontos do colaborador"
                    value={formatBRLFromNumber(totalsColaborador.descontos)}
                    hint="INSS retido, IRRF, VT, plano odontológico…"
                    onClick={() => abrirBreakdown("descontos")}
                  />
                </CardContent>
              )}
            </Card>

            {filtered.length > 0 && (
              <>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base">Composição do custo</CardTitle>
                      <p className="text-xs text-muted-foreground">
                        Onde cada real vai. As seis parcelas somam exatamente o custo total.
                      </p>
                    </CardHeader>
                    <CardContent>
                      <div className="h-16">
                        <ResponsiveContainer>
                          <BarChart layout="vertical" data={composicaoBar} barCategoryGap={0}>
                            <XAxis type="number" hide />
                            <YAxis type="category" hide />
                            <AppTooltip
                              formatter={(v: number, name: string) => [
                                formatBRLFromNumber(v),
                                name,
                              ]}
                            />
                            {composicao.map((p) => (
                              <Bar
                                key={p.key}
                                dataKey={p.key}
                                name={p.nome}
                                stackId="c"
                                fill={p.cor}
                                barSize={28}
                              />
                            ))}
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                      <ul className="mt-3 space-y-1.5">
                        {composicao
                          .filter((p) => p.valor > 0)
                          .map((p) => (
                            <li key={p.key} className="flex items-center gap-2 text-sm">
                              <span
                                aria-hidden
                                className="h-2.5 w-2.5 rounded-sm shrink-0"
                                style={{ background: p.cor }}
                              />
                              <span className="text-muted-foreground flex items-center gap-1.5">
                                {p.nome}
                                {p.info && (
                                  <InfoDica texto={p.info} rotulo={`O que entra em ${p.nome}`} />
                                )}
                              </span>
                              <span className="ml-auto tabular-nums">
                                {formatBRLFromNumber(p.valor)}
                              </span>
                              <span className="w-12 text-right tabular-nums text-xs text-muted-foreground">
                                {pctTexto(p.valor, agg.custoTotal)}
                              </span>
                            </li>
                          ))}
                        <li className="flex items-center gap-2 text-sm border-t pt-1.5 font-medium">
                          <span className="h-2.5 w-2.5 shrink-0" />
                          <span>Custo total</span>
                          <span className="ml-auto tabular-nums">
                            {formatBRLFromNumber(agg.custoTotal)}
                          </span>
                          <span className="w-12 text-right tabular-nums text-xs text-muted-foreground">
                            100%
                          </span>
                        </li>
                      </ul>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base">Custo por obra</CardTitle>
                      <p className="text-xs text-muted-foreground">
                        Composição empilhada, com as horas extras separadas do salário — os encargos
                        já incluem o RAT/SAT.
                      </p>
                    </CardHeader>
                    <CardContent className="h-72">
                      <ResponsiveContainer>
                        <BarChart data={obraChart}>
                          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                          <XAxis
                            dataKey="obra"
                            tick={{ fontSize: 11 }}
                            interval={0}
                            angle={-20}
                            height={70}
                            textAnchor="end"
                          />
                          <YAxis tickFormatter={(v: number) => `${(v / 1000).toFixed(0)}k`} />
                          <AppTooltip formatter={(v: number) => formatBRLFromNumber(v)} />
                          {/* Legenda customizada — é o único gráfico do app que
                              customiza a do Recharts. O motivo é o "i" de
                              "Outros proventos": o formatter aceita ReactNode,
                              e o TooltipProvider que o Radix exige já vem do
                              App.tsx, então o balão funciona aqui dentro. */}
                          <Legend
                            wrapperStyle={{ fontSize: 11 }}
                            formatter={(value: string) => {
                              const serie = OBRA_SERIES.find((s) => s.nome === value);
                              const info = serie && "info" in serie ? serie.info : undefined;
                              if (!info) return value;
                              return (
                                <span className="inline-flex items-center gap-1 align-middle">
                                  {value}
                                  <InfoDica
                                    texto={info}
                                    rotulo={`O que entra em ${value}`}
                                    compacto
                                  />
                                </span>
                              );
                            }}
                          />
                          {obraSeries.map((s) => (
                            <Bar
                              key={s.key}
                              dataKey={s.key}
                              stackId="a"
                              fill={s.cor}
                              name={s.nome}
                            />
                          ))}
                        </BarChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>
                </div>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">Custo por obra</CardTitle>
                    <p className="text-xs text-muted-foreground">
                      Headcount conta pessoas distintas, não linhas de holerite.
                    </p>
                  </CardHeader>
                  <CardContent className="overflow-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <SortHeader
                            sortKey="obra"
                            currentKey={obraSort.sortKey}
                            dir={obraSort.sortDir}
                            onToggle={obraSort.toggle}
                          >
                            Obra
                          </SortHeader>
                          <SortHeader
                            sortKey="headcount"
                            align="right"
                            currentKey={obraSort.sortKey}
                            dir={obraSort.sortDir}
                            onToggle={obraSort.toggle}
                          >
                            Headcount
                          </SortHeader>
                          <SortHeader
                            sortKey="salario"
                            align="right"
                            currentKey={obraSort.sortKey}
                            dir={obraSort.sortDir}
                            onToggle={obraSort.toggle}
                          >
                            Salário base
                          </SortHeader>
                          <SortHeader
                            sortKey="custo"
                            align="right"
                            currentKey={obraSort.sortKey}
                            dir={obraSort.sortDir}
                            onToggle={obraSort.toggle}
                          >
                            Custo total
                          </SortHeader>
                          <SortHeader
                            sortKey="fk"
                            align="right"
                            currentKey={obraSort.sortKey}
                            dir={obraSort.sortDir}
                            onToggle={obraSort.toggle}
                          >
                            Fator K
                          </SortHeader>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {obraSort.sorted.map((o) => (
                          <TableRow key={o.obra}>
                            <TableCell className="font-medium">{o.obra}</TableCell>
                            <TableCell className="text-right">{o.headcount}</TableCell>
                            <TableCell className="text-right">
                              {formatBRLFromNumber(o.salario)}
                            </TableCell>
                            <TableCell className="text-right font-semibold">
                              {formatBRLFromNumber(o.custo)}
                            </TableCell>
                            <TableCell className="text-right">{o.fk.toFixed(2)}x</TableCell>
                          </TableRow>
                        ))}
                        <TableRow className="border-t bg-muted/30 font-medium">
                          <TableCell>Total</TableCell>
                          <TableCell className="text-right">{pessoas}</TableCell>
                          <TableCell className="text-right">
                            {formatBRLFromNumber(agg.salarioBase)}
                          </TableCell>
                          <TableCell className="text-right">
                            {formatBRLFromNumber(agg.custoTotal)}
                          </TableCell>
                          <TableCell className="text-right">{agg.fatorK.toFixed(2)}x</TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">Custo por cargo</CardTitle>
                    <p className="text-xs text-muted-foreground">
                      Cargo conforme cadastro do colaborador. Clique na linha para ver os
                      colaboradores.
                    </p>
                  </CardHeader>
                  <CardContent className="overflow-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-8"></TableHead>
                          <SortHeader
                            sortKey="cargo"
                            currentKey={cargoSort.sortKey}
                            dir={cargoSort.sortDir}
                            onToggle={cargoSort.toggle}
                          >
                            Cargo
                          </SortHeader>
                          <SortHeader
                            sortKey="headcount"
                            align="right"
                            currentKey={cargoSort.sortKey}
                            dir={cargoSort.sortDir}
                            onToggle={cargoSort.toggle}
                          >
                            Headcount
                          </SortHeader>
                          <SortHeader
                            sortKey="custo"
                            align="right"
                            currentKey={cargoSort.sortKey}
                            dir={cargoSort.sortDir}
                            onToggle={cargoSort.toggle}
                          >
                            Custo total
                          </SortHeader>
                          <SortHeader
                            sortKey="fk"
                            align="right"
                            currentKey={cargoSort.sortKey}
                            dir={cargoSort.sortDir}
                            onToggle={cargoSort.toggle}
                          >
                            Fator K médio
                          </SortHeader>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {cargoSort.sorted.map((c) => {
                          const isOpen = expandedCargo === c.cargo;
                          return (
                            <Fragment key={c.cargo}>
                              <TableRow
                                className="cursor-pointer hover:bg-muted/50"
                                onClick={() => toggleExpand(c.cargo)}
                              >
                                <TableCell className="w-8 align-middle">
                                  {isOpen ? (
                                    <ChevronDown className="h-4 w-4" />
                                  ) : (
                                    <ChevronRight className="h-4 w-4" />
                                  )}
                                </TableCell>
                                <TableCell className="font-medium">{c.cargo}</TableCell>
                                <TableCell className="text-right">{c.headcount}</TableCell>
                                <TableCell className="text-right">
                                  {formatBRLFromNumber(c.custo)}
                                </TableCell>
                                <TableCell className="text-right">{c.fk.toFixed(2)}x</TableCell>
                              </TableRow>
                              {isOpen && (
                                <TableRow className="bg-muted/30 hover:bg-muted/30">
                                  <TableCell></TableCell>
                                  <TableCell colSpan={4} className="p-0">
                                    <Table>
                                      <TableHeader>
                                        <TableRow>
                                          <TableHead>Colaborador</TableHead>
                                          <TableHead>Obra</TableHead>
                                          <TableHead className="text-right">Salário base</TableHead>
                                          <TableHead className="text-right">Custo total</TableHead>
                                          <TableHead className="text-right">Fator K</TableHead>
                                        </TableRow>
                                      </TableHeader>
                                      <TableBody>
                                        {c.colabs.map((cb) => (
                                          <TableRow key={cb.colabId}>
                                            <TableCell className="font-medium">{cb.nome}</TableCell>
                                            <TableCell className="text-xs">{cb.obra}</TableCell>
                                            <TableCell className="text-right">
                                              {formatBRLFromNumber(cb.salario)}
                                            </TableCell>
                                            <TableCell className="text-right">
                                              {formatBRLFromNumber(cb.custo)}
                                            </TableCell>
                                            <TableCell className="text-right">
                                              {cb.fk != null ? `${cb.fk.toFixed(2)}x` : "—"}
                                            </TableCell>
                                          </TableRow>
                                        ))}
                                      </TableBody>
                                    </Table>
                                  </TableCell>
                                </TableRow>
                              )}
                            </Fragment>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">Por colaborador</CardTitle>
                    <p className="text-xs text-muted-foreground">
                      Clique numa linha para abrir o holerite completo, com todas as verbas.
                    </p>
                  </CardHeader>
                  <CardContent className="overflow-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          {(
                            [
                              ["nome", "Nome", false],
                              ["cargo", "Cargo", false],
                              ["obra", "Obra", false],
                              ["salarioBase", "Salário base", true],
                              ["he", "HE", true],
                              ["outros", "Outros", true],
                              ["encargos", "Encargos", true],
                              ["fgts", "FGTS", true],
                              ["provisoes", "Provisões", true],
                              ["custoTotal", "Custo total", true],
                              ["fatorK", "Fator K", true],
                            ] as [OpK, string, boolean][]
                          ).map(([k, rotulo, right]) => (
                            <SortHeader
                              key={k}
                              sortKey={k}
                              align={right ? "right" : "left"}
                              currentKey={opSort.sortKey}
                              dir={opSort.sortDir}
                              onToggle={opSort.toggle}
                            >
                              {rotulo}
                            </SortHeader>
                          ))}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {opSort.sorted.map((r) => (
                          <TableRow
                            key={r.id}
                            className="cursor-pointer"
                            onClick={() => setDetail(r.raw)}
                          >
                            <TableCell className="font-medium">{r.nome}</TableCell>
                            <TableCell className="text-xs">{r.cargo}</TableCell>
                            <TableCell className="text-xs">{r.obra}</TableCell>
                            <TableCell className="text-right">
                              {formatBRLFromNumber(r.salarioBase)}
                            </TableCell>
                            <TableCell className="text-right">
                              <ValorOuTraco valor={r.he} />
                            </TableCell>
                            <TableCell className="text-right">
                              <ValorOuTraco valor={r.outros} />
                            </TableCell>
                            <TableCell className="text-right">
                              {formatBRLFromNumber(r.encargos)}
                            </TableCell>
                            <TableCell className="text-right">
                              {formatBRLFromNumber(r.fgts)}
                            </TableCell>
                            <TableCell className="text-right">
                              {formatBRLFromNumber(r.provisoes)}
                            </TableCell>
                            <TableCell className="text-right font-semibold">
                              {formatBRLFromNumber(r.custoTotal)}
                            </TableCell>
                            <TableCell className="text-right">
                              {r.fatorK != null ? `${r.fatorK.toFixed(2)}x` : "—"}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                    <p className="text-[10px] text-muted-foreground mt-2">
                      Nome e cargo vêm do cadastro do colaborador, com o texto do holerite como
                      reserva — a mesma fonte que o filtro de cargo usa. O detalhamento inclui os
                      descontos do colaborador (INSS retido, IRRF, plano odontológico), que são
                      informativos e não compõem o custo da empresa.
                    </p>
                  </CardContent>
                </Card>
              </>
            )}
          </div>
        )}
      </QueryState>

      <HoleriteDetailDialog holerite={detail} onClose={() => setDetail(null)} />
      <BreakdownDialog
        data={breakdown}
        onClose={() => setBreakdown(null)}
        onRowClick={(r) => r.raw && setDetail(r.raw)}
      />
    </div>
  );
}

// ── Auxiliares de apresentação ────────────────────────────────────────────
function pctTexto(valor: number, total: number): string {
  if (!total) return "—";
  return `${((valor / total) * 100).toFixed(1).replace(".", ",")}%`;
}
function pctDoCusto(valor: number, total: number): string {
  return `${pctTexto(valor, total)} do custo total`;
}

function ValorOuTraco({ valor }: { valor: number }) {
  if (!valor) return <span className="text-muted-foreground">—</span>;
  return <>{formatBRLFromNumber(valor)}</>;
}

function SemDados({ onImported }: { onImported: () => void }) {
  return (
    <Card>
      <CardContent className="py-12 flex flex-col items-center text-center gap-3">
        <FileSpreadsheet className="h-12 w-12 text-muted-foreground" />
        <h3 className="text-lg font-semibold">Nenhum holerite ou adiantamento importado</h3>
        <p className="text-sm text-muted-foreground max-w-md">
          Importe a planilha <strong>"Holerite em Excel"</strong> (dia 5) ou{" "}
          <strong>"Adiantamento Salarial"</strong> (dia 20). Cada tipo é independente e pode ser
          importado separadamente.
        </p>
        <ImportHoleriteDialog onImported={onImported} />
      </CardContent>
    </Card>
  );
}

/**
 * Prova, na tela, que a decomposição fecha com o total. Existe porque a versão
 * anterior desta informação (na Folha de Pagamento) não fechava: os cards
 * somavam `custo_total − rat` e ninguém tinha como perceber.
 */
function ReconciliacaoBar({
  composicao,
  custoTotal,
  fecha,
  residuo,
}: {
  composicao: { key: string; nome: string; valor: number; cor: string }[];
  custoTotal: number;
  fecha: boolean;
  residuo: number;
}) {
  return (
    <Card>
      <CardContent className="py-3 flex items-center gap-x-2 gap-y-1.5 flex-wrap text-sm">
        {composicao
          .filter((p) => p.valor > 0)
          .map((p, i) => (
            <Fragment key={p.key}>
              {i > 0 && <span className="text-muted-foreground">+</span>}
              <span className="inline-flex items-center gap-1.5 tabular-nums" title={p.nome}>
                <span
                  aria-hidden
                  className="h-2.5 w-2.5 rounded-sm"
                  style={{ background: p.cor }}
                />
                {formatBRLFromNumber(p.valor)}
              </span>
            </Fragment>
          ))}
        <span className="text-muted-foreground">=</span>
        <strong className="tabular-nums">{formatBRLFromNumber(custoTotal)}</strong>
        {fecha ? (
          <span className="text-xs font-medium text-success bg-success/10 rounded-full px-2 py-0.5">
            ✓ fecha com o custo total
          </span>
        ) : (
          <span className="text-xs font-medium text-destructive bg-destructive/10 rounded-full px-2 py-0.5">
            ✗ diferença de {formatBRLFromNumber(Math.abs(residuo))} — verifique a importação
          </span>
        )}
      </CardContent>
    </Card>
  );
}

type BdSortK = "nome" | "cpf" | "obra" | "valor";

function BreakdownDialog({
  data,
  onClose,
  onRowClick,
}: {
  data: Breakdown;
  onClose: () => void;
  onRowClick: (r: BreakdownEntry) => void;
}) {
  const entries = useMemo(() => (data ? data.entries.filter((e) => e.valor !== 0) : []), [data]);
  const [q, setQ] = useState("");
  const [filtroNome, setFiltroNome] = useState<Set<string>>(new Set());
  const [filtroObra, setFiltroObra] = useState<Set<string>>(new Set());

  const opcoesNome = useMemo(
    () => Array.from(new Set(entries.map((e) => e.nome || "—"))).sort(),
    [entries],
  );
  const opcoesObra = useMemo(
    () => Array.from(new Set(entries.map((e) => e.obra || "—"))).sort(),
    [entries],
  );

  const filtrados = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return entries.filter((e) => {
      if (needle) {
        const hit =
          (e.nome || "").toLowerCase().includes(needle) ||
          (e.cpf || "").includes(needle.replace(/\D/g, "")) ||
          (e.obra || "").toLowerCase().includes(needle);
        if (!hit) return false;
      }
      if (filtroNome.size > 0 && !filtroNome.has(e.nome || "—")) return false;
      if (filtroObra.size > 0 && !filtroObra.has(e.obra || "—")) return false;
      return true;
    });
  }, [entries, q, filtroNome, filtroObra]);

  const { sorted, sortKey, sortDir, toggle } = useTableSort<BreakdownEntry, BdSortK>(
    filtrados,
    (row, key) => (key === "valor" ? Number(row.valor ?? 0) : (row[key] ?? "")),
    "valor",
    "desc",
  );

  const totalFiltrado = useMemo(
    () => filtrados.reduce((s, e) => s + Number(e.valor ?? 0), 0),
    [filtrados],
  );

  const algumFiltro = filtroNome.size > 0 || filtroObra.size > 0;
  function limparFiltros() {
    setFiltroNome(new Set());
    setFiltroObra(new Set());
    setQ("");
  }

  if (!data) return null;
  return (
    <Dialog open={!!data} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="space-y-1">
            <div>{data.titulo}</div>
            <div className="text-sm font-normal text-muted-foreground">
              Total: <strong>{formatBRLFromNumber(totalFiltrado)}</strong> · {sorted.length}{" "}
              colaborador(es)
              {sorted.length !== entries.length && (
                <span className="ml-2 text-xs">
                  (de {entries.length} · {formatBRLFromNumber(data.total)})
                </span>
              )}
            </div>
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[220px] max-w-md">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar por nome, CPF ou obra..."
              className="pl-8 h-9"
            />
          </div>
          {(algumFiltro || q) && (
            <Button size="sm" variant="ghost" onClick={limparFiltros}>
              <X className="h-3.5 w-3.5 mr-1" />
              Limpar filtros
            </Button>
          )}
        </div>

        <div className="border rounded-md overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
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
                <SortHeader sortKey="cpf" currentKey={sortKey} dir={sortDir} onToggle={toggle}>
                  CPF
                </SortHeader>
                <ColumnFilterHeader
                  sortKey="obra"
                  currentKey={sortKey}
                  dir={sortDir}
                  onToggleSort={toggle}
                  options={opcoesObra}
                  selected={filtroObra}
                  onChangeSelected={setFiltroObra}
                >
                  Obra
                </ColumnFilterHeader>
                <SortHeader
                  sortKey="valor"
                  currentKey={sortKey}
                  dir={sortDir}
                  onToggle={toggle}
                  align="right"
                >
                  Valor
                </SortHeader>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.map((r) => (
                <TableRow
                  key={r.id}
                  className={r.raw ? "cursor-pointer" : undefined}
                  onClick={() => r.raw && onRowClick(r)}
                >
                  <TableCell className="font-medium">{r.nome}</TableCell>
                  <TableCell className="text-xs">{maskCPFDisplay(r.cpf)}</TableCell>
                  <TableCell className="text-xs">{r.obra}</TableCell>
                  <TableCell className="text-right font-semibold">
                    {formatBRLFromNumber(r.valor)}
                  </TableCell>
                </TableRow>
              ))}
              {sorted.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground text-sm">
                    Nenhum valor a exibir
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
        <p className="text-[10px] text-muted-foreground mt-2">
          Clique numa linha para abrir o holerite completo do colaborador.
        </p>
      </DialogContent>
    </Dialog>
  );
}
