import { describe, it, expect } from "vitest";
import {
  calcularBAC,
  calcularPV,
  calcularEV,
  calcularAC,
  calcularEVM,
  curvaPVMensal,
  calcularEarnedSchedule,
  classificarIndice,
  type EvmItemCrono,
} from "@/lib/pmbok/evm";
import { construirAcReal } from "@/lib/pmbok/ac-totvs";

function item(o: Partial<EvmItemCrono>): EvmItemCrono {
  return {
    custo: 1000,
    custo_baseline: null,
    percentual_previsto: 0,
    percentual_realizado: 0,
    data_inicio: "2025-01-01",
    data_fim: "2025-03-31",
    data_inicio_baseline: null,
    data_fim_baseline: null,
    ativo: true,
    ...o,
  };
}

describe("EVM — básicos", () => {
  it("BAC soma custo_baseline (fallback custo)", () => {
    expect(
      calcularBAC([
        item({ custo: 100 }),
        item({ custo: 200, custo_baseline: 250 }),
        item({ custo: 300, ativo: false }), // ignorado
      ]),
    ).toBe(350);
  });

  it("EV = custo × %realizado", () => {
    expect(
      calcularEV([
        item({ custo: 1000, percentual_realizado: 50 }),
        item({ custo: 500, percentual_realizado: 100 }),
      ]),
    ).toBe(1000);
  });

  it("PV usa fração linear pela janela do item", () => {
    const it = item({ custo: 1000, data_inicio: "2025-01-01", data_fim: "2025-12-31" });
    const pv = calcularPV([it], new Date("2025-07-01"));
    expect(pv).toBeGreaterThan(400);
    expect(pv).toBeLessThan(600);
  });

  it("classificarIndice: 1.0 bom, 0.95 alerta, 0.5 crítico", () => {
    expect(classificarIndice(1.0)).toBe("bom");
    expect(classificarIndice(0.95)).toBe("alerta");
    expect(classificarIndice(0.5)).toBe("critico");
  });
});

describe("EVM — AC real vs fallback", () => {
  it("usa TOTVS quando há dados (fonteAC = totvs)", () => {
    const r = calcularEVM({
      itens: [item({ custo: 1000, percentual_realizado: 50 })],
      dataRef: new Date("2025-06-01"),
      acReal: {
        porMes: [
          { mes: "2025-03", valor: 200 },
          { mes: "2025-05", valor: 300 },
        ],
        total: 500,
      },
    });
    expect(r.fonteAC).toBe("totvs");
    expect(r.AC).toBe(500);
    expect(r.CV).toBe(0); // EV=500, AC=500
    expect(r.CPI).toBe(1);
  });

  it("cai para fallback de medições quando sem TOTVS", () => {
    const r = calcularEVM({
      itens: [item({ custo: 1000, percentual_realizado: 50 })],
      dataRef: new Date("2025-06-01"),
      medicoesFallback: [
        { status: "aprovada", valor: 300 },
        { status: "rascunho", valor: 999 }, // ignorada
        { status: "faturada", valor: 100 },
      ],
    });
    expect(r.fonteAC).toBe("estimado_medicoes");
    expect(r.AC).toBe(400);
  });

  it("ignora meses futuros do AC TOTVS", () => {
    const { ac, fonte } = calcularAC(
      {
        porMes: [
          { mes: "2025-01", valor: 100 },
          { mes: "2025-12", valor: 500 },
        ],
        total: 600,
      },
      null,
      new Date("2025-06-01"),
    );
    expect(fonte).toBe("totvs");
    expect(ac).toBe(100);
  });
});

describe("EVM — projeções e TCPI", () => {
  it("EACs e TCPI em obra com CPI<1", () => {
    const r = calcularEVM({
      itens: [item({ custo: 1000, percentual_realizado: 50 })],
      dataRef: new Date("2025-06-01"),
      acReal: { porMes: [{ mes: "2025-05", valor: 600 }], total: 600 },
    });
    // EV=500, AC=600 → CPI≈0.833
    expect(r.CPI).toBeCloseTo(0.833, 2);
    expect(r.EAC_cpi).toBeGreaterThan(r.BAC);
    expect(r.EAC_otimista).toBe(1100); // 600 + (1000-500)
    expect(r.VAC).toBeLessThan(0);
    // TCPI = (BAC-EV)/(BAC-AC) = 500/400 = 1.25
    expect(r.TCPI).toBeCloseTo(1.25, 2);
  });

  it("índices retornam 0 sob divisão por zero", () => {
    const r = calcularEVM({
      itens: [item({ custo: 0 })],
      dataRef: new Date("2025-06-01"),
    });
    expect(r.SPI).toBe(0);
    expect(r.CPI).toBe(0);
  });
});

describe("Earned Schedule", () => {
  it("SV(t) negativo em obra atrasada (e SV em R$ pequeno perto do fim)", () => {
    // Projeto 4 meses, baseline 1000, % realizado=80 no mês 4 → atrasado
    const itens = [
      item({
        custo: 1000,
        percentual_realizado: 80,
        data_inicio: "2025-01-01",
        data_fim: "2025-04-30",
      }),
    ];
    const r = calcularEVM({ itens, dataRef: new Date("2025-05-01") });
    expect(r.SVt_meses).toBeLessThan(0);
    expect(r.SPIt).toBeLessThan(1);
  });

  it("curvaPVMensal cresce monotonicamente", () => {
    const itens = [item({ custo: 1000, data_inicio: "2025-01-01", data_fim: "2025-04-30" })];
    const c = curvaPVMensal(itens);
    expect(c.length).toBe(4);
    for (let i = 1; i < c.length; i++) {
      expect(c[i].pvAcum).toBeGreaterThanOrEqual(c[i - 1].pvAcum);
    }
    expect(c[c.length - 1].pvAcum).toBeCloseTo(1000, 0);
  });

  it("ES vazio quando EV = 0", () => {
    const r = calcularEarnedSchedule([{ mes: "2025-01", pvAcum: 100 }], 0, new Date("2025-01-15"));
    expect(r.ES_meses).toBe(0);
    expect(r.SPIt).toBe(0);
  });
});

describe("construirAcReal (TOTVS → AC)", () => {
  it("soma grupo 2 por mes_competencia usando valor_rateio", () => {
    const r = construirAcReal([
      { grupo: "2", mes_competencia: "2025-03-01", valor_rateio: 100, status_cod: 3 } as any,
      { grupo: "2", mes_competencia: "2025-03-15", valor_rateio: 50, status_cod: 3 } as any,
      { grupo: "2", mes_competencia: "2025-04-01", valor_rateio: 200, status_cod: 3 } as any,
      { grupo: "3", mes_competencia: "2025-03-01", valor_rateio: 9999, status_cod: 3 } as any, // mov: excluído
      { grupo: "2", mes_competencia: "2025-03-01", valor_rateio: 999, status_cod: 18 } as any, // cancelado
    ]);
    expect(r.total).toBe(350);
    expect(r.porMes).toEqual([
      { mes: "2025-03", valor: 150 },
      { mes: "2025-04", valor: 200 },
    ]);
  });

  it("vazio quando sem linhas relevantes", () => {
    expect(construirAcReal([]).total).toBe(0);
    expect(construirAcReal([{ grupo: "1", valor_rateio: 100 } as any]).total).toBe(0);
  });
});
