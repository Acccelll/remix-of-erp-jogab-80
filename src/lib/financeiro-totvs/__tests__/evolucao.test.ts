import { describe, expect, it } from "vitest";
import {
  agingAVencer,
  agingVencidos,
  evolucaoPorNatureza,
  serieTemporal,
  variacao,
  variacaoPorNatureza,
  type RollupLinha,
} from "../evolucao";
import { prepararHistorico } from "@/components/financeiro/dividas/EvolucaoEndividamentoCard";

const OBRA_A = "11111111-1111-1111-1111-111111111111";
const OBRA_B = "22222222-2222-2222-2222-222222222222";

function l(
  data: string,
  status: number,
  valor_aberto: number,
  valor_pago: number,
  extra: Partial<RollupLinha> = {},
): RollupLinha {
  return {
    data_snapshot: data,
    obra_id: OBRA_A,
    status_cod: status,
    status_label: null,
    grupo: "2",
    cod_natureza: "2.01.010",
    desc_natureza: "Materiais",
    valor_aberto,
    valor_pago,
    qtd_titulos: 1,
    ...extra,
  };
}

describe("serieTemporal", () => {
  const rollup: RollupLinha[] = [
    l("2026-01-01", 40, 1000, 0),
    l("2026-01-01", 56, 500, 0),
    l("2026-01-01", 3, 0, 200),
    l("2026-02-01", 40, 1200, 0),
    l("2026-02-01", 56, 300, 0),
    l("2026-02-01", 3, 0, 500),
    // cancelado é ignorado
    l("2026-02-01", 18, 9999, 9999),
    // outra obra
    l("2026-02-01", 40, 50, 0, { obra_id: OBRA_B }),
  ];

  it("agrega vencido / a vencer / pago por data e ignora cancelados", () => {
    const s = serieTemporal(rollup);
    expect(s).toEqual([
      { data: "2026-01-01", valor_vencido: 1000, valor_a_vencer: 500, valor_pago: 200 },
      { data: "2026-02-01", valor_vencido: 1250, valor_a_vencer: 300, valor_pago: 500 },
    ]);
  });

  it("filtra por obra", () => {
    const s = serieTemporal(rollup, { obraId: OBRA_B });
    expect(s).toEqual([
      { data: "2026-02-01", valor_vencido: 50, valor_a_vencer: 0, valor_pago: 0 },
    ]);
  });

  it("soma das obras bate com total da empresa", () => {
    const total = serieTemporal(rollup);
    const a = serieTemporal(rollup, { obraId: OBRA_A });
    const b = serieTemporal(rollup, { obraId: OBRA_B });
    const fev = total.find((p) => p.data === "2026-02-01")!;
    const aFev = a.find((p) => p.data === "2026-02-01")!;
    const bFev = b.find((p) => p.data === "2026-02-01")!;
    expect(fev.valor_vencido).toBeCloseTo(aFev.valor_vencido + bFev.valor_vencido, 2);
  });
});

describe("prepararHistorico", () => {
  it("mantém todas as datas de referência, inclusive no mesmo mês", () => {
    const historico = prepararHistorico([
      { data: "2026-07-28", valor_vencido: 200, valor_a_vencer: 300, valor_pago: 0 },
      { data: "2026-07-13", valor_vencido: 100, valor_a_vencer: 400, valor_pago: 0 },
    ]);

    expect(historico.map((p) => p.data)).toEqual(["2026-07-13", "2026-07-28"]);
  });
});

describe("evolucaoPorNatureza", () => {
  const rollup: RollupLinha[] = [
    l("2026-01-01", 40, 100, 0, { cod_natureza: "2.01.010", desc_natureza: "Materiais" }),
    l("2026-02-01", 40, 250, 0, { cod_natureza: "2.01.010", desc_natureza: "Materiais" }),
    l("2026-01-01", 40, 30, 0, { cod_natureza: "2.02.020", desc_natureza: "Solda" }),
    l("2026-02-01", 40, 25, 0, { cod_natureza: "2.02.020", desc_natureza: "Solda" }),
    l("2026-02-01", 18, 9999, 0), // cancelado
  ];
  it("retorna uma série por natureza ordenada por data", () => {
    const s = evolucaoPorNatureza(rollup);
    expect(s).toHaveLength(2);
    const mat = s.find((x) => x.cod_natureza === "2.01.010")!;
    expect(mat.pontos.map((p) => p.valor_aberto)).toEqual([100, 250]);
  });
});

describe("variacao", () => {
  it("retorna delta e pct entre os dois últimos pontos do total", () => {
    const v = variacao([
      { data: "2026-01-01", valor_vencido: 100, valor_a_vencer: 100, valor_pago: 0 },
      { data: "2026-02-01", valor_vencido: 220, valor_a_vencer: 80, valor_pago: 0 },
    ]);
    expect(v).toEqual({ anterior: 200, atual: 300, delta: 100, pct: 50 });
  });
  it("retorna null com menos de 2 pontos", () => {
    expect(variacao([])).toBeNull();
  });
  it("pct é null quando anterior é 0", () => {
    const v = variacao([
      { data: "2026-01-01", valor_vencido: 0, valor_a_vencer: 0, valor_pago: 0 },
      { data: "2026-02-01", valor_vencido: 50, valor_a_vencer: 0, valor_pago: 0 },
    ]);
    expect(v?.pct).toBeNull();
    expect(v?.delta).toBe(50);
  });
});

