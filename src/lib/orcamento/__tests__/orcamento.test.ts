import { describe, it, expect } from "vitest";
import {
  custoUnitarioComposicao,
  valorItemOrcamento,
  custoAtividade,
  curvaABC,
} from "../orcamento";

describe("custoUnitarioComposicao", () => {
  it("soma coeficiente × preço de múltiplos insumos", () => {
    expect(
      custoUnitarioComposicao([
        { coeficiente: 1.5, preco_unitario: 10 }, // 15
        { coeficiente: 0.25, preco_unitario: 80 }, // 20
        { coeficiente: 2, preco_unitario: 3.5 }, // 7
      ]),
    ).toBe(42);
  });

  it("arredonda a 4 casas", () => {
    expect(custoUnitarioComposicao([{ coeficiente: 0.333333, preco_unitario: 1 }])).toBe(0.3333);
  });

  it("lista vazia → 0", () => {
    expect(custoUnitarioComposicao([])).toBe(0);
  });
});

describe("valorItemOrcamento", () => {
  it("multiplica e arredonda a 2 casas (R$)", () => {
    expect(valorItemOrcamento(3.333, 10)).toBe(33.33);
    expect(valorItemOrcamento(2.5, 4.5)).toBe(11.25);
  });
  it("zero ou null → 0", () => {
    expect(valorItemOrcamento(0, 100)).toBe(0);
    expect(valorItemOrcamento(null as unknown as number, null as unknown as number)).toBe(0);
  });
});

describe("custoAtividade", () => {
  it("soma valor_total das linhas", () => {
    expect(
      custoAtividade([{ valor_total: 100.5 }, { valor_total: 50.25 }, { valor_total: 0.25 }]),
    ).toBe(151);
  });
  it("lista vazia → 0", () => {
    expect(custoAtividade([])).toBe(0);
  });
});

describe("curvaABC", () => {
  it("lista vazia → []", () => {
    expect(curvaABC([])).toEqual([]);
  });

  it("um único insumo com 100% acumulado vira C pelo limiar (≤95% B, resto C)", () => {
    const r = curvaABC([{ insumo_id: "x", descricao: "X", valor: 100 }]);
    expect(r).toHaveLength(1);
    expect(r[0].pct).toBe(1);
    expect(r[0].acumulado).toBe(1);
    expect(r[0].classe).toBe("C");
  });

  it("ordena decrescente e classifica A/B/C nas fronteiras 80/95", () => {
    // total = 100. A até 80 (cum), B até 95, C resto
    const r = curvaABC([
      { insumo_id: "c", descricao: "C", valor: 5 },
      { insumo_id: "a", descricao: "A", valor: 80 },
      { insumo_id: "b", descricao: "B", valor: 15 },
    ]);
    expect(r.map((x) => x.insumo_id)).toEqual(["a", "b", "c"]);
    expect(r[0].classe).toBe("A"); // 80% acumulado → A
    expect(r[1].classe).toBe("B"); // 95% acumulado → B
    expect(r[2].classe).toBe("C"); // 100% → C
  });

  it("total zero → todos A com pct 0", () => {
    const r = curvaABC([
      { insumo_id: "a", descricao: "A", valor: 0 },
      { insumo_id: "b", descricao: "B", valor: 0 },
    ]);
    expect(r.every((x) => x.classe === "A" && x.pct === 0 && x.acumulado === 0)).toBe(true);
  });

  it("[60,30,7,3] → A,B,C,C pela regra ≤80 / ≤95", () => {
    const r = curvaABC([
      { insumo_id: "1", descricao: "1", valor: 60 },
      { insumo_id: "2", descricao: "2", valor: 30 },
      { insumo_id: "3", descricao: "3", valor: 7 },
      { insumo_id: "4", descricao: "4", valor: 3 },
    ]);
    expect(r[0].classe).toBe("A"); // acc=0.60
    expect(r[1].classe).toBe("B"); // acc=0.90
    expect(r[2].classe).toBe("C"); // acc=0.97
    expect(r[3].classe).toBe("C"); // acc=1.00
  });
});
