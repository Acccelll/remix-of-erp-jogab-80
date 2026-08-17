import { describe, it, expect } from "vitest";
import {
  diasExposicao,
  desagio,
  taxaPeriodo,
  taxaMensalEquivalente,
  taxaAnualEquivalente,
  custoEfetivoTotal,
  prazoMedioPonderado,
  ratearPorTitulo,
  custoCarteira,
  comparativoOperadores,
} from "../calculo";

describe("antecipacao/calculo", () => {
  it("diasExposicao entre datas ISO", () => {
    expect(diasExposicao("2026-03-19", "2026-04-09")).toBe(21);
    expect(diasExposicao("2026-03-19", "2026-06-09")).toBe(82);
  });

  it("deságio = face - líquido em centavos exatos", () => {
    expect(desagio(85029.81, 83928.45)).toBeCloseTo(1101.36, 2);
  });

  it("taxa a.m. caso real (face 85.029,81 / líq 83.928,45 / 21 dias)", () => {
    const d = desagio(85029.81, 83928.45);
    const tp = taxaPeriodo(d, 85029.81)!;
    const tam = taxaMensalEquivalente(tp, 21)!;
    // deságio ~1,295% em 21 dias → ~1,85% a.m.
    expect(tam * 100).toBeGreaterThan(1.7);
    expect(tam * 100).toBeLessThan(2.0);
  });

  it("taxa anual equivalente coerente", () => {
    const taa = taxaAnualEquivalente(0.01, 30)!;
    expect(taa).toBeGreaterThan(0.12);
    expect(taa).toBeLessThan(0.14);
  });

  it("guardas: dias <= 0 → null; face 0 → taxa 0", () => {
    expect(taxaMensalEquivalente(0.01, 0)).toBeNull();
    expect(taxaAnualEquivalente(0.01, -3)).toBeNull();
    expect(taxaPeriodo(10, 0)).toBe(0);
  });

  it("custoEfetivoTotal soma custo total sobre face", () => {
    const r = custoEfetivoTotal({ valorFace: 1000, desagio: 20, iof: 5, tarifas: 5 });
    expect(r.valorLiquidoEfetivo).toBeCloseTo(970, 2);
    expect(r.cetPeriodo).toBeCloseTo(0.03, 6);
  });

  it("prazoMedioPonderado por valor de face", () => {
    const pmp = prazoMedioPonderado([
      { valorFace: 100, dias: 30 },
      { valorFace: 300, dias: 60 },
    ]);
    // (100*30 + 300*60)/400 = 52.5
    expect(pmp).toBeCloseTo(52.5, 4);
  });

  it("ratearPorTitulo fecha exato em centavos (100,00 entre 3 iguais)", () => {
    const parts = ratearPorTitulo(100, [
      { id: "a", valorFace: 33.33 },
      { id: "b", valorFace: 33.33 },
      { id: "c", valorFace: 33.33 },
    ]);
    const soma = parts.reduce((a, p) => a + p.valor, 0);
    expect(Math.round(soma * 100)).toBe(10000);
  });

  it("ratearPorTitulo sem face distribui igualmente", () => {
    const parts = ratearPorTitulo(10, [
      { id: "a", valorFace: 0 },
      { id: "b", valorFace: 0 },
      { id: "c", valorFace: 0 },
    ]);
    expect(parts.reduce((a, p) => a + p.valor, 0)).toBeCloseTo(10, 2);
  });

  it("custoCarteira agrega deságio/IOF/tarifas e cet ponderado", () => {
    const c = custoCarteira([
      { valorFaceTotal: 1000, desagioTotal: 20, iof: 5, tarifas: 0, diasExposicaoPonderado: 30 },
      { valorFaceTotal: 2000, desagioTotal: 30, iof: 10, tarifas: 0, diasExposicaoPonderado: 60 },
    ]);
    expect(c.desagioTotal).toBeCloseTo(50, 2);
    expect(c.iofTotal).toBeCloseTo(15, 2);
    expect(c.cetMedioPonderado).toBeCloseTo(65 / 3000, 6);
  });

  it("comparativoOperadores agrupa e calcula taxa média ponderada", () => {
    const cmp = comparativoOperadores([
      { operadorId: "TRUST", valorFaceTotal: 1000, desagioTotal: 10, iof: 0, tarifas: 0, diasExposicaoPonderado: 30 },
      { operadorId: "TRUST", valorFaceTotal: 2000, desagioTotal: 25, iof: 0, tarifas: 0, diasExposicaoPonderado: 30 },
      { operadorId: "BLACK", valorFaceTotal: 500, desagioTotal: 8, iof: 0, tarifas: 0, diasExposicaoPonderado: 30 },
    ]);
    const trust = cmp.find((c) => c.operadorId === "TRUST")!;
    expect(trust.operacoes).toBe(2);
    expect(trust.volume).toBeCloseTo(3000, 2);
    expect(trust.taxaMediaAm).not.toBeNull();
  });
});
