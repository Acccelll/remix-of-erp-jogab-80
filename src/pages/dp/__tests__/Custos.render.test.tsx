import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within, fireEvent } from "@testing-library/react";
import type { DpHoleriteRowEnriched } from "@/hooks/dp/useDpHolerites";

/**
 * Fumaça da página que resultou da fusão Folha de Pagamento + Custo do
 * Colaborador. O que este teste protege, e o typecheck não pega:
 *  - a decomposição em KPIs continua fechando com o custo total na TELA
 *    (era exatamente o que quebrava na Folha antiga, sem ninguém ver);
 *  - nome e cargo saem do cadastro, não do texto do holerite — a mesma fonte
 *    que o filtro de cargo usa;
 *  - o drill-down de KPI e o holerite continuam alcançáveis.
 */

const IMPORT_DIALOG = "import-holerite-dialog";

vi.mock("@/components/dp/ImportHoleriteDialog", () => ({
  default: () => <div data-testid={IMPORT_DIALOG} />,
}));

// Recharts não mede nada em jsdom (ResponsiveContainer fica 0x0). Em vez de
// sumir com o gráfico, o dublê publica os dados e as faixas em atributos — só
// atributos, nada de texto, para não interferir nas asserções por conteúdo.
vi.mock("@/components/ui/chart", async () => {
  const actual =
    await vi.importActual<typeof import("@/components/ui/chart")>("@/components/ui/chart");
  const Passthrough = ({ children }: { children?: React.ReactNode }) => <div>{children}</div>;
  return {
    ...actual,
    ResponsiveContainer: Passthrough,
    BarChart: ({ data, children }: { data?: unknown[]; children?: React.ReactNode }) => (
      <div data-testid="chart" data-rows={JSON.stringify(data ?? [])}>
        {children}
      </div>
    ),
    Bar: ({ dataKey, name }: { dataKey?: string; name?: string }) => (
      <div data-testid="chart-bar" data-key={dataKey} data-name={name} />
    ),
    XAxis: () => null,
    YAxis: () => null,
    CartesianGrid: () => null,
    // O Recharts é quem chama o `formatter` da legenda, com o nome de cada
    // série. Aqui o dublê faz esse papel para uma série conhecida — é assim que
    // o "i" de "Outros proventos" fica ao alcance do teste.
    Legend: ({ formatter }: { formatter?: (v: string) => React.ReactNode }) => (
      <div data-testid="chart-legend">{formatter ? formatter("Outros proventos") : null}</div>
    ),
    AppTooltip: () => null,
  };
});

const mockHolerites = vi.fn();
vi.mock("@/hooks/dp/useDpHolerites", async () => {
  const actual = await vi.importActual<typeof import("@/hooks/dp/useDpHolerites")>(
    "@/hooks/dp/useDpHolerites",
  );
  return { ...actual, useDpHolerites: () => mockHolerites() };
});

const mockCatalogos = vi.fn();
vi.mock("@/contexts/catalogos/useCatalogos", () => ({ useCatalogos: () => mockCatalogos() }));

import { TooltipProvider } from "@/components/ui/tooltip";
import Custos from "@/pages/dp/Custos";

/** A aplicação provê o TooltipProvider em App.tsx; aqui reproduzimos isso. */
const renderPagina = () =>
  render(
    <TooltipProvider>
      <Custos />
    </TooltipProvider>,
  );

/** Linha coerente com a fórmula de custo_total do parser. */
function linha(over: Partial<DpHoleriteRowEnriched> = {}): DpHoleriteRowEnriched {
  const base = {
    id: "h1",
    tipo: "holerite",
    colaborador_id: null,
    cpf: "11122233344",
    competencia: "2026-06",
    nome_lido: "NOME DO ARQUIVO",
    matricula_lida: "",
    cargo_lido: "CARGO DO ARQUIVO",
    centro_custo_nome_lido: "Obra Alfa",
    proventos: 4000,
    descontos: 900,
    liquido: 3100,
    base_inss: 4000,
    inss: 400,
    base_irrf: 3600,
    irrf: 200,
    base_fgts: 4000,
    fgts: 320,
    provisao_13: 333.33,
    inss_provisao_13: 96,
    fgts_provisao_13: 26.67,
    provisao_ferias: 444.44,
    inss_provisao_ferias: 128,
    fgts_provisao_ferias: 35.56,
    inss_empresa: 800,
    rat: 120,
    inss_terceiros: 232,
    salario_base: 3000,
    horas_extras_valor: 400,
    custo_total: 0,
    fator_k: null,
    verbas: [],
    imported_at: "2026-07-01",
    obraResolvida: "Obra Alfa",
    obraResolvidaId: "o1",
    funcaoCadastro: "Pedreiro",
    ...over,
  } as DpHoleriteRowEnriched;

  if (over.custo_total === undefined) {
    base.custo_total =
      base.proventos +
      base.inss_empresa +
      base.rat +
      base.inss_terceiros +
      base.fgts +
      base.provisao_13 +
      base.provisao_ferias +
      base.inss_provisao_13 +
      base.fgts_provisao_13 +
      base.inss_provisao_ferias +
      base.fgts_provisao_ferias;
  }
  return base;
}

