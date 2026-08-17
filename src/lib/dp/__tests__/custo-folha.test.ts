import { describe, it, expect } from "vitest";
import {
  agregarCusto,
  encargosPatronais,
  outrosProventos,
  provisoesTotais,
  reconcilia,
  residuoReconciliacao,
  fatorKDe,
  PARCELAS_CUSTO,
  type LinhaCusto,
} from "@/lib/dp/custo-folha";

/**
 * Constrói uma linha coerente com a fórmula de `custo_total` do parser, para
 * que o teste valide a agregação e não uma fixture inventada.
 */
function linha(over: Partial<LinhaCusto> = {}): LinhaCusto {
  const base: LinhaCusto = {
    proventos: 4000,
    salario_base: 3000,
    horas_extras_valor: 400,
    inss_empresa: 800,
    rat: 120,
    inss_terceiros: 232,
    fgts: 320,
    provisao_13: 333.33,
    provisao_ferias: 444.44,
    inss_provisao_13: 96,
    fgts_provisao_13: 26.67,
    inss_provisao_ferias: 128,
    fgts_provisao_ferias: 35.56,
    custo_total: 0,
    ...over,
  };
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

describe("custo-folha · reconciliação", () => {
  it("as parcelas exibidas somam exatamente o custo total", () => {
    const rows = [
      linha(),
      linha({ salario_base: 1850, proventos: 2100, horas_extras_valor: 250 }),
      linha({ salario_base: 12500, proventos: 12500, horas_extras_valor: 0 }),
    ];
    expect(residuoReconciliacao(rows)).toBeCloseTo(0, 6);
    expect(reconcilia(rows)).toBe(true);
  });

  it("inclui o RAT nos encargos — a soma quebraria sem ele", () => {
    const rows = [linha({ rat: 120 })];
    const a = agregarCusto(rows);

    expect(a.encargos).toBe(800 + 120 + 232);

    // Regressão da Folha de Pagamento antiga: encargos sem RAT deixavam um
    // buraco do tamanho exato do RAT entre os KPIs e o custo total.
    const encargosSemRat = rows[0].inss_empresa + rows[0].inss_terceiros;
    const somaErrada = a.salarioBase + a.he + a.outros + encargosSemRat + a.fgts + a.provisoes;
    expect(a.custoTotal - somaErrada).toBeCloseTo(120, 6);
  });

  it("PARCELAS_CUSTO reproduz o custo total linha a linha", () => {
    const rows = [linha(), linha({ horas_extras_valor: 0, proventos: 3000 })];
    for (const r of rows) {
      const soma = PARCELAS_CUSTO.reduce((s, p) => s + p.valor(r), 0);
      expect(soma).toBeCloseTo(r.custo_total, 6);
    }
  });

  it("continua fechando quando não há hora extra nem outros proventos", () => {
    const rows = [linha({ proventos: 3000, salario_base: 3000, horas_extras_valor: 0 })];
    const a = agregarCusto(rows);
    expect(a.he).toBe(0);
    expect(a.outros).toBe(0);
    expect(residuoReconciliacao(rows)).toBeCloseTo(0, 6);
  });
});

describe("custo-folha · parcelas", () => {
  it("outros proventos exclui salário base e hora extra", () => {
    expect(
      outrosProventos(linha({ proventos: 4000, salario_base: 3000, horas_extras_valor: 400 })),
    ).toBe(600);
  });

  it("outros proventos não fica negativo quando proventos < salário base", () => {
    // Afastamento no meio da competência: a verba 001 é maior que o pago.
    expect(
      outrosProventos(linha({ proventos: 1200, salario_base: 3000, horas_extras_valor: 0 })),
    ).toBe(0);
  });

  it("provisões incluem os encargos que incidem sobre elas", () => {
    const r = linha();
    expect(provisoesTotais(r)).toBeCloseTo(333.33 + 444.44 + 96 + 26.67 + 128 + 35.56, 6);
  });

  it("encargos somam INSS empresa, RAT e terceiros", () => {
    expect(encargosPatronais(linha({ inss_empresa: 100, rat: 15, inss_terceiros: 29 }))).toBe(144);
  });
});

describe("custo-folha · fator K", () => {
  it("pondera pela folha em vez de tirar a média dos K individuais", () => {
    // Um salário alto com K baixo e um baixo com K alto: a média aritmética
    // dos K daria 1,75; o ponderado tem que puxar para o salário maior.
    const rows = [
      linha({ salario_base: 10000, proventos: 10000, horas_extras_valor: 0, custo_total: 15000 }),
      linha({ salario_base: 1000, proventos: 1000, horas_extras_valor: 0, custo_total: 2000 }),
    ];
    const a = agregarCusto(rows);
    expect(a.fatorK).toBeCloseTo(17000 / 11000, 6);

    const mediaAritmetica = (15000 / 10000 + 2000 / 1000) / 2;
    expect(a.fatorK).not.toBeCloseTo(mediaAritmetica, 2);
  });

  it("devolve zero para conjunto vazio e null para linha sem salário base", () => {
    expect(agregarCusto([]).fatorK).toBe(0);
    expect(fatorKDe(0, 500)).toBeNull();
    expect(fatorKDe(1000, 1800)).toBeCloseTo(1.8, 6);
  });
});