describe("variacaoPorNatureza", () => {
  it("ordena pela maior variação absoluta", () => {
    const series = evolucaoPorNatureza([
      l("2026-01-01", 40, 100, 0, { cod_natureza: "A" }),
      l("2026-02-01", 40, 500, 0, { cod_natureza: "A" }),
      l("2026-01-01", 40, 100, 0, { cod_natureza: "B" }),
      l("2026-02-01", 40, 50, 0, { cod_natureza: "B" }),
    ]);
    const v = variacaoPorNatureza(series);
    expect(v[0].cod_natureza).toBe("A");
    expect(v[0].delta).toBe(400);
    expect(v[1].cod_natureza).toBe("B");
    expect(v[1].delta).toBe(-50);
  });
});

describe("agingVencidos", () => {
  it("distribui em faixas e ignora não vencidos", () => {
    const r = agingVencidos([
      { status_cod: 40, dias_atraso: 5, valor: 100 },
      { status_cod: 40, dias_atraso: 30, valor: 50 },
      { status_cod: 40, dias_atraso: 45, valor: 200 },
      { status_cod: 40, dias_atraso: 200, valor: 800 },
      { status_cod: 56, dias_atraso: 100, valor: 9999 }, // ignorado
      { status_cod: 40, dias_atraso: 0, valor: 10 }, // ignorado (dias<1)
    ]);
    const idx = (faixa: string) => r.find((f) => f.faixa === faixa)!;
    expect(idx("1-30").valor).toBe(150);
    expect(idx("1-30").titulos).toBe(2);
    expect(idx("31-60").valor).toBe(200);
    expect(idx("61-90").titulos).toBe(0);
    expect(idx("180+").valor).toBe(800);
    // ordem
    expect(r.map((f) => f.faixa)).toEqual(["1-30", "31-60", "61-90", "91-180", "180+"]);
  });

  it("conta baixa parcial vencida (status 15) quando o bucket diz vencido", () => {
    // O TOTVS mantém o código 15 (baixa parcial) mesmo depois do vencimento.
    // Sem o bucket, esse título sumia do aging — era o furo do KPI "Vencido".
    const r = agingVencidos([
      { status_cod: 15, dias_atraso: 45, valor: 300, bucket: "vencido" },
      { status_cod: 15, dias_atraso: 5, valor: 120, bucket: "vencido" },
    ]);
    const faixa = (f: string) => r.find((x) => x.faixa === f)!;
    expect(faixa("1-30")).toMatchObject({ titulos: 1, valor: 120 });
    expect(faixa("31-60")).toMatchObject({ titulos: 1, valor: 300 });
  });

  it("bucket tem precedência sobre o status_cod do TOTVS", () => {
    const r = agingVencidos([
      // status diz vencido, bucket diz pago -> fora do aging
      { status_cod: 40, dias_atraso: 10, valor: 999, bucket: "pago" },
      // status diz a vencer, bucket diz vencido -> dentro
      { status_cod: 56, dias_atraso: 10, valor: 70, bucket: "vencido" },
    ]);
    expect(r.find((f) => f.faixa === "1-30")).toMatchObject({ titulos: 1, valor: 70 });
  });

  it("sem bucket, mantém o comportamento antigo por status_cod", () => {
    const r = agingVencidos([
      { status_cod: 15, dias_atraso: 45, valor: 300 },
      { status_cod: 40, dias_atraso: 45, valor: 25 },
    ]);
    expect(r.find((f) => f.faixa === "31-60")).toMatchObject({ titulos: 1, valor: 25 });
  });
});

describe("agingAVencer", () => {
  const HOJE = "2026-07-15";

  it("usa o bucket para decidir o que é futuro", () => {
    const r = agingAVencer(
      [
        { status_cod: 15, data_vencimento: "2026-07-20", valor: 500, bucket: "avencer" },
        { status_cod: 29, data_vencimento: HOJE, valor: 80, bucket: "hoje" },
        // status diz a vencer, mas o bucket já classificou como vencido
        { status_cod: 56, data_vencimento: "2026-07-20", valor: 999, bucket: "vencido" },
      ],
      HOJE,
    );
    const faixa = (f: string) => r.find((x) => x.faixa === f)!;
    expect(faixa("Vence hoje")).toMatchObject({ titulos: 1, valor: 80 });
    expect(faixa("1-7")).toMatchObject({ titulos: 1, valor: 500 });
  });

  it("sem bucket, mantém o comportamento antigo por status_cod", () => {
    const r = agingAVencer(
      [
        { status_cod: 56, data_vencimento: "2026-07-20", valor: 500 },
        { status_cod: 15, data_vencimento: "2026-07-20", valor: 999 },
      ],
      HOJE,
    );
    expect(r.find((f) => f.faixa === "1-7")).toMatchObject({ titulos: 1, valor: 500 });
  });
});