const rows = [
  linha(),
  linha({ id: "h2", cpf: "55566677788", nome_lido: "OUTRO ARQUIVO", salario_base: 1850 }),
];

beforeEach(() => {
  mockHolerites.mockReturnValue({
    rows,
    adiantamentos: [],
    getAdiantamento: () => null,
    loading: false,
    reload: vi.fn(),
    competencias: ["2026-06"],
    obras: ["Obra Alfa"],
    cargos: ["Pedreiro"],
  });
  mockCatalogos.mockReturnValue({
    colaboradores: [
      { id: "c1", cpf: "111.222.333-44", nome: "Genivaldo Sousa Lima", funcao: "Pedreiro" },
      { id: "c2", cpf: "555.666.777-88", nome: "Creuza Marinho Batista", funcao: "Servente" },
    ],
    obras: [],
  });
});

/**
 * O card do gráfico "Custo por obra" — localizado pela sua descrição, que é o
 * único texto que não se repete no card da tabela homônima.
 */
function graficoCustoPorObra(): HTMLElement {
  const card = screen.getByText(/Composição empilhada/).closest(".bg-card");
  if (!card) throw new Error("card do gráfico Custo por obra não encontrado");
  return card as HTMLElement;
}

describe("Custo do Colaborador (página fundida)", () => {
  it("mostra o custo total e afirma que a decomposição fecha", () => {
    renderPagina();
    // 2 linhas × 6.535,56... conferido pela mesma fórmula do parser.
    const total = rows.reduce((s, r) => s + r.custo_total, 0);
    expect(total).toBeGreaterThan(0);
    expect(screen.getAllByText("Custo total da empresa").length).toBeGreaterThan(0);
    expect(screen.getByText(/fecha com o custo total/)).toBeInTheDocument();
    expect(screen.queryByText(/verifique a importação/)).not.toBeInTheDocument();
  });

  it("encargos patronais incluem o RAT — a regressão que motivou a fusão", () => {
    renderPagina();
    // 2 × (800 + 120 + 232) = 2.304,00. Sem o RAT daria 2.064,00.
    // O valor aparece no KPI, na legenda da composição e na faixa de
    // reconciliação — os três têm que dizer a mesma coisa.
    expect(screen.getAllByText("R$ 2.304,00").length).toBeGreaterThanOrEqual(3);
    expect(screen.queryByText("R$ 2.064,00")).not.toBeInTheDocument();
  });

  it("usa nome e cargo do cadastro, não o texto lido do holerite", () => {
    renderPagina();
    expect(screen.getAllByText("Genivaldo Sousa Lima").length).toBeGreaterThan(0);
    expect(screen.queryByText("NOME DO ARQUIVO")).not.toBeInTheDocument();
    expect(screen.queryByText("CARGO DO ARQUIVO")).not.toBeInTheDocument();
  });

  it("headcount por obra conta pessoas, não linhas de holerite", () => {
    // Mesma pessoa em duas competências: continua sendo 1 no headcount.
    mockHolerites.mockReturnValue({
      rows: [linha(), linha({ id: "h1b", competencia: "2026-05" })],
      adiantamentos: [],
      getAdiantamento: () => null,
      loading: false,
      reload: vi.fn(),
      competencias: ["2026-06", "2026-05"],
      obras: ["Obra Alfa"],
      cargos: ["Pedreiro"],
    });
    renderPagina();
    const tabela = screen.getAllByRole("table")[0];
    const linhaObra = within(tabela).getByText("Obra Alfa").closest("tr")!;
    expect(within(linhaObra).getAllByRole("cell")[1]).toHaveTextContent("1");
  });

  it("o gráfico por obra separa a hora extra do salário base", () => {
    renderPagina();
    const card = graficoCustoPorObra();
    const faixas = within(card)
      .getAllByTestId("chart-bar")
      .map((b) => [b.getAttribute("data-key"), b.getAttribute("data-name")]);

    expect(faixas).toContainEqual(["salario", "Salário base"]);
    expect(faixas).toContainEqual(["he", "Horas extras"]);
    // A faixa somada de antes tem que sumir: convivendo com a nova, a hora
    // extra apareceria duas vezes na mesma pilha.
    expect(faixas.map(([, nome]) => nome)).not.toContain("Salário + HE + outros");

    // 2 × 400 de HE, fora dos 3.000 + 1.850 de salário base.
    const [obra] = JSON.parse(within(card).getByTestId("chart").getAttribute("data-rows")!);
    expect(obra.he).toBeCloseTo(800, 2);
    expect(obra.salario).toBeCloseTo(4850, 2);
    // Separar não pode mudar a altura da barra: as faixas continuam somando o
    // custo total da obra.
    const total = rows.reduce((s, r) => s + r.custo_total, 0);
    expect(obra.salario + obra.he + obra.outros + obra.encargos + obra.provisoes).toBeCloseTo(
      total,
      2,
    );
  });

  it("faixa sem valor no recorte não entra na legenda do gráfico por obra", () => {
    mockHolerites.mockReturnValue({
      rows: [linha({ horas_extras_valor: 0, proventos: 3000, salario_base: 3000 })],
      adiantamentos: [],
      getAdiantamento: () => null,
      loading: false,
      reload: vi.fn(),
      competencias: ["2026-06"],
      obras: ["Obra Alfa"],
      cargos: ["Pedreiro"],
    });
    renderPagina();
    const nomes = within(graficoCustoPorObra())
      .getAllByTestId("chart-bar")
      .map((b) => b.getAttribute("data-name"));
    expect(nomes).toContain("Salário base");
    expect(nomes).not.toContain("Horas extras");
  });

  it("'Outros proventos' tem o 'i' de ajuda nas duas legendas", () => {
    const { container } = renderPagina();
    const ajuda = '[aria-label="O que entra em Outros proventos"]';

    // Legenda da composição do custo (lista própria da página).
    const composicao = screen.getByText(/Onde cada real vai/).closest(".bg-card")!;
    expect(composicao.querySelectorAll(ajuda)).toHaveLength(1);
    // Só essa parcela ganha o "i" — as outras se explicam ou já têm no KPI.
    expect(composicao.querySelectorAll("[aria-label^='O que entra em']")).toHaveLength(1);

    // Legenda do gráfico por obra (desenhada pelo Recharts).
    const porObra = within(graficoCustoPorObra()).getByTestId("chart-legend");
    expect(porObra.querySelector(ajuda)).toBeInTheDocument();

    // Mesmo texto nos dois lugares: um só `COMPOSICAO_INFO.outros`.
    const dicas = container.querySelectorAll(ajuda);
    expect(dicas).toHaveLength(2);
  });

  it("clicar num KPI abre o detalhamento com quem compõe o número", () => {
    renderPagina();
    fireEvent.click(screen.getByRole("button", { name: /Encargos patronais/ }));
    const dialogo = screen.getByRole("dialog");
    expect(within(dialogo).getByText(/Encargos patronais/)).toBeInTheDocument();
    expect(within(dialogo).getByText("Genivaldo Sousa Lima")).toBeInTheDocument();
    expect(within(dialogo).getByText("Creuza Marinho Batista")).toBeInTheDocument();
  });

  it("a visão do colaborador começa recolhida e abre sob demanda", () => {
    renderPagina();
    expect(screen.queryByText("Adiantamento (dia 20)")).not.toBeInTheDocument();
    fireEvent.click(screen.getByText("Visão do colaborador"));
    expect(screen.getByText("Adiantamento (dia 20)")).toBeInTheDocument();
  });

  it("sem holerite nem adiantamento, oferece a importação", () => {
    mockHolerites.mockReturnValue({
      rows: [],
      adiantamentos: [],
      getAdiantamento: () => null,
      loading: false,
      reload: vi.fn(),
      competencias: [],
      obras: [],
      cargos: [],
    });
    renderPagina();
    expect(screen.getByText(/Nenhum holerite ou adiantamento importado/)).toBeInTheDocument();
    expect(screen.getAllByTestId(IMPORT_DIALOG).length).toBeGreaterThan(0);
  });
});
