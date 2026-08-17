import { describe, it, expect } from "vitest";
import { valorTotalItem } from "@/lib/bms/valor-item";

describe("valorTotalItem", () => {
  it("aplica fatorVenda quando há custo", () => {
    // contrato 1000, antec 200 → base 800, fator 0.8 → custo 100 vira 80
    expect(valorTotalItem({ custo: 100, valorContrato: 1000, valorAntecipacao: 200 })).toBeCloseTo(
      80,
      6,
    );
  });
  it("usa percentual quando custo é zero", () => {
    // 10% de 800 = 80
    expect(
      valorTotalItem({
        custo: 0,
        percentualPrevisto: 10,
        valorContrato: 1000,
        valorAntecipacao: 200,
      }),
    ).toBeCloseTo(80, 6);
  });
  it("retorna 0 quando sem custo nem percentual", () => {
    expect(valorTotalItem({ custo: 0, valorContrato: 1000, valorAntecipacao: 0 })).toBe(0);
  });
  it("não estoura quando contrato é zero", () => {
    expect(valorTotalItem({ custo: 100, valorContrato: 0, valorAntecipacao: 0 })).toBe(100);
  });
});
